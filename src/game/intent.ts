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
  if (context && (context === "center" || context === team)) {
    const center = state.bridges.find((bridge) => bridge.id === context);
    if (
      center &&
      !center.lock &&
      (action === "build"
        ? !center.level
        : center.owner === team && center.level > 0)
    )
      return context;
  }
  return team;
}
