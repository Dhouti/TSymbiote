package tsymbiote

import (
	"net/http"
	"slices"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// HTTPRequests contains out dependencies for requests.
type HTTPRequest struct {
	*http.Request
	WS         *websocket.Conn
	Log        *zap.SugaredLogger
	StatusCode int
	TraceID    string
	UserName   string
}

func (r *HTTPRequest) SetStatusCode(w http.ResponseWriter, statusCode int) {
	r.StatusCode = statusCode
	w.WriteHeader(statusCode)
}

type HandlerFunc func(http.ResponseWriter, *HTTPRequest)

type Middleware func(HandlerFunc) HandlerFunc

type MiddlewareChain struct {
	TSymbiote
	Middleware []Middleware
	Mux        *http.ServeMux
}

func (m *MiddlewareChain) Add(i Middleware) *MiddlewareChain {
	m.Middleware = append(m.Middleware, i)
	return m
}

func (m *MiddlewareChain) Post() *MiddlewareChain {
	m.Add(postRequest)
	return m
}

func (m *MiddlewareChain) Get() *MiddlewareChain {
	m.Add(getRequest)
	return m
}

func (m *MiddlewareChain) Websocket() *MiddlewareChain {
	m.Add(websocketRequest)
	return m
}

// convertRequest is used as the first step in the request chain.
// It converts an http.Request to the custom HTTPRequest with metadata.
func (m *MiddlewareChain) convertRequest(next HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		next(w, &HTTPRequest{Request: r})
	}
}

// revertRequest is used as the last step in the request chain for compatibility with out of band/prebaked methods.
// It converts the custom HTTPRequest with metadata to http.Request.
func (m *MiddlewareChain) revertRequest(next http.HandlerFunc) HandlerFunc {
	return func(w http.ResponseWriter, r *HTTPRequest) {
		next(w, r.Request)
	}
}

// Register links all of our middleware together and adds it to the muxer.
// convertRequest is used in the return to ensure that all requests are converted to HandlerFunc for the first step in the chain.
func (m *MiddlewareChain) Register(path string, final HandlerFunc) {
	outFunc := final

	for _, handlerFunc := range slices.Backward(m.Middleware) {
		outFunc = handlerFunc(outFunc)
	}

	m.Mux.HandleFunc(path, m.convertRequest(outFunc))
}

// RegisterSimple links all of our middleware together and adds it to the muxer.
// revertRequest is used in the return to ensure Handlerfunc is converted to http.Handlerfunc for the last step in the chain.
func (m *MiddlewareChain) RegisterSimple(path string, final http.HandlerFunc) {
	outFunc := m.revertRequest(final)

	for _, handlerFunc := range slices.Backward(m.Middleware) {
		outFunc = handlerFunc(outFunc)
	}

	m.Mux.HandleFunc(path, m.convertRequest(outFunc))
}

func postRequest(next HandlerFunc) HandlerFunc {
	return func(w http.ResponseWriter, r *HTTPRequest) {
		defer r.Body.Close()
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			// Set CORS headers for pre-flight requests
			r.SetStatusCode(w, http.StatusOK)
			return
		}

		if r.Method != http.MethodPost {
			r.Log.Errorf("Unsupported method: %s", r.Method)
			r.SetStatusCode(w, http.StatusMethodNotAllowed)
			return
		}

		next(w, r)
	}
}

func getRequest(next HandlerFunc) HandlerFunc {
	return func(w http.ResponseWriter, r *HTTPRequest) {
		defer r.Body.Close()
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET")

		if r.Method != http.MethodGet {
			r.Log.Errorf("Unsupported method: %s", r.Method)
			r.SetStatusCode(w, http.StatusMethodNotAllowed)
			return
		}

		next(w, r)
	}
}

// websocketRequest upgrades the websocket and stores the connection in the request context as "ws"
func websocketRequest(next HandlerFunc) HandlerFunc {
	return func(w http.ResponseWriter, r *HTTPRequest) {
		defer r.Body.Close()
		upgrade := false
		upgradeHeaders, ok := r.Header["Upgrade"]
		if ok && slices.Contains(upgradeHeaders, "websocket") {
			upgrade = true
		}

		if upgrade == false {
			w.Header().Add("Upgrade", "websocket")
			r.Log.Error("Upgrade required")
			r.SetStatusCode(w, http.StatusUpgradeRequired)
			return
		}

		upgrader := websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		}

		conn, err := upgrader.Upgrade(w, r.Request, nil)
		if err != nil {
			r.Log.Errorw("Upgrade required", "error", err)
			r.SetStatusCode(w, http.StatusInternalServerError)
			return
		}

		// pong or die
		conn.SetPingHandler(func(message string) error {
			err := conn.WriteControl(websocket.PongMessage, []byte{}, time.Now().Add(consts.WSWriteTimeout))
			if err != nil {
				conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(consts.WSWriteTimeout))
			}

			conn.SetReadDeadline(time.Now().Add(consts.PingPongTimeout))
			return nil
		})

		r.WS = conn
		next(w, r)
	}
}
