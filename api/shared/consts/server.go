package consts

import "time"

const (
	ServerHardShutdownTimeout = time.Second * 3
	ServerIdleTimeout         = time.Second * 15
	PingPongInterval          = time.Second * 5
	WSWriteTimeout            = time.Second * 1
	PingPongTimeout           = PingPongInterval + WSWriteTimeout
	ServerDrainPeriod         = PingPongTimeout
	OutgoingRequestTimeout    = time.Second * 5
)
