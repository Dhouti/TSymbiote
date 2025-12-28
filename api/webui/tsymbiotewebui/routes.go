package tsymbiotewebui

import (
	"net/http"
	"net/http/pprof"

	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	webuiembed "github.com/dhouti/tsymbiote/web-ui"
)

func (t *TSymbioteUIServer) RegisterRoutes() {

	t.RouteNoAuth().Get().Register("/healthz", t.Healthz)

	// Static assets, this is files like pprof outputs and the compiled web ui js.
	fs := http.FileServerFS(webuiembed.EmbedFS())
	t.Route().Get().RegisterSimple("/", fs.ServeHTTP)

	// This will serve file outputs IE: Pprof from tailscaled
	pprofStatic := http.StripPrefix("/static/pprof/", http.FileServer(http.Dir("/tmp/TSymbiote/static")))
	t.Route().Get().RegisterSimple("/static/pprof/", pprofStatic.ServeHTTP)

	t.Route().Get().Register("/{host}/debug/pprof/", t.RemoteDebug)
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

	t.Route().Get().Register(paths.PeerMap.WebUI(), t.PeerMap)

	t.Route().Post().Register(paths.Ping.WebUI(), t.Ping)
	t.Route().Post().Register(paths.QueryDNS.WebUI(), t.QueryDNS)
	t.Route().Post().Register(paths.Pprof.WebUI(), t.Pprof)
	t.Route().Post().Register(paths.Goroutines.WebUI(), t.Goroutines)

	t.Route().Post().Register(paths.Status.WebUI(), t.RelativeJSON)
	t.Route().Post().Register(paths.Prefs.WebUI(), t.RelativeJSON)
	t.Route().Post().Register(paths.DriveShares.WebUI(), t.RelativeJSON)
	t.Route().Post().Register(paths.DNSConfig.WebUI(), t.RelativeJSON)
	t.Route().Post().Register(paths.ServeConfig.WebUI(), t.RelativeJSON)
	t.Route().Post().Register(paths.AppConnRoutes.WebUI(), t.RelativeJSON)

	t.Route().Websocket().Register(paths.Logs.WebUI(), t.RelativeWebsocket)
	t.Route().Websocket().Register(paths.BusEvents.WebUI(), t.RelativeWebsocket)
}
