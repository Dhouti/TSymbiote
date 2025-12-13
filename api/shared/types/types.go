package types

import (
	"reflect"

	"tailscale.com/ipn"
)

type DNSOSConfig struct {
	Nameservers   []string `json:"nameservers,omitempty"`
	SearchDomains []string `json:"searchDomains,omitempty"`
	MatchDomains  []string `json:"matchDomains,omitempty"`
}

type ServeConfig struct {
	ipn.ServeConfig
	ETag string `json:"etag,omitempty"`
}

type QueryDNSInput struct {
	Hosts     []string `json:"hosts,omitempty"`
	Name      string   `json:"name"`
	QueryType string   `json:"queryType"`
}

type DNSHeader struct {
	RCode string `json:"responseCode"`
	Name  string `json:"name,omitempty"`
	Type  string `json:"type,omitempty"`
	Class string `json:"class,omitempty"`
	TTL   uint32 `json:"ttl,omitempty"`
}

type QueryDNSResult struct {
	Error     string    `json:"error,omitempty"`
	Host      string    `json:"host,omitempty"`
	Header    DNSHeader `json:"header"`
	Responses []string  `json:"responses,omitempty"`
	Resolvers []string  `json:"resolvers"`
}

type PingInput struct {
	Target   string `json:"target"`
	Count    int    `json:"count"`
	PingType string `json:"pingType"`
	Delay    string `json:"delay"`
}

type PprofInput struct {
	Hosts   []string `json:"hosts,omitempty"`
	Type    string   `json:"type"`
	Seconds int      `json:"seconds"`
}

// StructToMap recursively converts a struct to a map[string]any
// This may seem messy, but using this means i don't have to change backend logic most of the time when underlying structs change.
// It also means that the UI gets access to fields it wouldn't normally see if we tried to just serialize them normally.
func StructToMap(obj any) map[string]any {
	result := make(map[string]any)

	val := reflect.ValueOf(obj)

	if val.Kind() == reflect.Pointer {
		val = val.Elem()
	}

	typ := val.Type()

	for i := range val.NumField() {
		// Field is not exported or invalid, ignore
		if !typ.Field(i).IsExported() {
			continue
		}

		fieldName := typ.Field(i).Name
		fieldValueKind := val.Field(i).Kind()
		var fieldValue interface{}

		tmpval := val.Field(i)
		if fieldValueKind == reflect.Pointer {
			tmpval = val.Field(i).Elem()
			fieldValueKind = tmpval.Kind()
		}

		if !tmpval.IsValid() {
			continue
		}

		if fieldValueKind == reflect.Struct {
			fieldValue = StructToMap(tmpval.Interface())
		} else {
			fieldValue = tmpval.Interface()
		}

		result[fieldName] = fieldValue
	}

	return result
}
