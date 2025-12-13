package tsymbiotewebui

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
)

type goroutinesInput struct {
	Hosts []string `json:"hosts"`
}

type goroutinesResult struct {
	Host   string `json:"host,omitempty"`
	Error  string `json:"error,omitempty"`
	Result []byte `json:"result,omitempty"`
}

func (t *TSymbioteUIServer) Goroutines(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	input := &goroutinesInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode body", "error", err)
		r.SetStatusCode(w, http.StatusBadRequest)
		return
	}

	outgoingctx, outgoingcancel := context.WithDeadline(r.Context(), time.Now().Add(consts.OutgoingRequestTimeout))
	defer outgoingcancel()

	var channels []chan goroutinesResult
	for _, targetHost := range input.Hosts {

		ch := make(chan goroutinesResult)
		channels = append(channels, ch)

		go func() {
			result := goroutinesResult{}
			result.Host = targetHost

			resp, err := t.CallHost(outgoingctx, r, "POST", targetHost, paths.Goroutines.Adapter(), nil)
			if err != nil {
				r.Log.Errorw("failed to call adapter", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			defer resp.Close()

			callRes, err := io.ReadAll(resp)
			if err != nil {
				r.Log.Errorw("failed to read response body", "error", err)
				result.Error = err.Error()
			}

			result.Result = callRes
			ch <- result
		}()
	}

	goroutinesResults := []goroutinesResult{}
	for _, channel := range channels {
		res := <-channel
		close(channel)
		goroutinesResults = append(goroutinesResults, res)
	}

	t.WriteJson(w, r, goroutinesResults)
}
