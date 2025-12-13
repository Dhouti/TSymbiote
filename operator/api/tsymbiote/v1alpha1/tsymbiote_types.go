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

package v1alpha1

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PodSpec struct {
	// +optional
	Tolerations []corev1.Toleration `json:"tolerations,omitempty"`
	// +optional
	Resources *corev1.ResourceRequirements `json:"resources,omitempty"`
	// +optional
	Affinity *corev1.Affinity `json:"affinity,omitempty"`
	// +optional
	// +mapType=atomic
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`
	// +optional
	ImagePullPolicy corev1.PullPolicy `json:"imagePullPolicy,omitempty"`
}

// TSymbioteSpec defines the desired state of TSymbiote
type TSymbioteSpec struct {
	// +optional
	Pod PodSpec `json:"pod,omitempty"`

	// The secret to load oauth credentials from. This field is required.
	AuthSecretRef *corev1.SecretEnvSource `json:"authSecretRef"`

	// AllowedUsers is a list of Tailscale users that are allowed to access the webui.
	// +optional
	AllowedUsers []string `json:"allowedUsers,omitempty"`

	// Image specifies the image to deploy, including image tag.
	// This overrides the default baked into the operator image.
	// +optional
	Image string `json:"image,omitempty"`

	// Hostname allows setting the default hostname for the tsnet service.
	// +optional
	Hostname string `json:"hostname,omitempty"`
}

const (
	// TSymbioteReady represents the status of the TSymbiote reconciliation
	TSymbioteReady = "Available"
	// TSymbioteProgressing represents the status used when the TSymbiote is being reconciled
	TSymbioteProgressing = "Progressing"
	// TSymbioteDegraded represents the status used when the TSymbiote has encountered an error
	TSymbioteDegraded = "Degraded"
)

// TSymbioteStatus defines the observed state of TSymbiote.
type TSymbioteStatus struct {
	// The status of each condition is one of True, False, or Unknown.
	// +listType=map
	// +listMapKey=type
	// +optional
	Conditions []metav1.Condition `json:"conditions,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

// TSymbiote is the Schema for the tsymbiotes API
type TSymbiote struct {
	metav1.TypeMeta `json:",inline"`

	// metadata is a standard object metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitzero"`

	// spec defines the desired state of TSymbiote
	// +required
	Spec TSymbioteSpec `json:"spec"`

	// status defines the observed state of TSymbiote
	// +optional
	Status TSymbioteStatus `json:"status,omitzero"`
}

// +kubebuilder:object:root=true

// TSymbioteList contains a list of TSymbiote
type TSymbioteList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitzero"`
	Items           []TSymbiote `json:"items"`
}

func init() {
	SchemeBuilder.Register(&TSymbiote{}, &TSymbioteList{})
}
