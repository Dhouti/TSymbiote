# TSymbiote

A debugging tool for Tailscale for network visualization & remote debugging.

TSymbiote attaches to existing Tailscale deployments, allowing you to map your network and debug remote hosts by "impersonating" them.  
The WebUI supports concurrent requests across multiple adapters, for example, running a `Ping` from every host to all peers it can communicate with concurrently, the node graph shows color coded results.

**Use at your own risk. No guarantees of security or functionality.**

![TSymbiote](tsymbiote.png)

## Quick Start
Policy file requirements:
```
"grants": [
  // Allow TSymbiote traffic
  // The WebUI must be able to talk to the adapters
  // The Adapters must be able to see WebUI for WhoIs
  {
    "src": ["tag:tsymbiote-webui", "tag:tsymbiote-adapter"],
    "dst": ["tag:tsymbiote-webui", "tag:tsymbiote-adapter"],
    "ip":  ["tcp:3621"],
  },
]
```

#### Start an adapter
You can start adapter and use the Tailscale login flow to authenticate without providing an auth key.
You will need to tag the device after creation with `tag:tsymbiote-adapter`.
```
tsymbiote adapter
```

If you wish to provide your own auth key:
```
TS_AUTHKEY=your-key tsymbiote adapter
```

#### Start WebUI

Set environment variables using an OAuth key with `devices:core:read` and `auth_keys` scopes with the `tag:tsymbiote-webui` tag:
```
TS_OAUTH_CLIENT_ID
TS_OAUTH_CLIENT_SECRET
```

```bash
tsymbiote webui --generate-auth
```

The WebUI serves over `tsnet` on port `3621` by default. Use `--dev` for http/localhost access.

For non-ephemeral environments, or when running both components on the same machine you may need to set the follwing environment variable:
```
TSNET_FORCE_LOGIN=1
```

## Components

### Adapter

Attaches to a running Tailscale host and executes LocalAPI calls as that host. Currently Read-Only by design.

**Required for non-interactive sessions:** `TS_AUTHKEY` environment variable

```
Usage:
  tsymbiote adapter [flags]

Flags:
      --allowed-tag string       Tag for access control (default "tag:tsymbiote-webui")
      --dev                      Run in HTTP mode for local dev
  -d, --discover-socket          Auto-discover socket path (for k8s sidecar)
      --hostname string          Static hostname
      --hostname-prefix string   Hostname prefix (default "tsymbiote-adapter")
      --logout                   Logout on exit (default true)
  -p, --port string              Service port (default "3621")
      --socket string            Path to tailscaled socket (default /var/run/tailscale/tailscaled.sock)
```

Tested on Linux. Should work on macOS; Windows is untested.

### WebUI

Serves a React frontend with a Go API backend over `tsnet`.

**Required:** `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_CLIENT_SECRET`

Optionally accepts `TS_AUTHKEY` when `--generate-auth=false`.

```
Usage:
  tsymbiote webui [flags]

Flags:
      --adapter-port string      Adapter port (default "3621")
      --allowed-users strings    Comma-separated allowed users
      --dev                      Run in HTTP mode for local dev
      --generate-auth            Generate authkey using OAuth client
      --hostname string          Static hostname
      --hostname-prefix string   Hostname prefix (default "tsymbiote-webui")
      --logout                   Logout on exit (default true)
  -p, --port string              Service port (default "3621")
      --scopes strings           OAuth scopes (default [auth_keys,devices:core:read])
```

### Operator (Optional)

Kubernetes operator for automatic adapter injection via mutating webhook. Compatible with Tailscale Operator.

**Mutating Webhook:** Add this label to namespaces and pods:
```
tsymbiote-secret-injection: enabled
```

**Secrets Controller:** Watches labeled pods and generates ephemeral auth keys automatically. Secrets are garbage-collected when pods are deleted.

**TSymbiote CRD:** Deploys the WebUI as a StatefulSet:
```yaml
apiVersion: tsymbiote.dhouti.dev/v1alpha1
kind: TSymbiote
metadata:
  name: tsymbiote
  namespace: tsymbiote
spec:
  authSecretRef:
    name: tsymbiote-webui
  image: repo/image:tag
```

## Kubernetes Adapter Details

Runs as a sidecar in a shared process namespace within Tailscale pods. Requires `SYS_PTRACE` capability to access the tailscaled socket in the other container.

Relevant docs: [Share Process Namespace](https://kubernetes.io/docs/tasks/configure-pod-container/share-process-namespace/)

## Development
Corresponding environment variables are still needed.
```bash
make webui-dev   # Build WebUI and start in HTTP mode
make web-dev     # Frontend dev server
make adapter-dev # Start a dev ready adapter
```

## Roadmap

- **Headscale support:** Requires integrating device listing and auth key APIs
- **App Capabilities:** Optional auth layer for WebUI to lock functionality behind capabilities.
- **Write APIs:** Currently read-only; write operations not implemented
- **Non-Kubernetes deployment examples:** Open to requests, suggestions, etc.
