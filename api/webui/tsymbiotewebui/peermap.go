package tsymbiotewebui

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
)

type Edge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

type Node struct {
	ID    string      `json:"id"`
	Label string      `json:"label"`
	Data  interface{} `json:"data"`
}

type NodeGraph struct {
	Hosts []string `json:"hosts"`
	Nodes []Node   `json:"nodes"`
	Edges []Edge   `json:"edges"`
}

type peerMapResult struct {
	Nodes map[string]Node
	Edges []Edge
	Error string `json:"error,omitempty"`
}

func (t *TSymbioteUIServer) PeerMap(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	devices, err := t.GetDevicesWithTag("tag:tsymbiote-adapter")
	if err != nil {
		r.Log.Errorw("failed to list devices", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	outgoingctx, outgoingcancel := context.WithDeadline(r.Context(), time.Now().Add(time.Second*1))
	defer outgoingcancel()

	var channels []chan peerMapResult
	for _, knownAdapter := range devices {
		ch := make(chan peerMapResult)
		channels = append(channels, ch)
		go func() {
			result := peerMapResult{
				Nodes: map[string]Node{},
			}

			resp, err := t.CallAdapter(outgoingctx, r, "POST", knownAdapter.Hostname, paths.Status.Adapter(), nil)
			if err != nil {
				r.Log.Errorw("failed to call adapter", "adapter", knownAdapter.Hostname)
				// Attempt to delete this adapter
				t.DeleteAdapter(knownAdapter.Hostname)
				result.Error = err.Error()
				ch <- result
				return
			}

			defer resp.Close()

			status := map[string]any{}
			err = json.NewDecoder(resp).Decode(&status)
			if err != nil {
				r.Log.Errorw("failed to decode peermap response from adapter", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			// Need some type assertions due to wanting to generally do passthrough.
			self := status["Self"].(map[string]any)
			hostname := self["HostName"].(string)
			// dumb cache of known hosts value with the real value
			t.SetKnownHost(hostname, knownAdapter.Hostname)
			peers := status["Peer"].(map[string]any)

			for _, peer := range peers {
				peerstatus := peer.(map[string]any)
				peerhostname := peerstatus["HostName"].(string)
				// Populate edges from self -> peer
				result.Edges = append(result.Edges, Edge{
					ID:     fmt.Sprintf("%s->%s", hostname, peerhostname),
					Source: hostname,
					Target: peerhostname,
				})

				_, ok := result.Nodes[peerhostname]
				if !ok {
					result.Nodes[peerhostname] = Node{
						ID:    peerhostname,
						Label: peerhostname,
						Data:  peer,
					}
				}
			}
			ch <- result
		}()
	}

	edges := []Edge{}
	mergedNodeMap := map[string]Node{}
	for _, channel := range channels {
		res := <-channel
		close(channel)
		edges = append(edges, res.Edges...)
		// Copy into the merged map overwriting any duplicates.
		maps.Copy(mergedNodeMap, res.Nodes)
	}

	nodeSlice := slices.Collect(maps.Values(mergedNodeMap))

	nodeGraph := NodeGraph{
		Hosts: t.GetHosts(),
		Nodes: nodeSlice,
		Edges: edges,
	}

	t.WriteJson(w, r, nodeGraph)
}
