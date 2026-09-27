package main

import (
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
)

type incoming struct {
	Type    string  `json:"type"`
	Token   string  `json:"token"`
	RoomID  string  `json:"roomId"`
	Name    string  `json:"name"`
	Ready   bool    `json:"ready"`
	Seq     uint64  `json:"seq"`
	Command Command `json:"command"`
}
type playerInfo struct {
	Name      string `json:"name"`
	Ready     bool   `json:"ready"`
	Connected bool   `json:"connected"`
}
type peer struct {
	conn           *websocket.Conn
	send           chan []byte
	token          string
	room           *room
	team           string
	name           string
	ready          bool
	connected      bool
	lastSeq        uint64
	commandWindow  time.Time
	commandCount   int
	disconnectedAt time.Time
	lastSeen       time.Time
	done           chan struct{}
}
type room struct {
	id         string
	locked     bool
	players    [2]*peer
	game       *Game
	running    bool
	startAt    time.Time
	rematch    [2]bool
	created    time.Time
	finishedAt time.Time
}
type hub struct {
	mu     sync.Mutex
	rooms  map[string]*room
	tokens map[string]*peer
	queue  []*peer
	config *Config
}

const reconnectGrace = 90 * time.Second

var upgrader = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 4096, CheckOrigin: checkOrigin}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return false
	}
	for _, allowed := range strings.Split(os.Getenv("INFRA_ALLOWED_ORIGINS"), ",") {
		if strings.EqualFold(strings.TrimSuffix(strings.TrimSpace(allowed), "/"), origin) {
			return true
		}
	}
	a, _, _ := net.SplitHostPort(u.Host)
	if a == "" {
		a = u.Hostname()
	}
	b, _, _ := net.SplitHostPort(r.Host)
	if b == "" {
		b = r.Host
	}
	return strings.EqualFold(a, b) || (isLoopback(a) && isLoopback(b))
}

func isLoopback(host string) bool { return host == "localhost" || host == "127.0.0.1" || host == "::1" }
func randomCode(n int) string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	for i := range b {
		b[i] = chars[int(b[i])%len(chars)]
	}
	return string(b)
}
func roomCode() string {
	var digits [5]byte
	if _, err := rand.Read(digits[:]); err != nil {
		panic(err)
	}
	for i := range digits {
		digits[i] = '0' + digits[i]%10
	}
	return string(digits[:])
}
func newHub(conf *Config) *hub {
	return &hub{rooms: map[string]*room{}, tokens: map[string]*peer{}, config: conf}
}
func (h *hub) send(p *peer, v any) {
	if p == nil || !p.connected {
		return
	}
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	select {
	case p.send <- data:
	default:
		go p.conn.Close()
	}
}
func (h *hub) sendRoom(r *room, v any) {
	for _, p := range r.players {
		h.send(p, v)
	}
}
func (h *hub) roomState(r *room) {
	phase := "waiting"
	if r.players[1] != nil {
		phase = "ready"
	}
	if r.running {
		phase = "playing"
	}
	if r.game != nil && r.game.Status == "finished" {
		phase = "finished"
	}
	players := map[string]playerInfo{}
	startAt := int64(0)
	if !r.startAt.IsZero() {
		startAt = r.startAt.UnixMilli()
	}
	for i, p := range r.players {
		if p != nil {
			team := "blue"
			if i == 1 {
				team = "red"
			}
			players[team] = playerInfo{p.name, p.ready, p.connected}
		}
	}
	for _, p := range r.players {
		if p != nil {
			h.send(p, map[string]any{"type": "room", "roomId": r.id, "locked": r.locked, "team": p.team, "phase": phase, "players": players, "startAt": startAt, "serverNow": time.Now().UnixMilli()})
		}
	}
}
func (h *hub) createRoom(p *peer, locked bool) {
	if p.room != nil {
		h.send(p, map[string]any{"type": "error", "message": "すでに部屋にいます"})
		return
	}
	id := roomCode()
	for h.rooms[id] != nil {
		id = roomCode()
	}
	r := &room{id: id, locked: locked, players: [2]*peer{p, nil}, created: time.Now()}
	h.rooms[id] = r
	p.room = r
	p.team = "blue"
	p.name = "プレイヤー1"
	p.ready = false
	p.lastSeq = 0
	h.roomState(r)
}
func (h *hub) joinRoom(p *peer, r *room) {
	if p.room != nil {
		h.send(p, map[string]any{"type": "error", "message": "すでに部屋にいます"})
		return
	}
	if r.players[1] != nil {
		h.send(p, map[string]any{"type": "error", "message": "この部屋は満員です"})
		return
	}
	r.players[1] = p
	p.room = r
	p.team = "red"
	p.name = "プレイヤー2"
	p.ready = false
	p.lastSeq = 0
	h.roomState(r)
}
func (h *hub) removeQueue(p *peer) {
	out := h.queue[:0]
	for _, q := range h.queue {
		if q != p {
			out = append(out, q)
		}
	}
	h.queue = out
}
func (h *hub) leave(p *peer) {
	h.removeQueue(p)
	r := p.room
	if r == nil {
		return
	}
	if r.running && time.Now().Before(r.startAt) {
		r.running = false
		r.game = nil
		r.startAt = time.Time{}
		for _, other := range r.players {
			if other != nil {
				other.ready = false
			}
		}
	} else if r.running && r.game != nil && r.game.Status == "playing" {
		r.game.Status = "finished"
		winner := own(p.team)
		r.game.Winner = &winner
		r.game.emit("end", winner, "相手が退出しました", nil)
		r.running = false
		r.finishedAt = time.Now()
		h.sendRoom(r, map[string]any{"type": "state", "state": r.game})
	}
	index := 0
	if r.players[1] == p {
		index = 1
	}
	r.players[index] = nil
	p.room = nil
	p.team = ""
	p.ready = false
	if r.game == nil && r.players[0] == nil && r.players[1] != nil {
		other := r.players[1]
		r.players[0] = other
		r.players[1] = nil
		other.team = "blue"
		other.name = "プレイヤー1"
	}
	if r.players[0] == nil {
		delete(h.rooms, r.id)
	} else {
		h.roomState(r)
	}
}
func (h *hub) tryStart(r *room) {
	if r.players[0] == nil || r.players[1] == nil || !r.players[0].ready || !r.players[1].ready {
		h.roomState(r)
		return
	}
	r.game = newGame(h.config, uint32(time.Now().UnixNano()))
	r.running = true
	r.startAt = time.Now().Add(time.Duration(h.config.Game.IntroSeconds * float64(time.Second)))
	r.rematch = [2]bool{}
	r.finishedAt = time.Time{}
	for _, p := range r.players {
		p.lastSeq = 0
		p.ready = false
	}
	h.roomState(r)
	h.sendRoom(r, map[string]any{"type": "state", "state": r.game})
}
func (h *hub) handle(p *peer, m incoming) {
	h.mu.Lock()
	defer h.mu.Unlock()
	p.lastSeen = time.Now()
	if m.Type != "hello" && p.token == "" {
		return
	}
	switch m.Type {
	case "hello":
		resumed := false
		if m.Token != "" {
			if old := h.tokens[m.Token]; old != nil && old != p && (old.connected || time.Since(old.disconnectedAt) < reconnectGrace) {
				resumed = old.room != nil
				if old.connected {
					old.connected = false
					go old.conn.Close()
				}
				p.token = old.token
				p.room = old.room
				p.team = old.team
				p.name = old.name
				p.ready = old.ready
				p.lastSeq = old.lastSeq
				if p.room != nil {
					for i, slot := range p.room.players {
						if slot == old {
							p.room.players[i] = p
						}
					}
				}
				old.room = nil
				delete(h.tokens, old.token)
			}
		}
		if p.token == "" {
			p.token = randomCode(32)
		}
		h.tokens[p.token] = p
		h.send(p, map[string]any{"type": "hello", "token": p.token, "seq": p.lastSeq, "resumed": resumed})
		if p.room != nil {
			h.roomState(p.room)
			if p.room.game != nil {
				h.send(p, map[string]any{"type": "state", "state": p.room.game})
			}
		}
	case "queue":
		if p.room != nil {
			return
		}
		for _, q := range h.queue {
			if q == p {
				return
			}
		}
		for len(h.queue) > 0 {
			other := h.queue[0]
			h.queue = h.queue[1:]
			if !other.connected || other == p || other.room != nil {
				continue
			}
			h.createRoom(other, false)
			h.joinRoom(p, other.room)
			return
		}
		h.queue = append(h.queue, p)
		h.send(p, map[string]any{"type": "queueing"})
	case "create":
		h.removeQueue(p)
		h.createRoom(p, true)
	case "join":
		h.removeQueue(p)
		id := strings.TrimSpace(m.RoomID)
		if len(id) != 5 || strings.Trim(id, "0123456789") != "" {
			h.send(p, map[string]any{"type": "error", "message": "招待コードは数字5桁です"})
			return
		}
		r := h.rooms[id]
		if r == nil || !r.locked {
			h.send(p, map[string]any{"type": "error", "message": "部屋が見つかりません"})
			return
		}
		h.joinRoom(p, r)
	case "name":
		if p.room == nil || p.room.running {
			return
		}
		name := strings.TrimSpace(m.Name)
		if name == "" {
			if p.team == "blue" {
				name = "プレイヤー1"
			} else {
				name = "プレイヤー2"
			}
		}
		if utf8.RuneCountInString(name) > 16 {
			h.send(p, map[string]any{"type": "error", "message": "名前は16文字までです"})
			return
		}
		p.name = name
		h.roomState(p.room)
	case "ready":
		if p.room != nil && !p.room.running && p.room.game == nil {
			p.ready = m.Ready
			h.tryStart(p.room)
		}
	case "command":
		if p.room == nil || !p.room.running || p.room.game == nil {
			return
		}
		if time.Now().Before(p.room.startAt) {
			h.send(p, map[string]any{"type": "ack", "seq": m.Seq, "error": "カウントダウン中です"})
			return
		}
		if time.Since(p.commandWindow) >= time.Second {
			p.commandWindow = time.Now()
			p.commandCount = 0
		}
		p.commandCount++
		if p.commandCount > 20 {
			h.send(p, map[string]any{"type": "ack", "seq": m.Seq, "error": "指示が多すぎます。少し待ってください"})
			return
		}
		if m.Seq <= p.lastSeq {
			h.send(p, map[string]any{"type": "ack", "seq": m.Seq, "duplicate": true})
			return
		}
		p.lastSeq = m.Seq
		err := p.room.game.command(p.team, m.Command)
		if err != nil {
			h.send(p, map[string]any{"type": "ack", "seq": m.Seq, "error": err.Error()})
		} else {
			h.send(p, map[string]any{"type": "ack", "seq": m.Seq})
		}
	case "rematch":
		r := p.room
		if r == nil || r.game == nil || r.game.Status != "finished" {
			return
		}
		index := 0
		if r.players[1] == p {
			index = 1
		}
		r.rematch[index] = true
		if r.players[0] != nil && r.players[1] != nil && r.rematch[0] && r.rematch[1] {
			r.game = nil
			r.running = false
			r.startAt = time.Time{}
			for _, slot := range r.players {
				slot.ready = false
			}
			r.rematch = [2]bool{}
			h.roomState(r)
		} else {
			h.sendRoom(r, map[string]any{"type": "rematch", "players": r.rematch})
		}
	case "leave":
		h.leave(p)
		h.send(p, map[string]any{"type": "left"})
	case "ping":
		h.send(p, map[string]any{"type": "pong", "at": time.Now().UnixMilli()})
	}
}
func (h *hub) disconnect(p *peer) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if !p.connected {
		return
	}
	p.connected = false
	p.disconnectedAt = time.Now()
	h.removeQueue(p)
	if p.room != nil {
		h.roomState(p.room)
		h.sendRoom(p.room, map[string]any{"type": "opponent_disconnected", "team": p.team, "seconds": int(reconnectGrace.Seconds())})
	}
}
func (h *hub) tick() {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	for _, r := range h.rooms {
		for _, p := range r.players {
			if p != nil && !p.connected && now.Sub(p.disconnectedAt) > reconnectGrace {
				h.leave(p)
			}
		}
		if r.running && r.game != nil && !now.Before(r.startAt) {
			r.game.tick(h.config.Game.Tick)
			if r.game.Status == "finished" {
				r.running = false
				r.finishedAt = now
			}
			h.sendRoom(r, map[string]any{"type": "state", "state": r.game})
		}
		if !r.finishedAt.IsZero() && now.Sub(r.finishedAt) > 5*time.Minute {
			for _, p := range r.players {
				if p != nil {
					p.room = nil
					h.send(p, map[string]any{"type": "left"})
				}
			}
			delete(h.rooms, r.id)
		}
		if r.game == nil && now.Sub(r.created) > 30*time.Minute {
			for _, p := range r.players {
				if p != nil {
					p.room = nil
					h.send(p, map[string]any{"type": "left"})
				}
			}
			delete(h.rooms, r.id)
		}
	}
	for token, p := range h.tokens {
		if !p.connected && now.Sub(p.disconnectedAt) > reconnectGrace {
			delete(h.tokens, token)
		}
	}
}
func (h *hub) serveWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	p := &peer{conn: conn, send: make(chan []byte, 32), done: make(chan struct{}), connected: true, lastSeen: time.Now()}
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		defer conn.Close()
		for {
			select {
			case <-p.done:
				return
			case data := <-p.send:
				conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if conn.WriteMessage(websocket.TextMessage, data) != nil {
					return
				}
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)) != nil {
					return
				}
			}
		}
	}()
	conn.SetReadLimit(4096)
	conn.SetReadDeadline(time.Now().Add(45 * time.Second))
	conn.SetPongHandler(func(string) error { conn.SetReadDeadline(time.Now().Add(45 * time.Second)); return nil })
	defer func() { h.disconnect(p); close(p.done); conn.Close() }()
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		conn.SetReadDeadline(time.Now().Add(45 * time.Second))
		var m incoming
		if json.Unmarshal(data, &m) == nil {
			h.handle(p, m)
		}
	}
}
func main() {
	defaultAddr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		defaultAddr = ":" + port
	}
	addr := flag.String("addr", defaultAddr, "HTTP address")
	static := flag.String("static", "dist", "static build directory")
	master := flag.String("master", "master", "master data directory")
	flag.Parse()
	conf, err := loadConfig(*master)
	if err != nil {
		log.Fatal(err)
	}
	h := newHub(conf)
	feedbackPath := os.Getenv("INFRA_FEEDBACK_PATH")
	if feedbackPath == "" {
		feedbackPath = "feedback.jsonl"
	}
	feedback, err := newFeedbackStore(feedbackPath)
	if err != nil {
		log.Fatalf("feedback storage unavailable: %v", err)
	}
	go func() {
		ticker := time.NewTicker(time.Duration(conf.Game.Tick * float64(time.Second)))
		defer ticker.Stop()
		for range ticker.C {
			h.tick()
		}
	}()
	http.HandleFunc("/ws", h.serveWS)
	http.HandleFunc("/feedback", feedback.serveHTTP)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "ok") })
	http.Handle("/", http.FileServer(http.Dir(*static)))
	log.Printf("INFRA RUSH online server on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, nil))
}
