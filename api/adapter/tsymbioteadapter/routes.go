package tsymbioteadapter

import (
	"net/http/pprof"

	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
)

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
