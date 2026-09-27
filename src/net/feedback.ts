import type { Difficulty } from "../game/master";
import { createOutbox } from "./outbox";

export interface DifficultyFeedback {
  id: string;
  selectedDifficulty: Difficulty;
  feltDifficulty: Difficulty;
  outcome: "win" | "loss" | "draw";
  durationSeconds: number;
  playerCastleHp: number;
  cpuCastleHp: number;
}

const feedback = createOutbox<DifficultyFeedback>(
  "infra-rush-difficulty-feedback-v1",
  "/feedback",
);
export const submitDifficultyFeedback = feedback.submit;
export const flushFeedback = feedback.flush;
