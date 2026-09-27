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
    return (
      targets.find((id) => {
        const bridge = state.bridges.find((b) => b.id === id);
        return (
          bridge &&
          bridge.owner === other(team) &&
          bridge.level > 0 &&
          !bridge.lock &&
          (action !== "embank" || !bridge.blockedBy)
        );
      }) ?? other(team)
    );
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
  if (context === "center") {
    const center = state.bridges.find((bridge) => bridge.id === "center");
    if (
      center &&
      !center.lock &&
      (action === "build"
        ? !center.level
        : center.owner === team && center.level > 0)
    )
      return "center";
  }
  return team;
}
