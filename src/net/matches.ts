import type { Difficulty } from "../game/master";
import { createOutbox } from "./outbox";

export interface SoloMatchReport {
  id: string;
  selectedDifficulty: Difficulty;
  configVersion: string;
  outcome: "win" | "loss" | "draw";
  durationSeconds: number;
  playerCastleHp: number;
  cpuCastleHp: number;
}

const matches = createOutbox<SoloMatchReport>(
  "infra-rush-solo-matches-v1",
  "/matches",
);
export const submitSoloMatch = matches.submit;
export const flushSoloMatches = matches.flush;
