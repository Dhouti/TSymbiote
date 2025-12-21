.PHONY: deps
deps:
	go install golang.org/x/tools/cmd/stringer@latest

.PHONY: generate
generate: deps
	go generate ./...

.PHONY: build
build: deps
	goreleaser build --snapshot --clean

.PHONY: dev
dev: build
	dist/tsymbiote_linux_amd64_v1/tsymbiote webui --dev --generate-auth