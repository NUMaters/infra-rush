import { describe, it, expect } from "vitest";
import { M } from "../src/game/master";
import {
  canCommand,
  command,
  createGame,
  earthquake,
  tick,
} from "../src/game/engine";
import { CPU } from "../src/game/cpu";
import type { Action, GameState, Team } from "../src/game/types";
const advance = (s: GameState, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / M.game.tick); i++)
    tick(s, M.game.tick);
};
const fund = (s: GameState, t: Team = "blue") => {
  s.teams[t].resources = { soil: 500, stone: 500, iron: 500 };
};
const bridge = (s: GameState, t: Team = "blue", level = 1) => {
  const b = s.bridges.find((b) => b.id === t)!;
  Object.assign(b, { owner: t, level, capacity: level });
  return b;
};
const doTask = (
  s: GameState,
  action: Action,
  target = "blue",
  team: Team = "blue",
  id = 0,
) => {
  const r = command(s, team, { botId: `${team}-${id}`, action, target });
  expect(r.ok, r.reason).toBe(true);
  advance(s, 35);
};
describe("Bot state and mining", () => {
  it("starts with five identical Bots per team, zero resources and 15 HP", () => {
    const s = createGame();
    expect(s.bots).toHaveLength(10);
    expect(s.teams.blue.resources).toEqual({ soil: 0, stone: 0, iron: 0 });
    expect(s.teams.red.hp).toBe(15);
    expect(s.bots.every((b) => b.state === "IDLE")).toBe(true);
  });
  it("moves to quarry before producing exactly one resource each second", () => {
    const s = createGame();
    command(s, "blue", { botId: "blue-0", action: "mine" });
    expect(s.bots[0].state).toBe("MOVING");
    expect(s.teams.blue.stats.mined).toBe(0);
    while (s.bots[0].state === "MOVING") tick(s, 0.05);
    advance(s, 4.05);
    expect(s.teams.blue.resources).toEqual({ stone: 2, soil: 1, iron: 1 });
  });
  it("can cancel mining while travelling and respawns idle", () => {
    const s = createGame();
    command(s, "blue", { botId: "blue-0", action: "mine" });
    expect(command(s, "blue", { botId: "blue-0", action: "cancel" }).ok).toBe(
      true,
    );
    advance(s, 1);
    expect(s.bots[0].state).toBe("IDLE");
    expect(s.bots[0].position).toEqual(s.bots[0].home);
  });
  it("does not cancel finite construction or spend twice", () => {
    const s = createGame();
    fund(s);
    command(s, "blue", { botId: "blue-0", action: "build", target: "blue" });
    expect(s.teams.blue.resources.stone).toBe(450);
    expect(command(s, "blue", { botId: "blue-0", action: "cancel" }).ok).toBe(
      false,
    );
    expect(
      command(s, "blue", { botId: "blue-0", action: "build", target: "blue" })
        .ok,
    ).toBe(false);
    expect(s.teams.blue.resources.stone).toBe(450);
  });
  it("rejects foreign Bots and insufficient funds without mutation", () => {
    const s = createGame(),
      before = structuredClone(s);
    expect(command(s, "blue", { botId: "red-0", action: "mine" }).ok).toBe(
      false,
    );
    expect(
      command(s, "blue", { botId: "blue-0", action: "build", target: "blue" })
        .ok,
    ).toBe(false);
    expect(s).toEqual(before);
  });
  it("supports replacing a mining assignment with a valid finite task", () => {
    const s = createGame();
    fund(s);
    command(s, "blue", { botId: "blue-0", action: "mine" });
    advance(s, 8);
    expect(
      command(s, "blue", { botId: "blue-0", action: "build", target: "blue" })
        .ok,
    ).toBe(true);
    advance(s, 25);
    expect(s.bridges[0].level).toBe(1);
    expect(s.bots[0].state).toBe("IDLE");
  });
});
describe("bridges, ownership and route validation", () => {
  it("keeps an attacker on the enemy bank after its bridge collapses", () => {
    const s = createGame();
    s.nextQuake = 1e9;
    bridge(s);
    expect(command(s, "blue", { botId: "blue-0", action: "march" }).ok).toBe(
      true,
    );
    expect(command(s, "blue", { botId: "blue-1", action: "march" }).ok).toBe(
      true,
    );
    while (s.bots[0].path.length > 2) tick(s, M.game.tick);
    // The first Bot has crossed; the second has not yet reached the far bank.
    s.bots[1].path = [
      [-7, -4],
      [-7, 4],
      [0, 6],
      [0, 8],
    ];
    s.bots[1].position = [...s.bots[1].home];
    s.bridges[0].level = 0;
    advance(s, 16);
    expect(s.teams.red.hp).toBe(14);
    expect(s.bots[1].state).toBe("IDLE");
  });
  it("allows embankment and drilling beside another Bot's bridge work", () => {
    const s = createGame();
    s.nextQuake = 1e9;
    fund(s);
    fund(s, "red");
    const b = bridge(s, "blue", 2);
    b.capacity = 3;
    b.damage = 1;
    expect(
      command(s, "blue", { botId: "blue-0", action: "repair", target: "blue" })
        .ok,
    ).toBe(true);
    expect(
      command(s, "red", { botId: "red-0", action: "embank", target: "blue" })
        .ok,
    ).toBe(true);
    expect(
      command(s, "red", { botId: "red-1", action: "destroy", target: "blue" })
        .ok,
    ).toBe(true);
    expect(b.lock).toBe("blue-0");
    advance(s, 35);
    expect(b.blockedBy).toBe("red");
    expect(b.level).toBe(2);
    expect(b.damage).toBe(1);
  });
  it("removes exactly one strength per drill or earthquake and retains cracks until fully repaired", () => {
    const s = createGame();
    s.nextQuake = 1e9;
    fund(s);
    fund(s, "red");
    const b = bridge(s, "blue", 3);
    doTask(s, "destroy", "blue", "red");
    expect(b).toMatchObject({ level: 2, capacity: 3, damage: 1 });
    doTask(s, "destroy", "blue", "red");
    expect(b).toMatchObject({ level: 1, capacity: 3, damage: 2 });
    doTask(s, "repair");
    expect(b).toMatchObject({ level: 2, capacity: 3, damage: 1 });
    earthquake(s);
    expect(b).toMatchObject({ level: 1, capacity: 3, damage: 2 });
    doTask(s, "destroy", "blue", "red");
    expect(b).toMatchObject({ level: 0, capacity: 0, owner: null });
  });
  it("builds own bridge for stone50 and returns home", () => {
    const s = createGame();
    fund(s);
    doTask(s, "build");
    expect(s.bridges[0]).toMatchObject({
      owner: "blue",
      level: 1,
      capacity: 1,
      lock: null,
    });
    expect(s.teams.blue.resources.stone).toBe(450);
    expect(s.bots[0].state).toBe("IDLE");
  });
  it("enforces dedicated bridge prerequisite and exclusive access", () => {
    const s = createGame();
    fund(s);
    expect(
      canCommand(s, "blue", {
        botId: "blue-0",
        action: "build",
        target: "center",
      }),
    ).not.toBeNull();
    expect(
      canCommand(s, "blue", {
        botId: "blue-0",
        action: "build",
        target: "red",
      }),
    ).not.toBeNull();
    bridge(s, "red");
    expect(
      canCommand(s, "blue", { botId: "blue-0", action: "march" }),
    ).not.toBeNull();
  });
  it("reserves shared construction against competing commands", () => {
    const s = createGame();
    fund(s);
    fund(s, "red");
    bridge(s);
    bridge(s, "red");
    expect(
      command(s, "blue", { botId: "blue-0", action: "build", target: "center" })
        .ok,
    ).toBe(true);
    expect(
      command(s, "red", { botId: "red-0", action: "build", target: "center" })
        .ok,
    ).toBe(false);
    expect(s.teams.red.resources.stone).toBe(500);
    advance(s, 30);
    expect(s.bridges[1].owner).toBe("blue");
  });
  it("attacks once then respawns, with no Bot-on-Bot damage", () => {
    const s = createGame();
    bridge(s);
    doTask(s, "march");
    expect(s.teams.red.hp).toBe(14);
    expect(s.teams.blue.stats.attacks).toBe(1);
    expect(s.bots[0].position).toEqual(s.bots[0].home);
    advance(s, 10);
    expect(s.teams.red.hp).toBe(14);
  });
  it("fifteen attacks win and all further mutations stop", () => {
    const s = createGame();
    bridge(s);
    for (let wave = 0; wave < 3; wave++) {
      for (let i = 0; i < 5; i++)
        command(s, "blue", { botId: `blue-${i}`, action: "march" });
      advance(s, 30);
    }
    expect(s.status).toBe("finished");
    expect(s.winner).toBe("blue");
    expect(s.teams.red.hp).toBe(0);
    const before = structuredClone(s);
    advance(s, 10);
    expect(s).toEqual(before);
  });
  it("aborts march on embankment before crossing the bridge", () => {
    const s = createGame();
    const b = bridge(s);
    command(s, "blue", { botId: "blue-0", action: "march" });
    b.blockedBy = "red";
    tick(s, 0.05);
    expect(s.bots[0].state).toBe("RETURNING");
    advance(s, 20);
    expect(s.teams.red.hp).toBe(15);
  });
  it("aborts march if bridge collapses", () => {
    const s = createGame();
    const b = bridge(s);
    command(s, "blue", { botId: "blue-0", action: "march" });
    b.level = 0;
    advance(s, 20);
    expect(s.teams.red.hp).toBe(15);
    expect(s.bots[0].state).toBe("IDLE");
  });
  it("upgrades to Lv3, rejects higher and repairs drill loss", () => {
    const s = createGame();
    fund(s);
    fund(s, "red");
    bridge(s);
    doTask(s, "upgrade");
    doTask(s, "upgrade");
    expect(s.bridges[0].level).toBe(3);
    expect(
      canCommand(s, "blue", {
        botId: "blue-0",
        action: "upgrade",
        target: "blue",
      }),
    ).not.toBeNull();
    doTask(s, "destroy", "blue", "red");
    expect(s.bridges[0].level).toBe(2);
    doTask(s, "repair");
    expect(s.bridges[0]).toMatchObject({ level: 3, capacity: 3, damage: 0 });
  });
  it("embanks enemy bridge and clears it with iron10", () => {
    const s = createGame();
    fund(s);
    fund(s, "red");
    bridge(s);
    doTask(s, "embank", "blue", "red");
    expect(s.bridges[0].blockedBy).toBe("red");
    expect(
      canCommand(s, "blue", { botId: "blue-0", action: "march" }),
    ).not.toBeNull();
    const start = command(s, "blue", {
      botId: "blue-0",
      action: "clear",
      target: "blue",
    });
    expect(start.ok).toBe(true);
    expect(s.bots[0].path.at(-1)).toEqual([s.bridges[0].x, 3.8]);
    advance(s, 7);
    expect(s.bots[0].position[1]).toBeGreaterThan(2);
    expect(s.bots[0].state).toBe("CLEARING_EMBANKMENT");
    advance(s, 35);
    expect(s.bridges[0].blockedBy).toBeNull();
    expect(s.teams.blue.resources.iron).toBe(490);
  });
  it("neutralizes collapsed central bridge so it can be claimed again", () => {
    const s = createGame();
    fund(s);
    fund(s, "red");
    bridge(s);
    bridge(s, "red");
    doTask(s, "build", "center");
    doTask(s, "destroy", "center", "red");
    expect(s.bridges[1]).toMatchObject({
      owner: null,
      level: 0,
      blockedBy: null,
      lock: null,
    });
    doTask(s, "build", "center", "red");
    expect(s.bridges[1].owner).toBe("red");
  });
});
describe("earthquake, game timer and determinism", () => {
  it("starts the easy CPU shortly after the opening animation", () => {
    const s = createGame();
    const cpu = new CPU("easy");
    s.time = 7.9;
    cpu.update(s);
    expect(
      s.bots.filter((b) => b.team === "red").every((b) => b.state === "IDLE"),
    ).toBe(true);
    s.time = 8.1;
    cpu.update(s);
    expect(
      s.bots.filter((b) => b.team === "red").some((b) => b.action === "mine"),
    ).toBe(true);
  });
  it("allows pre-embankment at an enemy bridge site and preserves it through construction", () => {
    const s = createGame();
    s.nextQuake = 1e9;
    fund(s, "blue");
    fund(s, "red");
    doTask(s, "embank", "red", "blue");
    expect(s.bridges[2]).toMatchObject({ level: 0, blockedBy: "blue" });
    doTask(s, "build", "red", "red");
    expect(s.bridges[2]).toMatchObject({
      owner: "red",
      level: 1,
      blockedBy: "blue",
    });
    expect(
      canCommand(s, "red", { botId: "red-0", action: "march" }),
    ).not.toBeNull();
  });
  it("lets the owner upgrade central bridge and the opponent block and damage it", () => {
    const s = createGame();
    s.nextQuake = 1e9;
    fund(s, "blue");
    fund(s, "red");
    bridge(s);
    doTask(s, "build", "center");
    doTask(s, "upgrade", "center");
    expect(s.bridges[1]).toMatchObject({
      owner: "blue",
      level: 2,
      capacity: 2,
    });
    doTask(s, "embank", "center", "red");
    expect(s.bridges[1].blockedBy).toBe("red");
    doTask(s, "destroy", "center", "red");
    expect(s.bridges[1]).toMatchObject({ level: 1, damage: 1 });
  });
  it("earthquake removes one level and clears embankments", () => {
    const s = createGame();
    bridge(s, "blue", 2);
    bridge(s, "red", 3);
    s.bridges[0].blockedBy = "red";
    earthquake(s);
    expect(s.bridges[0].level).toBe(1);
    expect(s.bridges[2].level).toBe(2);
    expect(s.bridges[0].blockedBy).toBeNull();
    expect(s.bridges[0].damage).toBeGreaterThan(0);
    earthquake(s);
    expect(s.bridges[0]).toMatchObject({ level: 0, owner: null, capacity: 0 });
  });
  it("allows repair of visually damaged Lv1", () => {
    const s = createGame();
    fund(s);
    const b = bridge(s);
    b.damage = 1;
    doTask(s, "repair");
    expect(b.damage).toBe(0);
    expect(b.level).toBe(1);
  });
  it("awards timeout to the team with more castle HP, drawing only on equal HP", () => {
    const s = createGame();
    s.teams.blue.hp = 2;
    advance(s, 360.1);
    expect(s.winner).toBe("red");
    expect(s.time).toBe(360);
    const equal = createGame();
    advance(equal, 360.1);
    expect(equal.winner).toBe("draw");
  });
  it("is reproducible from seed and commands", () => {
    const a = createGame(71),
      b = createGame(71);
    for (const s of [a, b]) {
      command(s, "blue", { botId: "blue-0", action: "mine" });
      advance(s, 120);
    }
    expect(a).toEqual(b);
  });
  it("ignores negative and nonfinite time steps", () => {
    const s = createGame(),
      before = structuredClone(s);
    tick(s, -1);
    tick(s, NaN);
    expect(s).toEqual(before);
  });
});
describe("CPU plays under the same resource rules", () => {
  it("builds and wins against an idle player without any resource injection", () => {
    const s = createGame(5);
    const cpu = new CPU("normal");
    for (let i = 0; i < 7200 && s.status === "playing"; i++) {
      cpu.update(s);
      tick(s, 0.05);
      for (const r of Object.values(s.teams.red.resources))
        expect(r).toBeGreaterThanOrEqual(0);
    }
    expect(s.teams.red.stats.mined).toBeGreaterThan(50);
    expect(s.teams.red.stats.built).toBeGreaterThan(0);
    expect(s.winner).toBe("red");
  });
  it("prioritizes clearing a blocked own bridge", () => {
    const s = createGame();
    fund(s, "red");
    const b = bridge(s, "red");
    b.blockedBy = "blue";
    new CPU("hard").update(s);
    expect(s.bots.find((b) => b.id === "red-0")?.action).toBe("clear");
    expect(s.teams.red.resources.iron).toBe(490);
  });
  it("does not create resources merely by thinking", () => {
    const s = createGame();
    const cpu = new CPU("hard");
    for (let i = 0; i < 100; i++) cpu.update(s);
    expect(s.teams.red.resources).toEqual(M.resources.initial);
  });
  it("symmetric CPU matches terminate without stuck resource locks", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame(seed),
        a = new CPU("normal", "blue"),
        b = new CPU("hard", "red");
      for (let i = 0; i < 7300 && s.status === "playing"; i++) {
        a.update(s);
        b.update(s);
        tick(s, 0.05);
      }
      expect(s.status).toBe("finished");
      expect(
        s.teams.blue.stats.built + s.teams.red.stats.built,
      ).toBeGreaterThan(1);
      for (const bridge of s.bridges)
        if (bridge.lock)
          expect(
            s.bots.some((b) => b.id === bridge.lock && b.state !== "IDLE"),
          ).toBe(true);
    }
  });
});
