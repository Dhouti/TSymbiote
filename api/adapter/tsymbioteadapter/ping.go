package tsymbioteadapter

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/dhouti/tsymbiote/api/shared/types"
	"tailscale.com/ipn/ipnstate"
	"tailscale.com/tailcfg"
)

func (t *TSymbioteAdapterServer) Ping(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {
	input := &types.PingInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode input body", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	delay, err := time.ParseDuration(input.Delay)
	if err != nil {
		r.Log.Errorw("failed to parse ping delay", "error", err)
		r.SetStatusCode(w, http.StatusBadRequest)
		return
	}

	ip, ok := t.GetIPByPeer(input.Target)
	if !ok {
		r.Log.Errorw("failed to get known IP for host", "target", input.Target)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	var allPings []*ipnstate.PingResult
	for range input.Count {
		pingRes, err := t.Host().Ping(r.Context(), ip, tailcfg.PingType(input.PingType))
		if err != nil {
			r.Log.Infow("failed to ping", "error", err)
			continue
		}

		time.Sleep(delay)

		allPings = append(allPings, pingRes)
	}

	pingRes := []map[string]any{}
	for _, ping := range allPings {
		pingRes = append(pingRes, types.StructToMap(ping))
	}

	t.WriteJson(w, r, pingRes)
}
