import { quarry } from "../game/engine";
import type { Bot, Bridge, Point } from "../game/types";

// Blender assets face local -Y, which glTF maps to Three.js local +Z.
// Point each working attachment toward what it touches instead of using a
// fixed team-facing rotation. In particular, the dozer blade must face the
// mound at the enemy bridge exit, not the opposite shore.
export function vehicleWorkHeading(
  bot: Pick<Bot, "team" | "action" | "target" | "position">,
  bridges: readonly Pick<Bridge, "id" | "x" | "owner">[],
): number {
  let target: Point | null = null;
  if (bot.action === "mine") target = quarry(bot.team);
  else {
    const bridge = bridges.find((b) => b.id === bot.target);
    if (bridge) {
      target =
        bot.action === "embank" || bot.action === "clear"
          ? [bridge.x, bridge.owner === "blue" ? 4 : -4]
          : [bridge.x, 0];
    }
  }
  if (!target) return bot.team === "blue" ? 0 : Math.PI;
  const dx = target[0] - bot.position[0];
  const dz = target[1] - bot.position[1];
  if (Math.hypot(dx, dz) < 0.01) return bot.team === "blue" ? 0 : Math.PI;
  return Math.atan2(dx, dz);
}
