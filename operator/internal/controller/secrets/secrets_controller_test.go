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
	"time"

	"github.com/dhouti/tsymbiote/pkg/utils"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"tailscale.com/client/tailscale/v2"

	corev1 "k8s.io/api/core/v1"
)

var _ = Describe("Secrets Controller", func() {
	Context("When reconciling a resource", func() {
		var pod *corev1.Pod
		BeforeEach(func() {
			pod = &corev1.Pod{}
			Expect(utils.NewTestNamespace(k8sClient, ctx)).To(Succeed())

			mockedTailscaleClient := &utils.TailscaleClientMock{
				GenerateDeviceKeyFunc: func(ctx context.Context, s string, strings []string) (*tailscale.Key, error) {
					return &tailscale.Key{Key: "generated-by-mock"}, nil
				},
			}

			secretsReconciler.InjectTailscaleClient(mockedTailscaleClient)

		})

		AfterEach(func() {
			Expect(utils.DeleteTestNamespace(k8sClient, ctx)).To(Succeed())
		})

		It("does not make a secret for an incorrectly labeled pod", func() {
			pod.Name = utils.GetTestName()
			pod.Namespace = utils.GetTestNamespace()
			pod.Spec.Containers = []corev1.Container{
				{
					Name:  "tsymbiote-adapter",
					Image: "no-labels",
					EnvFrom: []corev1.EnvFromSource{
						{
							SecretRef: &corev1.SecretEnvSource{
								LocalObjectReference: corev1.LocalObjectReference{
									Name: "tsymbiote-no-labels",
								},
							},
						},
					},
				},
			}

			By("creating pod with incorrect labels")
			Expect(k8sClient.Create(ctx, pod)).To(Succeed())

			By("ensuring there is no secret")
			allSecrets := &corev1.SecretList{}
			Consistently(func() int {
				_ = k8sClient.List(ctx, allSecrets, client.InNamespace(pod.Namespace))
				return len(allSecrets.Items)
			}, time.Second*1).Should(Equal(0))

			By("updating pod with one of the two labels")
			Expect(k8sClient.Get(ctx, utils.GetTestNamespacedName(), pod)).To(Succeed())
			pod.Labels = map[string]string{
				"tsymbiote-adapter-injection": "enabled",
			}
			Expect(k8sClient.Update(ctx, pod)).To(Succeed())

			By("ensuring there is no secret")
			Consistently(func() int {
				_ = k8sClient.List(ctx, allSecrets, client.InNamespace(pod.Namespace))
				return len(allSecrets.Items)
			}, time.Second*1).Should(Equal(0))

			By("using the other label")
			Expect(k8sClient.Get(ctx, utils.GetTestNamespacedName(), pod)).To(Succeed())
			pod.Labels = map[string]string{
				"tsymbiote-adapter-injected": "true",
			}
			Expect(k8sClient.Update(ctx, pod)).To(Succeed())

			By("ensuring there is no secret")
			Consistently(func() int {
				_ = k8sClient.List(ctx, allSecrets, client.InNamespace(pod.Namespace))
				return len(allSecrets.Items)
			}, time.Second*1).Should(Equal(0))

			By("using incorrect label values")
			Expect(k8sClient.Get(ctx, utils.GetTestNamespacedName(), pod)).To(Succeed())
			pod.Labels = map[string]string{
				"tsymbiote-adapter-injection": "disabled",
				"tsymbiote-adapter-injected":  "true",
			}
			Expect(k8sClient.Update(ctx, pod)).To(Succeed())

			By("ensuring there is no secret")
			Consistently(func() int {
				_ = k8sClient.List(ctx, allSecrets, client.InNamespace(pod.Namespace))
				return len(allSecrets.Items)
			}, time.Second*1).Should(Equal(0))

		})

		It("creates a secret when all labels are present", func() {
			pod.Name = utils.GetTestName()
			pod.Namespace = utils.GetTestNamespace()
			pod.Labels = map[string]string{
				"tsymbiote-adapter-injection": "enabled",
				"tsymbiote-adapter-injected":  "true",
			}
			pod.Spec.Containers = []corev1.Container{
				{
					Name:  "tsymbiote-adapter",
					Image: "no-labels",
					EnvFrom: []corev1.EnvFromSource{
						{
							SecretRef: &corev1.SecretEnvSource{
								LocalObjectReference: corev1.LocalObjectReference{
									Name: "tsymbiote-with-labels",
								},
							},
						},
					},
				},
			}

			err := k8sClient.Create(ctx, pod)
			Expect(err).NotTo(HaveOccurred())

			// Ensure a secret is created
			allSecrets := &corev1.SecretList{}
			Eventually(func() int {
				_ = k8sClient.List(ctx, allSecrets, client.InNamespace(pod.Namespace))
				return len(allSecrets.Items)
			}, time.Second*2).Should(Equal(1))

			targetSecret := allSecrets.Items[0]
			Expect(targetSecret.Data).To(HaveKeyWithValue("TS_AUTHKEY", []byte("generated-by-mock")))
		})
	})
})
