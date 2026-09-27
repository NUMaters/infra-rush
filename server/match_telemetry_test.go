package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const matchBody = `{"id":"83c0e4aa-fb65-4945-9769-505e1584e040","selectedDifficulty":"normal","configVersion":"a1b2c3d4","outcome":"loss","durationSeconds":270,"playerCastleHp":2,"cpuCastleHp":8}`

func TestSoloMatchTelemetryDeduplicatesAndExportsPrivately(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "matches.jsonl")
	feedbackPath := filepath.Join(dir, "feedback.jsonl")
	if err := os.WriteFile(feedbackPath, []byte(""), 0600); err != nil {
		t.Fatal(err)
	}
	store, err := newMatchStore(path)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		response := httptest.NewRecorder()
		store.serveHTTP(response, feedbackRequest(matchBody, "http://localhost:5177"))
		if response.Code != http.StatusNoContent {
			t.Fatalf("post %d: %d: %s", i, response.Code, response.Body.String())
		}
		store, err = newMatchStore(path)
		if err != nil {
			t.Fatal(err)
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Count(data, []byte("\n")) != 1 || !bytes.Contains(data, []byte(`"configVersion":"a1b2c3d4"`)) {
		t.Fatalf("unexpected records: %s", data)
	}
	handler := balanceExportHandler(feedbackPath, path, "secret-for-test")
	request := httptest.NewRequest(http.MethodGet, "/balance/export?kind=matches", nil)
	response := httptest.NewRecorder()
	handler(response, request)
	if response.Code != http.StatusUnauthorized || bytes.Contains(response.Body.Bytes(), []byte("configVersion")) {
		t.Fatalf("unauthorized export: %d", response.Code)
	}
	request.Header.Set("Authorization", "Bearer secret-for-test")
	response = httptest.NewRecorder()
	handler(response, request)
	if response.Code != http.StatusOK || !bytes.Equal(response.Body.Bytes(), data) {
		t.Fatalf("authorized export: %d: %s", response.Code, response.Body.String())
	}
	request = httptest.NewRequest(http.MethodGet, "/balance/export?kind=matches&since=2100-01-01T00:00:00Z", nil)
	request.Header.Set("Authorization", "Bearer secret-for-test")
	response = httptest.NewRecorder()
	handler(response, request)
	if response.Code != http.StatusOK || response.Body.Len() != 0 {
		t.Fatalf("date filter: %d: %s", response.Code, response.Body.String())
	}
}

func TestSoloMatchTelemetryRejectsInvalidVersionAndOrigin(t *testing.T) {
	store, err := newMatchStore(filepath.Join(t.TempDir(), "matches.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		body, origin string
		want         int
	}{
		{strings.Replace(matchBody, "a1b2c3d4", "invalid-version", 1), "", http.StatusBadRequest},
		{matchBody, "https://untrusted.example", http.StatusForbidden},
	} {
		response := httptest.NewRecorder()
		store.serveHTTP(response, feedbackRequest(tc.body, tc.origin))
		if response.Code != tc.want {
			t.Fatalf("got %d, want %d", response.Code, tc.want)
		}
	}
}
