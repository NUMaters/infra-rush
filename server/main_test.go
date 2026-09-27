package main

import (
	"encoding/json"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"
)

func testPeer() *peer { return &peer{send: make(chan []byte, 64), connected: true} }

func TestWebSocketOriginForPublishedPages(t *testing.T) {
	t.Setenv("INFRA_ALLOWED_ORIGINS", "https://numaters.github.io")
	request := httptest.NewRequest("GET", "https://game.example/ws", nil)
	for _, origin := range []string{"https://numaters.github.io", "https://game.example"} {
		request.Header.Set("Origin", origin)
		if !checkOrigin(request) {
			t.Fatalf("rejected trusted origin %s", origin)
		}
	}
	for _, origin := range []string{"https://numaters.github.io.evil.example", "https://another.example", "file://numaters.github.io"} {
		request.Header.Set("Origin", origin)
		if checkOrigin(request) {
			t.Fatalf("accepted untrusted origin %s", origin)
		}
	}
}

func TestLockedRoomSequenceAndReconnect(t *testing.T) {
	h := newHub(configForTest(t))
	a, b := testPeer(), testPeer()
	h.handle(a, incoming{Type: "hello"})
	h.handle(b, incoming{Type: "hello"})
	h.handle(a, incoming{Type: "create"})
	if a.room == nil || !regexp.MustCompile(`^[0-9]{5}$`).MatchString(a.room.id) {
		t.Fatalf("invalid room id: %v", a.room)
	}
	h.handle(b, incoming{Type: "join", RoomID: "AB123"})
	if b.room != nil {
		t.Fatal("accepted a nonnumeric invitation")
	}
	h.handle(b, incoming{Type: "join", RoomID: a.room.id})
	if b.room != a.room || b.team != "red" {
		t.Fatal("friend did not join as red")
	}
	h.handle(a, incoming{Type: "name", Name: "Rin"})
	h.handle(b, incoming{Type: "name", Name: "Sora"})
	h.handle(a, incoming{Type: "ready", Ready: true})
	if a.room.running {
		t.Fatal("started before both ready")
	}
	h.handle(b, incoming{Type: "ready", Ready: true})
	if !a.room.running || a.room.game == nil {
		t.Fatal("did not start")
	}
	game := a.room.game
	if a.room.startAt.Before(time.Now()) {
		t.Fatal("countdown start time was not scheduled")
	}
	h.handle(a, incoming{Type: "command", Seq: 1, Command: Command{BotID: "blue-0", Action: "mine"}})
	if game.bot("blue-0").Action != nil {
		t.Fatal("command ran during countdown")
	}
	h.tick()
	if game.Time != 0 {
		t.Fatal("game clock advanced during countdown")
	}
	a.room.startAt = time.Now().Add(-time.Millisecond)
	h.handle(a, incoming{Type: "command", Seq: 1, Command: Command{BotID: "blue-0", Action: "mine"}})
	if game.bot("blue-0").Action == nil {
		t.Fatal("command not applied")
	}
	before := game.EventSequence
	h.handle(a, incoming{Type: "command", Seq: 1, Command: Command{BotID: "blue-1", Action: "mine"}})
	if game.EventSequence != before || game.bot("blue-1").Action != nil {
		t.Fatal("duplicate sequence was executed")
	}
	h.handle(a, incoming{Type: "command", Seq: 2, Command: Command{BotID: "red-0", Action: "mine"}})
	if game.bot("red-0").Action != nil {
		t.Fatal("client commanded opponent bot")
	}

	a.connected = false
	// A restarted browser can take longer than a few seconds to reload its GLBs.
	a.disconnectedAt = time.Now().Add(-45 * time.Second)
	reconnected := testPeer()
	h.handle(reconnected, incoming{Type: "hello", Token: a.token})
	if reconnected.room != b.room || reconnected.team != "blue" || reconnected.lastSeq != 2 {
		t.Fatal("session was not restored")
	}
	if reconnected.name != "Rin" {
		t.Fatal("player name was not restored")
	}

	game.Status = "finished"
	game.Winner = str("draw")
	reconnected.room.running = false
	h.handle(reconnected, incoming{Type: "rematch"})
	if reconnected.room.game == nil {
		t.Fatal("rematch restarted before both accepted")
	}
	var notified bool
	for len(b.send) > 0 {
		var message struct {
			Type string `json:"type"`
		}
		payload := <-b.send
		if err := json.Unmarshal(payload, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type == "rematch" {
			var vote struct {
				Players [2]bool `json:"players"`
			}
			if err := json.Unmarshal(payload, &vote); err != nil {
				t.Fatal(err)
			}
			notified = vote.Players == [2]bool{true, false}
		}
	}
	if !notified {
		t.Fatal("opponent was not notified of rematch request")
	}
	h.handle(b, incoming{Type: "rematch"})
	if reconnected.room.game != nil || reconnected.room.running {
		t.Fatal("rematch did not return to ready room")
	}
}

func TestRandomQueueOnlyMatchesQueuedPlayers(t *testing.T) {
	h := newHub(configForTest(t))
	a, b, c := testPeer(), testPeer(), testPeer()
	for _, p := range []*peer{a, b, c} {
		h.handle(p, incoming{Type: "hello"})
	}
	h.handle(a, incoming{Type: "queue"})
	h.handle(c, incoming{Type: "create"})
	if a.room != nil || len(h.queue) != 1 {
		t.Fatal("random player matched with private room")
	}
	h.handle(b, incoming{Type: "queue"})
	if a.room == nil || a.room != b.room || a.room.locked {
		t.Fatal("random players did not match")
	}
	if c.room == a.room {
		t.Fatal("private player joined random match")
	}
}

func TestLeavingDuringCountdownDoesNotAwardVictory(t *testing.T) {
	h := newHub(configForTest(t))
	a, b := testPeer(), testPeer()
	h.handle(a, incoming{Type: "hello"})
	h.handle(b, incoming{Type: "hello"})
	h.handle(a, incoming{Type: "create"})
	h.handle(b, incoming{Type: "join", RoomID: a.room.id})
	h.handle(a, incoming{Type: "ready", Ready: true})
	h.handle(b, incoming{Type: "ready", Ready: true})
	h.handle(b, incoming{Type: "leave"})
	if a.room == nil || a.room.game != nil || a.room.running || a.ready {
		t.Fatal("countdown exit should return the remaining player to the lobby")
	}
}
