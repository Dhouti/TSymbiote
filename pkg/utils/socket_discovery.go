package utils

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"time"
)

// DiscoverSocket is a retry wrapper around discoverSocket
func DiscoverSocket() (string, error) {
	// The socket sometimes takes a second to initialize, retry a few times.
	outPath := ""
	attempts := 0
	for attempts < 4 {
		socketPath, err := discoverSocket()
		if err != nil {
			if os.IsNotExist(err) && attempts < 4 {
				// Short sleep, try again
				attempts++
				time.Sleep(time.Millisecond * 150)
				continue
			}
			return outPath, err
		}

		outPath = socketPath
		break
	}

	return outPath, nil
}

var socketRegex = regexp.MustCompile("^[0-9]+$")

// discoverSocket looks for PID directories in /proc and checks if there is a tailscaled.sock we can use
// This is a bit of a mess, but it works.
func discoverSocket() (string, error) {
	files, err := os.ReadDir("/proc")
	if err != nil {
		return "", err
	}

	for _, file := range files {
		// If a file is a directory and is only numbers, like a PID
		if file.IsDir() && socketRegex.MatchString(file.Name()) {
			// There tend not to be a lot of PIDs in containers for good reason, so this isn't a stretch.
			socketPath := fmt.Sprintf("/proc/%s/root/tmp/tailscaled.sock", file.Name())
			fInfo, err := os.Stat(socketPath)
			if err != nil {
				if !errors.Is(err, os.ErrNotExist) {
					return "", fmt.Errorf("encountered during socket discovery: %w", err)
				}
				// File didn't exist, carry on
				continue
			}
			// Validate that it's a socket
			if fInfo.Mode().Type() == fs.ModeSocket {
				return socketPath, nil
			} else {
				return "", fmt.Errorf("found matching tailscaled.sock that wasn't a socket")
			}
		}
	}

	return "", os.ErrNotExist
}
