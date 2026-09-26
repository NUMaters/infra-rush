package main

import (
	"path/filepath"
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
	for i := 0; i < 5; i++ {
		if err := g.command("blue", Command{BotID: "blue-0", Action: "march"}); err != nil {
			t.Fatal(err)
		}
		advance(g, 35)
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
