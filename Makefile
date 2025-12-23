.PHONY: deps
deps:
	go mod tidy
	go fmt ./...
	go install golang.org/x/tools/cmd/stringer@latest

.PHONY: generate
generate: deps
	go generate ./...

.PHONY: build
build: generate
	goreleaser build --snapshot --clean

.PHONY: dev
dev: build
	dist/tsymbiote_linux_amd64_v1/tsymbiote webui --generate-auth --dev

.PHONY: web-dev
web-dev:
	cd web-ui && npm run dev