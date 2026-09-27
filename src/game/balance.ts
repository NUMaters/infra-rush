import type { M } from "./master";

export type CpuProfiles = typeof M.cpu;
export type CpuProfile = CpuProfiles["easy"];

/** Stable ID for the selected difficulty's CPU parameters. */
export function cpuConfigVersion(
  profiles: CpuProfiles,
  difficulty: keyof CpuProfiles,
): string {
  const p = profiles[difficulty];
  const input = [
    difficulty,
    p.interval,
    p.initialDelay,
    p.miners,
    p.attackers,
    p.central,
    p.sabotage,
    p.maintenance,
  ].join(":");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
