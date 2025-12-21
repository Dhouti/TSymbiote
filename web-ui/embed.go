package webuiembed

import (
	"embed"
	"io/fs"
)

//go:embed dist/*
var embedFS embed.FS

func EmbedFS() fs.FS {
	embedFS, err := fs.Sub(embedFS, "dist")
	if err != nil {
		panic(err)
	}
	return embedFS
}
