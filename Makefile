.PHONY: deps
deps:
	go install golang.org/x/tools/cmd/stringer@latest

.PHONY: generate
generate: deps
	go generate ./...

.PHONY: build
build:
	go build -o dist/tsymbiote main.go
