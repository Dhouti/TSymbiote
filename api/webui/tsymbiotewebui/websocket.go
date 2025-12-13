package tsymbiotewebui

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/gorilla/websocket"
)

// RelativeWebsocket routes to
func (t *TSymbioteUIServer) RelativeWebsocket(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	var targetPath string
	for _, path := range paths.Paths() {
		// Check for a substring match and set targetPath to the adapter version
		if strings.Contains(r.URL.Path, path.String()) {
			targetPath = path.Adapter()
			r.WS.Close()
			break
		}
	}

	if targetPath == "" {
		r.Log.Error("unable to find path for adapter")
		r.WS.Close()
		return
	}

	urlparams := r.URL.Query()
	rawTargets := urlparams.Get("hosts")
	if rawTargets == "" {
		r.Log.Error("failed to find host query param, closing")
		r.WS.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(consts.WSWriteTimeout))
		time.Sleep(time.Millisecond * 100)
		r.WS.Close()
		return
	}

	// the url param should be csv
	targets := strings.Split(rawTargets, ",")

	if len(targets) == 0 {
		r.Log.Error("zero targets provided, closing")
		r.WS.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(consts.WSWriteTimeout))
		time.Sleep(time.Millisecond * 100)
		r.WS.Close()
	}

	// Make a buffered channel the size of the amount of targets we have.
	msg := make(chan tsymbiote.WebsocketMessage, len(targets))
	// slice of funcs we're going to start after loop
	readerFuncs := make([]tsymbiote.WebsocketFunc, 0, len(targets))
	// map of websocket connections we're going to close in the event of client socket death
	adapterConns := map[string]*websocket.Conn{}
	// Channel for tracking death of adapters
	dead := make(chan string, len(targets))

	for _, target := range targets {

		// Get translated hostname
		adapterHost, ok := t.GetAdapter(target)
		if !ok || adapterHost == "" {
			r.Log.Errorw("failed to find adatpter for host", "host", adapterHost)
			return
		}

		url := url.URL{Scheme: "ws", Host: fmt.Sprintf("%s:3621", adapterHost), Path: targetPath}
		wsDialer := &websocket.Dialer{
			HandshakeTimeout: 45 * time.Second,
			NetDial: func(network string, address string) (net.Conn, error) {
				return t.TSNet().Dial(r.Context(), network, address)
			},
		}

		// Propagate trace-id to downstream websockets.
		traceHeaders := http.Header{}
		traceHeaders.Set("trace-id", r.TraceID)
		// Do the same with username, fetched when we grab auth details.
		traceHeaders.Set("ts-username", r.UserName)

		adapterConn, _, err := wsDialer.DialContext(r.Context(), url.String(), traceHeaders)
		if err != nil {
			r.Log.Errorw("failed to dial adapter", "error", err)
			return
		}

		adapterConn.SetPongHandler(func(string) error {
			adapterConn.SetReadDeadline(time.Now().Add(consts.PingPongTimeout))
			return nil
		})

		adapterConns[target] = adapterConn

		// adapter reader goroutine per target sending messages at a central writer
		readerFuncs = append(readerFuncs, adapterWebsocketReader(r, target, msg, dead, adapterConn))
	}

	// Used to signal kill all adapter sockets across routines
	clientDeathCtx, deathFunc := context.WithCancel(context.Background())

	// Run goroutines using manager so we can inject a non-request scoped context and signal/track shutdown events.
	for _, readerFunc := range readerFuncs {
		t.RunWSFunc(readerFunc)
	}
	t.RunWSFunc(clientWebsocketReader(clientDeathCtx, deathFunc, r, msg))
	t.RunWSFunc(clientWebsocketWriter(clientDeathCtx, deathFunc, r, adapterConns, msg, dead))
}

func adapterWebsocketReader(r *tsymbiote.HTTPRequest, target string, ws chan tsymbiote.WebsocketMessage, dead chan string, conn *websocket.Conn) tsymbiote.WebsocketFunc {
	return func(adapterReaderCtx context.Context) {
		// Close from read loop
		defer conn.Close()
		for {
			select {
			case <-adapterReaderCtx.Done():
				return
			default:
				messageType, message, err := conn.ReadMessage()
				if err != nil {
					tsymbiote.LogWebsocketError(r, err)
					// Signal tracker about death
					dead <- target
					return
				}

				tmp := tsymbiote.WebsocketHostMessage{
					Host:    target,
					Message: message,
				}

				newMessage, err := json.Marshal(tmp)
				if err != nil {
					r.Log.Errorw("failed to marshal websocket message", "error", err)
					continue
				}

				// Throw the message in a chan for writing in other goroutine.
				ws <- tsymbiote.WebsocketMessage{
					Type:    messageType,
					Message: newMessage,
				}
			}
		}
	}
}

func clientWebsocketReader(clientDeathCtx context.Context, deathFunc func(), r *tsymbiote.HTTPRequest, ws chan tsymbiote.WebsocketMessage) tsymbiote.WebsocketFunc {
	return func(clientReadsCtx context.Context) {
		// Close from read loop
		defer r.WS.Close()

		for {
			select {
			// shutdown of server
			case <-clientReadsCtx.Done():
				return
			// Client died in write loop, just exit.
			case <-clientDeathCtx.Done():
				return
			default:
				// Webui sends a ping every 5 seconds, give a little leeway.
				r.WS.SetReadDeadline(time.Now().Add(consts.PingPongInterval + consts.WSWriteTimeout))
				messageType, message, err := r.WS.ReadMessage()
				if err != nil {
					tsymbiote.LogWebsocketError(r, err)
					// When we exit the client reader we no longer need the adapter(s)
					deathFunc()
					return
				}

				// Don't echo garbage back to the client
				if messageType == websocket.TextMessage && string(message) == "ping" {
					// Throw the message in a chan for writing in other goroutine.
					ws <- tsymbiote.WebsocketMessage{
						Type:    websocket.TextMessage,
						Message: []byte("pong"),
					}
				}
			}
		}
	}
}

func clientWebsocketWriter(clientDeathCtx context.Context, deathFunc func(), r *tsymbiote.HTTPRequest, adapterConns map[string]*websocket.Conn, msg chan tsymbiote.WebsocketMessage, dead chan string) tsymbiote.WebsocketFunc {
	return func(writerFuncCtx context.Context) {
		closeClientFunc := func() {
			err := r.WS.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(consts.WSWriteTimeout))
			if err != nil {
				// Wouldn't expect an error here
				tsymbiote.LogWebsocketError(r, err)
			}
		}

		closeReadersFunc := func(remainingAdapters map[string]*websocket.Conn) {
			for _, remainingAdapterConn := range remainingAdapters {
				err := remainingAdapterConn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(consts.WSWriteTimeout))
				if err != nil {
					// Wouldn't expect an error here
					tsymbiote.LogWebsocketError(r, err)
				}
			}
		}

		ticker := time.NewTicker(consts.PingPongInterval)
		defer ticker.Stop()

		livingAdapters := adapterConns

		for {
			select {
			// Server shutdown, send close to adapters and client.
			case <-writerFuncCtx.Done():
				closeReadersFunc(livingAdapters)
				closeClientFunc()
				return
			// client died in read loop, kill all adapters
			case <-clientDeathCtx.Done():
				closeReadersFunc(livingAdapters)
				return
			case <-ticker.C:
				// ping adapters to see if they're alive
				for adapter, adapterConn := range livingAdapters {
					// Don't block the main writer, shove these in a background task per adapter.
					// Writes here will corrupt the connection on fail faster than they re-run anyway.
					go func() {
						err := adapterConn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(consts.WSWriteTimeout))
						if err != nil {
							tsymbiote.LogWebsocketError(r, err)
							adapterConn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(consts.WSWriteTimeout))
							// Not allowed to play ping pong with this one anymore
							// Fire the adapter key at the tracker
							dead <- adapter
						}
					}()

				}
			// remove adapter from map when key received
			case adapter := <-dead:
				delete(livingAdapters, adapter)

				tmp := tsymbiote.WebsocketHostMessage{
					Host:    adapter,
					Message: []byte("websocket closed"),
				}

				newMessage, err := json.Marshal(tmp)
				if err != nil {
					r.Log.Errorw("failed to marshal websocket close message for client", "error", err)
					continue
				}

				replyMessage := tsymbiote.WebsocketMessage{
					Type:    websocket.TextMessage,
					Message: newMessage,
				}

				// Send to channel even though it's consumed right below, otherwise duplicated logic
				msg <- replyMessage

			case msg := <-msg:
				// Because browers are silly and don't let us manually send ping frames we're adding a custom ping handler.
				// Without this it's hard to be pro-active about disconnects on the client.
				if msg.Type == websocket.TextMessage && string(msg.Message) == "ping" {
					msg.Message = []byte("pong")
				}

				r.WS.SetWriteDeadline(time.Now().Add(consts.WSWriteTimeout))
				err := r.WS.WriteMessage(msg.Type, msg.Message)
				if err != nil {
					tsymbiote.LogWebsocketError(r, err)
					// When we exit the client reader we no longer need the adapter(s)
					// Restart loop so we catch the context
					deathFunc()
					continue
				}
			}

			// No more adapters, kill the client.
			if len(livingAdapters) <= 0 {
				closeClientFunc()
				return
			}
		}
	}
}
