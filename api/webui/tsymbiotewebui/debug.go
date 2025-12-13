package tsymbiotewebui

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
)

func (t *TSymbioteUIServer) RemoteDebug(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {
	hostname := r.PathValue("host")

	// Recreate the URI, remove hostname/ and passthrough to adapter
	originalURI := r.URL.RequestURI()
	trimmedURI := strings.ReplaceAll(originalURI, fmt.Sprintf("%s/", hostname), "")

	resp, err := t.CallHost(r.Context(), r, "GET", hostname, trimmedURI, nil)
	if err != nil {
		r.Log.Errorw("failed to call adapter", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}
	defer resp.Close()

	io.Copy(w, resp)
}
