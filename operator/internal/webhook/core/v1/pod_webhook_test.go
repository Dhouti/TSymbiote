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
	"os"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("Pod Webhook", func() {
	var (
		obj       *corev1.Pod
		defaulter PodCustomDefaulter
	)

	BeforeEach(func() {
		// Override oauth keys, extra layer against real TS client.
		os.Setenv("TS_OAUTH_CLIENT_ID", "invalid-testing-key")
		os.Setenv("TS_OAUTH_CLIENT_SECRET", "invalid-testing-key")

		os.Setenv("TSYMBIOTE_ADAPTER_IMAGE", "fake-image-for-testing")
		obj = &corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-pod",
				Namespace: "default",
			},
			Spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{
						Name:  "container-one",
						Image: "test",
					},
				},
			},
		}

		defaulter = PodCustomDefaulter{
			Client: k8sClient,
			Scheme: k8sClient.Scheme(),
		}
		Expect(defaulter).NotTo(BeNil(), "Expected defaulter to be initialized")

		Expect(obj).NotTo(BeNil(), "Expected obj to be initialized")
	})

	AfterEach(func() {
	})

	Context("When creating Pod under Defaulting Webhook", func() {

		It("Should apply defaults when a required field is empty", func() {
			defaulter.Default(ctx, obj)
			By("checking that there is more than one container")
			Expect(len(obj.Spec.Containers)).To(Equal(2))
			By("checking that shareProcessNamespace is set")
			Expect(obj.Spec.ShareProcessNamespace).To(HaveValue(Equal(true)))

			debugContainer := obj.Spec.Containers[1]
			By("checking name of debug container")
			Expect(debugContainer.Name).To(Equal("tsymbiote-adapter"))
			By("checking image of debug container")
			Expect(debugContainer.Image).To(Equal("fake-image-for-testing"))
			By("checking capabilities of debug container")
			Expect(debugContainer.SecurityContext.Capabilities.Add).To(Equal([]corev1.Capability{"SYS_PTRACE"}))
			By("checking envFrom of debug container")
			Expect(len(debugContainer.EnvFrom)).To(Equal(1))

		})
	})

})
