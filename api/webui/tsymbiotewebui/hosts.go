package tsymbiotewebui

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
)

type HostsResponse struct {
	Hosts []string `json:"hosts"`
}

func (t *TSymbioteUIServer) Hosts(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	devices, err := t.GetDevicesWithTag("tag:tsymbiote-adapter")
	if err != nil {
		r.Log.Errorw("failed to list devices", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	outgoingctx, outgoingcancel := context.WithDeadline(r.Context(), time.Now().Add(consts.OutgoingRequestTimeout))
	defer outgoingcancel()

	var wg sync.WaitGroup

	for _, device := range devices {
		// Skip offline hosts and remove from knownhosts
		if !device.ConnectedToControl {
			t.Log.Info("offline device ignored, issue logging out?")

			continue
		}

		var translatedHost string

		translatedHost, ok := t.GetHost(device.Hostname)
		if !ok || translatedHost == "" {

			wg.Go(func() {
				// Fetch the name of the host the adapter is attached to so we can return that instead
				resp, err := t.CallAdapter(outgoingctx, r, "POST", device.Hostname, paths.Status.Adapter(), nil)
				if err != nil {
					r.Log.Errorw("failed to call adapter", "error", err)
					r.SetStatusCode(w, http.StatusInternalServerError)
					return
				}
				defer resp.Close()

				status := map[string]any{}
				err = json.NewDecoder(resp).Decode(&status)
				if err != nil {
					r.Log.Errorw("failed to decode hosts response from adapter", "error", err)
					r.SetStatusCode(w, http.StatusInternalServerError)
					return
				}

				self, ok := status["Self"].(map[string]any)
				if !ok {
					t.Log.Error("unable to access Self in response")
					r.SetStatusCode(w, http.StatusInternalServerError)
					return
				}
				translatedHost, ok = self["HostName"].(string)
				if !ok {
					t.Log.Error("unable to determine hostname from status response")
					r.SetStatusCode(w, http.StatusInternalServerError)
					return
				}

				// dumb cache of known hosts value with the real value
				t.SetKnownHost(translatedHost, device.Hostname)
			})
		}
	}

	// The outgoing requests have a context dealine, this will always exit after that timeout.
	wg.Wait()

	response := HostsResponse{
		Hosts: t.GetHosts(),
	}

	t.WriteJson(w, r, response)
}
