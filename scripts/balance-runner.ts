import { readFile, writeFile, mkdir } from "node:fs/promises";
import { isNativeError } from "node:util/types";
import { resolve } from "node:path";
import {
  evaluateDifficulty,
  choosePromotion,
} from "../src/game/balance-training";
import type {
  BalancePolicy,
  MatchSample,
  SurveySample,
} from "../src/game/balance-training";
import type { CpuProfiles } from "../src/game/balance";

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
const localMatches = args.includes("--matches") ? option("--matches") : "";
const localFeedback = args.includes("--feedback") ? option("--feedback") : "";
const dryRun = args.includes("--dry-run");

async function dataset(
  kind: "matches" | "feedback",
  localPath: string,
  historyDays: number,
) {
  if (localPath) return readFile(resolve(root, localPath), "utf8");
  const endpoint = process.env.BALANCE_EXPORT_URL;
  const token = process.env.BALANCE_EXPORT_TOKEN;
  if (!endpoint || !token)
    throw new Error("balance export URL and token are required");
  const url = new URL(endpoint);
  url.searchParams.set("kind", kind);
  url.searchParams.set(
    "since",
    new Date(Date.now() - historyDays * 86400_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error(`${kind} export failed: ${response.status}`);
  return response.text();
}

function jsonLines<T>(source: string): T[] {
  return source.split("\n").flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as T];
    } catch {
      throw new Error(`invalid dataset JSON on line ${index + 1}`);
    }
  });
}

async function readHistory(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNativeError(error) && "code" in error && error.code === "ENOENT")
      return "";
    throw error;
  }
}

async function main() {
  if (Boolean(localMatches) !== Boolean(localFeedback))
    throw new Error("supply both local datasets");
  const policy = JSON.parse(
    await readFile(resolve(root, "master/cpu-balance-policy.json"), "utf8"),
  ) as BalancePolicy;
  const profiles = JSON.parse(
    await readFile(resolve(root, "master/cpu.json"), "utf8"),
  ) as CpuProfiles;
  const [matchesRaw, feedbackRaw] = await Promise.all([
    dataset("matches", localMatches, policy.historyDays),
    dataset("feedback", localFeedback, policy.historyDays),
  ]);
  const matches = jsonLines<MatchSample>(matchesRaw);
  const surveys = jsonLines<SurveySample>(feedbackRaw);
  const historyPath = resolve(root, "docs/balance/history.jsonl");
  const history = await readHistory(historyPath);
  const promotions = jsonLines<{ difficulty: string; promotedAt: string }>(
    history,
  );
  const now = new Date();
  const evaluations = (["easy", "normal", "hard"] as const).map(
    (difficulty) => {
      const previous = promotions
        .filter((item) => item.difficulty === difficulty)
        .at(-1);
      return evaluateDifficulty(
        difficulty,
        profiles,
        policy,
        matches,
        surveys,
        now,
        previous ? new Date(previous.promotedAt) : undefined,
      );
    },
  );
  const summary = evaluations
    .map(
      (item) =>
        `${item.difficulty}: matches=${item.matches} surveys=${item.surveys} win=${item.playerWinRate?.toFixed(3) ?? "-"} feeling=${item.averageFeeling?.toFixed(3) ?? "-"} decision=${item.decision}`,
    )
    .join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    await writeFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### CPU balance\n\n\`\`\`text\n${summary}\n\`\`\`\n`,
      { flag: "a" },
    );
  const chosen = choosePromotion(evaluations);
  if (!chosen) return;
  console.log(
    `candidate: ${chosen.difficulty} ${chosen.direction} ${profiles[chosen.difficulty].interval}s -> ${chosen.candidate[chosen.difficulty].interval}s; self-play delta=${chosen.selfPlayDelta}`,
  );
  if (dryRun) return;
  const record = {
    promotedAt: now.toISOString(),
    difficulty: chosen.difficulty,
    direction: chosen.direction,
    previousVersion: chosen.currentVersion,
    version: chosen.nextVersion,
    previousInterval: profiles[chosen.difficulty].interval,
    interval: chosen.candidate[chosen.difficulty].interval,
    matches: chosen.matches,
    surveys: chosen.surveys,
    playerWinRate: chosen.playerWinRate,
    averageFeeling: chosen.averageFeeling,
    selfPlayDelta: chosen.selfPlayDelta,
  };
  await mkdir(resolve(root, "docs/balance"), { recursive: true });
  await writeFile(
    resolve(root, "master/cpu.json"),
    JSON.stringify(chosen.candidate, null, 2) + "\n",
  );
  await writeFile(historyPath, history + JSON.stringify(record) + "\n");
  console.log(`promoted ${chosen.nextVersion}`);
}

await main();
