import { describe, it, expect } from "vitest";
import { canCommand, createGame } from "../src/game/engine";
import { resolveTaskTarget } from "../src/game/intent";
describe("automatic construction targets", () => {
  it("assigns construction to own bridge and sabotage to enemy without a selector", () => {
    const s = createGame();
    for (const team of ["blue", "red"] as const) {
      for (const action of ["build", "upgrade", "repair", "clear"] as const)
        expect(resolveTaskTarget(s, team, action)).toBe(team);
      for (const action of ["embank", "destroy"] as const)
        expect(resolveTaskTarget(s, team, action)).toBe(
          team === "blue" ? "red" : "blue",
        );
    }
  });
  it("keeps central bridge work accessible by direct map selection", () => {
    const s = createGame();
    expect(resolveTaskTarget(s, "blue", "build", "center")).toBe("center");
    s.bridges[1].owner = "red";
    s.bridges[1].level = s.bridges[1].capacity = 1;
    expect(resolveTaskTarget(s, "blue", "destroy", "center")).toBe("center");
    s.bridges[1].owner = "blue";
    expect(resolveTaskTarget(s, "blue", "repair", "center")).toBe("center");
    expect(resolveTaskTarget(s, "blue", "embank", "center")).toBe("red");
    expect(resolveTaskTarget(s, "blue", "build")).toBe("blue");
  });
  it("falls back from a locked or already blocked central bridge to an actionable enemy bridge", () => {
    const s = createGame();
    const center = s.bridges.find((bridge) => bridge.id === "center")!;
    const enemy = s.bridges.find((bridge) => bridge.id === "red")!;
    for (const bridge of [center, enemy]) {
      bridge.owner = "red";
      bridge.level = bridge.capacity = 1;
    }
    center.lock = "red-0";
    expect(resolveTaskTarget(s, "blue", "embank", "center")).toBe("red");
    expect(resolveTaskTarget(s, "blue", "destroy", "center")).toBe("red");
    center.lock = null;
    center.blockedBy = "blue";
    expect(resolveTaskTarget(s, "blue", "embank", "center")).toBe("red");
    expect(resolveTaskTarget(s, "blue", "destroy", "center")).toBe("center");
    s.teams.blue.resources.soil = 30;
    s.teams.blue.resources.iron = 45;
    for (const action of ["embank", "destroy"] as const)
      expect(
        canCommand(s, "blue", {
          botId: "blue-0",
          action,
          target: resolveTaskTarget(s, "blue", action, "center"),
        }),
      ).toBeNull();
  });
  it("uses the contested route for sabotage and clearance when it is the usable target", () => {
    const s = createGame();
    const center = s.bridges.find((b) => b.id === "center")!;
    center.owner = "red";
    center.level = 1;
    expect(resolveTaskTarget(s, "blue", "embank")).toBe("center");
    s.teams.blue.resources.soil = 30;
    expect(
      canCommand(s, "blue", {
        botId: "blue-0",
        action: "embank",
        target: resolveTaskTarget(s, "blue", "embank"),
      }),
    ).toBeNull();
    expect(resolveTaskTarget(s, "blue", "destroy")).toBe("center");
    center.owner = "blue";
    center.blockedBy = "red";
    expect(resolveTaskTarget(s, "blue", "clear")).toBe("center");
  });
});
