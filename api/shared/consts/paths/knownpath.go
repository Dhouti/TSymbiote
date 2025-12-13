package paths

import "fmt"

//go:generate stringer -type=KnownPath
type KnownPath int

const (
	Status KnownPath = iota
	QueryDNS
	Ping
	Pprof
	Prefs
	Logs
	DriveShares
	DNSConfig
	ServeConfig
	AppConnRoutes
	Goroutines
	Hosts
	PeerMap
	BusEvents
	End // Just a marker
)

func (k KnownPath) Adapter() string {
	return fmt.Sprintf("/%s", k)
}

func (k KnownPath) WebUI() string {
	return fmt.Sprintf("/api/%s", k)
}

func Paths() []KnownPath {
	allPaths := make([]KnownPath, 0, End-1)
	for i := range int(End) {
		allPaths = append(allPaths, KnownPath(i))
	}
	return allPaths
}
