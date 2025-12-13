package tsymbiotewebui

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/dhouti/tsymbiote/api/shared/types"
)

type pingTargets struct {
	Targets []string `json:"targets"`
	Host    string   `json:"host"`
}

type pingInput struct {
	Count    int           `json:"count"`
	PingType string        `json:"pingType"`
	Delay    string        `json:"delay"`
	Args     []pingTargets `json:"args"`
}

type pingResults struct {
	Error   string           `json:"error,omitempty"`
	Host    string           `json:"host,omitempty"`
	Target  string           `json:"target,omitempty"`
	Results []map[string]any `json:"results,omitempty"`
}

func (t *TSymbioteUIServer) Ping(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	input := &pingInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode ping input", "error", err)
		r.SetStatusCode(w, http.StatusBadRequest)
		return
	}

	delay, err := time.ParseDuration(input.Delay)
	if err != nil {
		r.Log.Errorw("failed to parse ping delay", "error", err)
		r.SetStatusCode(w, http.StatusBadRequest)
		return
	}

	// (delay between pings * count) + default timeout
	totalDelay := (time.Duration(input.Count) * delay) + consts.OutgoingRequestTimeout

	outgoingctx, outgoingcancel := context.WithDeadline(r.Context(), time.Now().Add(totalDelay))
	defer outgoingcancel()

	var channels []chan pingResults
	for _, pingTarget := range input.Args {
		for _, target := range pingTarget.Targets {
			ch := make(chan pingResults)
			channels = append(channels, ch)
			go func() {
				result := pingResults{
					Host:   pingTarget.Host,
					Target: target,
				}

				pingCommand := &types.PingInput{
					Target:   target,
					Count:    input.Count,
					PingType: input.PingType,
					Delay:    input.Delay,
				}

				pingBody, err := json.Marshal(pingCommand)
				if err != nil {
					r.Log.Errorw("failed to marshal ping input", "error", err)
					result.Error = err.Error()
					ch <- result
					return
				}

				resp, err := t.CallHost(outgoingctx, r, "POST", pingTarget.Host, paths.Ping.Adapter(), pingBody)
				if err != nil {
					r.Log.Errorw("failed to call adapter", "error", err)
					result.Error = err.Error()
					ch <- result
					return
				}

				defer resp.Close()

				pingRes := []map[string]any{}
				err = json.NewDecoder(resp).Decode(&pingRes)
				if err != nil {
					r.Log.Errorw("failed to decode ping response from adapter", "error", err)
					result.Error = err.Error()
					ch <- result
					return
				}

				result.Results = pingRes
				ch <- result
			}()
		}
	}

	pingResults := []pingResults{}
	for _, channel := range channels {
		res := <-channel
		close(channel)
		pingResults = append(pingResults, res)
	}

	t.WriteJson(w, r, pingResults)
}
