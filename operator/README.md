Automatically injects a CLI wrapper adapter into labeled pods.

Label Namespace and Pod with the following to enable injection:
    tsymbiote-adapter-injection: enabled
    (Label is set on MutatingWebhookConfiguration in a kustomize overlay.)


Requires OAuth keys with `auth_keys` scope.
Under the `auth_keys` scope option during key creation, set the tags to: 
    `tag:tsymbiote-adapter`

The webui also requires an OAuth key for peer discovery.
It uses `auth_keys` to generate a tsnet key for itself (this can be disabled if you are not using the operator: `--generate-auth=false --scopes="devices:core:read"`)
It uses `devices:core:read` to search for devices with the `tag:tsymbiote-adapter` tag.


Policy file requirements:
```
"tagOwners": {
    "tag:tsymbiote-controller": [],
	"tag:tsymbiote-adapter":    ["tag:tsymbiote-controller"],
    "tag:tsymbiote-webui":      ["tag:tsymbiote-controller"],
}
```

Environment Variables:
```
    TS_OAUTH_CLIENT_ID
    TS_OAUTH_CLIENT_SECRET

    TSYMBIOTE_ADAPTER_IMAGE
    TSYMBIOTE_WEBUI_IMAGE
```

Uses a MutatingWebhook to intercept pod creation events for labeled pods.
Generates an ephemeral, preapproved auth key with the associated tag: 
 `tag:tsymbiote-adapter`

Injects the newly created auth key into the sidecontainer container configuration.

Sets the pod to ShareProcessNamespace = true.
https://kubernetes.io/docs/tasks/configure-pod-container/share-process-namespace/

Sharing the process namespace allows the tsnet adapter service to interact with the tailscale binary in the other container.
