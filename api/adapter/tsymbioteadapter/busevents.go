package tsymbioteadapter

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/dhouti/tsymbiote/api/adapter/internal"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/gorilla/websocket"
)

func (t *TSymbioteAdapterServer) BusEvents(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	// Used to signal kill across routines
	wsDeathCtx, wsDeathFunc := context.WithCancel(context.Background())
	wsMessage := make(chan tsymbiote.WebsocketMessage)

	// Run goroutines using manager so we can inject a non-request scoped context and signal/track shutdown events.
	t.RunWSFunc(internal.WebsocketReader(wsDeathCtx, wsDeathFunc, r))
	t.RunWSFunc(internal.WebsocketWriter(wsDeathCtx, r, wsMessage))
	t.RunWSFunc(t.busEventsIterFunc(wsDeathCtx, r, wsMessage))
}

// Read from bus events and write back to the websocket writer from the iterator.
func (t *TSymbioteAdapterServer) busEventsIterFunc(wsDeathCtx context.Context, r *tsymbiote.HTTPRequest, wsMessage chan tsymbiote.WebsocketMessage) tsymbiote.WebsocketFunc {
	return func(wsReaderCtx context.Context) {
		// Uses wsDeathCtx so when sockets die the scanner emits False and breaks the loop.
		busEvents := t.Host().StreamBusEvents(wsDeathCtx)

		// Iterate and stream it back out
		for event, err := range busEvents {
			if err != nil {
				r.Log.Errorw("bus event error encountered", "error", err)
				internal.CloseWebsocket(r)
				return
			}

			out, err := json.Marshal(event)
			if err != nil {
				r.Log.Errorw("failed to marshal debug event", "error", err)
				internal.CloseWebsocket(r)
				return
			}

			wsMessage <- tsymbiote.WebsocketMessage{
				Type:    websocket.TextMessage,
				Message: out,
			}
		}
	}
}
