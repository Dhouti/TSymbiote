package tsymbiote

import (
	"context"
	"errors"
	"sync"
)

// WebsocketMessage is a convenience type for crafting websocket payloads
type WebsocketMessage struct {
	Type    int
	Message []byte
}

// WebsocketHostMessage is used as a payload in WebsocketMessage when messages from multiple hosts are aggregated into one writer.
type WebsocketHostMessage struct {
	Host    string
	Message []byte
}

// WebsocketManager is less of a manager more of a context injector and graceful shutdown wait.
type WebsocketManager struct {
	// baseContext is the base context used for websocket connections.
	// This is used for graceful termination of websockets on shutdown.
	baseContext func() context.Context
	wg          *sync.WaitGroup
}

type WebsocketFunc func(context.Context)

func NewWebsocketManager(baseContextFunc func() context.Context) (*WebsocketManager, error) {
	if baseContextFunc() == nil {
		return nil, errors.New("nil base context provided to websocketmanager")
	}

	var waitgroup sync.WaitGroup

	return &WebsocketManager{
		baseContext: baseContextFunc,
		wg:          &waitgroup,
	}, nil
}

// RunWSFunc is used to inject a graceful shutdown context into websocket goroutines.
func (m *WebsocketManager) RunWSFunc(wsFunc WebsocketFunc) {
	// Attach the base context to the func and let it fly.
	m.wg.Go(func() {
		wsFunc(m.baseContext())
	})
}

// Shutdown attempts to wait for all websockets to close, returns nil if success
func (m *WebsocketManager) Shutdown(shutdownCtx context.Context) error {
	// Type irrelevant, we're communicating by closing it.
	waitChan := make(chan bool)

	// Wait for goroutines in a seperate func and wait for either timeout or successful drain
	go func(waitGroup *sync.WaitGroup, done chan bool) {
		waitGroup.Wait()
		close(done)
	}(m.wg, waitChan)

	select {
	// graceful drain period is over, hard exit
	case <-shutdownCtx.Done():
		return errors.New("failed to wait for websockets to drain, context canceled")
	// Catch the closed channel, goroutines have drained.
	case <-waitChan:
		return nil
	}

}
