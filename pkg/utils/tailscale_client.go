package utils

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"slices"

	"tailscale.com/client/tailscale/v2"
)

//go:generate moq -out zz_tailscale_client_mocks.go . TailscaleClient
type TailscaleClient interface {
	GetDevicesWithTag(string) ([]tailscale.Device, error)
	GenerateDeviceKey(context.Context, string, []string) (*tailscale.Key, error)
}

type TSClient struct {
	tsClient    *tailscale.Client
	oauthClient *http.Client
}

func NewTSOAuthClient(scopes []string) (*TSClient, error) {
	clientId, ok := os.LookupEnv("TS_OAUTH_CLIENT_ID")
	if !ok || clientId == "" {
		return nil, fmt.Errorf("TS_OAUTH_CLIENT_ID not set")
	}

	clientSecret, ok := os.LookupEnv("TS_OAUTH_CLIENT_SECRET")
	if !ok || clientSecret == "" {
		return nil, fmt.Errorf("TS_OAUTH_CLIENT_SECRET not set")
	}

	var oauthConfig = &tailscale.OAuthConfig{
		ClientID:     clientId,
		ClientSecret: clientSecret,
		Scopes:       scopes,
	}

	oauthClient := oauthConfig.HTTPClient()

	utilClient := &TSClient{}

	tailscaleClient := &tailscale.Client{
		HTTP:    oauthClient,
		Tailnet: "",
	}

	utilClient.tsClient = tailscaleClient
	utilClient.oauthClient = oauthClient
	return utilClient, nil
}

func (tc *TSClient) GenerateDeviceKey(ctx context.Context, description string, tags []string) (*tailscale.Key, error) {
	// Why are they using unkeyed fields in the v2 client?
	createKeyRequest := tailscale.CreateKeyRequest{}
	createKeyRequest.Capabilities.Devices.Create.Ephemeral = true
	createKeyRequest.Capabilities.Devices.Create.Reusable = false
	createKeyRequest.Capabilities.Devices.Create.Preauthorized = true
	createKeyRequest.Description = description
	createKeyRequest.Capabilities.Devices.Create.Tags = tags
	authKey, err := tc.tsClient.Keys().CreateAuthKey(ctx, createKeyRequest)
	if err != nil {
		return nil, err
	}
	return authKey, nil
}

func (tc *TSClient) getDevices() ([]tailscale.Device, error) {
	devices, err := tc.tsClient.Devices().List(context.Background())
	if err != nil {
		return nil, err
	}

	// Only return devices that are connected
	var connectedDevices []tailscale.Device
	for _, device := range devices {
		if device.ConnectedToControl {
			connectedDevices = append(connectedDevices, device)
		}
	}

	return connectedDevices, nil
}

func (tc *TSClient) GetDevicesWithTag(filterTag string) ([]tailscale.Device, error) {
	devices, err := tc.getDevices()
	if err != nil {
		return nil, err
	}

	var filtered []tailscale.Device
	for _, device := range devices {
		if slices.Contains(device.Tags, filterTag) {
			filtered = append(filtered, device)
		}
	}

	return filtered, nil
}
