package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
)

type Point [2]float64
type Resources map[string]int
type Cost map[string]int
type Stats struct {
	Mined    int `json:"mined"`
	Built    int `json:"built"`
	Attacks  int `json:"attacks"`
	Repairs  int `json:"repairs"`
	Sabotage int `json:"sabotage"`
}
type TeamState struct {
	Resources Resources `json:"resources"`
	HP        int       `json:"hp"`
	Stats     Stats     `json:"stats"`
}
type Bot struct {
	ID        string  `json:"id"`
	Team      string  `json:"team"`
	Index     int     `json:"index"`
	State     string  `json:"state"`
	Position  Point   `json:"position"`
	Home      Point   `json:"home"`
	Path      []Point `json:"path"`
	Action    *string `json:"action"`
	Target    *string `json:"target"`
	Progress  float64 `json:"progress"`
	Duration  float64 `json:"duration"`
	Paid      Cost    `json:"paid"`
	MineClock float64 `json:"mineClock"`
	MineIndex int     `json:"mineIndex"`
}
type Bridge struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Exclusive *string `json:"exclusive"`
	Owner     *string `json:"owner"`
	Level     int     `json:"level"`
	Capacity  int     `json:"capacity"`
	Damage    int     `json:"damage"`
	BlockedBy *string `json:"blockedBy"`
	Lock      *string `json:"lock"`
}
type GameEvent struct {
	ID       int     `json:"id"`
	Kind     string  `json:"kind"`
	Team     *string `json:"team,omitempty"`
	Position *Point  `json:"position,omitempty"`
	Text     string  `json:"text"`
}
type Game struct {
	Time          float64               `json:"time"`
	Status        string                `json:"status"`
	Winner        *string               `json:"winner"`
	Teams         map[string]*TeamState `json:"teams"`
	Bots          []*Bot                `json:"bots"`
	Bridges       []*Bridge             `json:"bridges"`
	Seed          uint32                `json:"seed"`
	NextQuake     float64               `json:"nextQuake"`
	Warned        bool                  `json:"warned"`
	Events        []GameEvent           `json:"events"`
	EventSequence int                   `json:"eventSequence"`
	conf          *Config
}
type Command struct {
	BotID  string `json:"botId"`
	Action string `json:"action"`
	Target string `json:"target"`
}
type TaskSpec struct {
	Cost    Cost    `json:"cost"`
	Seconds float64 `json:"seconds"`
}
type Config struct {
	Game struct {
		Duration      float64 `json:"duration"`
		Tick          float64 `json:"tick"`
		ReturnSeconds float64 `json:"returnSeconds"`
		AttackSeconds float64 `json:"attackSeconds"`
		IntroSeconds  float64 `json:"introSeconds"`
		Seed          uint32  `json:"seed"`
	}
	Resources struct {
		Initial  Resources `json:"initial"`
		Cycle    []string  `json:"cycle"`
		Interval float64   `json:"interval"`
		Amount   int       `json:"amount"`
	}
	Bots struct {
		Count        int     `json:"count"`
		Speed        float64 `json:"speed"`
		MarchSpeed   float64 `json:"marchSpeed"`
		SpawnSpacing float64 `json:"spawnSpacing"`
	}
	Castle struct {
		HP           int   `json:"hp"`
		AttackDamage int   `json:"attackDamage"`
		Blue         Point `json:"blue"`
		Red          Point `json:"red"`
	}
	Bridges struct {
		MaxLevel int `json:"maxLevel"`
		Sites    []struct {
			ID        string  `json:"id"`
			X         float64 `json:"x"`
			Exclusive *string `json:"exclusive"`
		} `json:"sites"`
	}
	Tasks      map[string]TaskSpec
	Earthquake struct {
		MeanInterval      float64   `json:"meanInterval"`
		WarningSeconds    float64   `json:"warningSeconds"`
		DamageProbability []float64 `json:"damageProbability"`
		MinimumLevel      int       `json:"minimumLevel"`
	}
}

func loadConfig(dir string) (*Config, error) {
	c := new(Config)
	for _, entry := range []struct {
		name   string
		target any
	}{
		{"game", &c.Game}, {"resources", &c.Resources}, {"bots", &c.Bots}, {"castle", &c.Castle},
		{"bridges", &c.Bridges}, {"tasks", &c.Tasks}, {"earthquake", &c.Earthquake},
	} {
		data, err := os.ReadFile(filepath.Join(dir, entry.name+".json"))
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(data, entry.target); err != nil {
			return nil, fmt.Errorf("%s: %w", entry.name, err)
		}
	}
	return c, nil
}
func own(team string) string {
	if team == "blue" {
		return "red"
	}
	return "blue"
}
func teamPoint(c *Config, team string) Point {
	if team == "blue" {
		return c.Castle.Blue
	}
	return c.Castle.Red
}
func side(team string) float64 {
	if team == "blue" {
		return -1
	}
	return 1
}
func str(v string) *string        { return &v }
func is(v *string, s string) bool { return v != nil && *v == s }
func newGame(c *Config, seed uint32) *Game {
	g := &Game{Status: "playing", Teams: map[string]*TeamState{}, Bots: []*Bot{}, Bridges: []*Bridge{}, Seed: seed, Events: []GameEvent{}, conf: c}
	for _, team := range []string{"blue", "red"} {
		res := Resources{}
		for k, v := range c.Resources.Initial {
			res[k] = v
		}
		g.Teams[team] = &TeamState{Resources: res, HP: c.Castle.HP}
		for i := 0; i < c.Bots.Count; i++ {
			home := Point{teamPoint(c, team)[0] + float64(i-2)*c.Bots.SpawnSpacing, side(team) * 6.3}
			g.Bots = append(g.Bots, &Bot{ID: fmt.Sprintf("%s-%d", team, i), Team: team, Index: i, State: "IDLE", Position: home, Home: home, Path: []Point{}, Paid: Cost{}})
		}
	}
	for _, site := range c.Bridges.Sites {
		g.Bridges = append(g.Bridges, &Bridge{ID: site.ID, X: site.X, Exclusive: site.Exclusive})
	}
	g.nextQuake()
	return g
}
func (g *Game) rand() float64 {
	g.Seed = g.Seed*1664525 + 1013904223
	return float64(g.Seed) / 4294967296
}
func (g *Game) nextQuake() {
	g.NextQuake = g.Time - g.conf.Earthquake.MeanInterval*math.Log(math.Max(0.000001, 1-g.rand()))
}
func (g *Game) emit(kind, team, text string, pos *Point) {
	g.EventSequence++
	e := GameEvent{ID: g.EventSequence, Kind: kind, Text: text, Position: pos}
	if team != "" {
		e.Team = str(team)
	}
	g.Events = append(g.Events, e)
	if len(g.Events) > 80 {
		g.Events = g.Events[1:]
	}
}
func (g *Game) bot(id string) *Bot {
	for _, b := range g.Bots {
		if b.ID == id {
			return b
		}
	}
	return nil
}
func (g *Game) bridge(id string) *Bridge {
	for _, b := range g.Bridges {
		if b.ID == id {
			return b
		}
	}
	return nil
}
func (g *Game) task(action string, b *Bridge) TaskSpec {
	key := action
	if action == "build" && b != nil && b.ID == "center" {
		key = "buildCenter"
	}
	if action == "upgrade" {
		key = "upgrade2"
		if b != nil && b.Capacity == 2 {
			key = "upgrade3"
		}
	}
	return g.conf.Tasks[key]
}
func (g *Game) usable(team string) []*Bridge {
	out := []*Bridge{}
	for _, b := range g.Bridges {
		if is(b.Owner, team) && b.Level > 0 && b.BlockedBy == nil {
			out = append(out, b)
		}
	}
	return out
}
func (g *Game) canCommand(team string, c Command) error {
	if g.Status != "playing" {
		return errors.New("試合は終了しています")
	}
	b := g.bot(c.BotID)
	if b == nil || b.Team != team {
		return errors.New("自分のBotをタップしてね")
	}
	mining := is(b.Action, "mine") && (b.State == "MOVING" || b.State == "MINING")
	if c.Action == "cancel" {
		if mining {
			return nil
		}
		return errors.New("途中でやめられるのは「掘る」だけです")
	}
	if b.State != "IDLE" && !mining {
		return errors.New("この仕事が終わるまで待ってね")
	}
	if c.Action == "mine" {
		if mining {
			return errors.New("いま掘っています")
		}
		return nil
	}
	if c.Action == "march" {
		if len(g.usable(team)) > 0 {
			return nil
		}
		return errors.New("渡れる橋をつくろう")
	}
	switch c.Action {
	case "build", "upgrade", "repair", "embank", "clear", "destroy":
	default:
		return errors.New("不明な指示です")
	}
	bridge := g.bridge(c.Target)
	if bridge == nil {
		return errors.New("橋をタップしてね")
	}
	if bridge.Lock != nil {
		return errors.New("別のBotが作業しています")
	}
	if c.Action == "build" {
		if bridge.Level > 0 {
			return errors.New("橋はすでに完成しています")
		}
		if bridge.Exclusive != nil && !is(bridge.Exclusive, team) {
			return errors.New("相手の橋はつくれません")
		}
		if bridge.ID == "center" {
			ownBridge := false
			for _, candidate := range g.Bridges {
				if is(candidate.Exclusive, team) && candidate.Level > 0 {
					ownBridge = true
				}
			}
			if !ownBridge {
				return errors.New("先に自分の城の近くに橋をつくろう")
			}
		}
	} else {
		if bridge.Level == 0 {
			return errors.New("橋がありません")
		}
		if (c.Action == "upgrade" || c.Action == "repair" || c.Action == "clear") && !is(bridge.Owner, team) {
			return errors.New("自分の橋で作業しよう")
		}
		if (c.Action == "destroy" || c.Action == "embank") && !is(bridge.Owner, own(team)) {
			return errors.New("相手の橋で作業しよう")
		}
		if c.Action == "upgrade" && (bridge.Level < bridge.Capacity || bridge.Damage > 0) {
			return errors.New("先に橋を直そう")
		}
		if c.Action == "upgrade" && bridge.Capacity >= g.conf.Bridges.MaxLevel {
			return errors.New("これ以上は強くできません")
		}
		if c.Action == "repair" && bridge.Level == bridge.Capacity && bridge.Damage == 0 {
			return errors.New("直すところがありません")
		}
		if c.Action == "embank" && bridge.BlockedBy != nil {
			return errors.New("すでに道がふさがっています")
		}
		if c.Action == "clear" && bridge.BlockedBy == nil {
			return errors.New("どける土がありません")
		}
	}
	for resource, amount := range g.task(c.Action, bridge).Cost {
		if g.Teams[team].Resources[resource] < amount {
			return fmt.Errorf("%sが%d必要です", map[string]string{"soil": "土", "stone": "石", "iron": "鉄"}[resource], amount)
		}
	}
	return nil
}
func (g *Game) pay(team string, cost Cost, mult int) {
	for resource, amount := range cost {
		g.Teams[team].Resources[resource] += mult * amount
	}
}
func (g *Game) returning(b *Bot, text string) {
	for _, bridge := range g.Bridges {
		if is(bridge.Lock, b.ID) {
			bridge.Lock = nil
		}
	}
	b.State = "RETURNING"
	b.Progress = 0
	b.Duration = g.conf.Game.ReturnSeconds
	b.Path = []Point{}
	b.Paid = Cost{}
	p := b.Position
	g.emit("return", b.Team, text, &p)
}
func (g *Game) command(team string, c Command) error {
	if err := g.canCommand(team, c); err != nil {
		return err
	}
	b := g.bot(c.BotID)
	if c.Action == "cancel" {
		g.returning(b, "シュポン！")
		return nil
	}
	target := g.bridge(c.Target)
	b.Action = str(c.Action)
	b.Target = nil
	if target != nil {
		b.Target = str(target.ID)
	}
	b.Progress = 0
	spec := g.task(c.Action, target)
	b.Duration = spec.Seconds
	b.Paid = Cost{}
	for k, v := range spec.Cost {
		b.Paid[k] = v
	}
	g.pay(team, b.Paid, -1)
	sz := side(team)
	switch c.Action {
	case "mine":
		q := Point{8, -10}
		if team == "red" {
			q = Point{-8, 10}
		}
		b.Path = []Point{{q[0] + float64(b.Index%3-1)*1.8, q[1] + sz*func() float64 {
			if b.Index < 3 {
				return -1.6
			}
			return 0.2
		}()}}
		b.MineClock = 0
	case "march":
		routes := g.usable(team)
		closest := routes[0]
		best := distance(b.Position, Point{closest.X, sz * 4})
		for _, route := range routes[1:] {
			d := distance(b.Position, Point{route.X, sz * 4})
			if d < best {
				closest = route
				best = d
			}
		}
		b.Target = str(closest.ID)
		enemy := teamPoint(g.conf, own(team))
		b.Path = []Point{{closest.X, sz * 4}, {closest.X, -sz * 4}, {enemy[0], -sz * 6}, {enemy[0], -sz * 8}}
	default:
		target.Lock = str(b.ID)
		b.Path = []Point{{target.X, sz * 4.6}}
	}
	if c.Action == "march" {
		b.State = "MARCHING"
	} else {
		b.State = "MOVING"
	}
	p := b.Path[len(b.Path)-1]
	g.emit("command", team, "仕事を始めるよ！", &p)
	return nil
}
func distance(a, b Point) float64 { return math.Hypot(a[0]-b[0], a[1]-b[1]) }
func (g *Game) arrive(b *Bot) {
	b.Progress = 0
	switch *b.Action {
	case "mine":
		b.State = "MINING"
	case "march":
		b.State = "ATTACKING_CASTLE"
		b.Duration = g.conf.Game.AttackSeconds
	case "build":
		b.State = "BUILDING_BRIDGE"
	case "upgrade":
		b.State = "UPGRADING_BRIDGE"
	case "repair":
		b.State = "REPAIRING_BRIDGE"
	case "embank":
		b.State = "BUILDING_EMBANKMENT"
	case "clear":
		b.State = "CLEARING_EMBANKMENT"
	case "destroy":
		b.State = "DESTROYING_BRIDGE"
	}
}
func (g *Game) move(b *Bot, dt float64) {
	speed := g.conf.Bots.Speed
	if is(b.Action, "march") {
		speed = g.conf.Bots.MarchSpeed
	}
	remaining := dt * speed
	for remaining > 0 && len(b.Path) > 0 {
		target := b.Path[0]
		d := distance(b.Position, target)
		if d <= remaining {
			b.Position = target
			b.Path = b.Path[1:]
			remaining -= d
		} else {
			b.Position[0] += (target[0] - b.Position[0]) * remaining / d
			b.Position[1] += (target[1] - b.Position[1]) * remaining / d
			remaining = 0
		}
	}
	if len(b.Path) == 0 {
		g.arrive(b)
	}
}
func (g *Game) finishBot(b *Bot) {
	bridge := g.bridge(value(b.Target))
	stats := &g.Teams[b.Team].Stats
	if is(b.Action, "march") {
		enemy := g.Teams[own(b.Team)]
		enemy.HP -= g.conf.Castle.AttackDamage
		if enemy.HP < 0 {
			enemy.HP = 0
		}
		stats.Attacks++
		p := b.Position
		g.emit("attack", b.Team, "城に一撃！", &p)
		if enemy.HP == 0 {
			g.Status = "finished"
			g.Winner = str(b.Team)
			g.emit("end", b.Team, "勝利への道、開通！", nil)
		}
	} else if bridge != nil {
		if !is(b.Action, "build") && (bridge.Level == 0 || ((is(b.Action, "upgrade") || is(b.Action, "repair") || is(b.Action, "clear")) && !is(bridge.Owner, b.Team))) {
			g.pay(b.Team, b.Paid, 1)
			g.returning(b, "作業先がなくなったので資源が戻りました")
			return
		}
		switch value(b.Action) {
		case "build":
			bridge.Owner = str(b.Team)
			bridge.Level = 1
			bridge.Capacity = 1
			bridge.Damage = 0
			bridge.BlockedBy = nil
			stats.Built++
		case "upgrade":
			bridge.Level++
			bridge.Capacity++
		case "repair":
			bridge.Level = int(math.Min(float64(bridge.Capacity), float64(bridge.Level+1)))
			bridge.Damage = 0
			stats.Repairs++
		case "embank":
			bridge.BlockedBy = str(b.Team)
			stats.Sabotage++
		case "clear":
			bridge.BlockedBy = nil
		case "destroy":
			bridge.Level--
			bridge.Damage = int(math.Min(2, float64(bridge.Damage+1)))
			stats.Sabotage++
			if bridge.Level == 0 {
				bridge.Owner = nil
				bridge.Capacity = 0
				bridge.BlockedBy = nil
				p := Point{bridge.X, 0}
				g.emit("collapse", "", "橋がこわれた！", &p)
			}
		}
		p := Point{bridge.X, 0}
		message := "仕事が終わった！"
		if is(b.Action, "build") {
			message = "橋ができた！"
		}
		if is(b.Action, "clear") {
			message = "道が通れるようになった！"
		}
		g.emit("complete", b.Team, message, &p)
	}
	g.returning(b, "シュポン！")
}
func value(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
func (g *Game) earthquake() {
	g.emit("earthquake", "", "地震だ！ 橋は大丈夫？", nil)
	for _, b := range g.Bridges {
		if b.Level > 0 && b.Level < len(g.conf.Earthquake.DamageProbability) && g.rand() < g.conf.Earthquake.DamageProbability[b.Level] {
			b.Level--
			if b.Level < g.conf.Earthquake.MinimumLevel {
				b.Level = g.conf.Earthquake.MinimumLevel
			}
			b.Damage++
			if b.Damage > 2 {
				b.Damage = 2
			}
		}
	}
	g.Warned = false
	g.nextQuake()
}
func (g *Game) tick(dt float64) {
	if g.Status != "playing" || dt <= 0 || math.IsNaN(dt) || math.IsInf(dt, 0) {
		return
	}
	g.Time += dt
	if g.Time >= g.conf.Game.Duration {
		g.Time = g.conf.Game.Duration
		g.Status = "finished"
		g.Winner = str("draw")
		g.emit("end", "", "タイムアップ！ 引き分け", nil)
		return
	}
	if !g.Warned && g.Time >= g.NextQuake-g.conf.Earthquake.WarningSeconds {
		g.Warned = true
		g.emit("warning", "", "まもなく地震！", nil)
	}
	if g.Time >= g.NextQuake {
		g.earthquake()
	}
	for _, b := range g.Bots {
		if g.Status != "playing" {
			break
		}
		if b.State == "IDLE" {
			continue
		}
		if is(b.Action, "march") && b.State != "RETURNING" {
			route := g.bridge(value(b.Target))
			if route == nil || !is(route.Owner, b.Team) || route.Level == 0 || route.BlockedBy != nil {
				g.returning(b, "道が塞がれた！ 帰還します")
				continue
			}
		}
		if b.State == "MOVING" || b.State == "MARCHING" {
			g.move(b, dt)
			continue
		}
		if b.State == "MINING" {
			b.MineClock += dt
			for b.MineClock >= g.conf.Resources.Interval {
				b.MineClock -= g.conf.Resources.Interval
				resource := g.conf.Resources.Cycle[b.MineIndex%len(g.conf.Resources.Cycle)]
				b.MineIndex++
				g.Teams[b.Team].Resources[resource] += g.conf.Resources.Amount
				g.Teams[b.Team].Stats.Mined += g.conf.Resources.Amount
				p := b.Position
				g.emit("resource", b.Team, fmt.Sprintf("%s +%d", map[string]string{"soil": "土", "stone": "石", "iron": "鉄"}[resource], g.conf.Resources.Amount), &p)
			}
			continue
		}
		b.Progress += dt
		if b.Progress+1e-8 < b.Duration {
			continue
		}
		if b.State == "RETURNING" {
			b.Position = b.Home
			b.State = "IDLE"
			b.Action = nil
			b.Target = nil
			b.Progress = 0
		} else {
			g.finishBot(b)
		}
	}
}
