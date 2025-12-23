package tsymbiote

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/types"
	"github.com/dhouti/tsymbiote/pkg/utils"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/spf13/viper"
	"go.uber.org/zap"
	"tailscale.com/client/local"
	"tailscale.com/client/tailscale/v2"
	"tailscale.com/tsnet"
)

type TSymbiote interface {
	TSNet() *tsnet.Server
	HTTP() *http.Server
	Local() *local.Client
	ListenAndServe()
	RouteNoAuth() *MiddlewareChain
}

type TSymbioteServer struct {
	http  *http.Server
	tsnet *tsnet.Server
	local *local.Client
	Log   *zap.SugaredLogger
	Mux   *http.ServeMux
	*WebsocketManager
}

// NewTsymbiote sets up the base dependencies of TSymbiote servers.
// This is called for both Adapter and WebUI.
// The auth key is optional, if is not provided ambient credentials will be used.
func NewTSymbiote(authKey *tailscale.Key) *TSymbioteServer {
	ctx := context.Background()

	log := zap.Must(zap.NewProduction()).Sugar()

	if viper.GetBool("dev") {
		log.Info("dev mode enabled, authentication is disabled.")
	}

	tsnet := getTSNetServer(authKey)
	if tsnet == nil {
		log.Error("failed to start tsnet server")
		return nil
	}

	mux := http.NewServeMux()

	// Fetch the base localClient
	localClient, err := tsnet.LocalClient()
	if err != nil {
		log.Errorw("failed to setup local client", "error", err)
		return nil
	}

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%s", viper.GetString("port")),
		Handler: mux,
		BaseContext: func(l net.Listener) context.Context {
			return ctx
		},
		IdleTimeout: consts.ServerIdleTimeout,
	}

	// Setup a shutdown handler for websockets and link it to http.Server.Shutdown()
	wsCtx, wsCancel := context.WithCancel(ctx)
	wsManager, err := NewWebsocketManager(func() context.Context {
		return wsCtx
	})
	if err != nil {
		log.Errorw("failed to setup websocket manager", "error", err)
		wsCancel()
		return nil
	}

	wsGracefulFunc := func() {
		wsCancel()
	}

	httpServer.RegisterOnShutdown(wsGracefulFunc)

	return &TSymbioteServer{
		Log:              log,
		tsnet:            tsnet,
		local:            localClient,
		http:             httpServer,
		WebsocketManager: wsManager,
		Mux:              mux,
	}
}

// GetTSNet returns the underlying tailscale *tsnet.Server
func (t *TSymbioteServer) TSNet() *tsnet.Server {
	return t.tsnet
}

// GetHTTP returns the underlying *http.Server
func (t *TSymbioteServer) HTTP() *http.Server {
	return t.http
}

// Local returns the tailscale *local.Client
func (t *TSymbioteServer) Local() *local.Client {
	return t.local
}

// ListenAndServe starts the webserver and handles graceful termination.
func (t *TSymbioteServer) ListenAndServe() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	if viper.GetBool("dev") {
		go func() {
			t.Log.Infof("Starting listener on http://localhost:%s", viper.GetString("port"))
			err := t.HTTP().ListenAndServe()
			if err != nil && !errors.Is(err, http.ErrServerClosed) {
				t.Log.Errorw("failed to start http server", "error", err)
			}
		}()
	} else {
		go func() {
			t.Log.Infof("Starting listener on http://%s:%s", t.TSNet().Hostname, viper.GetString("port"))
			listener, err := t.TSNet().Listen("tcp", fmt.Sprintf(":%s", viper.GetString("port")))
			if err != nil {
				t.Log.Errorw("failed to start tsnet listener", "error", err)
				return
			}
			defer listener.Close()

			err = t.HTTP().Serve(listener)
			if err != nil && !errors.Is(err, http.ErrServerClosed) {
				t.Log.Errorw("failed to start tsnet server", "error", err)
			}
		}()
	}

	// Wait for shutdown signal channel
	<-ctx.Done()
	// Allow for hard shutdown signal with another sigterm
	cancel()

	// Allow for graceful shutdown of 10 seconds.
	t.Log.Infof("Shutdown signal received, draining connections")
	gracefulctx, shutdownRelease := context.WithTimeout(context.Background(), consts.ServerDrainPeriod)

	err := t.HTTP().Shutdown(gracefulctx)
	if err != nil {
		t.Log.Error("graceful shutdown failed, waiting before hard stop")
		time.Sleep(consts.ServerHardShutdownTimeout)
	}

	// Wait for shutdown of websockets.
	err = t.Shutdown(gracefulctx)
	if err != nil {
		t.Log.Error("graceful shutdown failed, waiting before hard stop")
		time.Sleep(consts.ServerHardShutdownTimeout)
	}

	// Logout if flag is set
	if viper.GetBool("logout") {
		t.Log.Info("Attempting to log out out of tailscale")
		err = t.Local().Logout(gracefulctx)
		if err != nil {
			t.Log.Errorw("failed to log out of tailscale", "error", err)
		}
	}

	t.Log.Info("Server shutdown complete")

	t.Log.Sync()
	t.HTTP().Close()
	t.TSNet().Close()
	shutdownRelease()
}

// logger is a middleware that injects a request scoped logger into the HTTPRequest object.
func (t *TSymbioteServer) RequestLogger(next HandlerFunc) HandlerFunc {
	return func(w http.ResponseWriter, r *HTTPRequest) {
		// Try to fetch traceid from request, if not exists create one
		traceId := r.Header.Get("trace-id")
		if traceId == "" {
			traceId = uuid.New().String()
		}

		// Set the value on both a raw value in struct to propogate to outbound
		// as well as to the logger for the remainder of the request.
		r.TraceID = traceId
		r.Log = t.Log.With(zap.String("trace_id", traceId))

		// Try to fetch username from request, if not set ignore it.
		// Header created in webuiAuth and propagated from client -> adapter via headers.
		username := r.Header.Get("ts-username")
		if username != "" {
			r.Log = r.Log.With(zap.String("user", username))
		}

		start := time.Now()
		next(w, r)
		end := time.Now()

		// Status is assumed 200 if header hasn't been written to, following that pattern.
		status := r.StatusCode
		if status == 0 {
			status = 200
		}

		r.Log.Infof("Addr: %s - Method: %s - Path: %s - Elapsed: %s - Status: %#v", r.RemoteAddr, r.Method, r.URL.Path, end.Sub(start), status)
	}
}

func LogWebsocketError(r *HTTPRequest, err error) {
	if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		r.Log.Info(err.Error())
	} else {
		r.Log.Error(err.Error())
	}
}

// getTSNetServer creates a new *tsnet.Server and waits for it to connect.
func getTSNetServer(authKey *tailscale.Key) *tsnet.Server {
	srv := new(tsnet.Server)

	srv.Ephemeral = viper.GetBool("ephemeral")
	if authKey != nil {
		srv.AuthKey = authKey.Key
	}

	hostnamePrefix := viper.GetString("hostname-prefix")

	// hostname overrides prefix
	hostname := viper.GetString("hostname")
	if hostname == "" {
		hostname = fmt.Sprintf("%s-%s", hostnamePrefix, utils.RandomString(6))
	}

	srv.Hostname = hostname

	// Wait for tsnet to connect
	_, err := srv.Up(context.Background())
	if err != nil {
		return nil
	}
	return srv
}

func (t *TSymbioteServer) RouteNoAuth() *MiddlewareChain {
	middleware := &MiddlewareChain{
		TSymbiote: t,
		Middleware: []Middleware{
			t.RequestLogger,
		},
		Mux: t.Mux,
	}

	return middleware
}

func (t *TSymbioteServer) WriteUnstructuredJSON(w http.ResponseWriter, r *HTTPRequest, data any) {
	w.Header().Set("Content-Type", "application/json")
	err := json.NewEncoder(w).Encode(types.StructToMap(data))
	if err != nil {
		r.Log.Errorw("failed to encode json response", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
	}
}

func (t *TSymbioteServer) WriteJson(w http.ResponseWriter, r *HTTPRequest, data any) {
	w.Header().Set("Content-Type", "application/json")
	err := json.NewEncoder(w).Encode(data)
	if err != nil {
		r.Log.Errorw("failed to encode json response", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
	}
}

func (t *TSymbioteServer) Healthz(w http.ResponseWriter, r *HTTPRequest) {
	w.WriteHeader(http.StatusOK)
	io.WriteString(w, string("ok"))
}
