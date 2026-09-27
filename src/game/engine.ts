import { M } from "./master";
import type {
  Action,
  Bot,
  BotState,
  Bridge,
  Command,
  Cost,
  GameEvent,
  GameState,
  Point,
  Resource,
  Team,
} from "./types";
export const other = (t: Team): Team => (t === "blue" ? "red" : "blue");
export const side = (t: Team): number => (t === "blue" ? -1 : 1);
export const quarry = (t: Team): Point => (t === "blue" ? [8, -10] : [-8, 10]);
export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
export function random(s: GameState): number {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function nextQuake(s: GameState) {
  return (
    s.time -
    M.earthquake.meanInterval * Math.log(Math.max(0.000001, 1 - random(s)))
  );
}
export function emit(s: GameState, event: Omit<GameEvent, "id">) {
  s.events.push({ ...event, id: ++s.eventSequence });
  if (s.events.length > 80) s.events.shift();
}
export function createGame(seed = M.game.seed): GameState {
  const teams = Object.fromEntries(
    (["blue", "red"] as const).map((t) => [
      t,
      {
        resources: { ...M.resources.initial },
        hp: M.castle.hp,
        stats: { mined: 0, built: 0, attacks: 0, repairs: 0, sabotage: 0 },
      },
    ]),
  ) as GameState["teams"];
  const s: GameState = {
    time: 0,
    status: "playing",
    winner: null,
    teams,
    bots: [],
    bridges: M.bridges.sites.map((b) => ({
      ...b,
      exclusive: b.exclusive as Team | null,
      owner: null,
      level: 0,
      capacity: 0,
      damage: 0,
      blockedBy: null,
      lock: null,
    })),
    seed,
    nextQuake: 0,
    warned: false,
    events: [],
    eventSequence: 0,
  };
  for (const team of ["blue", "red"] as const)
    for (let i = 0; i < M.bots.count; i++) {
      const home: Point = [
        M.castle[team][0] + (i - 2) * M.bots.spawnSpacing,
        side(team) * 6.3,
      ];
      s.bots.push({
        id: `${team}-${i}`,
        team,
        index: i,
        state: "IDLE",
        position: [...home],
        home,
        path: [],
        action: null,
        target: null,
        progress: 0,
        duration: 0,
        paid: {},
        mineClock: 0,
        mineIndex: 0,
      });
    }
  s.nextQuake = nextQuake(s);
  return s;
}
export function taskSpec(
  action: Action,
  b?: Bridge,
): { cost: Cost; seconds: number } {
  if (action === "build")
    return b?.id === "center" ? M.tasks.buildCenter : M.tasks.build;
  if (action === "upgrade")
    return b?.capacity === 2 ? M.tasks.upgrade3 : M.tasks.upgrade2;
  return M.tasks[action];
}
export function usable(s: GameState, t: Team) {
  return s.bridges.filter((b) => b.owner === t && b.level > 0 && !b.blockedBy);
}
export function canCommand(
  s: GameState,
  team: Team,
  c: Command,
): string | null {
  if (s.status !== "playing") return "試合は終了しています";
  const bot = s.bots.find((b) => b.id === c.botId);
  if (!bot || bot.team !== team) return "自分のBotをタップしてね";
  const mining =
    bot.action === "mine" && (bot.state === "MOVING" || bot.state === "MINING");
  if (c.action === "cancel")
    return mining ? null : "途中でやめられるのは「掘る」だけです";
  if (bot.state !== "IDLE" && !mining) return "この仕事が終わるまで待ってね";
  if (c.action === "mine") return mining ? "いま掘っています" : null;
  if (c.action === "march")
    return usable(s, team).length ? null : "渡れる橋をつくろう";
  const b = s.bridges.find((x) => x.id === c.target);
  if (!b) return "橋をタップしてね";
  if (b.lock) return "別のBotが作業しています";
  if (c.action === "build") {
    if (b.level > 0) return "橋はすでに完成しています";
    if (b.exclusive && b.exclusive !== team) return "相手の橋はつくれません";
    if (
      b.id === "center" &&
      !s.bridges.some((x) => x.exclusive === team && x.level > 0)
    )
      return "先に自分の城の近くに橋をつくろう";
  } else {
    if (!b.level && c.action !== "embank") return "橋がありません";
    if (
      ["upgrade", "repair", "clear"].includes(c.action) &&
      (b.owner ?? b.exclusive) !== team
    )
      return "自分の橋で作業しよう";
    if (
      ["destroy", "embank"].includes(c.action) &&
      (b.owner ?? b.exclusive) !== other(team)
    )
      return "相手の橋で作業しよう";
    if (c.action === "embank" && b.id === "center" && !b.owner)
      return "真ん中の橋は完成後に作業しよう";
    if (c.action === "upgrade" && (b.level < b.capacity || b.damage))
      return "先に橋を直そう";
    if (c.action === "upgrade" && b.capacity >= M.bridges.maxLevel)
      return "これ以上は強くできません";
    if (c.action === "repair" && b.level === b.capacity && !b.damage)
      return "直すところがありません";
    if (c.action === "embank" && b.blockedBy)
      return "すでに道がふさがっています";
    if (c.action === "clear" && !b.blockedBy) return "どける土がありません";
  }
  const cost = taskSpec(c.action, b).cost;
  for (const r of Object.keys(cost) as Resource[])
    if (s.teams[team].resources[r] < (cost[r] ?? 0))
      return `${{ soil: "土", stone: "石", iron: "鉄" }[r]}が${cost[r]}必要です`;
  return null;
}
function pay(s: GameState, t: Team, cost: Cost, mult = -1) {
  for (const r of Object.keys(cost) as Resource[])
    s.teams[t].resources[r] += mult * (cost[r] ?? 0);
}
function returning(s: GameState, b: Bot, text = "シュポン！") {
  const bridge = s.bridges.find((x) => x.lock === b.id);
  if (bridge) bridge.lock = null;
  b.state = "RETURNING";
  b.progress = 0;
  b.duration = M.game.returnSeconds;
  b.path = [];
  b.paid = {};
  emit(s, { kind: "return", team: b.team, position: [...b.position], text });
}
export function command(
  s: GameState,
  t: Team,
  c: Command,
): { ok: boolean; reason?: string } {
  const reason = canCommand(s, t, c);
  if (reason) return { ok: false, reason };
  const b = s.bots.find((x) => x.id === c.botId)!;
  if (c.action === "cancel") {
    returning(s, b);
    return { ok: true };
  }
  const target = s.bridges.find((x) => x.id === c.target);
  b.action = c.action;
  b.target = target?.id ?? null;
  b.progress = 0;
  b.duration = taskSpec(c.action, target).seconds;
  b.paid = { ...taskSpec(c.action, target).cost };
  pay(s, t, b.paid);
  const sz = side(t);
  if (c.action === "mine") {
    const q = quarry(t);
    b.path = [
      [
        q[0] + ((b.index % 3) - 1) * 1.8,
        q[1] + sz * (b.index < 3 ? -1.6 : 0.2),
      ],
    ];
    b.mineClock = 0;
  } else if (c.action === "march") {
    const route = usable(s, t).sort(
      (a, z) =>
        distance(b.position, [a.x, sz * 4]) -
        distance(b.position, [z.x, sz * 4]),
    )[0];
    b.target = route.id;
    b.path = [
      [route.x, sz * 4],
      [route.x, -sz * 4],
      [M.castle[other(t)][0], -sz * 6],
      [M.castle[other(t)][0], -sz * 8],
    ];
  } else {
    target!.lock = b.id;
    b.path =
      c.action === "clear"
        ? [
            [target!.x, sz * 4.6],
            [target!.x, -sz * 3.8],
          ]
        : [[target!.x, sz * 4.6]];
  }
  b.state = c.action === "march" ? "MARCHING" : "MOVING";
  emit(s, {
    kind: "command",
    team: t,
    position: b.path[b.path.length - 1],
    text: "仕事を始めるよ！",
  });
  return { ok: true };
}
const taskStates: Record<Exclude<Action, "mine" | "march">, BotState> = {
  build: "BUILDING_BRIDGE",
  upgrade: "UPGRADING_BRIDGE",
  repair: "REPAIRING_BRIDGE",
  embank: "BUILDING_EMBANKMENT",
  clear: "CLEARING_EMBANKMENT",
  destroy: "DESTROYING_BRIDGE",
};
function arrive(b: Bot) {
  b.progress = 0;
  b.state =
    b.action === "mine"
      ? "MINING"
      : b.action === "march"
        ? "ATTACKING_CASTLE"
        : taskStates[b.action as keyof typeof taskStates];
  if (b.action === "march") b.duration = M.game.attackSeconds;
}
function move(b: Bot, dt: number) {
  let remaining =
    dt * (b.action === "march" ? M.bots.marchSpeed : M.bots.speed);
  while (remaining > 0 && b.path.length) {
    const target = b.path[0],
      d = distance(b.position, target);
    if (d <= remaining) {
      b.position = [...target];
      b.path.shift();
      remaining -= d;
    } else {
      b.position[0] += ((target[0] - b.position[0]) * remaining) / d;
      b.position[1] += ((target[1] - b.position[1]) * remaining) / d;
      remaining = 0;
    }
  }
  if (!b.path.length) arrive(b);
}
function finish(s: GameState, b: Bot) {
  const bridge = s.bridges.find((x) => x.id === b.target);
  const stats = s.teams[b.team].stats;
  if (b.action === "march") {
    const enemy = s.teams[other(b.team)];
    enemy.hp = Math.max(0, enemy.hp - M.castle.attackDamage);
    stats.attacks++;
    emit(s, {
      kind: "attack",
      team: b.team,
      position: [...b.position],
      text: "城に一撃！",
    });
    if (enemy.hp === 0) {
      s.status = "finished";
      s.winner = b.team;
      emit(s, { kind: "end", team: b.team, text: "勝利への道、開通！" });
    }
  } else if (bridge) {
    const owner = bridge.owner ?? bridge.exclusive;
    if (
      b.action !== "build" &&
      ((!bridge.level && b.action !== "embank") ||
        (["upgrade", "repair", "clear"].includes(b.action!) &&
          owner !== b.team) ||
        (["embank", "destroy"].includes(b.action!) &&
          owner !== other(b.team)) ||
        (b.action === "clear" && !bridge.blockedBy))
    ) {
      pay(s, b.team, b.paid, 1);
      returning(s, b, "作業先がなくなったので資源が戻りました");
      return;
    }
    switch (b.action) {
      case "build":
        bridge.owner = b.team;
        bridge.level = 1;
        bridge.capacity = 1;
        bridge.damage = 0;
        stats.built++;
        break;
      case "upgrade":
        bridge.level++;
        bridge.capacity++;
        break;
      case "repair":
        bridge.level = Math.min(bridge.capacity, bridge.level + 1);
        bridge.damage = 0;
        stats.repairs++;
        break;
      case "embank":
        bridge.blockedBy = b.team;
        stats.sabotage++;
        break;
      case "clear":
        bridge.blockedBy = null;
        break;
      case "destroy":
        bridge.level--;
        bridge.damage = Math.min(2, bridge.damage + 1);
        stats.sabotage++;
        if (bridge.level === 0) {
          bridge.owner = null;
          bridge.capacity = 0;
          emit(s, {
            kind: "collapse",
            position: [bridge.x, 0],
            text: "橋がこわれた！",
          });
        }
        break;
    }
    emit(s, {
      kind: "complete",
      team: b.team,
      position: [bridge.x, 0],
      text:
        b.action === "build"
          ? "橋ができた！"
          : b.action === "clear"
            ? "道が通れるようになった！"
            : "仕事が終わった！",
    });
  }
  returning(s, b);
}
export function earthquake(s: GameState) {
  emit(s, { kind: "earthquake", text: "地震だ！ 橋は大丈夫？" });
  for (const b of s.bridges) {
    b.blockedBy = null;
    if (!b.level) continue;
    if (random(s) >= M.earthquake.damageProbability[b.level]) continue;
    b.level = Math.max(M.earthquake.minimumLevel, b.level - 1);
    b.damage = Math.min(2, b.damage + 1);
    if (b.level === 0) {
      b.owner = null;
      b.capacity = 0;
      emit(s, { kind: "collapse", position: [b.x, 0], text: "橋がこわれた！" });
    }
  }
  s.warned = false;
  s.nextQuake = nextQuake(s);
}
export function tick(s: GameState, dt: number) {
  if (s.status !== "playing" || dt <= 0 || !Number.isFinite(dt)) return;
  s.time += dt;
  if (s.time >= M.game.duration) {
    s.time = M.game.duration;
    s.status = "finished";
    s.winner =
      s.teams.blue.hp === s.teams.red.hp
        ? "draw"
        : s.teams.blue.hp > s.teams.red.hp
          ? "blue"
          : "red";
    emit(s, {
      kind: "end",
      team: s.winner === "draw" ? undefined : s.winner,
      text:
        s.winner === "draw"
          ? "タイムアップ！ 引き分け"
          : "タイムアップ！ 城を守りきった！",
    });
    return;
  }
  if (!s.warned && s.time >= s.nextQuake - M.earthquake.warningSeconds) {
    s.warned = true;
    emit(s, { kind: "warning", text: "まもなく地震！" });
  }
  if (s.time >= s.nextQuake) earthquake(s);
  for (const b of s.bots) {
    if (s.status !== "playing") break;
    if (b.state === "IDLE") continue;
    if (b.action === "march" && b.state !== "RETURNING") {
      const route = s.bridges.find((x) => x.id === b.target);
      if (!route || route.owner !== b.team || !route.level || route.blockedBy) {
        returning(s, b, "道が塞がれた！ 帰還します");
        continue;
      }
    }
    if (b.state === "MOVING" || b.state === "MARCHING") {
      move(b, dt);
      continue;
    }
    if (b.state === "MINING") {
      b.mineClock += dt;
      while (b.mineClock >= M.resources.interval) {
        b.mineClock -= M.resources.interval;
        const resource = M.resources.cycle[
          b.mineIndex++ % M.resources.cycle.length
        ] as Resource;
        s.teams[b.team].resources[resource] += M.resources.amount;
        s.teams[b.team].stats.mined += M.resources.amount;
        emit(s, {
          kind: "resource",
          team: b.team,
          position: [...b.position],
          text: `${{ soil: "土", stone: "石", iron: "鉄" }[resource]} +${M.resources.amount}`,
        });
      }
      continue;
    }
    b.progress += dt;
    if (b.progress + 1e-8 < b.duration) continue;
    if (b.state === "RETURNING") {
      b.position = [...b.home];
      b.state = "IDLE";
      b.action = null;
      b.target = null;
      b.progress = 0;
    } else finish(s, b);
  }
}
