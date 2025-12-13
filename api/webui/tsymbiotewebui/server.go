package tsymbiotewebui

import (
	"context"
	"net/http"
	"net/http/pprof"
	"slices"

	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/dhouti/tsymbiote/api/webui/client"
	"github.com/dhouti/tsymbiote/pkg/utils"
	"github.com/spf13/viper"
	"go.uber.org/zap"
	"tailscale.com/client/tailscale/v2"
)

type TSymbioteUIServer struct {
	*tsymbiote.TSymbioteServer
	*client.Client
	*utils.TSClient

	allowedUsers []string
}

func NewTSymbioteUI() tsymbiote.TSymbiote {

	oauth, err := utils.NewTSOAuthClient(viper.GetStringSlice("scopes"))
	if err != nil {
		log := zap.Must(zap.NewProduction()).Sugar()
		log.Error("failed to setup TSymbiote")
		return nil
	}

	// Default nil key, if not set in env and no generate-auth tsnet will not start.
	// Operator will provision a reusable key, else grant auth_keys scope to webui and enable this flag.
	var authKey *tailscale.Key
	if viper.GetBool("generate-auth") {
		createdKey, err := oauth.GenerateDeviceKey(context.Background(), "tsymbiote-webui", []string{"tag:tsymbiote-webui"})
		if err != nil {
			log := zap.Must(zap.NewProduction()).Sugar()
			log.Error("failed to generate auth key")
			return nil
		}
		authKey = createdKey
	}

	tsymbiote := tsymbiote.NewTSymbiote(authKey)

	client := client.NewClient(tsymbiote.TSNet())

	allowed := viper.GetStringSlice("allowed-users")
	if len(allowed) == 0 {
		tsymbiote.Log.Info("No allowed-users provided, all requests over tailnet will be allowed.")
	}

	webui := &TSymbioteUIServer{
		TSymbioteServer: tsymbiote,
		Client:          client,
		TSClient:        oauth,
		allowedUsers:    allowed,
	}

	webui.RegisterRoutes()
	return webui
}

func (t *TSymbioteUIServer) Route() *tsymbiote.MiddlewareChain {
	middleware := &tsymbiote.MiddlewareChain{
		TSymbiote: t,
		Middleware: []tsymbiote.Middleware{
			t.RequestLogger,
		},
		Mux: t.Mux,
	}

	if !viper.GetBool("dev") {
		middleware.Add(t.uiAuth)
	}
	return middleware
}

// uiAuth uses the tailscale local client to ensure requests can only proceed if they came from an authorized user.
// This uses a flag at startup `allowed-users`
func (t *TSymbioteUIServer) uiAuth(next tsymbiote.HandlerFunc) tsymbiote.HandlerFunc {
	return func(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

		resp, err := t.Local().WhoIs(r.Context(), r.RemoteAddr)
		if err != nil {
			r.Log.Errorw("failed to get whois", "error", err)
			r.SetStatusCode(w, http.StatusInternalServerError)
			return
		}

		// Set the username into request and add to logger.
		r.UserName = resp.UserProfile.LoginName
		r.Log = r.Log.With(zap.String("user", r.UserName))

		// No allowed-users provided, defaulting open.
		// This is logged at setup.
		if len(t.allowedUsers) == 0 {
			next(w, r)
			return
		}

		// Check if associated username is in the allowedUsers slice.
		if !slices.Contains(t.allowedUsers, resp.UserProfile.LoginName) {
			r.SetStatusCode(w, http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

func (t *TSymbioteUIServer) RegisterRoutes() {

	t.RouteNoAuth().Get().Register("/healthz", t.Healthz)

	// Static assets, this is files like pprof outputs and the compiled web ui js.
	fs := http.FileServer(http.Dir("/tmp/TSymbiote/static/"))
	serveStatic := func(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {
		fs.ServeHTTP(w, r.Request)
	}
	t.Route().Get().Register("/", serveStatic)

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

	t.Route().Get().Register(paths.Hosts.WebUI(), t.Hosts)
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
