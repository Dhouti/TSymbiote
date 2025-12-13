package client

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"sync"

	"github.com/dhouti/tsymbiote/api/shared/tsymbiote"
	"github.com/spf13/viper"
	"tailscale.com/tsnet"
)

// Maintain a two way mapping to allow fast lookups in both directions.
// There's probably a much cleaner way to do this, but it's barely necessary to start with.
type Client struct {
	*tsnet.Server
	// map[adapter]host
	adapters sync.Map
	// map[host]adapter
	hosts sync.Map
}

func NewClient(tsnet *tsnet.Server) *Client {
	return &Client{
		Server: tsnet,
	}
}

func (c *Client) SetKnownHost(host string, adapter string) {
	c.adapters.Store(adapter, host)
	c.hosts.Store(host, adapter)
}

func (c *Client) DeleteHost(host string) error {
	adapter, ok := c.GetAdapter(host)
	if !ok {
		return errors.New("could not find adapter to delete")
	}
	c.hosts.Delete(host)
	c.adapters.Delete(adapter)
	return nil
}

func (c *Client) GetAdapter(host string) (string, bool) {
	val, ok := c.hosts.Load(host)
	if !ok {
		return "", false
	}
	return val.(string), ok
}

func (c *Client) GetAdapters() []string {
	iter := func(yield func(string) bool) {
		c.adapters.Range(func(k, v any) bool {
			return yield(k.(string))
		})
	}

	return slices.Collect(iter)
}

func (c *Client) GetHost(adapter string) (string, bool) {
	val, ok := c.adapters.Load(adapter)
	if !ok {
		return "", false
	}

	return val.(string), ok
}

func (c *Client) GetHosts() []string {
	iter := func(yield func(string) bool) {
		c.hosts.Range(func(k, v any) bool {
			return yield(k.(string))
		})
	}
	return slices.Collect(iter)
}

func (c *Client) CallAdapter(ctx context.Context, r *tsymbiote.HTTPRequest, method string, adapter string, path string, body []byte) (io.ReadCloser, error) {

	client := c.HTTPClient()

	bodyReader := bytes.NewReader(body)

	port := viper.GetString("adapter-port")

	req, err := http.NewRequestWithContext(ctx, method, fmt.Sprintf("http://%s:%s%s", adapter, port, path), bodyReader)
	if err != nil {
		return nil, err
	}

	// Get trace ID and propagate it through headers
	req.Header.Set("trace-id", r.TraceID)
	// Do the same with username, fetched when we grab auth details.
	req.Header.Set("ts-username", r.UserName)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, errors.New(resp.Status)
	}

	return resp.Body, nil
}

// CallHost is a convenience function that translates a target hostname to the target adapter before calling CallAdapter.
func (c *Client) CallHost(ctx context.Context, r *tsymbiote.HTTPRequest, method string, host string, path string, body []byte) (io.ReadCloser, error) {

	// Fetch the Adapter to call using the target hostname
	adapter, ok := c.GetAdapter(host)
	if !ok || adapter == "" {
		return nil, fmt.Errorf("failed to find adapter for host: %s", host)
	}

	resp, err := c.CallAdapter(ctx, r, method, adapter, path, body)
	if err != nil {
		return nil, err
	}

	return resp, nil
}
