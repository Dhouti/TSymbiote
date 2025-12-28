/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package secrets

import (
	"context"
	"fmt"
	"strings"

	"github.com/dhouti/tsymbiote/pkg/utils"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	corev1 "k8s.io/api/core/v1"
)

// SecretsReconciler reconciles when a watched pod is updated
type SecretsReconciler struct {
	client.Client
	utils.TailscaleClient
	Scheme *runtime.Scheme
}

func (r *SecretsReconciler) InjectTailscaleClient(injectClient utils.TailscaleClient) {
	r.TailscaleClient = injectClient
}

// +kubebuilder:rbac:groups="",resources=pods,verbs=get;list;watch
// +kubebuilder:rbac:groups="",resources=secrets,verbs=get;list;watch;create;update;patch;

func (r *SecretsReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := logf.FromContext(ctx)

	// Client is nil, initialize the real oauth client.
	if r.TailscaleClient == nil {
		tsClient, err := utils.NewTSOAuthClient([]string{"auth_keys"})
		if err != nil {
			log.Error(err, "failed to initialize tailscale oauth client")
			return ctrl.Result{}, err
		}
		r.TailscaleClient = tsClient
	}

	// Fetch the pod that triggered the reconcile event
	pod := &corev1.Pod{}
	err := r.Get(ctx, req.NamespacedName, pod)
	if err != nil {
		if !k8serrors.IsNotFound(err) {
			log.Error(err, "failed to get pod that caused reconcile")
			return ctrl.Result{}, err
		}
		// Object doesn't exist, probably deleted
		return ctrl.Result{}, nil
	}

	// Find the secretRef name and try to fetch the corresponding object.
	var secretName string
	for _, container := range pod.Spec.Containers {
		// Not ours, get out of here!
		if container.Name != "tsymbiote-adapter" && container.Name != "tsymbiote-webui" {
			continue
		}

		for _, envEntry := range container.EnvFrom {
			if envEntry.SecretRef != nil {
				if strings.Contains(envEntry.SecretRef.Name, "tsymbiote-inject") {
					secretName = envEntry.SecretRef.Name
					break
				}
			}
		}
	}

	// SecretName is not set, eject
	if secretName == "" {
		return ctrl.Result{}, fmt.Errorf("secret name was not found in pod")
	}

	secret := &corev1.Secret{}
	secretNamespacedName := types.NamespacedName{Name: secretName, Namespace: pod.Namespace}
	err = r.Get(ctx, secretNamespacedName, secret)
	if err != nil {
		if !k8serrors.IsNotFound(err) {
			log.Error(err, "failed to get associated secret")
			return ctrl.Result{}, err
		}
	} else {
		// no error from Get, Secret was found, do nothing
		return ctrl.Result{}, nil
	}

	// Default to adapter, but support webui.
	deviceTag := []string{"tag:tsymbiote-adapter"}
	for _, container := range pod.Spec.Containers {
		if container.Name == "tsymbiote-webui" {
			deviceTag = []string{"tag:tsymbiote-webui"}
			break
		}
	}

	// Secret doesn't exist, create a new key and populate it.
	// This key is ephemeral as we don't want/need to manage a permanent auth key for a service we don't fully control.
	authKey, err := r.GenerateDeviceKey(ctx, pod.Name, deviceTag)
	if err != nil {
		log.Error(err, "failed generate device key")
		return ctrl.Result{}, fmt.Errorf("failed to generate device key for pod: %w", err)
	}

	// Build a secret object then apply it.
	secret = r.buildSecret(secretNamespacedName, authKey.Key)
	err = r.Apply(ctx, pod, secret)
	if err != nil {
		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

func (r *SecretsReconciler) buildSecret(secretNamespacedName types.NamespacedName, authKey string) *corev1.Secret {
	secret := &corev1.Secret{}
	secret.Name = secretNamespacedName.Name
	secret.Namespace = secretNamespacedName.Namespace
	secret.Type = corev1.SecretTypeOpaque
	secret.StringData = map[string]string{
		"TS_AUTHKEY": authKey,
	}
	return secret
}

func (r *SecretsReconciler) Apply(ctx context.Context, pod *corev1.Pod, obj client.Object) error {
	// Set owner reference to the pod that triggered the reconcile
	// garbage collection
	// Sadly this cannot be tested in EnvTest :(
	err := controllerutil.SetOwnerReference(pod, obj, r.Scheme)
	if err != nil {
		return err
	}

	err = utils.ServerSideApply(ctx, r.Client, obj)
	if err != nil {
		return err
	}

	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *SecretsReconciler) SetupWithManager(mgr ctrl.Manager) error {
	watchFilter := func(ctx context.Context, obj client.Object) []reconcile.Request {
		// Only enqueue a reconcile if the pod has the correct labels.
		labels := obj.GetLabels()

		injectEnabledVal, ok := labels["tsymbiote-secret-injection"]
		if !ok || injectEnabledVal != "enabled" {
			// Throw away event if the label is not set appropriately.
			return nil
		}

		injectedVal, ok := labels["tsymbiote-secret-injected"]
		if !ok || injectedVal != "true" {
			// Throw away event if the label is not set appropriately.
			return nil
		}

		// Enqueue reconcile request for the pod object
		return []ctrl.Request{{NamespacedName: client.ObjectKeyFromObject(obj)}}
	}

	return ctrl.NewControllerManagedBy(mgr).
		Named("secrets").
		Watches(&corev1.Pod{}, handler.TypedEnqueueRequestsFromMapFunc(watchFilter)).
		Complete(r)
}
