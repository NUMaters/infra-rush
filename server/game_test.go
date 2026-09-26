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
