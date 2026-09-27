import { describe, expect, it } from "vitest";
import {
  EXCAVATOR_DIG_SECONDS,
  dampAngle,
  excavatorDigPose,
} from "../src/render/excavator-motion";

describe("excavator dig cycle", () => {
  it("loops without a jump at the cycle boundary", () => {
    const end = excavatorDigPose(EXCAVATOR_DIG_SECONDS - 1e-6);
    const start = excavatorDigPose(0);
    for (const k of ["boom", "arm", "bucket", "slew"] as const)
      expect(end[k]).toBeCloseTo(start[k], 4);
  });

  it("changes every joint gradually between frames", () => {
    for (let t = 0; t < EXCAVATOR_DIG_SECONDS; t += 1 / 60) {
      const a = excavatorDigPose(t);
      const b = excavatorDigPose(t + 1 / 60);
      for (const k of ["boom", "arm", "bucket", "slew"] as const)
        expect(Math.abs(b[k] - a[k])).toBeLessThan(0.12);
    }
  });

  it("digs facing forward and dumps swung aside", () => {
    const bite = excavatorDigPose(0, 1.2);
    expect(bite.slew).toBeCloseTo(0);
    const dump = excavatorDigPose(EXCAVATOR_DIG_SECONDS * 0.73, 1.2);
    expect(dump.slew).toBeCloseTo(0.42);
    expect(dump.bucket).toBeGreaterThan(bite.bucket);
    expect(
      excavatorDigPose(EXCAVATOR_DIG_SECONDS * 0.73, -1.2).slew,
    ).toBeCloseTo(-0.42);
  });
});

describe("dampAngle", () => {
  it("turns along the shorter arc across the ±π seam", () => {
    const next = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 5, 0.016);
    expect(next).toBeGreaterThan(Math.PI - 0.1);
  });

  it("converges on the target without overshooting", () => {
    let a = 0;
    for (let i = 0; i < 120; i++) a = dampAngle(a, 1.5, 4.5, 1 / 60);
    expect(a).toBeLessThanOrEqual(1.5);
    expect(a).toBeCloseTo(1.5, 2);
  });
});
