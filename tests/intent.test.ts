import { describe, it, expect } from "vitest";
import { createGame } from "../src/game/engine";
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
    expect(resolveTaskTarget(s, "blue", "destroy", "center")).toBe("center");
    s.bridges[1].owner = "blue";
    expect(resolveTaskTarget(s, "blue", "repair", "center")).toBe("center");
    expect(resolveTaskTarget(s, "blue", "embank", "center")).toBe("red");
    expect(resolveTaskTarget(s, "blue", "build")).toBe("blue");
  });
});
