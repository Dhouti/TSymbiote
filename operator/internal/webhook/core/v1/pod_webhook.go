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

package v1

import (
	"context"
	"errors"
	"fmt"
	"os"

	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	corev1 "k8s.io/api/core/v1"
)

// log is for logging in this package.
var podlog = logf.Log.WithName("pod-resource")

// SetupPodWebhookWithManager registers the webhook for Pod in the manager.
func (d *PodCustomDefaulter) SetupPodWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr).For(&corev1.Pod{}).
		WithDefaulter(d).
		WithDefaulterCustomPath("/mutate-tsymbiote-adapter").
		Complete()
}

// +kubebuilder:webhook:path=/mutate-tsymbiote-adapter,mutating=true,failurePolicy=ignore,sideEffects=None,groups="",resources=pods,verbs=create,versions=v1,name=tsymbiote-adapter.kb.io,admissionReviewVersions=v1

// PodCustomDefaulter struct is responsible for setting default values on the custom resource of the
// Kind Pod when those are created or updated.
//
// NOTE: The +kubebuilder:object:generate=false marker prevents controller-gen from generating DeepCopy methods,
// as it is used only for temporary operations and does not need to be deeply copied.
type PodCustomDefaulter struct {
	client.Client

	Scheme *runtime.Scheme
}

var _ webhook.CustomDefaulter = &PodCustomDefaulter{}

// Default implements webhook.CustomDefaulter so a webhook will be registered for the Kind Pod.
func (d *PodCustomDefaulter) Default(ctx context.Context, obj runtime.Object) error {
	pod, ok := obj.(*corev1.Pod)
	if !ok {
		err := fmt.Errorf("expected an Pod object but got %T", obj)
		podlog.Error(err, "failed to default pod")
		return err
	}
	podlog.Info("Defaulting for Pod", "name", pod.GetName())

	for _, container := range pod.Spec.Containers {
		if container.Name == "tsymbiote-webui" {
			return d.defaultWebUIPod(pod)
		}
	}

	return d.defaultAdapterPod(ctx, pod)
}

func (d *PodCustomDefaulter) defaultAdapterPod(ctx context.Context, pod *corev1.Pod) error {
	adapterImage, ok := os.LookupEnv("TSYMBIOTE_ADAPTER_IMAGE")
	if !ok {
		err := errors.New("TSYMBIOTE_ADAPTER_IMAGE must be set.")
		podlog.Error(err, "failed to default pod")
		return err
	}

	// This injects an adapter that shares the process namespace with the main tailscale container.
	// This allows us to access the running tailscale binary over the /proc/$pid/root link.
	// The adapter is only accesible over the tailnet by default.
	shareProcessNamespace := true
	pod.Spec.ShareProcessNamespace = &shareProcessNamespace

	adapter := corev1.Container{
		Name:  "tsymbiote-adapter",
		Image: adapterImage,
		// TODO: This should be removed later, makes testing easier though.
		ImagePullPolicy: "Always",
		SecurityContext: &corev1.SecurityContext{
			Capabilities: &corev1.Capabilities{
				Add: []corev1.Capability{"SYS_PTRACE"},
			},
		},
		Command: []string{"/tsymbiote"},
		Args: []string{
			"adapter",
			"--discover-socket",
			"--hostname=tsymbiote-$(POD_NAME)",
		},
		// Mount new secret to populate TS_AUTHKEY env var for tsnet service.
		EnvFrom: []corev1.EnvFromSource{
			{
				SecretRef: &corev1.SecretEnvSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: fmt.Sprintf("tsymbiote-inject-%s", pod.Name),
					},
				},
			},
		},
		Env: []corev1.EnvVar{
			{
				Name: "POD_NAME",
				ValueFrom: &corev1.EnvVarSource{
					FieldRef: &corev1.ObjectFieldSelector{
						FieldPath: "metadata.name",
					},
				},
			},
		},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				"cpu":    *resource.NewMilliQuantity(100, resource.DecimalSI),
				"memory": *resource.NewQuantity(0.5*1024*1024*1024, resource.BinarySI),
			},
			Limits: corev1.ResourceList{
				"cpu":    *resource.NewMilliQuantity(1000, resource.DecimalSI),
				"memory": *resource.NewQuantity(1*1024*1024*1024, resource.BinarySI),
			},
		},
	}

	pod.Spec.Containers = append(pod.Spec.Containers, adapter)
	// Add a label to show that injection was successful.
	// This is used in the secrets controller for filtering.
	if pod.Labels == nil {
		podlog.Info("Pod didn't have labels, setting to empty map.")
		pod.Labels = make(map[string]string)
	}

	pod.Labels["tsymbiote-secret-injected"] = "true"
	return nil
}

func (d *PodCustomDefaulter) defaultWebUIPod(pod *corev1.Pod) error {
	// This injects a secret into WebUI pods.
	// This allows us to use ephemeral keys without storing permanent state.

	pod.Spec.Containers[0].EnvFrom = append(pod.Spec.Containers[0].EnvFrom, corev1.EnvFromSource{
		SecretRef: &corev1.SecretEnvSource{
			LocalObjectReference: corev1.LocalObjectReference{
				Name: fmt.Sprintf("tsymbiote-inject-%s", pod.Name),
			},
		},
	})

	// Add a label to show that injection was successful.
	// This is used in the secrets controller for filtering.
	if pod.Labels == nil {
		podlog.Info("Pod didn't have labels, setting to empty map.")
		pod.Labels = make(map[string]string)
	}

	pod.Labels["tsymbiote-secret-injected"] = "true"
	return nil
}
