package utils

import (
	"context"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var testObjectName, testObjectNamespace string

func GetTestName() string {
	if testObjectName == "" {
		testObjectName = RandomString(6)
		return testObjectName
	}
	return testObjectName
}

func GetTestNamespace() string {
	if testObjectNamespace == "" {
		testObjectNamespace = RandomString(6)
		return testObjectNamespace
	}
	return testObjectNamespace
}

func GetTestNamespacedName() types.NamespacedName {
	return types.NamespacedName{Name: GetTestName(), Namespace: GetTestNamespace()}
}

func NewTestName() string {
	testObjectName = RandomString(6)
	return testObjectName
}

func NewTestNamespace(k8sClient client.Client, ctx context.Context) error {
	testObjectNamespace = RandomString(6)

	newNamespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: GetTestNamespace(),
		},
	}

	return k8sClient.Create(ctx, newNamespace)
}

func DeleteTestNamespace(k8sClient client.Client, ctx context.Context) error {
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: GetTestNamespace(),
		},
	}
	return k8sClient.Delete(ctx, namespace)
}
