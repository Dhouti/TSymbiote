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

func (t *TSymbioteUIServer) QueryDNS(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	input := &types.QueryDNSInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode querydns input", "error", err)
		r.SetStatusCode(w, http.StatusBadRequest)
		return
	}

	outgoingctx, outgoingcancel := context.WithDeadline(r.Context(), time.Now().Add(consts.OutgoingRequestTimeout))
	defer outgoingcancel()

	var channels []chan types.QueryDNSResult
	for _, targetHost := range input.Hosts {

		ch := make(chan types.QueryDNSResult)
		channels = append(channels, ch)

		go func() {
			result := types.QueryDNSResult{
				Host: targetHost,
			}

			queryDNSCommand := &types.QueryDNSInput{
				Name:      input.Name,
				QueryType: input.QueryType,
			}

			queryDNSCommandBody, err := json.Marshal(queryDNSCommand)
			if err != nil {
				r.Log.Errorw("failed to build querydns command input", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			outgoingctx, outgoingcancel := context.WithDeadline(outgoingctx, time.Now().Add(consts.OutgoingRequestTimeout))
			defer outgoingcancel()

			resp, err := t.CallHost(outgoingctx, r, "POST", targetHost, paths.QueryDNS.Adapter(), queryDNSCommandBody)
			if err != nil {
				r.Log.Errorw("failed to call adapter", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			defer resp.Close()

			err = json.NewDecoder(resp).Decode(&result)
			if err != nil {
				r.Log.Errorw("failed to decode querydns response from adapter", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			ch <- result
		}()
	}

	queryDNSResults := []types.QueryDNSResult{}
	for _, channel := range channels {
		res := <-channel
		close(channel)
		queryDNSResults = append(queryDNSResults, res)
	}

	t.WriteJson(w, r, queryDNSResults)
}
