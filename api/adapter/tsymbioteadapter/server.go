package tsymbioteadapter

import (
	"net/http"
	"slices"

	"github.com/dhouti/tsymbiote/api/adapter/internal"
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

	// In most environments the default LocalClient works, but we sometimes need to swap the Socket path.
	hostClient := &local.Client{}

	// Handle custom socket paths
	customSocketPath := viper.GetString("socket")
	if customSocketPath != "" {
		hostClient.Socket = customSocketPath
	}

	// if --socket and --discover-socket prefer discovery
	if viper.GetBool("discover-socket") {
		discoveredSocketPath, err := utils.DiscoverSocket()
		if err != nil {
			tsymbiote.Log.Errorw("failed to discover tailscale socket path", err)
			return nil
		}
		hostClient.Socket = discoveredSocketPath
	}

	allowTag := viper.GetString("allowed-tag")
	if allowTag == "" {
		tsymbiote.Log.Error("allowed-tag must be set, where is the default?")
		return nil
	}

	adapter := &TSymbioteAdapterServer{
		TSymbioteServer: tsymbiote,
		host:            hostClient,
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
