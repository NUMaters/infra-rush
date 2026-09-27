import { CPU } from "./cpu";
import { createGame, tick } from "./engine";
import { cpuConfigVersion } from "./balance";
import type { CpuProfiles } from "./balance";
import type { Difficulty } from "./master";

export interface MatchSample {
  id: string;
  selectedDifficulty: Difficulty;
  configVersion: string;
  outcome: "win" | "loss" | "draw";
  receivedAt: string;
}
export interface SurveySample {
  id: string;
  selectedDifficulty: Difficulty;
  feltDifficulty: Difficulty;
  receivedAt: string;
}
export interface DifficultyPolicy {
  frozen: boolean;
  targetPlayerWin: number;
  targetFeeling: number;
  interval: { min: number; max: number; step: number };
}
export interface BalancePolicy {
  schemaVersion: number;
  enabled: boolean;
  historyDays: number;
  maxRecordsPerDifficulty: number;
  minimumMatches: number;
  minimumSurveys: number;
  minimumDaysBetweenUpdates: number;
  winDeadband: number;
  feelingDeadband: number;
  winOnlyThreshold: number;
  selfPlaySeeds: number;
  maxBadSelfPlayDelta: number;
  difficulty: Record<Difficulty, DifficultyPolicy>;
}
export interface Promotion {
  difficulty: Difficulty;
  direction: "stronger" | "softer";
  currentVersion: string;
  nextVersion: string;
  candidate: CpuProfiles;
  matches: number;
  surveys: number;
  playerWinRate: number;
  averageFeeling: number;
  signal: number;
  selfPlayDelta: number;
}
export interface Evaluation {
  difficulty: Difficulty;
  matches: number;
  surveys: number;
  playerWinRate: number | null;
  averageFeeling: number | null;
  decision: string;
  promotion?: Promotion;
}

const difficulties = ["easy", "normal", "hard"] as const;
const feeling = { easy: 0, normal: 1, hard: 2 };

export function validateBalancePolicy(policy: BalancePolicy): void {
  if (
    policy.schemaVersion !== 1 ||
    typeof policy.enabled !== "boolean" ||
    !Number.isInteger(policy.historyDays) ||
    policy.historyDays < 1 ||
    policy.historyDays > 365 ||
    !Number.isInteger(policy.maxRecordsPerDifficulty) ||
    policy.maxRecordsPerDifficulty > 10000 ||
    !Number.isInteger(policy.minimumMatches) ||
    policy.minimumMatches < 30 ||
    !Number.isInteger(policy.minimumSurveys) ||
    policy.minimumSurveys < 8 ||
    policy.minimumSurveys > policy.minimumMatches ||
    policy.maxRecordsPerDifficulty < policy.minimumMatches ||
    !Number.isInteger(policy.minimumDaysBetweenUpdates) ||
    policy.minimumDaysBetweenUpdates < 1 ||
    policy.minimumDaysBetweenUpdates > 30 ||
    !Number.isFinite(policy.winDeadband) ||
    policy.winDeadband < 0.05 ||
    policy.winDeadband > 0.5 ||
    !Number.isFinite(policy.feelingDeadband) ||
    policy.feelingDeadband < 0.1 ||
    policy.feelingDeadband > 1 ||
    !Number.isFinite(policy.winOnlyThreshold) ||
    policy.winOnlyThreshold < policy.winDeadband ||
    policy.winOnlyThreshold > 0.5 ||
    !Number.isInteger(policy.selfPlaySeeds) ||
    policy.selfPlaySeeds < 2 ||
    policy.selfPlaySeeds > 32 ||
    !Number.isInteger(policy.maxBadSelfPlayDelta) ||
    policy.maxBadSelfPlayDelta < 0 ||
    policy.maxBadSelfPlayDelta > policy.selfPlaySeeds
  ) {
    throw new Error("unsafe balance policy");
  }
  for (const name of difficulties) {
    const p = policy.difficulty[name];
    if (
      !p ||
      typeof p.frozen !== "boolean" ||
      !Number.isFinite(p.targetPlayerWin) ||
      p.targetPlayerWin < 0.1 ||
      p.targetPlayerWin > 0.9 ||
      !Number.isFinite(p.targetFeeling) ||
      p.targetFeeling < 0 ||
      p.targetFeeling > 2 ||
      !Number.isFinite(p.interval.min) ||
      !Number.isFinite(p.interval.max) ||
      !Number.isFinite(p.interval.step) ||
      p.interval.min <= 0 ||
      p.interval.min >= p.interval.max ||
      p.interval.step <= 0 ||
      p.interval.step > 0.5
    ) {
      throw new Error(`unsafe ${name} balance bounds`);
    }
  }
  if (!(
    policy.difficulty.easy.interval.min >
      policy.difficulty.normal.interval.max &&
    policy.difficulty.normal.interval.min > policy.difficulty.hard.interval.max
  )) {
    throw new Error("difficulty interval bounds must remain ordered");
  }
}

function selfPlayScore(
  difficulty: Difficulty,
  current: CpuProfiles,
  candidate: CpuProfiles,
  seeds: number,
): number {
  let score = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    for (const candidateTeam of ["blue", "red"] as const) {
      const state = createGame(seed);
      const opponentTeam = candidateTeam === "blue" ? "red" : "blue";
      const challenger = new CPU(
        difficulty,
        candidateTeam,
        candidate[difficulty],
      );
      const incumbent = new CPU(difficulty, opponentTeam, current[difficulty]);
      for (let step = 0; step < 7200 && state.status === "playing"; step++) {
        challenger.update(state);
        incumbent.update(state);
        tick(state, 0.05);
      }
      if (state.status !== "finished")
        throw new Error("self-play did not finish");
      if (state.winner === candidateTeam) score++;
      else if (state.winner === opponentTeam) score--;
    }
  }
  return score;
}

export function evaluateDifficulty(
  difficulty: Difficulty,
  profiles: CpuProfiles,
  policy: BalancePolicy,
  matches: MatchSample[],
  surveys: SurveySample[],
  now: Date,
  previousUpdate?: Date,
): Evaluation {
  validateBalancePolicy(policy);
  if (
    !difficulties.every((name) => {
      const interval = profiles[name].interval;
      const bounds = policy.difficulty[name].interval;
      return (
        Number.isFinite(interval) &&
        interval >= bounds.min &&
        interval <= bounds.max
      );
    }) ||
    !(
      profiles.easy.interval > profiles.normal.interval &&
      profiles.normal.interval > profiles.hard.interval
    )
  ) {
    throw new Error("current CPU settings violate balance policy");
  }
  const version = cpuConfigVersion(profiles, difficulty);
  const p = policy.difficulty[difficulty];
  const latest = Date.parse(now.toISOString()) - policy.historyDays * 86400_000;
  const relevant = matches
    .filter(
      (item) =>
        item.selectedDifficulty === difficulty &&
        item.configVersion === version &&
        Date.parse(item.receivedAt) >= latest &&
        Date.parse(item.receivedAt) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(0, policy.maxRecordsPerDifficulty);
  const byID = new Set(relevant.map((item) => item.id));
  const answers = surveys.filter(
    (item) => item.selectedDifficulty === difficulty && byID.has(item.id),
  );
  const playerWinRate = relevant.length
    ? relevant.reduce(
        (sum, item) =>
          sum +
          (item.outcome === "win" ? 1 : item.outcome === "draw" ? 0.5 : 0),
        0,
      ) / relevant.length
    : null;
  const averageFeeling = answers.length
    ? answers.reduce((sum, item) => sum + feeling[item.feltDifficulty], 0) /
      answers.length
    : null;
  const base = {
    difficulty,
    matches: relevant.length,
    surveys: answers.length,
    playerWinRate,
    averageFeeling,
  };
  if (!policy.enabled || p.frozen) return { ...base, decision: "frozen" };
  if (
    relevant.length < policy.minimumMatches ||
    answers.length < policy.minimumSurveys
  )
    return { ...base, decision: "insufficient_data" };
  if (
    previousUpdate &&
    now.getTime() - previousUpdate.getTime() <
      policy.minimumDaysBetweenUpdates * 86400_000
  )
    return { ...base, decision: "cooldown" };
  const winDelta = playerWinRate! - p.targetPlayerWin;
  const feelingDelta = p.targetFeeling - averageFeeling!;
  const winSignal =
    Math.abs(winDelta) >= policy.winDeadband ? Math.sign(winDelta) : 0;
  const feelingSignal =
    Math.abs(feelingDelta) >= policy.feelingDeadband
      ? Math.sign(feelingDelta)
      : 0;
  if (winSignal && feelingSignal && winSignal !== feelingSignal)
    return { ...base, decision: "conflicting_signals" };
  const direction =
    feelingSignal ||
    (Math.abs(winDelta) >= policy.winOnlyThreshold ? winSignal : 0);
  if (!direction) return { ...base, decision: "on_target" };
  const currentInterval = profiles[difficulty].interval;
  const nextInterval =
    Math.round(
      Math.max(
        p.interval.min,
        Math.min(p.interval.max, currentInterval - direction * p.interval.step),
      ) * 100,
    ) / 100;
  if (nextInterval === currentInterval)
    return { ...base, decision: "at_bound" };
  const candidate = structuredClone(profiles);
  candidate[difficulty].interval = nextInterval;
  const selfPlayDelta = selfPlayScore(
    difficulty,
    profiles,
    candidate,
    policy.selfPlaySeeds,
  );
  if (direction * selfPlayDelta < -policy.maxBadSelfPlayDelta)
    return { ...base, decision: "self_play_rejected" };
  return {
    ...base,
    decision: "promote",
    promotion: {
      difficulty,
      direction: direction > 0 ? "stronger" : "softer",
      currentVersion: version,
      nextVersion: cpuConfigVersion(candidate, difficulty),
      candidate,
      matches: relevant.length,
      surveys: answers.length,
      playerWinRate: playerWinRate!,
      averageFeeling: averageFeeling!,
      signal: Math.abs(winDelta) + Math.abs(feelingDelta) / 2,
      selfPlayDelta,
    },
  };
}

export function choosePromotion(evaluations: Evaluation[]): Promotion | null {
  return (
    evaluations
      .flatMap((item) => (item.promotion ? [item.promotion] : []))
      .sort((a, b) => b.signal - a.signal)[0] ?? null
  );
}
