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

.PHONY: webui-dev
webui-dev:
	TSNET_FORCE_LOGIN=1 dist/tsymbiote_linux_amd64_v1/tsymbiote webui --generate-auth --dev

.PHONY: adapter-dev
adapter-dev:
	TSNET_FORCE_LOGIN=1 dist/tsymbiote_linux_amd64_v1/tsymbiote adapter

.PHONY: web-dev
web-dev:
	cd web-ui && npm run dev