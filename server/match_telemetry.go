package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

type soloMatchReport struct {
	ID                 string    `json:"id"`
	SelectedDifficulty string    `json:"selectedDifficulty"`
	ConfigVersion      string    `json:"configVersion"`
	Outcome            string    `json:"outcome"`
	DurationSeconds    int       `json:"durationSeconds"`
	PlayerCastleHP     int       `json:"playerCastleHp"`
	CPUCastleHP        int       `json:"cpuCastleHp"`
	ReceivedAt         time.Time `json:"receivedAt"`
}

type matchStore struct {
	mu   sync.Mutex
	path string
	seen map[string]bool
}

var configVersionPattern = regexp.MustCompile(`^[0-9a-f]{8}$`)

func validMatchReport(v soloMatchReport) bool {
	valid := feedbackID.MatchString(v.ID) && validDifficulty(v.SelectedDifficulty) &&
		configVersionPattern.MatchString(v.ConfigVersion) &&
		(v.Outcome == "win" || v.Outcome == "loss" || v.Outcome == "draw") &&
		v.DurationSeconds >= 0 && v.DurationSeconds <= 600 &&
		v.PlayerCastleHP >= 0 && v.PlayerCastleHP <= 50 &&
		v.CPUCastleHP >= 0 && v.CPUCastleHP <= 50
	if !valid {
		return false
	}
	if v.Outcome == "win" {
		return v.PlayerCastleHP > v.CPUCastleHP
	}
	if v.Outcome == "loss" {
		return v.PlayerCastleHP < v.CPUCastleHP
	}
	return v.PlayerCastleHP == v.CPUCastleHP && v.DurationSeconds == 360
}

func newMatchStore(path string) (*matchStore, error) {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDONLY, 0600)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	store := &matchStore{path: path, seen: make(map[string]bool)}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var record soloMatchReport
		if json.Unmarshal(scanner.Bytes(), &record) == nil && feedbackID.MatchString(record.ID) {
			store.seen[record.ID] = true
		}
	}
	return store, scanner.Err()
}

func (s *matchStore) serveHTTP(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		if !checkOrigin(r) {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "JSON required", http.StatusUnsupportedMediaType)
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	var record soloMatchReport
	if err := decoder.Decode(&record); err != nil {
		http.Error(w, "invalid match", http.StatusBadRequest)
		return
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) || !validMatchReport(record) || !record.ReceivedAt.IsZero() {
		http.Error(w, "invalid match", http.StatusBadRequest)
		return
	}
	record.ReceivedAt = time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.seen[record.ID] {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	file, err := os.OpenFile(s.path, os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		http.Error(w, "match storage unavailable", http.StatusServiceUnavailable)
		return
	}
	data, err := json.Marshal(record)
	if err == nil {
		_, err = file.Write(append(data, '\n'))
	}
	if err == nil {
		err = file.Sync()
	}
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		http.Error(w, "match storage unavailable", http.StatusServiceUnavailable)
		return
	}
	s.seen[record.ID] = true
	w.WriteHeader(http.StatusNoContent)
}
