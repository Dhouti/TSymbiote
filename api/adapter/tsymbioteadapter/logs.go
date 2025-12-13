package tsymbioteadapter

import (
	"bufio"
	"context"
	"net/http"

	"github.com/dhouti/tsymbiote/api/adapter/internal"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/gorilla/websocket"
)

func (t *TSymbioteAdapterServer) Logs(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	// Used to signal kill across routines
	wsDeathCtx, wsDeathFunc := context.WithCancel(context.Background())
	wsMessage := make(chan tsymbiote.WebsocketMessage)

	// Run goroutines using manager so we can inject a non-request scoped context and signal/track shutdown events.
	t.RunWSFunc(internal.WebsocketReader(wsDeathCtx, wsDeathFunc, r))
	t.RunWSFunc(internal.WebsocketWriter(wsDeathCtx, r, wsMessage))
	t.RunWSFunc(t.logStreamScannerFunc(wsDeathCtx, r, wsMessage))
}

// This is run in its own routine to prevent scanner.Scan() from blocking reading or writing.
func (t *TSymbioteAdapterServer) logStreamScannerFunc(wsDeathCtx context.Context, r *tsymbiote.HTTPRequest, wsMessage chan tsymbiote.WebsocketMessage) tsymbiote.WebsocketFunc {
	return func(wsReaderCtx context.Context) {
		// Uses wsDeathCtx so when sockets die the scanner emits False and breaks the loop.
		logs, err := t.Host().TailDaemonLogs(wsDeathCtx)
		if err != nil {
			r.Log.Errorw("failed to get log stream", "error", err)
			internal.CloseWebsocket(r)
			return
		}

		scanner := bufio.NewScanner(logs)

		// Scan until EOF, websocket death, or shutdown event
		for scanner.Scan() {
			wsMessage <- tsymbiote.WebsocketMessage{
				Type:    websocket.TextMessage,
				Message: scanner.Bytes(),
			}
		}
	}
}
