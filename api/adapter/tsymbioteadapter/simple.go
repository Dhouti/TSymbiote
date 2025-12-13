package tsymbioteadapter

import (
	"encoding/json"
	"net/http"

	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/dhouti/tsymbiote/api/shared/types"
	"tailscale.com/types/appctype"
)

func (t *TSymbioteAdapterServer) AppConnRoutes(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	resp, err := t.Host().GetAppConnectorRouteInfo(r.Context())
	if err != nil {
		// Why does this one endpoint have a different pattern for nil?
		if err.Error() == "404 Not Found: 404 page not found" {
			r.Log.Errorw("failed to get appconnroutes", "error", err)
			r.SetStatusCode(w, http.StatusInternalServerError)
			return
		}
		resp = appctype.RouteInfo{}
	}

	t.WriteUnstructuredJSON(w, r, resp)
}

func (t *TSymbioteAdapterServer) DNSConfig(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	resp, err := t.Host().GetDNSOSConfig(r.Context())
	if err != nil {
		r.Log.Errorw("failed to get dnsconfig", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	t.WriteUnstructuredJSON(w, r, resp)
}

func (t *TSymbioteAdapterServer) DriveShares(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {
	resp, err := t.Host().DriveShareList(r.Context())
	if err != nil {
		r.Log.Errorw("failed to get driveshares", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	t.WriteUnstructuredJSON(w, r, resp)
}

func (t *TSymbioteAdapterServer) Pprof(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {
	defer r.Body.Close()

	input := &types.PprofInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode pprof input", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	pprof, err := t.Host().Pprof(r.Context(), input.Type, input.Seconds)
	if err != nil {
		r.Log.Errorw("failed getting pprof", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	_, err = w.Write(pprof)
	if err != nil {
		r.Log.Errorw("failed to write response", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
	}
}

func (t *TSymbioteAdapterServer) Goroutines(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	out, err := t.Host().Goroutines(r.Context())
	if err != nil {
		r.Log.Errorw("failed to dump goroutines", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	_, err = w.Write(out)
	if err != nil {
		r.Log.Errorw("failed to write response", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
	}
}

func (t *TSymbioteAdapterServer) Prefs(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	resp, err := t.Host().GetPrefs(r.Context())
	if err != nil {
		r.Log.Errorw("failed to get prefs", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	t.WriteUnstructuredJSON(w, r, resp)
}

func (t *TSymbioteAdapterServer) ServeConfig(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	resp, err := t.Host().GetServeConfig(r.Context())
	if err != nil {
		r.Log.Errorw("failed to get serveconfig", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	t.WriteUnstructuredJSON(w, r, resp)
}

func (t *TSymbioteAdapterServer) Status(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	resp, err := t.Host().Status(r.Context())
	if err != nil {
		r.Log.Errorw("failed to get status", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	t.StorePeers(resp.Peer)

	t.WriteUnstructuredJSON(w, r, resp)
}
