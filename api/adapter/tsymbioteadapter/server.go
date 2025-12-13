package tsymbioteadapter

import (
	"net/http"
	"net/http/pprof"
	"slices"

	"github.com/dhouti/tsymbiote/api/adapter/internal"
	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/dhouti/tsymbiote/pkg/utils"
	"github.com/spf13/viper"
	"go.uber.org/zap"
	"tailscale.com/client/local"
)

type TSymbioteAdapterServer struct {
	*tsymbiote.TSymbioteServer
	*local.Client
	*internal.KnownPeers
	host       *local.Client
	allowedTag string
}

func NewTSymbioteAdapter() tsymbiote.TSymbiote {
	// Don't provide auth key, use env.
	tsymbiote := tsymbiote.NewTSymbiote(nil)
	if tsymbiote == nil {
		log := zap.Must(zap.NewProduction()).Sugar()
		log.Error("failed to setup TSymbiote")
		return nil
	}

	// We need the host adapter client
	host, err := utils.NewLocalClient(true)
	if err != nil {
		tsymbiote.Log.Error("failed to configure tailscale local client", "error", err)
		return nil
	}

	allowTag := viper.GetString("allowed-tag")
	if allowTag == "" {
		tsymbiote.Log.Error("allowed-tag must be set, where is the default?")
		return nil
	}

	adapter := &TSymbioteAdapterServer{
		TSymbioteServer: tsymbiote,
		host:            host,
		allowedTag:      allowTag,
		KnownPeers:      &internal.KnownPeers{},
	}

	// Setup our routes
	adapter.RegisterRoutes()
	return adapter
}

func (t *TSymbioteAdapterServer) Host() *local.Client {
	return t.host
}

func (t *TSymbioteAdapterServer) Route() *tsymbiote.MiddlewareChain {
	middleware := &tsymbiote.MiddlewareChain{
		TSymbiote: t,
		Middleware: []tsymbiote.Middleware{
			t.RequestLogger,
		},
		Mux: t.Mux,
	}

	if !viper.GetBool("dev") {
		middleware.Add(t.adapterAuth)
	}
	return middleware
}

// adapterAuth uses the tailscale local client to ensure requests can only proceed if they came from the tsymbiote-webui.
func (t *TSymbioteAdapterServer) adapterAuth(next tsymbiote.HandlerFunc) tsymbiote.HandlerFunc {
	return func(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

		resp, err := t.Local().WhoIs(r.Context(), r.RemoteAddr)
		if err != nil {
			r.Log.Errorw("failed to get whois", "error", err)
			r.SetStatusCode(w, http.StatusInternalServerError)
			return
		}

		if !slices.Contains(resp.Node.Tags, t.allowedTag) {
			r.SetStatusCode(w, http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// RegisterRoutes is used to define and configure out HTTP routes
func (t *TSymbioteAdapterServer) RegisterRoutes() {

	t.RouteNoAuth().Get().Register("/healthz", t.Healthz)

	t.Route().Get().RegisterSimple("/debug/pprof/", pprof.Index)
	t.Route().Get().RegisterSimple("/debug/pprof/allocs", pprof.Handler("allocs").ServeHTTP)
	t.Route().Get().RegisterSimple("/debug/pprof/block", pprof.Handler("block").ServeHTTP)
	t.Route().Get().RegisterSimple("/debug/pprof/goroutine", pprof.Handler("goroutine").ServeHTTP)
	t.Route().Get().RegisterSimple("/debug/pprof/heap", pprof.Handler("heap").ServeHTTP)
	t.Route().Get().RegisterSimple("/debug/pprof/mutex", pprof.Handler("mutex").ServeHTTP)
	t.Route().Get().RegisterSimple("/debug/pprof/threadcreate", pprof.Handler("threadcreate").ServeHTTP)
	t.Route().Get().RegisterSimple("/debug/pprof/cmdline", pprof.Cmdline)
	t.Route().Get().RegisterSimple("/debug/pprof/profile", pprof.Profile)
	t.Route().Get().RegisterSimple("/debug/pprof/symbol", pprof.Symbol)
	t.Route().Get().RegisterSimple("/debug/pprof/trace", pprof.Trace)

	t.Route().Post().Register(paths.Ping.Adapter(), t.Ping)
	t.Route().Post().Register(paths.Status.Adapter(), t.Status)
	t.Route().Post().Register(paths.QueryDNS.Adapter(), t.QueryDNS)
	t.Route().Post().Register(paths.Pprof.Adapter(), t.Pprof)
	t.Route().Post().Register(paths.Prefs.Adapter(), t.Prefs)
	t.Route().Post().Register(paths.DriveShares.Adapter(), t.DriveShares)
	t.Route().Post().Register(paths.DNSConfig.Adapter(), t.DNSConfig)
	t.Route().Post().Register(paths.ServeConfig.Adapter(), t.ServeConfig)
	t.Route().Post().Register(paths.AppConnRoutes.Adapter(), t.AppConnRoutes)
	t.Route().Post().Register(paths.Goroutines.Adapter(), t.Goroutines)

	t.Route().Websocket().Register(paths.Logs.Adapter(), t.Logs)
	t.Route().Websocket().Register(paths.BusEvents.Adapter(), t.BusEvents)
}
