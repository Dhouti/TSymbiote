package utils

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// ServerSideApply is a general func for running Server Side Apply
// Make sure to set ownership references on the target object prior to running.
func ServerSideApply(ctx context.Context, k8sClient client.Client, obj runtime.Object) error {
	// Convert the object to Unstructured to use in server-side apply.
	u := &unstructured.Unstructured{}
	var err error
	u.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return err
	}

	gvks, _, err := k8sClient.Scheme().ObjectKinds(obj)
	if err != nil {
		return err
	}
	if len(gvks) != 1 {
		return fmt.Errorf("found incorrect count of gvks for obj")
	}
	u.SetGroupVersionKind(gvks[0])

	// Run the server-side patch. Set the field owner as tsymbiote-controller and force ownership of field conflicts.
	err = k8sClient.Apply(ctx, client.ApplyConfigurationFromUnstructured(u), client.ForceOwnership, client.FieldOwner("tsymbiote-controller"))
	if err != nil {
		return err
	}

	return nil
}
