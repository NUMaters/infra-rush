import type { Action, GameState, Team } from "./types";
import { other } from "./engine";

// Ordinary Bot commands use the corresponding team's dedicated bridge.
// Tapping the central bridge directly retains access to the contested route.
export function resolveTaskTarget(
  state: GameState,
  team: Team,
  action: Action | "cancel",
  context: string | null = null,
): string {
  const sabotage = action === "embank" || action === "destroy";
  if (
    context === "center" &&
    (!sabotage ||
      state.bridges.find((b) => b.id === "center")?.owner === other(team))
  )
    return "center";
  return sabotage ? other(team) : team;
}
