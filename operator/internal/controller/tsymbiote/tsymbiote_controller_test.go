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
	"os"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	tsymbiotev1alpha1 "github.com/dhouti/tsymbiote/operator/api/tsymbiote/v1alpha1"
	"github.com/dhouti/tsymbiote/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("TSymbiote Controller", func() {
	Context("When reconciling a resource", func() {

		BeforeEach(func() {
			Expect(utils.NewTestNamespace(k8sClient, ctx)).To(Succeed())

			os.Setenv("TSYMBIOTE_WEBUI_IMAGE", "test-image")
		})

		AfterEach(func() {
			Expect(utils.DeleteTestNamespace(k8sClient, ctx)).To(Succeed())
		})
		It("should successfully reconcile the resource", func() {
			By("creating a tsymbiote resource")
			tsymbiote := &tsymbiotev1alpha1.TSymbiote{
				ObjectMeta: metav1.ObjectMeta{
					Name:      utils.GetTestName(),
					Namespace: utils.GetTestNamespace(),
				},
				Spec: tsymbiotev1alpha1.TSymbioteSpec{
					AuthSecretRef: &corev1.SecretEnvSource{
						LocalObjectReference: corev1.LocalObjectReference{
							Name: "test",
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, tsymbiote)).To(Succeed())

			By("Checking that TSymbiote successfully created")
			err := k8sClient.Get(ctx, utils.GetTestNamespacedName(), tsymbiote)
			Expect(err).ToNot(HaveOccurred())

			By("Checking if statefulset was created")
			sts := &appsv1.StatefulSet{}
			Eventually(func() error {
				return k8sClient.Get(ctx, utils.GetTestNamespacedName(), sts)
			}, time.Second*3).Should(Succeed())
		})

		It("should match the specified resource requests/limits", func() {
			By("creating a tsymbiote resource")
			tsymbiote := &tsymbiotev1alpha1.TSymbiote{
				ObjectMeta: metav1.ObjectMeta{
					Name:      utils.GetTestName(),
					Namespace: utils.GetTestNamespace(),
				},
				Spec: tsymbiotev1alpha1.TSymbioteSpec{
					AuthSecretRef: &corev1.SecretEnvSource{
						LocalObjectReference: corev1.LocalObjectReference{
							Name: "test",
						},
					},
					Pod: tsymbiotev1alpha1.PodSpec{
						Resources: &corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								corev1.ResourceCPU:    *resource.NewMilliQuantity(10, resource.DecimalSI),
								corev1.ResourceMemory: *resource.NewQuantity(1*1024*1024*1024, resource.BinarySI),
							},
							Limits: corev1.ResourceList{
								corev1.ResourceCPU:    *resource.NewMilliQuantity(250, resource.DecimalSI),
								corev1.ResourceMemory: *resource.NewQuantity(12*1024*1024*1024, resource.BinarySI),
							},
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, tsymbiote)).To(Succeed())

			By("Checking that TSymbiote successfully created")
			err := k8sClient.Get(ctx, utils.GetTestNamespacedName(), tsymbiote)
			Expect(err).ToNot(HaveOccurred())

			By("Checking if statefulset was created")
			sts := &appsv1.StatefulSet{}
			Eventually(func() error {
				return k8sClient.Get(ctx, utils.GetTestNamespacedName(), sts)
			}, time.Second*3).Should(Succeed())

			By("validating the configured resource requests/limits")
			stsResources := sts.Spec.Template.Spec.Containers[0].Resources
			Expect(stsResources.Requests.Cpu().String()).To(Equal("10m"))
			Expect(stsResources.Limits.Cpu().String()).To(Equal("250m"))
			Expect(stsResources.Requests.Memory().String()).To(Equal("1Gi"))
			Expect(stsResources.Limits.Memory().String()).To(Equal("12Gi"))

			By("updating a single resource request")
			Eventually(func() error {
				k8sClient.Get(ctx, utils.GetTestNamespacedName(), tsymbiote)
				tsymbiote.Spec.Pod.Resources.Requests[corev1.ResourceCPU] = *resource.NewMilliQuantity(150, resource.DecimalSI)
				return k8sClient.Update(ctx, tsymbiote)
			}, time.Second*3).Should(Succeed())

			By("Checking if statefulset was updated")
			Eventually(func() string {
				k8sClient.Get(ctx, utils.GetTestNamespacedName(), sts)
				return sts.Spec.Template.Spec.Containers[0].Resources.Requests.Cpu().String()
			}, time.Second*3).Should(Equal("150m"))

			By("using defaults")
			Eventually(func() error {
				k8sClient.Get(ctx, utils.GetTestNamespacedName(), tsymbiote)
				tsymbiote.Spec.Pod.Resources = nil
				return k8sClient.Update(ctx, tsymbiote)
			}, time.Second*3).Should(Succeed())

			By("Checking if statefulset was updated")
			Eventually(func() string {
				k8sClient.Get(ctx, utils.GetTestNamespacedName(), sts)
				return sts.Spec.Template.Spec.Containers[0].Resources.Requests.Cpu().String()
			}, time.Second*3).Should(Equal("50m"))
			stsResources = sts.Spec.Template.Spec.Containers[0].Resources
			Expect(stsResources.Limits.Cpu().String()).To(Equal("500m"))
			Expect(stsResources.Requests.Memory().String()).To(Equal("512Mi"))
			Expect(stsResources.Limits.Memory().String()).To(Equal("512Mi"))
		})
	})
})
