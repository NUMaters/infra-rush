import { describe, expect, it } from "vitest";
import policyJson from "../master/cpu-balance-policy.json";
import { M } from "../src/game/master";
import { cpuConfigVersion } from "../src/game/balance";
import type { CpuProfiles } from "../src/game/balance";
import {
  choosePromotion,
  evaluateDifficulty,
} from "../src/game/balance-training";
import type {
  BalancePolicy,
  MatchSample,
  SurveySample,
} from "../src/game/balance-training";

const policy = policyJson as BalancePolicy;
const now = new Date("2026-09-27T12:00:00Z");
const profiles: CpuProfiles = {
  easy: { ...M.cpu.easy, interval: 4 },
  normal: { ...M.cpu.normal, interval: 1.6 },
  hard: { ...M.cpu.hard, interval: 0.65 },
};
const samples = (
  selectedDifficulty: "easy" | "normal" | "hard",
  outcome: MatchSample["outcome"],
  feltDifficulty: SurveySample["feltDifficulty"],
) => {
  const matches: MatchSample[] = Array.from({ length: 80 }, (_, index) => ({
    id: `match-${index}`,
    selectedDifficulty,
    configVersion: cpuConfigVersion(profiles, selectedDifficulty),
    outcome,
    receivedAt: "2026-09-27T11:00:00Z",
  }));
  const surveys: SurveySample[] = matches.slice(0, 20).map(({ id }) => ({
    id,
    selectedDifficulty,
    feltDifficulty,
    receivedAt: "2026-09-27T11:10:00Z",
  }));
  return { matches, surveys };
};

describe("CPU balance promotion", () => {
  it("keeps another difficulty's data valid after a profile update", () => {
    const changed = structuredClone(profiles);
    changed.easy.interval += 0.4;
    expect(cpuConfigVersion(changed, "normal")).toBe(
      cpuConfigVersion(profiles, "normal"),
    );
  });

  it("waits for data from the currently deployed model", () => {
    const { matches, surveys } = samples("easy", "loss", "hard");
    matches.forEach((match) => (match.configVersion = "00000000"));
    const result = evaluateDifficulty(
      "easy",
      profiles,
      policy,
      matches,
      surveys,
      now,
    );
    expect(result.decision).toBe("insufficient_data");
    expect(result.matches).toBe(0);
  });

  it("holds when game results and human ratings disagree", () => {
    const { matches, surveys } = samples("normal", "win", "hard");
    expect(
      evaluateDifficulty("normal", profiles, policy, matches, surveys, now)
        .decision,
    ).toBe("conflicting_signals");
  });

  it("honors human freeze and update cooldown", () => {
    const { matches, surveys } = samples("easy", "loss", "hard");
    const frozen = structuredClone(policy);
    frozen.difficulty.easy.frozen = true;
    expect(
      evaluateDifficulty("easy", profiles, frozen, matches, surveys, now)
        .decision,
    ).toBe("frozen");
    expect(
      evaluateDifficulty(
        "easy",
        profiles,
        policy,
        matches,
        surveys,
        now,
        new Date("2026-09-26T12:00:00Z"),
      ).decision,
    ).toBe("cooldown");
  });

  it("softens only one bounded step after enough matching feedback and self-play", () => {
    const { matches, surveys } = samples("easy", "loss", "hard");
    const result = evaluateDifficulty(
      "easy",
      profiles,
      policy,
      matches,
      surveys,
      now,
    );
    expect(result.decision).toBe("promote");
    expect(result.promotion?.candidate.easy.interval).toBe(4.4);
    expect(result.promotion?.candidate.normal).toEqual(profiles.normal);
    expect(result.promotion?.nextVersion).not.toBe(
      cpuConfigVersion(profiles, "easy"),
    );
    expect(choosePromotion([result])?.difficulty).toBe("easy");
  });
});
