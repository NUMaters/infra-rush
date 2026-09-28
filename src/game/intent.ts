import type { Action, GameState, Team } from "./types";
import { other } from "./engine";

// Prefer the dedicated route, but use the contested bridge when it is the
// actionable route. This keeps sabotage and clearance usable without a picker.
export function resolveTaskTarget(
  state: GameState,
  team: Team,
  action: Action | "cancel",
  context: string | null = null,
): string {
  const sabotage = action === "embank" || action === "destroy";
  if (sabotage) {
    const targets =
      context === "center" ? ["center", other(team)] : [other(team), "center"];
    if (context === other(team) && action === "embank") {
      const exclusive = state.bridges.find((b) => b.id === context);
      if (exclusive && !exclusive.blockedBy) return context;
    }
    const findTarget = (allowUnbuilt: boolean) =>
      targets.find((id) => {
        const bridge = state.bridges.find((b) => b.id === id);
        return (
          bridge &&
          (bridge.owner === other(team) ||
            (action === "embank" && bridge.exclusive === other(team))) &&
          (bridge.level > 0 || (allowUnbuilt && action === "embank")) &&
          (action !== "embank" || !bridge.blockedBy)
        );
      });
    return findTarget(false) ?? findTarget(true) ?? other(team);
  }
  if (action === "clear") {
    return (
      (context === "center" ? ["center", team] : [team, "center"]).find(
        (id) => {
          const bridge = state.bridges.find((b) => b.id === id);
          return (
            bridge?.owner === team &&
            bridge.level > 0 &&
            bridge.blockedBy &&
            !bridge.lock
          );
        },
      ) ?? team
    );
  }
  // A bridge tap is an explicit target. Never silently redirect its command
  // to the home bridge when that site changes while the panel is open.
  if (context === "center" || context === team) return context;
  const home = state.bridges.find((bridge) => bridge.id === team);
  const center = state.bridges.find((bridge) => bridge.id === "center");
  if (action === "build" && home?.level && center && !center.level)
    return "center";
  if (
    (action === "upgrade" || action === "repair") &&
    home?.lock &&
    center?.owner === team &&
    center.level > 0 &&
    !center.lock
  )
    return "center";
  return team;
}
