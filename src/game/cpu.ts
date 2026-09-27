import { M } from "./master";
import type { Difficulty } from "./master";
import type { Command, GameState, Team } from "./types";
import { canCommand, command, other, usable } from "./engine";
export class CPU {
  private next = 0;
  constructor(
    public difficulty: Difficulty = "normal",
    public team: Team = "red",
  ) {
    this.next = M.cpu[difficulty].initialDelay;
  }
  update(s: GameState) {
    if (s.time < this.next || s.status !== "playing") return;
    const cfg = M.cpu[this.difficulty];
    this.next = s.time + cfg.interval;
    const team = this.team,
      own = s.bridges.find((b) => b.exclusive === team)!,
      enemy = s.bridges.find((b) => b.exclusive === other(team))!;
    const bots = s.bots.filter((b) => b.team === team);
    const idle = bots.filter((b) => b.state === "IDLE");
    const miners = bots.filter((b) => b.action === "mine");
    const candidates = [...idle, ...miners];
    const tryTask = (action: Command["action"], target?: string) => {
      for (const b of candidates) {
        const c = { botId: b.id, action, target };
        if (!canCommand(s, team, c)) {
          command(s, team, c);
          return true;
        }
      }
      return false;
    };
    if (!own.level && !own.lock && tryTask("build", own.id)) return;
    const blocked = s.bridges.find(
      (b) => b.owner === team && b.blockedBy && !b.lock,
    );
    if (blocked && tryTask("clear", blocked.id)) return;
    const damaged = s.bridges.find(
      (b) => b.owner === team && (b.level < b.capacity || b.damage) && !b.lock,
    );
    if (cfg.maintenance && damaged && tryTask("repair", damaged.id)) return;
    // Before the first bridge, all spare Bots mine. Afterwards keep a sustainable workforce.
    const targetMiners = own.level ? cfg.miners : M.bots.count;
    if (miners.length < targetMiners && idle.length && tryTask("mine")) return;
    if (!own.level) return;
    const threatening = s.bots.filter(
      (b) =>
        b.team === other(team) &&
        b.action === "march" &&
        b.state !== "RETURNING",
    );
    const enemyRoute =
      s.bridges.find(
        (b) => b.id === threatening[0]?.target && b.owner === other(team),
      ) ??
      s.bridges.find((b) => b.id === "center" && b.owner === other(team)) ??
      enemy;
    if (
      cfg.sabotage &&
      threatening.length > 0 &&
      !enemyRoute.blockedBy &&
      tryTask("embank", enemyRoute.id)
    )
      return;
    if (
      cfg.central &&
      s.time > 65 &&
      !s.bridges[1].level &&
      tryTask("build", "center")
    )
      return;
    if (
      cfg.maintenance &&
      own.level === 1 &&
      !own.damage &&
      s.teams[team].resources.iron >=
        M.tasks.upgrade2.cost.iron + M.tasks.clear.cost.iron &&
      tryTask("upgrade", own.id)
    )
      return;
    const ownedCenter = s.bridges.find(
      (b) => b.id === "center" && b.owner === team,
    );
    if (
      cfg.maintenance &&
      ownedCenter?.level &&
      ownedCenter.level === ownedCenter.capacity &&
      !ownedCenter.damage &&
      ownedCenter.capacity < M.bridges.maxLevel &&
      tryTask("upgrade", ownedCenter.id)
    )
      return;
    if (
      cfg.sabotage &&
      enemyRoute.level &&
      s.teams[team].resources.iron >=
        M.tasks.destroy.cost.iron + M.tasks.clear.cost.iron &&
      tryTask("destroy", enemyRoute.id)
    )
      return;
    const marching = bots.filter((b) => b.action === "march").length;
    if (
      usable(s, team).length &&
      marching < cfg.attackers &&
      candidates.length > 0 &&
      tryTask("march")
    )
      return;
    if (idle.length) tryTask("mine");
  }
}
