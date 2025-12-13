package tsymbioteadapter

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/netip"

	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/dhouti/tsymbiote/api/shared/types"
	"golang.org/x/net/dns/dnsmessage"
)

func (t *TSymbioteAdapterServer) QueryDNS(w http.ResponseWriter, r *tsymbiote.HTTPRequest) {
	input := &types.QueryDNSInput{}
	err := json.NewDecoder(r.Body).Decode(input)
	if err != nil {
		r.Log.Errorw("failed to decode dns query input", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	dnsResponse, resolvers, err := t.Host().QueryDNS(r.Context(), input.Name, input.QueryType)
	if err != nil {
		r.Log.Errorw("failed to query dns", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	resp := types.QueryDNSResult{}

	for _, resolver := range resolvers {
		resp.Resolvers = append(resp.Resolvers, resolver.Addr)
	}

	var dnsParser dnsmessage.Parser
	header, err := dnsParser.Start(dnsResponse)
	if err != nil {
		r.Log.Errorw("failed to parse DNS header", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	err = dnsParser.SkipAllQuestions()
	if err != nil {
		r.Log.Errorw("failed to skip DNS questions", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	formattedHeader := types.DNSHeader{}
	formattedHeader.RCode = header.RCode.GoString()
	resp.Header = formattedHeader
	if header.RCode != dnsmessage.RCodeSuccess {
		resp.Responses = []string{"No answer."}
		body, err := formatDNSResponseBody(resp)
		if err != nil {
			r.Log.Errorw("failed to format dns response body", "error", err)
			r.SetStatusCode(w, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write(body)
		if err != nil {
			r.Log.Errorw("failed to write response", "error", err)
		}
		return
	}

	answers, err := dnsParser.AllAnswers()
	if err != nil {
		r.Log.Errorw("failed to parse answers from dns query", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	// No answer, reply early.
	if len(answers) == 0 {
		resp.Responses = []string{"No answer."}
		body, err := formatDNSResponseBody(resp)
		if err != nil {
			r.Log.Errorw("failed to format response body", "error", err)
			r.SetStatusCode(w, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write(body)
		if err != nil {
			r.Log.Errorw("failed to write response", "error", err)
		}
		return
	}

	for _, answer := range answers {
		resp.Responses = append(resp.Responses, translateDNSRecordBody(answer))
	}

	body, err := formatDNSResponseBody(resp)
	if err != nil {
		r.Log.Errorw("failed to format response body", "error", err)
		r.SetStatusCode(w, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(body)
	if err != nil {
		r.Log.Errorw("failed to write response", "error", err)
	}
}

func formatDNSResponseBody(resp types.QueryDNSResult) ([]byte, error) {
	reply, err := json.Marshal(resp)
	if err != nil {
		return nil, err
	}
	return reply, nil
}

func translateDNSRecordBody(resource dnsmessage.Resource) string {
	switch resource.Header.Type {
	case dnsmessage.TypeA:
		body, ok := resource.Body.(*dnsmessage.AResource)
		if !ok {
			return ""
		}
		return netip.AddrFrom4(body.A).String()
	case dnsmessage.TypeAAAA:
		body, ok := resource.Body.(*dnsmessage.AAAAResource)
		if !ok {
			return ""
		}
		return netip.AddrFrom16(body.AAAA).String()

	case dnsmessage.TypeCNAME:
		body, ok := resource.Body.(*dnsmessage.CNAMEResource)
		if !ok {
			return ""
		}
		return body.CNAME.String()
	case dnsmessage.TypeMX:
		body, ok := resource.Body.(*dnsmessage.MXResource)
		if !ok {
			return ""
		}
		return fmt.Sprintf("%s, priority: %v", body.MX, body.Pref)
	case dnsmessage.TypeNS:
		body, ok := resource.Body.(*dnsmessage.NSResource)
		if !ok {
			return ""
		}
		return body.NS.String()
	case dnsmessage.TypeOPT:
		body, ok := resource.Body.(*dnsmessage.OPTResource)
		if !ok {
			return ""
		}
		return body.GoString()
	case dnsmessage.TypePTR:
		body, ok := resource.Body.(*dnsmessage.PTRResource)
		if !ok {
			return ""
		}
		return body.PTR.String()
	case dnsmessage.TypeSRV:
		body, ok := resource.Body.(*dnsmessage.SRVResource)
		if !ok {
			return ""
		}
		return body.GoString()
	case dnsmessage.TypeTXT:
		body, ok := resource.Body.(*dnsmessage.TXTResource)
		if !ok {
			return ""
		}
		return body.GoString()
	default:
		return resource.Body.GoString()
	}
}
