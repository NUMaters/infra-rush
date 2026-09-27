package main

import (
	"path/filepath"
	"strconv"
	"testing"
)

func configForTest(t *testing.T) *Config {
	t.Helper()
	c, err := loadConfig(filepath.Join("..", "master"))
	if err != nil {
		t.Fatal(err)
	}
	return c
}
func advance(g *Game, seconds float64) {
	steps := int(seconds / g.conf.Game.Tick)
	for i := 0; i < steps; i++ {
		g.tick(g.conf.Game.Tick)
	}
}
func TestServerRulesAndVictory(t *testing.T) {
	g := newGame(configForTest(t), 12345)
	if err := g.command("red", Command{BotID: "blue-0", Action: "mine"}); err == nil {
		t.Fatal("cross-team command accepted")
	}
	if err := g.command("blue", Command{BotID: "blue-0", Action: "mine"}); err != nil {
		t.Fatal(err)
	}
	advance(g, 10)
	if g.Teams["blue"].Resources["stone"] == 0 {
		t.Fatal("mining did not produce resources")
	}
	if err := g.command("blue", Command{BotID: "blue-0", Action: "cancel"}); err != nil {
		t.Fatal(err)
	}
	advance(g, 1)
	g.Teams["blue"].Resources["stone"] = 50
	if err := g.command("blue", Command{BotID: "blue-0", Action: "build", Target: "blue"}); err != nil {
		t.Fatal(err)
	}
	if g.Teams["blue"].Resources["stone"] != 0 {
		t.Fatal("server did not charge bridge cost")
	}
	advance(g, 22)
	if g.bridge("blue").Level != 1 {
		t.Fatal("bridge did not finish")
	}
	for wave := 0; wave < 3; wave++ {
		for i := 0; i < 5; i++ {
			if err := g.command("blue", Command{BotID: "blue-" + strconv.Itoa(i), Action: "march"}); err != nil {
				t.Fatal(err)
			}
		}
		advance(g, 30)
	}
	if g.Status != "finished" || value(g.Winner) != "blue" || g.Teams["red"].HP != 0 {
		t.Fatalf("unexpected victory state: %+v", g)
	}
}

func TestSabotageAndRepair(t *testing.T) {
	g := newGame(configForTest(t), 2)
	b := g.bridge("blue")
	b.Owner = str("blue")
	b.Level = 3
	b.Capacity = 3
	g.Teams["red"].Resources["iron"] = 90
	if err := g.command("red", Command{BotID: "red-0", Action: "destroy", Target: "blue"}); err != nil {
		t.Fatal(err)
	}
	advance(g, 23)
	if b.Level != 2 || b.Damage != 1 {
		t.Fatalf("destroy: level %d damage %d", b.Level, b.Damage)
	}
	g.Teams["blue"].Resources["iron"] = 25
	if err := g.command("blue", Command{BotID: "blue-0", Action: "repair", Target: "blue"}); err != nil {
		t.Fatal(err)
	}
	advance(g, 20)
	if b.Level != 3 || b.Damage != 0 {
		t.Fatalf("repair: level %d damage %d", b.Level, b.Damage)
	}
}

func TestCrossedBotCanFinishAfterBridgeCollapse(t *testing.T) {
	g := newGame(configForTest(t), 33)
	g.NextQuake = 1e9
	b := g.bridge("blue")
	b.Owner = str("blue")
	b.Level, b.Capacity = 1, 1
	for _, id := range []string{"blue-0", "blue-1"} {
		if err := g.command("blue", Command{BotID: id, Action: "march"}); err != nil {
			t.Fatal(err)
		}
	}
	for len(g.bot("blue-0").Path) > 2 {
		g.tick(g.conf.Game.Tick)
	}
	g.bot("blue-1").Path = []Point{{-7, -4}, {-7, 4}, {0, 6}, {0, 8}}
	g.bot("blue-1").Position = g.bot("blue-1").Home
	b.Level = 0
	advance(g, 16)
	if g.Teams["red"].HP != 14 || g.bot("blue-1").State != "IDLE" {
		t.Fatalf("crossed bot should attack, uncrossed bot should return: hp=%d state=%s", g.Teams["red"].HP, g.bot("blue-1").State)
	}
}

func TestParallelSabotageAndStrengthDamage(t *testing.T) {
	g := newGame(configForTest(t), 34)
	g.NextQuake = 1e9
	b := g.bridge("blue")
	b.Owner = str("blue")
	b.Level, b.Capacity, b.Damage = 2, 3, 1
	g.Teams["blue"].Resources["iron"] = 100
	g.Teams["red"].Resources["iron"] = 100
	g.Teams["red"].Resources["soil"] = 100
	for _, c := range []struct {
		team, bot, action string
	}{{"blue", "blue-0", "repair"}, {"red", "red-0", "embank"}, {"red", "red-1", "destroy"}} {
		if err := g.command(c.team, Command{BotID: c.bot, Action: c.action, Target: "blue"}); err != nil {
			t.Fatal(err)
		}
	}
	if !is(b.Lock, "blue-0") {
		t.Fatal("parallel sabotage replaced the repair lock")
	}
	advance(g, 35)
	if b.Level != 2 || b.Damage != 1 || !is(b.BlockedBy, "red") {
		t.Fatalf("parallel result: %+v", b)
	}
	g.earthquake()
	if b.Level != 1 || b.Damage != 2 || b.BlockedBy != nil {
		t.Fatalf("earthquake must remove exactly one level and mound: %+v", b)
	}
}

func TestPreEmbankEarthquakeAndTimeout(t *testing.T) {
	g := newGame(configForTest(t), 19)
	g.NextQuake = 1e9
	g.Teams["blue"].Resources["soil"] = 100
	g.Teams["red"].Resources["stone"] = 100
	if err := g.command("blue", Command{BotID: "blue-0", Action: "embank", Target: "red"}); err != nil {
		t.Fatal(err)
	}
	advance(g, 35)
	if g.bridge("red").BlockedBy == nil {
		t.Fatal("pre-embankment not constructed")
	}
	if err := g.command("red", Command{BotID: "red-0", Action: "build", Target: "red"}); err != nil {
		t.Fatal(err)
	}
	advance(g, 35)
	if g.bridge("red").BlockedBy == nil {
		t.Fatal("building cleared pre-embankment")
	}
	g.earthquake()
	if g.bridge("red").Level != 0 || g.bridge("red").BlockedBy != nil {
		t.Fatal("earthquake did not remove one level and clear mound")
	}
	g.Teams["blue"].HP = 14
	g.Time = g.conf.Game.Duration - g.conf.Game.Tick
	g.tick(g.conf.Game.Tick)
	if value(g.Winner) != "red" {
		t.Fatalf("timeout winner = %s", value(g.Winner))
	}
}

func TestClearWorksBesideTheMound(t *testing.T) {
	g := newGame(configForTest(t), 4)
	b := g.bridge("blue")
	b.Owner = str("blue")
	b.Level = 1
	b.Capacity = 1
	b.BlockedBy = str("red")
	g.Teams["blue"].Resources["iron"] = 10
	if err := g.command("blue", Command{BotID: "blue-0", Action: "clear", Target: "blue"}); err != nil {
		t.Fatal(err)
	}
	path := g.bot("blue-0").Path
	if len(path) != 2 || path[1] != (Point{b.X, 3.8}) {
		t.Fatalf("grader must travel to the mound: %v", path)
	}
	advance(g, 7)
	if g.bot("blue-0").State != "CLEARING_EMBANKMENT" || g.bot("blue-0").Position[1] < 3 {
		t.Fatalf("grader stopped away from mound: %+v", g.bot("blue-0"))
	}
	advance(g, 15)
	if b.BlockedBy != nil {
		t.Fatal("mound was not cleared")
	}
}
