import type { Difficulty } from "../game/master";

export interface DifficultyFeedback {
  id: string;
  selectedDifficulty: Difficulty;
  feltDifficulty: Difficulty;
  outcome: "win" | "loss" | "draw";
  durationSeconds: number;
  playerCastleHp: number;
  cpuCastleHp: number;
}

const outboxKey = "infra-rush-difficulty-feedback-v1";

export function feedbackEndpoint(
  page: Pick<Location, "protocol" | "hostname" | "port" | "host">,
  configured = import.meta.env.VITE_ONLINE_WS_URL?.trim(),
): string | null {
  if (configured) {
    try {
      const url = new URL(configured);
      if (!["ws:", "wss:"].includes(url.protocol)) return null;
      if (page.protocol === "https:" && url.protocol !== "wss:") return null;
      url.protocol = url.protocol === "wss:" ? "https:" : "http:";
      url.pathname = "/feedback";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }
  if (page.hostname.endsWith(".github.io")) return null;
  const host = ["5173", "5177", "5178"].includes(page.port)
    ? `${page.hostname}:8080`
    : page.host;
  return `${page.protocol}//${host}/feedback`;
}

function readOutbox(): DifficultyFeedback[] {
  try {
    const value = JSON.parse(localStorage.getItem(outboxKey) ?? "[]");
    return Array.isArray(value) ? value.slice(-20) : [];
  } catch {
    return [];
  }
}

function saveOutbox(items: DifficultyFeedback[]) {
  try {
    localStorage.setItem(outboxKey, JSON.stringify(items.slice(-20)));
  } catch {
    // Feedback is optional when browser storage is unavailable.
  }
}

let flushing = false;
export async function flushFeedback(): Promise<boolean> {
  if (flushing) return false;
  const endpoint = feedbackEndpoint(location);
  if (!endpoint) return false;
  flushing = true;
  try {
    for (const item of readOutbox()) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
          keepalive: true,
          signal: controller.signal,
        });
        if (!response.ok) return false;
        saveOutbox(readOutbox().filter((queued) => queued.id !== item.id));
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    }
    return true;
  } finally {
    flushing = false;
  }
}

export async function submitDifficultyFeedback(item: DifficultyFeedback) {
  const queued = readOutbox();
  if (!queued.some((entry) => entry.id === item.id)) {
    queued.push(item);
    saveOutbox(queued);
  }
  return flushFeedback();
}

window.addEventListener("online", () => void flushFeedback());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void flushFeedback();
});
