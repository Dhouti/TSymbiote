package internal

import (
	"context"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/gorilla/websocket"
)

func WebsocketWriter(wsDeathCtx context.Context, r *tsymbiote.HTTPRequest, wsMessage chan tsymbiote.WebsocketMessage) tsymbiote.WebsocketFunc {
	return func(wsReaderCtx context.Context) {
		for {
			select {
			// Server shutdown, signal socket
			case <-wsReaderCtx.Done():
				CloseWebsocket(r)
				return
			// socket died in read loop, exit
			case <-wsDeathCtx.Done():
				return
			case msg := <-wsMessage:
				r.WS.SetWriteDeadline(time.Now().Add(consts.WSWriteTimeout))
				err := r.WS.WriteMessage(msg.Type, msg.Message)
				if err != nil {
					tsymbiote.LogWebsocketError(r, err)
					CloseWebsocket(r)
					return
				}
			}
		}
	}
}

func WebsocketReader(wsDeathCtx context.Context, wsDeathFunc func(), r *tsymbiote.HTTPRequest) tsymbiote.WebsocketFunc {
	return func(wsReaderCtx context.Context) {
		// Close from read loop
		defer r.WS.Close()

		for {
			select {
			// shutdown of server, safe to exit here.
			case <-wsReaderCtx.Done():
				return
			// Client died in write loop, just exit.
			case <-wsDeathCtx.Done():
				return
			default:
				// Read for a close message, deadline is handled via ping handler.
				_, _, err := r.WS.ReadMessage()
				if err != nil {
					tsymbiote.LogWebsocketError(r, err)
					wsDeathFunc()
					return
				}
			}
		}
	}
}

func CloseWebsocket(r *tsymbiote.HTTPRequest) {
	err := r.WS.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(consts.WSWriteTimeout))
	if err != nil {
		tsymbiote.LogWebsocketError(r, err)
	}
}
