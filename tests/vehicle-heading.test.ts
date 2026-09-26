import { describe, expect, it } from "vitest";
import { vehicleWorkHeading } from "../src/render/vehicle-heading";
import type { Bot, Bridge } from "../src/game/types";

const bridges = [
  { id: "blue", x: -7, owner: "blue" },
  { id: "red", x: 7, owner: "red" },
] as Pick<Bridge, "id" | "x" | "owner">[];

function heading(
  team: Bot["team"],
  action: Bot["action"],
  target: Bot["target"],
  position: Bot["position"],
) {
  return vehicleWorkHeading({ team, action, target, position }, bridges);
}

describe("working vehicle orientation", () => {
  it("faces each bulldozer blade toward the mound at the enemy bridge exit", () => {
    expect(heading("blue", "embank", "red", [7, -4.6])).toBeCloseTo(0);
    expect(heading("red", "embank", "blue", [-7, 4.6])).toBeCloseTo(Math.PI);
  });

  it("faces the grader toward the mound it removes", () => {
    expect(heading("blue", "clear", "blue", [-7, 3.8])).toBeCloseTo(0);
    expect(heading("red", "clear", "red", [7, -3.8])).toBeCloseTo(Math.PI);
  });

  it("faces the launcher and drill toward the bridge they work on", () => {
    expect(heading("blue", "build", "blue", [-7, -4.6])).toBeCloseTo(0);
    expect(heading("red", "build", "red", [7, 4.6])).toBeCloseTo(Math.PI);
    expect(heading("blue", "destroy", "red", [7, -4.6])).toBeCloseTo(0);
  });

  it("faces the excavator bucket toward the quarry from either work slot", () => {
    expect(heading("blue", "mine", null, [8, -11.6])).toBeCloseTo(0);
    expect(heading("blue", "mine", null, [8, -9.8])).toBeCloseTo(Math.PI);
  });
});
