package tsymbiotewebui

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/dhouti/tsymbiote/api/shared/consts"
	"github.com/dhouti/tsymbiote/api/shared/consts/paths"
	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/dhouti/tsymbiote/api/shared/types"
)

type pprofResult struct {
	Error string `json:"error,omitempty"`
	Host  string `json:"hosts"`
	Type  string `json:"type"`
	Pprof []byte `json:"pprof"`
}

func (t *TSymbioteUIServer) Pprof(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {

	input := &types.PprofInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode input body", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}
	deadlineTimeout := time.Duration(int64(input.Seconds))*time.Second + consts.OutgoingRequestTimeout
	outgoingctx, outgoingcancel := context.WithDeadline(r.Context(), time.Now().Add(deadlineTimeout))
	defer outgoingcancel()

	var channels []chan pprofResult
	for _, targetHost := range input.Hosts {

		ch := make(chan pprofResult)
		channels = append(channels, ch)

		go func() {
			result := pprofResult{
				Type: input.Type,
			}
			result.Host = targetHost

			pprofInput := &types.PprofInput{
				Type:    input.Type,
				Seconds: input.Seconds,
			}

			pprofBody, err := json.Marshal(pprofInput)
			if err != nil {
				r.Log.Errorw("failed to build pprof command input", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			resp, err := t.CallHost(outgoingctx, r, "POST", targetHost, paths.Pprof.Adapter(), pprofBody)
			if err != nil {
				r.Log.Errorw("failed to call adapter", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			defer resp.Close()

			pprofRes, err := io.ReadAll(resp)
			if err != nil {
				r.Log.Errorw("failed to read response body", "error", err)
				result.Error = err.Error()
				ch <- result
				return
			}

			result.Pprof = pprofRes
			ch <- result
		}()
	}

	pprofResp := []pprofResult{}
	for _, channel := range channels {
		res := <-channel
		close(channel)
		tmpRes := pprofResult{
			Error: res.Error,
			Host:  res.Host,
		}

		if res.Error == "" {
			err = writePprofToFile(res.Host, res.Pprof)
			if err != nil {
				r.Log.Errorw("failed to write pprof to file", "error", err)
				res.Error = err.Error()
			}
		}

		pprofResp = append(pprofResp, tmpRes)
	}

	t.WriteJson(w, r, pprofResp)
}

func writePprofToFile(host string, data []byte) error {
	basePath := "/tmp/TSymbiote/static/"
	filename := fmt.Sprintf("%s%s.pprof", basePath, host)

	err := os.MkdirAll(filepath.Dir(basePath), 0770)
	if err != nil {
		return err
	}

	file, err := os.Create(filename)
	if err != nil {
		return err
	}

	defer file.Close()

	_, err = file.Write(data)
	if err != nil {
		return err
	}
	return nil
}
