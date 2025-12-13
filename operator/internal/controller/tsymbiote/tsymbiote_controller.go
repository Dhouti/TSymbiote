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

package tsymbiote

import (
	"context"
	"fmt"
	"os"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	logf "sigs.k8s.io/controller-runtime/pkg/log"

	tsymbiotev1alpha1 "github.com/dhouti/tsymbiote/operator/api/tsymbiote/v1alpha1"
	"github.com/dhouti/tsymbiote/pkg/utils"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TSymbioteReconciler reconciles a TSymbiote object
type TSymbioteReconciler struct {
	client.Client
	utils.TailscaleClient
	Scheme *runtime.Scheme
}

func (r *TSymbioteReconciler) InjectTailscaleClient(injectClient utils.TailscaleClient) {
	r.TailscaleClient = injectClient
}

// +kubebuilder:rbac:groups=tsymbiote.dhouti.dev,resources=tsymbiotes,verbs=get;list;watch;update;patch;
// +kubebuilder:rbac:groups=tsymbiote.dhouti.dev,resources=tsymbiotes/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=tsymbiote.dhouti.dev,resources=tsymbiotes/finalizers,verbs=update

// +kubebuilder:rbac:groups=apps,resources=statefulsets,verbs=get;list;watch;create;update;patch

// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.22.4/pkg/reconcile
func (r *TSymbioteReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := logf.FromContext(ctx)

	log.Info("starting reconcile")

	fetchobj := &tsymbiotev1alpha1.TSymbiote{}
	err := r.Get(ctx, req.NamespacedName, fetchobj)
	if err != nil {
		if !k8serrors.IsNotFound(err) {
			return ctrl.Result{}, err
		}
		log.Info("object that caused reconciled does not exist, probably deleted")
		return ctrl.Result{}, nil
	}

	tsymbioteObj := fetchobj.DeepCopy()

	// Initialize status conditions if not yet present
	if len(tsymbioteObj.Status.Conditions) == 0 {
		meta.SetStatusCondition(&tsymbioteObj.Status.Conditions, metav1.Condition{
			Type:    tsymbiotev1alpha1.TSymbioteProgressing,
			Status:  metav1.ConditionUnknown,
			Reason:  "Reconciling",
			Message: "Starting reconciliation",
		})
		// Update the status
		err = r.Status().Update(ctx, tsymbioteObj)
		if err != nil {
			return ctrl.Result{}, err
		}

		// Re-fetch the TSymbiote after updating the status
		err = r.Get(ctx, req.NamespacedName, tsymbioteObj)
		if err != nil {
			r.UpdateStatusError(ctx, tsymbioteObj, "FailedTSymbioteGet", err)
			return ctrl.Result{}, err
		}
	}

	sts := r.buildStatefulSet(tsymbioteObj)

	// Apply the statefulset
	err = r.ApplyWithOwnerRef(ctx, tsymbioteObj, sts)
	if err != nil {
		// Granular status updates handled inside.
		return ctrl.Result{}, err
	}

	meta.SetStatusCondition(&tsymbioteObj.Status.Conditions, metav1.Condition{
		Type:    tsymbiotev1alpha1.TSymbioteReady,
		Status:  metav1.ConditionTrue,
		Reason:  "Ready",
		Message: "Reconciliation completed",
	})

	// Update the status
	err = r.Status().Update(ctx, tsymbioteObj)
	if err != nil {
		return ctrl.Result{}, err
	}
	return ctrl.Result{}, nil
}

func (r *TSymbioteReconciler) getHostname(tsymbioteObj *tsymbiotev1alpha1.TSymbiote) string {
	hostname := tsymbioteObj.Name
	if tsymbioteObj.Spec.Hostname != "" {
		hostname = tsymbioteObj.Spec.Hostname
	}
	return hostname
}

func (r *TSymbioteReconciler) buildStatefulSet(tsymbioteObj *tsymbiotev1alpha1.TSymbiote) client.Object {
	// Ehhh, maybe use templates instead. This makes me sad. Maybe i port some code later.
	sts := &appsv1.StatefulSet{}
	sts.Name = tsymbioteObj.Name
	sts.Namespace = tsymbioteObj.Namespace
	staticReplicas := int32(1)
	sts.Spec.Replicas = &staticReplicas
	sts.Spec.Selector = &metav1.LabelSelector{
		MatchLabels: map[string]string{
			"app": "tsymbiote-webui",
		},
	}
	sts.Spec.Template.Spec.Affinity = tsymbioteObj.Spec.Pod.Affinity
	sts.Spec.Template.Spec.NodeSelector = tsymbioteObj.Spec.Pod.NodeSelector
	sts.Spec.Template.Spec.Tolerations = tsymbioteObj.Spec.Pod.Tolerations
	sts.Spec.Template.Spec.Resources = tsymbioteObj.Spec.Pod.Resources
	sts.Spec.Template.Labels = map[string]string{
		"app":                        "tsymbiote-webui",
		"tsymbiote-secret-injection": "enabled",
	}

	// Default resource requests/limits
	desiredResources := corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			corev1.ResourceCPU:    *resource.NewMilliQuantity(50, resource.DecimalSI),
			corev1.ResourceMemory: *resource.NewQuantity(.5*1024*1024*1024, resource.BinarySI),
		},
		Limits: corev1.ResourceList{
			corev1.ResourceCPU:    *resource.NewMilliQuantity(500, resource.DecimalSI),
			corev1.ResourceMemory: *resource.NewQuantity(.5*1024*1024*1024, resource.BinarySI),
		},
	}

	// The default image is baked into the container.
	uiImage := os.Getenv("TSYMBIOTE_WEBUI_IMAGE")
	if tsymbioteObj.Spec.Image != "" {
		uiImage = tsymbioteObj.Spec.Image
	}

	hostname := r.getHostname(tsymbioteObj)

	configuredResources := tsymbioteObj.Spec.Pod.Resources
	if configuredResources != nil {
		if configuredResources.Requests != nil {
			if configuredResources.Requests.Cpu() != nil {
				desiredResources.Requests[corev1.ResourceCPU] = *configuredResources.Requests.Cpu()
			}
			if configuredResources.Requests.Memory() != nil {
				desiredResources.Requests[corev1.ResourceMemory] = *configuredResources.Requests.Memory()
			}
		}
		if configuredResources.Limits != nil {
			if configuredResources.Limits.Cpu() != nil {
				desiredResources.Limits[corev1.ResourceCPU] = *configuredResources.Limits.Cpu()
			}
			if configuredResources.Limits.Memory() != nil {
				desiredResources.Limits[corev1.ResourceMemory] = *configuredResources.Limits.Memory()
			}
		}
	}

	sts.Spec.Template.Spec.Containers = []corev1.Container{
		{
			Name:            "tsymbiote-webui",
			Image:           uiImage,
			ImagePullPolicy: tsymbioteObj.Spec.Pod.ImagePullPolicy,
			Command:         []string{"/tsymbiote"},
			Args: []string{
				"webui",
				fmt.Sprintf("--hostname=%s", hostname),
				fmt.Sprintf("--allowed-users=%s", strings.Join(tsymbioteObj.Spec.AllowedUsers, ",")),
			},
			EnvFrom: []corev1.EnvFromSource{
				// oauth credentials
				{
					SecretRef: tsymbioteObj.Spec.AuthSecretRef,
				},
			},
			Resources: desiredResources,
		},
	}
	return sts
}

func (r *TSymbioteReconciler) UpdateStatusError(ctx context.Context, obj *tsymbiotev1alpha1.TSymbiote, reason string, reconcileErr error) {
	meta.SetStatusCondition(&obj.Status.Conditions, metav1.Condition{
		Type:    tsymbiotev1alpha1.TSymbioteDegraded,
		Status:  metav1.ConditionTrue,
		Reason:  reason,
		Message: reconcileErr.Error(),
	})

	err := r.Status().Update(ctx, obj)
	if err != nil {
		log := logf.FromContext(ctx)
		log.Error(err, "failed to update status")
	}

}

func (r *TSymbioteReconciler) ApplyWithOwnerRef(ctx context.Context, tsymbioteObj *tsymbiotev1alpha1.TSymbiote, obj client.Object) error {
	// Set the tsymbiote Object as the owner, garbage collect on delete.
	// Sadly this cannot be tested in EnvTest :(
	err := controllerutil.SetControllerReference(tsymbioteObj, obj, r.Scheme)
	if err != nil {
		r.UpdateStatusError(ctx, tsymbioteObj, "FailedSetControllerRef", err)
		return err
	}

	err = utils.ServerSideApply(ctx, r.Client, obj)
	if err != nil {
		r.UpdateStatusError(ctx, tsymbioteObj, "FailedSSA", err)
		return err
	}

	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *TSymbioteReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&tsymbiotev1alpha1.TSymbiote{}).
		Owns(&appsv1.StatefulSet{}).
		Named("tsymbiote-tsymbiote").
		Complete(r)
}
