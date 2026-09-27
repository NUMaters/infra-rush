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

const feedbackBody = `{"id":"83c0e4aa-fb65-4945-9769-505e1584e040","selectedDifficulty":"normal","feltDifficulty":"hard","outcome":"loss","durationSeconds":270,"playerCastleHp":2,"cpuCastleHp":8}`

func feedbackRequest(body, origin string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "http://localhost:8080/feedback", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	return r
}

func TestFeedbackStoresAnonymousResultOnceAcrossRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "feedback.jsonl")
	store, err := newFeedbackStore(path)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		response := httptest.NewRecorder()
		store.serveHTTP(response, feedbackRequest(feedbackBody, "http://localhost:5177"))
		if response.Code != http.StatusNoContent {
			t.Fatalf("request %d: %d: %s", i, response.Code, response.Body.String())
		}
		store, err = newFeedbackStore(path)
		if err != nil {
			t.Fatal(err)
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Count(data, []byte("\n")) != 1 || !bytes.Contains(data, []byte(`"feltDifficulty":"hard"`)) || !bytes.Contains(data, []byte(`"receivedAt":`)) {
		t.Fatalf("unexpected stored records: %s", data)
	}
}

func TestFeedbackRejectsInvalidAndCrossOriginRequests(t *testing.T) {
	path := filepath.Join(t.TempDir(), "feedback.jsonl")
	store, err := newFeedbackStore(path)
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		body, origin string
		want         int
	}{
		{strings.Replace(feedbackBody, `"feltDifficulty":"hard"`, `"feltDifficulty":"expert"`, 1), "", http.StatusBadRequest},
		{strings.Replace(feedbackBody, `"selectedDifficulty":"normal"`, `"name":"Alice","selectedDifficulty":"normal"`, 1), "", http.StatusBadRequest},
		{feedbackBody, "https://untrusted.example", http.StatusForbidden},
	}
	for _, tc := range cases {
		response := httptest.NewRecorder()
		store.serveHTTP(response, feedbackRequest(tc.body, tc.origin))
		if response.Code != tc.want {
			t.Fatalf("got %d, want %d: %s", response.Code, tc.want, response.Body.String())
		}
	}
	preflight := httptest.NewRequest(http.MethodOptions, "http://localhost:8080/feedback", nil)
	preflight.Header.Set("Origin", "http://localhost:5177")
	response := httptest.NewRecorder()
	store.serveHTTP(response, preflight)
	if response.Code != http.StatusNoContent || response.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5177" {
		t.Fatalf("preflight: %d, %v", response.Code, response.Header())
	}
}
