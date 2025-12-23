# Operator
This operator is only meant to be used in conjunction with Tailscale-Operator.
A mutating webhook was chosen specifically to be compatible with pods created by that operator.

# Known issues
The operator supplies ephemeral credentials at pod creation time.
If a container exits and is restarted, but the pod itself has not been recreated, the credentials are now invalid.

I do not plan on fixing this at current as it is not a common scenario in stable environments.  
The alternatives would require either detecting the container failure and forcing pod restart or managing state, which i do not want to do.

Relevant future update for Kubernetes:
https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/5532-restart-all-containers-on-container-exits/README.md


# Installation
Installation with defaults can be done using the Kustomize bundle:  
[kustomize/bundle.yml](/kustomize/bundle.yml)


Label Namespace and Pod with the following to enable secret/container injection:
```
 tsymbiote-secret-injection: enabled
```

Requires OAuth keys with `auth_keys` scope.
Under the `auth_keys` scope option during key creation, set the tags to:
```
tag:tsymbiote-adapter
tag:tsymbiote-webui
```


Policy file:
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
```

These vars can also be provided, however defaults are set within the container.
The WebUI image can also be set using the CRD.  
```
TSYMBIOTE_ADAPTER_IMAGE
TSYMBIOTE_WEBUI_IMAGE
```