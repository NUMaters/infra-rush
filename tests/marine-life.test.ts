import { describe, expect, it } from "vitest";
import { marineAppearance } from "../src/render/marine-life";

describe("occasional marine encounters", () => {
  it("keeps the opening clear and cycles through every requested creature", () => {
    expect(marineAppearance(0)).toBeNull();
    expect(marineAppearance(18)?.kind).toBe("fish");
    expect(marineAppearance(42)?.kind).toBe("birds");
    expect(marineAppearance(69)?.kind).toBe("dolphin");
    expect(marineAppearance(112)?.kind).toBe("whale");
    expect(marineAppearance(378)?.kind).toBe("fish");
  });

  it("leaves most of the sea quiet and never overlaps encounters", () => {
    let visibleSeconds = 0;
    for (let t = 0; t < 360; t++) if (marineAppearance(t)) visibleSeconds++;
    expect(visibleSeconds).toBeLessThan(120);
    expect(marineAppearance(31)).toBeNull();
    expect(marineAppearance(72)).toBeNull();
  });
});
