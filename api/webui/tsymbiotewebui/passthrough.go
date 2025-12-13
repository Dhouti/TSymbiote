package tsymbiotewebui

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
)

type defaultInput struct {
	Hosts []string `json:"hosts"`
}

type defaultResult struct {
	Host   string         `json:"host,omitempty"`
	Error  string         `json:"error,omitempty"`
	Result map[string]any `json:"result,omitempty"`
}

// In most cases we're just passing a result back from the adapter to the Web UI.
// Because of this and the type reflection nonsense, we can just perform straight passthrough.
func (t *TSymbioteUIServer) RelativeJSON(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {
	var targetPath string
	for _, path := range paths.Paths() {
		// Check for a substring match and set targetPath to the adapter version
		if strings.Contains(r.URL.Path, path.String()) {
			targetPath = path.Adapter()
			break
		}
	}

	if targetPath == "" {
		r.Log.Error("unable to find path for adapter")
		return
	}

	input := &defaultInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode input", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	var channels []chan defaultResult
	for _, targetHost := range input.Hosts {

		ch := make(chan defaultResult)
		channels = append(channels, ch)
		go func() {
			result := defaultResult{}
			result.Host = targetHost

			outgoingctx, outgoingcancel := context.WithDeadline(r.Context(), time.Now().Add(consts.OutgoingRequestTimeout))
			defer outgoingcancel()

			resp, err := t.CallHost(outgoingctx, r, "POST", targetHost, targetPath, nil)
			if err != nil {
				r.Log.Errorw("failed to call adapter", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			defer resp.Close()

			callResult := map[string]any{}
			err = json.NewDecoder(resp).Decode(&callResult)
			if err != nil {
				r.Log.Errorw("failed to decode response from adapter", "error", err)
				result.Error = err.Error()
				ch <- result
			}

			result.Result = callResult
			ch <- result
		}()
	}

	results := []defaultResult{}
	for _, channel := range channels {
		res := <-channel
		close(channel)
		results = append(results, res)
	}

	// Unstructured is only needed on the adapter side in most cases.
	t.WriteJson(w, r, results)
}
