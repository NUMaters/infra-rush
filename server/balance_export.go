package main

import (
	"bufio"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"
)

func balanceExportHandler(feedbackPath, matchesPath, token string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if token == "" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		provided := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(token)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		path := ""
		switch r.URL.Query().Get("kind") {
		case "matches":
			path = matchesPath
		case "feedback":
			path = feedbackPath
		default:
			http.Error(w, "unknown dataset", http.StatusBadRequest)
			return
		}
		file, err := os.Open(path)
		if err != nil {
			http.Error(w, "dataset unavailable", http.StatusServiceUnavailable)
			return
		}
		defer file.Close()
		var since time.Time
		if value := r.URL.Query().Get("since"); value != "" {
			since, err = time.Parse(time.RFC3339, value)
			if err != nil {
				http.Error(w, "invalid date", http.StatusBadRequest)
				return
			}
		}
		w.Header().Set("Content-Type", "application/x-ndjson")
		scanner := bufio.NewScanner(file)
		scanner.Buffer(make([]byte, 4096), 64*1024)
		for scanner.Scan() {
			line := scanner.Bytes()
			if !since.IsZero() {
				var envelope struct {
					ReceivedAt time.Time `json:"receivedAt"`
				}
				if json.Unmarshal(line, &envelope) != nil || envelope.ReceivedAt.Before(since) {
					continue
				}
			}
			if _, err := w.Write(append(line, '\n')); err != nil {
				return
			}
		}
	}
}
