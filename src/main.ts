import "./style.css";
import "./motion.css";
import "./tutorial.css";
import { M } from "./game/master";
import type { Difficulty } from "./game/master";
import { canCommand, command, createGame, taskSpec, tick } from "./game/engine";
import { CPU } from "./game/cpu";
import { resolveTaskTarget } from "./game/intent";
import type {
  Action,
  BotState,
  GameState,
  Point,
  Resource,
} from "./game/types";
import { World } from "./render/world";
import { Sound } from "./ui/audio";
import type { WorkSound } from "./ui/audio";
import { icon } from "./ui/icons";
import { OnlineClient } from "./net/client";
import type { OnlinePlayer, ServerMessage } from "./net/client";
import type { Team } from "./game/types";
import { civilTrivia } from "./content/trivia";
import { TriviaViewer } from "./render/trivia";
import { flushFeedback, submitDifficultyFeedback } from "./net/feedback";
import { cpuConfigVersion } from "./game/balance";
import { flushSoloMatches, submitSoloMatch } from "./net/matches";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const resourceIcon = (resource: Resource) =>
  `<img class="resource-art" src="${import.meta.env.BASE_URL}ui/resources/${resource}.png" alt="" aria-hidden="true">`;
const htmlCache = new WeakMap<HTMLElement, string>();
function html(selector: string, markup: string) {
  const el = $(selector);
  if (htmlCache.get(el) !== markup) {
    el.innerHTML = markup;
    htmlCache.set(el, markup);
  }
}
const app = $("#app");
app.insertAdjacentHTML(
  "beforeend",
  `<main id="world"></main><div id="vignette"></div>
<section id="title" class="hidden">
 <div class="title-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
 <div class="title-top"><span class="edition">CIVIL ENGINEERING STRATEGY</span><div class="title-actions"><button id="title-sound" class="circle" aria-label="音楽を再生・停止" aria-pressed="false">${icon("sound")}</button><button class="circle help" aria-label="遊び方">?</button></div></div>
 <div class="title-copy"><div class="logo"><span>INFRA</span><b>RUSH<span class="logo-dot">!</span></b></div><img class="title-tagline-art" src="${import.meta.env.BASE_URL}ui/title/civil-tagline.png" alt="遊んで知ろう、土木のしくみ。"></div>
 <div class="start-card"><div id="title-modes" class="title-menu"><button id="start" class="primary">${icon("helmet")}<span>ひとりで遊ぶ</span>${icon("march")}</button><button id="online-start" class="secondary online-entry">${icon("users")}<span>みんなで遊ぶ</span>${icon("march")}</button><button id="title-trivia-open" class="title-trivia-button" type="button">${icon("book")}<span>土木の豆知識をみる</span>${icon("march")}</button><p>1ゲーム 5分 · 先に城を${M.castle.hp}回たたけば勝ち</p></div><div id="solo-menu" class="title-menu hidden"><div class="solo-heading"><button id="solo-back" type="button" aria-label="モード選択に戻る">← 戻る</button><strong>ひとりで遊ぶ</strong></div><button id="tutorial-start" class="solo-choice tutorial-choice">${icon("helmet")}<span>チュートリアル<small>はじめてプレイする人はこちら</small></span>${icon("march")}</button><button id="cpu-start" class="solo-choice cpu-choice">${icon("castle")}<span>CPU戦<small>今すぐ遊ぶ</small></span>${icon("march")}</button><fieldset class="difficulty-field"><legend>CPUの強さ</legend><div class="difficulty-options"><button data-difficulty="easy">かんたん</button><button data-difficulty="normal" class="active">ふつう</button><button data-difficulty="hard">むずかしい</button></div></fieldset></div></div>
 <div class="title-footer"><span>BUILD. CONNECT. RUSH.</span></div>
</section>
<section id="hud" class="hidden">
 <header class="match-header"><div class="team-score blue" id="blue-score"><div class="score-top"><span>${icon("castle")}<small>あなたの城</small></span><b id="blue-hp-count">${M.castle.hp}<em>/${M.castle.hp}</em></b></div><div class="health-meter" id="blue-hp" style="--castle-hp:${M.castle.hp}" role="progressbar" aria-label="あなたの城の残り" aria-valuemin="0" aria-valuemax="${M.castle.hp}"></div></div><div class="timer"><small>のこり時間</small><b id="timer">05:00</b></div><div class="team-score red" id="red-score"><div class="score-top"><span>${icon("castle")}<small>相手の城</small></span><b id="red-hp-count">${M.castle.hp}<em>/${M.castle.hp}</em></b></div><div class="health-meter" id="red-hp" style="--castle-hp:${M.castle.hp}" role="progressbar" aria-label="相手の城の残り" aria-valuemin="0" aria-valuemax="${M.castle.hp}"></div></div></header>
 <div class="resource-bar" id="resources"></div>
 <div class="utilities"><button id="sound" class="circle" aria-label="BGMと効果音を切り替え" aria-pressed="false">${icon("sound")}</button><button id="pause" class="circle" aria-label="一時停止">${icon("pause")}</button><button class="circle help" aria-label="遊び方">?</button></div>
 <span id="latency" class="latency hidden" aria-label="通信遅延"></span><div id="opponent-connection" class="opponent-connection hidden" role="status" aria-label="相手の接続が切れています"><span class="signal-bars"><i></i><i></i><i></i></span><b>相手が接続中…</b></div>
 <div id="bridge-labels"></div><div id="floaters" aria-hidden="true"></div>
 <div id="impact-flash" aria-hidden="true"></div>
 <div id="toast" role="status" aria-live="polite"></div>
 <div id="hint" class="field-hint"></div>
 <section id="task-panel" class="hidden" aria-label="Botへの作業指示"></section>
 <div class="corner-brand">INFRA <b>RUSH</b></div>
</section>
<section id="match-intro" class="hidden" aria-live="assertive" aria-label="対戦開始のカウントダウン"></section>
<section id="tutorial" class="hidden" aria-live="polite" aria-label="操作チュートリアル"><div id="tutorial-guide" aria-hidden="true"></div><div id="tutorial-card"></div></section>
<section id="modal" class="overlay hidden"></section>
<section id="online-lobby" class="overlay hidden" aria-label="オンライン対戦"></section>
<section id="title-trivia" class="overlay hidden" role="dialog" aria-modal="true" aria-label="土木の豆知識"><article class="dialog title-trivia-dialog"><button id="title-trivia-close" class="circle close-online" type="button" aria-label="豆知識を閉じる">${icon("close")}</button><section id="title-trivia-content" class="result-trivia" aria-label="土木の豆知識"></section></article></section>
<section id="result" class="overlay hidden"></section><div id="map-review" class="hidden" aria-label="試合終了時のマップ"><div class="map-review-bar"><span>試合終了時のマップ</span><button id="review-back" type="button">結果へ戻る</button></div><p>ドラッグで移動 · ピンチで拡大・回転</p></div><div id="scene-wipe" aria-hidden="true"></div>`,
);
const openingVideo = $("#opening-video") as HTMLVideoElement;
const openingPlay = $("#opening-play") as HTMLButtonElement;
const openingSkip = $("#opening-skip") as HTMLButtonElement;
const openingReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const openingMediaRoot = `${import.meta.env.BASE_URL}media/opening-gemini-77f0d820`;
type OpeningQuality = "hd" | "md" | "lite";
const openingSources: Record<OpeningQuality, string> = {
  hd: `${openingMediaRoot}-hd.mp4`,
  md: `${openingMediaRoot}-md.mp4`,
  lite: `${openingMediaRoot}-lite.mp4`,
};
const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
  .deviceMemory;
const saveData = (
  navigator as Navigator & { connection?: { saveData?: boolean } }
).connection?.saveData;
const cores = navigator.hardwareConcurrency ?? 8;
const mobile = window.matchMedia("(max-width: 700px)").matches;
let openingQuality: OpeningQuality =
  mobile ||
  saveData ||
  (deviceMemory !== undefined && deviceMemory <= 2) ||
  cores <= 2 ||
  (mobile && cores <= 3)
    ? "lite"
    : (deviceMemory !== undefined && deviceMemory <= 4) || cores <= 4
      ? "md"
      : "hd";
let openingClosed = false;
let openingFallback = false;
let openingAttempt = 0;
let lastOpeningTime = 0;
let lastOpeningAdvance = performance.now();
let openingPlaybackAt = 0;
let openingSkipped = false;
let openingWatchdog: ReturnType<typeof setInterval> | undefined;
const hasVideoFrameCallback = !!openingVideo.requestVideoFrameCallback;
let frameObserver = 0;
const observeOpeningFrames = () => {
  if (!hasVideoFrameCallback) return;
  const observer = ++frameObserver;
  const onFrame = () => {
    if (observer !== frameObserver || openingClosed || openingFallback) return;
    lastOpeningAdvance = performance.now();
    openingVideo.classList.add("opening-video-moving");
    openingVideo.requestVideoFrameCallback(onFrame);
  };
  openingVideo.requestVideoFrameCallback(onFrame);
};
const showOpeningPlayback = () => {
  if (!openingClosed && !openingFallback) {
    if (!openingPlaybackAt) openingPlaybackAt = performance.now();
    openingVideo.classList.add("opening-video-moving");
    openingPlay.hidden = true;
    lastOpeningAdvance = performance.now();
  }
};
openingSkip.addEventListener("click", () => {
  openingSkipped = true;
});
openingVideo.addEventListener("playing", showOpeningPlayback);
openingVideo.addEventListener("timeupdate", showOpeningPlayback);
openingPlay.addEventListener("click", () => {
  openingVideo.muted = true;
  openingVideo.setAttribute("playsinline", "");
  openingVideo.setAttribute("webkit-playsinline", "");
  void openingVideo
    .play()
    .then(showOpeningPlayback)
    .catch(() => {
      openingPlay.hidden = false;
    });
});
const releaseOpeningVideo = () => {
  ++frameObserver;
  openingVideo.pause();
  openingVideo.removeAttribute("src");
  openingVideo.querySelectorAll("source").forEach((source) => source.remove());
  openingVideo.load();
};
const useOpeningFallback = () => {
  if (openingFallback || openingClosed) return;
  openingFallback = true;
  if (openingWatchdog) clearInterval(openingWatchdog);
  openingVideo.classList.add("opening-video-fallback");
  releaseOpeningVideo();
};
const playOpening = (quality: OpeningQuality) => {
  const attempt = ++openingAttempt;
  openingQuality = quality;
  lastOpeningTime = 0;
  lastOpeningAdvance = performance.now();
  openingVideo.classList.remove("opening-video-moving");
  openingVideo.src = openingSources[quality];
  openingVideo.load();
  observeOpeningFrames();
  void openingVideo.play().catch((error: unknown) => {
    if (openingClosed || openingFallback || attempt !== openingAttempt) return;
    if (error instanceof DOMException && error.name === "NotAllowedError")
      openingPlay.hidden = false;
    else if (quality === "lite") useOpeningFallback();
    else playOpening("lite");
  });
};
openingVideo.addEventListener("error", () => {
  if (openingClosed || openingFallback) return;
  if (openingQuality === "lite") useOpeningFallback();
  else playOpening("lite");
});
const stopOpening = () => {
  openingClosed = true;
  openingPlay.hidden = true;
  openingSkip.hidden = true;
  if (openingWatchdog) clearInterval(openingWatchdog);
  releaseOpeningVideo();
};
const waitForOpeningStart = () => {
  if (
    openingFallback ||
    document.hidden ||
    (openingVideo.readyState >= openingVideo.HAVE_CURRENT_DATA &&
      !openingVideo.paused)
  )
    return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      openingVideo.removeEventListener("playing", done);
      resolve();
    };
    const timer = setTimeout(done, 600);
    openingVideo.addEventListener("playing", done, { once: true });
  });
};
const waitForOpeningPresentation = async () => {
  openingSkip.hidden = false;
  const deadline = performance.now() + 10000;
  while (!openingSkipped && !openingFallback && performance.now() < deadline) {
    if (openingPlaybackAt && performance.now() - openingPlaybackAt >= 3500)
      break;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
};
const firstSource = openingVideo.currentSrc;
const firstQuality: OpeningQuality = firstSource.includes("-lite.mp4")
  ? "lite"
  : firstSource.includes("-md.mp4")
    ? "md"
    : "hd";
if (openingReducedMotion) {
  useOpeningFallback();
} else {
  if (firstSource && firstQuality === openingQuality) {
    const attempt = ++openingAttempt;
    observeOpeningFrames();
    void openingVideo.play().catch((error: unknown) => {
      if (openingClosed || openingFallback || attempt !== openingAttempt)
        return;
      if (error instanceof DOMException && error.name === "NotAllowedError")
        openingPlay.hidden = false;
      else playOpening("lite");
    });
  } else playOpening(openingQuality);
  openingWatchdog = setInterval(() => {
    if (openingClosed || openingFallback || document.hidden) {
      lastOpeningAdvance = performance.now();
      return;
    }
    if (Math.abs(openingVideo.currentTime - lastOpeningTime) > 0.05) {
      lastOpeningTime = openingVideo.currentTime;
      lastOpeningAdvance = performance.now();
      openingVideo.classList.add("opening-video-moving");
    } else if (performance.now() - lastOpeningAdvance > 3000) {
      if (openingQuality === "lite") {
        openingPlay.hidden = false;
        lastOpeningAdvance = performance.now();
      } else playOpening("lite");
    }
  }, 1000);
}
let state = createGame();
let cpu = new CPU();
let titleState = createGame();
let titleBlueCPU = new CPU("normal", "blue");
let titleRedCPU = new CPU("normal", "red");
let titleAccumulator = 0;
let cpuEnabled = true;
let difficulty: Difficulty = "normal";
let soloMatchId = "";
let feedbackAnswer: Difficulty | null = null;
let started = false,
  paused = false,
  selected: string | null = null,
  ready = false,
  lastEvent = 0;
let bridgeContext: string | null = null;
let qaFrozen = false;
let audioGestureSeen = false;
let mode: "cpu" | "online" = "cpu";
let playerTeam: Team = "blue";
let online: OnlineClient | null = null;
let onlineRoom = "";
let onlinePlayers: Partial<Record<Team, OnlinePlayer>> = {};
let rematchVotes: [boolean, boolean] = [false, false];
let onlinePhase:
  "menu" | "queueing" | "waiting" | "ready" | "playing" | "finished" = "menu";
let onlineStatus = "";
let nameDraft = "";
let joinDraft = "";
let keypadOpen = false;
let joinPending = false;
let joinFeedback = "";
let pendingInvite = /^[0-9]{5}$/.test(
  new URLSearchParams(location.search).get("room") ?? "",
)
  ? new URLSearchParams(location.search).get("room")!
  : "";
let pingAt = 0;
const resumeKey = "infra-rush-active-match";
let previousResources: Record<Resource, number> | null = null;
let opponentOffline = false;
let lastMatchSavedAt = 0;
function rememberMatch() {
  if (Date.now() - lastMatchSavedAt < 10_000) return;
  lastMatchSavedAt = Date.now();
  localStorage.setItem(resumeKey, String(lastMatchSavedAt));
}
function forgetMatch() {
  lastMatchSavedAt = 0;
  localStorage.removeItem(resumeKey);
}
function showOpponentConnection(visible: boolean) {
  opponentOffline = visible;
  $("#opponent-connection").classList.toggle("hidden", !visible);
}
const visualPositions = new Map<string, Point>();
const sound = new Sound();
let world: World;
const labels: Record<Action, string> = {
  mine: "掘る",
  build: "橋をつくる",
  upgrade: "強くする",
  repair: "直す",
  embank: "道をふさぐ",
  clear: "土をならす",
  destroy: "橋を壊す",
  march: "攻める",
};
const states: Record<string, string> = {
  IDLE: "待機中",
  MOVING: "移動中",
  MINING: "掘っている",
  BUILDING_BRIDGE: "橋をつくっている",
  UPGRADING_BRIDGE: "橋を強くしている",
  REPAIRING_BRIDGE: "橋を直している",
  BUILDING_EMBANKMENT: "道をふさいでいる",
  CLEARING_EMBANKMENT: "土をどけている",
  DESTROYING_BRIDGE: "橋を壊している",
  MARCHING: "城へ向かっている",
  ATTACKING_CASTLE: "城を攻撃！",
  RETURNING: "戻っている",
};
const workSoundByState: Partial<Record<BotState, WorkSound>> = {
  MINING: "mine",
  BUILDING_BRIDGE: "build",
  UPGRADING_BRIDGE: "build",
  REPAIRING_BRIDGE: "build",
  BUILDING_EMBANKMENT: "embank",
  CLEARING_EMBANKMENT: "clear",
  DESTROYING_BRIDGE: "destroy",
};
const resourceNames: Record<Resource, string> = {
  soil: "土",
  stone: "石",
  iron: "鉄",
};
const compactReasons: Record<string, string> = {
  別のBotが作業しています: "作業中",
  渡れる橋をつくろう: "橋をつくろう",
  自分の橋で作業しよう: "自分の橋が必要",
  相手の橋で作業しよう: "相手の橋が必要",
  先に自分の城の近くに橋をつくろう: "手前の橋が必要",
};
const compactReason = (reason: string) => compactReasons[reason] ?? reason;
const botName = (i: number) => ["アオ", "ソラ", "リク", "ナギ", "ウミ"][i];
let toastTimer: ReturnType<typeof setTimeout>;
let panelCloseTimer: ReturnType<typeof setTimeout>;
let modalCloseTimer: ReturnType<typeof setTimeout>;
let transitioning = false;
const introDuration = M.game.introSeconds * 1000;
const teamRevealDuration = (introDuration - 3600) / 2;
let introUntil = 0;
let introStage = -1;
let introActive = false;
let bridgeRuleFocus = 0;
type TutorialStage =
  | "rules"
  | "bridgeRules"
  | "camera"
  | "pick"
  | "mine"
  | "pickSecond"
  | "secondMine"
  | "gather"
  | "bridge"
  | "build"
  | "construction"
  | "pickUpgrade"
  | "upgrade"
  | "upgradeWork"
  | "pickRepair"
  | "repair"
  | "repairWork"
  | "bridgeOptions"
  | "pickMarch"
  | "march"
  | "attack"
  | "returned"
  | "pickEmbank"
  | "embank"
  | "embankWork"
  | "pickDestroy"
  | "destroy"
  | "destroyWork"
  | "pickClear"
  | "clear"
  | "clearWork"
  | "complete";
let tutorialStage: TutorialStage | null = null;
let tutorialMarchBot: string | null = null;
let tutorialMiningBot: string | null = null;
const triviaViewer = new TriviaViewer();
const triviaStorageKey = "infra-rush-last-trivia";
let resultTriviaIndex = -1;
let titleTriviaIndex = -1;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function tapBurst(button: HTMLButtonElement) {
  if (reducedMotion.matches) return;
  const rect = button.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "tap-burst";
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  burst.innerHTML = "<i></i><i></i><i></i><i></i>";
  app.append(burst);
  setTimeout(() => burst.remove(), 460);
}
function sceneTransition(
  button: HTMLButtonElement,
  action: () => void,
  actionDelay = 255,
) {
  if (transitioning) return;
  if (reducedMotion.matches) {
    action();
    return;
  }
  transitioning = true;
  const rect = button.getBoundingClientRect();
  const wipe = $("#scene-wipe");
  wipe.style.setProperty("--wipe-x", `${rect.left + rect.width / 2}px`);
  wipe.style.setProperty("--wipe-y", `${rect.top + rect.height / 2}px`);
  wipe.classList.remove("active");
  void wipe.offsetWidth;
  wipe.classList.add("active");
  setTimeout(action, actionDelay);
  setTimeout(() => {
    wipe.classList.remove("active");
    transitioning = false;
  }, 640);
}
let shownHp: Record<"blue" | "red", number> = {
  blue: M.castle.hp,
  red: M.castle.hp,
};
function toast(text: string) {
  const message = $("#toast");
  message.textContent = text;
  message.classList.remove("show");
  void message.offsetWidth;
  message.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function worldPop(position: Point, kind: "select" | "command" | "rush") {
  const point = world.project(position, 1.4);
  const el = document.createElement("span");
  el.className = `world-pop ${kind}`;
  el.style.left = `${point.x}px`;
  el.style.top = `${point.y}px`;
  if (kind !== "select") el.textContent = kind === "rush" ? "GO!" : "OK!";
  $("#floaters").append(el);
  setTimeout(() => el.remove(), 760);
}
function resourceSpendPop(position: Point, resource: Resource, amount: number) {
  const point = world.project(position, 2);
  const el = document.createElement("span");
  el.className = "floater resource-floater spend";
  el.style.left = `${point.x}px`;
  el.style.top = `${point.y}px`;
  el.innerHTML = `${resourceIcon(resource)}<b>−${amount}</b>`;
  $("#floaters").append(el);
  setTimeout(() => el.remove(), 1400);
}
function chooseBot(id: string, context: string | null = null) {
  if (
    tutorialStage === "rules" ||
    tutorialStage === "bridgeRules" ||
    tutorialStage === "camera" ||
    tutorialStage === "bridgeOptions" ||
    tutorialStage === "returned"
  )
    return;
  const nextStage: Partial<Record<TutorialStage, TutorialStage>> = {
    pick: "mine",
    pickSecond: "secondMine",
    pickUpgrade: "upgrade",
    pickRepair: "repair",
    pickMarch: "march",
    pickEmbank: "embank",
    pickDestroy: "destroy",
    pickClear: "clear",
  };
  if (tutorialStage && nextStage[tutorialStage]) {
    const bot = state.bots.find((b) => b.id === id);
    if (tutorialStage === "pickSecond" && id === tutorialMiningBot) {
      toast("別のBotを選ぼう");
      return;
    }
    if (bot?.state !== "IDLE") {
      toast("待機中のBotを選ぼう");
      return;
    }
    setTutorialStage(nextStage[tutorialStage]!);
  }
  selected = id;
  bridgeContext = context;
  world.setSelected(id);
  sound.unlock();
  sound.play("select");
  const bot = state.bots.find((b) => b.id === id);
  if (bot) worldPop(bot.position, "select");
  const panel = $("#task-panel");
  clearTimeout(panelCloseTimer);
  panel.inert = false;
  panel.classList.remove("hidden", "closing", "opening");
  void panel.offsetWidth;
  panel.classList.add("opening");
  renderUI();
}
function chooseBridge(id: string) {
  if (!started || paused || introActive || state.status !== "playing") return;
  const bot = bridgeBuilder(id);
  if (!bot) return;
  if (tutorialStage === "bridge" && id === "blue") setTutorialStage("build");
  chooseBot(bot, id);
}
function bridgeBuilder(id: string): string | null {
  const bridge = state.bridges.find((b) => b.id === id);
  if (!bridge) return null;
  const candidates = [
    ...state.bots.filter((b) => b.id === selected),
    ...state.bots.filter((b) => b.id !== selected && b.team === playerTeam),
  ];
  return (
    candidates.find((bot) =>
      (
        ["build", "upgrade", "repair", "embank", "clear", "destroy"] as Action[]
      ).some(
        (action) =>
          canCommand(state, playerTeam, {
            botId: bot.id,
            action,
            target: id,
          }) === null,
      ),
    )?.id ?? null
  );
}
function positionPanel() {
  if (!selected) return;
  const bot = state.bots.find((b) => b.id === selected)!;
  const point = world.project(bot.position, 1.5);
  const panel = $("#task-panel");
  panel.style.left = `${Math.max(12, Math.min(innerWidth - panel.offsetWidth - 12, point.x + 18))}px`;
  panel.style.top = `${Math.max(130, Math.min(innerHeight - panel.offsetHeight - 16, point.y - panel.offsetHeight - 18))}px`;
}
function closePanel() {
  selected = null;
  world.setSelected(null);
  const panel = $("#task-panel");
  panel.inert = true;
  panel.classList.remove("opening");
  if (!panel.classList.contains("hidden")) {
    panel.classList.add("closing");
    clearTimeout(panelCloseTimer);
    panelCloseTimer = setTimeout(
      () => {
        panel.classList.add("hidden");
        panel.classList.remove("closing");
      },
      reducedMotion.matches ? 0 : 170,
    );
  }
  renderUI();
}
function prepareSolo() {
  if (!ready) return;
  triviaViewer.stop();
  tutorialStage = null;
  tutorialMarchBot = null;
  tutorialMiningBot = null;
  mode = "cpu";
  soloMatchId = crypto.randomUUID();
  feedbackAnswer = null;
  playerTeam = "blue";
  sound.unlock();
  state = createGame(Date.now() >>> 0);
  cpu = new CPU(difficulty);
  cpuEnabled = true;
  lastEvent = 0;
  started = true;
  paused = false;
  selected = null;
  bridgeContext = null;
  qaFrozen = false;
  shownHp = { blue: M.castle.hp, red: M.castle.hp };
  previousResources = null;
  world.reset();
  visualPositions.clear();
  world.setHomeTeam("blue");
  clearTimeout(panelCloseTimer);
  $("#title").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#tutorial").classList.add("hidden");
  $("#result").classList.add("hidden");
  $("#map-review").classList.add("hidden");
  $("#bridge-labels").classList.remove("hidden");
  $("#modal").classList.add("hidden");
  $("#latency").classList.add("hidden");
  $("#task-panel").classList.add("hidden");
  $("#task-panel").inert = true;
  sound.setMusicScene("game");
  syncSoundButtons();
}
function start() {
  if (!ready) return;
  prepareSolo();
  sound.play("complete");
  renderUI();
  beginIntro(introDuration);
}
function startTutorial() {
  if (!ready) return;
  prepareSolo();
  cpuEnabled = false;
  state.teams.blue.resources.stone = M.tasks.build.cost.stone! - 2;
  state.nextQuake = Number.POSITIVE_INFINITY;
  tutorialStage = "rules";
  tutorialMiningBot = null;
  $("#hud").classList.remove("hidden");
  $("#tutorial").classList.remove("hidden");
  renderUI();
  sound.play("complete");
}
function showSoloMenu(open: boolean) {
  $("#title").classList.toggle("solo-open", open);
  $("#title-modes").classList.toggle("hidden", open);
  $("#solo-menu").classList.toggle("hidden", !open);
  $(open ? "#tutorial-start" : "#start").focus({ preventScroll: true });
}
const tutorialSteps: TutorialStage[] = [
  "rules",
  "bridgeRules",
  "camera",
  "pick",
  "mine",
  "pickSecond",
  "secondMine",
  "gather",
  "bridge",
  "build",
  "construction",
  "pickUpgrade",
  "upgrade",
  "upgradeWork",
  "pickRepair",
  "repair",
  "repairWork",
  "bridgeOptions",
  "pickMarch",
  "march",
  "attack",
  "returned",
  "pickEmbank",
  "embank",
  "embankWork",
  "pickDestroy",
  "destroy",
  "destroyWork",
  "pickClear",
  "clear",
  "clearWork",
  "complete",
];
function tutorialStepNumber(stage: TutorialStage) {
  const index = tutorialSteps.indexOf(stage);
  if (index < tutorialSteps.indexOf("camera")) return 1;
  if (index < tutorialSteps.indexOf("pick")) return 2;
  if (index < tutorialSteps.indexOf("bridge")) return 3;
  if (index < tutorialSteps.indexOf("pickMarch")) return 4;
  if (index < tutorialSteps.indexOf("pickEmbank")) return 5;
  if (index < tutorialSteps.indexOf("pickDestroy")) return 6;
  if (index < tutorialSteps.indexOf("pickClear")) return 7;
  return 8;
}
function tutorialAllowedAction(stage: TutorialStage | null): Action | null {
  if (stage === "mine" || stage === "secondMine") return "mine";
  if (stage === "build") return "build";
  if (stage === "upgrade") return "upgrade";
  if (stage === "repair") return "repair";
  if (stage === "march") return "march";
  if (stage === "embank") return "embank";
  if (stage === "destroy") return "destroy";
  if (stage === "clear") return "clear";
  return null;
}
function setTutorialStage(stage: TutorialStage) {
  if (!tutorialStage || tutorialStage === stage) return;
  tutorialStage = stage;
  if (stage === "bridgeRules") {
    bridgeRuleFocus = 0;
    focusTutorialBridge();
  } else if (stage === "camera") world.setHomeTeam("blue");
  sound.play(stage === "complete" ? "complete" : "ui");
  renderUI();
}
function focusTutorialBridge() {
  const id = (["blue", "center", "red"] as const)[bridgeRuleFocus];
  const bridge = state.bridges.find((site) => site.id === id);
  if (bridge) world.focusTutorialSite(bridge.x);
}
function renderTutorial() {
  const stage = tutorialStage;
  const tutorial = $("#tutorial");
  tutorial.classList.toggle("hidden", !stage);
  tutorial.classList.toggle("bridge-tour", stage === "bridgeRules");
  if (!stage) return;
  const stone = state.teams.blue.resources.stone;
  const descriptions: Record<TutorialStage, [string, string]> = {
    rules: [
      "まずはゲームのルール",
      `5体のBotに仕事を頼み、橋を架けて相手の城を攻めよう。先に${M.castle.hp}回たたいたチームの勝ち。5分で決着しなければ、城の体力が多い方が勝つよ。`,
    ],
    bridgeRules: [
      "3つの橋を覚えよう",
      [
        "ここは青い城へ続く橋の場所。青チームだけが橋を架けて、ここを通れるよ。",
        "ここは中央の橋。青も赤も、自分の城側の橋を完成させると着工できる。先に完成させたチームが使えるよ。",
        "ここは赤い城へ続く橋の場所。赤チームだけが架けて通れる。完成した橋は、旗と手すりの色で持ち主を確かめよう。",
      ][bridgeRuleFocus],
    ],
    camera: [
      "マップを見渡そう",
      "マップを1本指でスワイプすると見たい場所へ移動できるよ。2本指を広げると拡大、閉じると縮小。2本指を回せば向きも変わるよ。",
    ],
    pick: [
      "Botをタップ！",
      "青い城の前に並ぶBotを1体タップしてみよう。仕事を選ぶ画面が開くよ。",
    ],
    mine: [
      "石を掘ろう",
      "「掘る」を押すと、Botが採石場で資源を集め始めるよ。石・土・鉄のうち、今回は橋に使う石をあと2個集めよう。",
    ],
    pickSecond: [
      "同時に仕事を頼めるよ",
      "採掘中でも、ほかのBotに仕事を頼めるよ。城の前で待っている別のBotをタップしてみよう。",
    ],
    secondMine: [
      "2体目にも頼もう",
      "2体目にも「掘る」を頼もう。複数で採掘すると、そのぶん早く資源がたまるよ。",
    ],
    gather: [
      "採掘中！",
      `Botがショベルに乗って採石場へ向かっているよ。石が50個たまると、青い城側の橋を架けられる。いま ${Math.min(stone, 50)}/50 個。`,
    ],
    bridge: [
      "橋の場所をタップ！",
      "石がそろったら、青い城側の架橋地点に出る黄色い「!」をタップしよう。仕事を頼むBotを選べるよ。",
    ],
    build: [
      "橋をつくろう",
      `${resourceIcon("stone")} 石${M.tasks.build.cost.stone}個を使って橋を架けよう。「橋をつくる」を押すと、資源を支払って作業が始まるよ。`,
    ],
    construction: [
      "架橋中！",
      `${resourceIcon("stone")} 橋の材料に石${M.tasks.build.cost.stone}個を使ったよ。いまの残りは${stone}個。架橋機が桁を送り出して完成するまで見てみよう。`,
    ],
    pickUpgrade: [
      "橋を強くしよう",
      "青の橋が完成したよ。次は別のBotをタップして「強くする」を選び、橋を壊れにくくしてみよう。",
    ],
    upgrade: [
      "強くする",
      `${resourceIcon("iron")} 橋の補強には鉄${M.tasks.upgrade2.cost.iron}個が必要だよ。「強くする」を押すと、橋の耐久が1段階上がる。`,
    ],
    upgradeWork: [
      "補強中！",
      "Botが鉄骨を取り付けているよ。作業が終わると橋の耐久は2段階になる。続いて、傷んだ橋の直し方を練習しよう。",
    ],
    pickRepair: [
      "傷んだ橋を直そう",
      "練習のため、いま青の橋の耐久を1段階下げたよ。城の前で待つBotをタップして、修理を頼もう。",
    ],
    repair: [
      "橋を直す",
      `${resourceIcon("iron")} 「直す」を押すと鉄${M.tasks.repair.cost.iron}個を使って修理が始まるよ。完了すれば橋の耐久が1段階戻る。`,
    ],
    repairWork: [
      "修繕中！",
      "Botが傷んだところを補修しているよ。橋が直れば、また安心して渡れるようになる。",
    ],
    bridgeOptions: [
      "真ん中も狙える！",
      "青の橋ができたので、中央の橋も狙えるよ。中央は先に完成させたチームが使い、旗と手すりがその色になる。取ったあとも補強や修理ができる。地震では橋の耐久が1段階減り、盛土は消えるよ。",
    ],
    pickMarch: [
      "攻めるBotを選ぼう",
      "城の前で待っている青いBotをタップして、攻める仕事を頼もう。",
    ],
    march: [
      "進軍しよう！",
      "「攻める」を押そう。Botが自分の橋を渡り、赤い城まで走っていくよ。",
    ],
    attack: [
      "城へ一直線！",
      "Botが赤い城へ向かっているよ。到着すると城を1回たたき、自分の城の前へシュポンと帰る。",
    ],
    returned: [
      "Botが帰ってきた！",
      "攻撃したBotが青い城の前に戻ったね。建設や修理などの仕事を終えたBotも同じ場所へ帰る。待機中になれば、また指示できるよ。",
    ],
    pickEmbank: [
      "相手の道をふさごう",
      "相手の橋をふさぐ練習をしよう。練習用に赤の橋を用意したよ。まず、待機中のBotをタップしてね。",
    ],
    embank: [
      "土を盛ろう",
      `${resourceIcon("soil")} 「道をふさぐ」を押そう。土${M.tasks.embank.cost.soil}個を使い、相手の橋の出口に土を積んで通れなくするよ。`,
    ],
    embankWork: [
      "盛土中！",
      "ブルドーザーが赤の橋の出口に土を運んでいるよ。盛土が完成すると、相手はそこを渡れなくなる。",
    ],
    pickDestroy: [
      "今度は橋を壊そう",
      "赤の橋の出口をふさげたね。次は橋そのものを傷つける方法を試そう。待機中のBotを選んでね。",
    ],
    destroy: [
      "ドリルで橋を壊そう",
      `${resourceIcon("iron")} 「橋を壊す」を押すと鉄${M.tasks.destroy.cost.iron}個を使うよ。ドリルで相手の橋の耐久を1段階下げよう。`,
    ],
    destroyWork: [
      "破壊中！",
      "ドリルが橋を削っているよ。1回の作業で耐久が1段階下がり、耐久がなくなると橋は崩れる。",
    ],
    pickClear: [
      "自分の道を直そう",
      "今度は青の橋の出口が、相手の土でふさがれたよ。道を開けるため、待機中のBotを選ぼう。",
    ],
    clear: [
      "土をならそう",
      `${resourceIcon("iron")} 「土をならす」を押そう。鉄${M.tasks.clear.cost.iron}個を使い、グレーダーで相手の盛土を取り除くよ。`,
    ],
    clearWork: [
      "整地中！",
      "モーターグレーダーが盛土を平らにならしているよ。土がなくなれば、その橋をまた通れる。",
    ],
    complete: [
      "練習クリア！",
      "複数のBotへの指示から、資源集め、橋づくり、進軍、相手への妨害と道の復旧まで練習できたね。準備ができたらCPU戦へ進もう。",
    ],
  };
  const [title, description] = descriptions[stage];
  const step = tutorialStepNumber(stage);
  html(
    "#tutorial-card",
    `<article class="tutorial-card ${stage === "complete" ? "cleared" : ""} ${stage === "bridgeRules" ? "bridge-tour" : ""} ${["rules", "bridgeRules", "camera", "bridgeOptions", "returned"].includes(stage) ? "rules" : ""}">
    <div class="tutorial-top"><span>れんしゅう <b>${step}/8</b></span><button id="tutorial-skip" type="button">${stage === "complete" ? "CPU戦へ進む" : "スキップして対戦"} ${icon("march")}</button></div>
    <div class="tutorial-message"><span class="tutorial-emblem">${icon(["mine", "pickSecond", "secondMine", "gather"].includes(stage) ? "mine" : ["bridgeRules", "bridge", "build", "construction", "pickUpgrade", "upgrade", "upgradeWork", "pickRepair", "repair", "repairWork", "bridgeOptions"].includes(stage) ? "build" : ["pickEmbank", "embank", "embankWork"].includes(stage) ? "embank" : ["pickDestroy", "destroy", "destroyWork"].includes(stage) ? "destroy" : ["pickClear", "clear", "clearWork"].includes(stage) ? "clear" : stage === "rules" || stage === "pick" ? "helmet" : "march")}</span><div><h2>${title}</h2><p>${description}</p></div></div>
    ${stage === "bridgeRules" ? `<div class="tutorial-bridge-map" aria-label="橋の役割"><span class="own ${bridgeRuleFocus === 0 ? "active" : ""}"><b>青の橋</b><small>青だけ</small></span><span class="contested ${bridgeRuleFocus === 1 ? "active" : ""}"><b>中央の橋</b><small>早い者勝ち</small></span><span class="enemy ${bridgeRuleFocus === 2 ? "active" : ""}"><b>赤の橋</b><small>赤だけ</small></span></div>` : ""}
    ${stage === "camera" ? '<div class="tutorial-gesture" aria-hidden="true"><span class="gesture-swipe">☝<small>スワイプ</small></span><span class="gesture-pinch"><i>☝</i><i>☝</i><small>広げる・閉じる</small></span></div>' : ""}
    ${["rules", "bridgeRules", "camera", "bridgeOptions", "returned"].includes(stage) ? `<button id="tutorial-next" type="button">${stage === "bridgeRules" ? (bridgeRuleFocus < 2 ? "次の橋を見る →" : "カメラを動かしてみる →") : { rules: "橋のルールを見る →", camera: "Botを選んでみる →", bridgeOptions: "Botを進めよう →", returned: "次の仕事へ →" }[stage as "rules" | "camera" | "bridgeOptions" | "returned"]}</button>` : ""}
    ${stage === "complete" ? '<button id="tutorial-home" type="button">タイトルへ戻る</button>' : ""}
    <div class="tutorial-progress" aria-label="練習の進み具合 ${step}/8">${Array.from({ length: 8 }, (_, i) => `<i class="${i < step ? "done" : ""}"></i>`).join("")}</div>
  </article>`,
  );
  document
    .querySelectorAll(".tutorial-target")
    .forEach((node) => node.classList.remove("tutorial-target"));
  const action = tutorialAllowedAction(stage);
  if (action)
    document
      .querySelector(`#task-panel [data-action="${action}"]`)
      ?.classList.add("tutorial-target");
  if (stage === "bridge")
    document
      .querySelector('#bridge-labels [data-target="blue"]')
      ?.classList.add("tutorial-target");
  const guide = $("#tutorial-guide");
  let point: { x: number; y: number } | null = null;
  if (
    [
      "pick",
      "pickSecond",
      "pickUpgrade",
      "pickRepair",
      "pickMarch",
      "pickEmbank",
      "pickDestroy",
      "pickClear",
    ].includes(stage)
  ) {
    const bot = state.bots.find(
      (b) =>
        b.team === "blue" &&
        b.state === "IDLE" &&
        (stage !== "pickSecond" || b.id !== tutorialMiningBot),
    );
    if (bot) point = world.project(bot.position, 1);
  } else if (stage === "bridgeRules") {
    const id = (["blue", "center", "red"] as const)[bridgeRuleFocus];
    const bridge = state.bridges.find((b) => b.id === id);
    if (bridge) point = world.project([bridge.x, 0], 0.5);
  } else if (
    stage === "bridge" ||
    stage === "construction" ||
    stage === "upgradeWork" ||
    stage === "repairWork" ||
    stage === "clearWork"
  ) {
    const bridge = state.bridges.find((b) => b.id === "blue")!;
    point = world.project([bridge.x, 0], 0.5);
  } else if (["embankWork", "destroyWork"].includes(stage)) {
    const bridge = state.bridges.find((b) => b.id === "red")!;
    point = world.project([bridge.x, 0], 0.5);
  } else if (stage === "attack")
    point = world.project([M.castle.red[0], M.castle.red[1]], 2);
  guide.classList.toggle("hidden", !point);
  if (point) {
    guide.style.left = `${point.x}px`;
    guide.style.top = `${point.y}px`;
  }
}
function checkTutorialProgress() {
  if (
    tutorialStage === "gather" &&
    state.teams.blue.resources.stone >= M.tasks.build.cost.stone!
  )
    setTutorialStage("bridge");
  else if (
    tutorialStage === "construction" &&
    state.bridges.find((b) => b.id === "blue")?.level
  ) {
    state.teams.blue.resources.iron = Math.max(
      state.teams.blue.resources.iron,
      M.tasks.upgrade2.cost.iron + M.tasks.repair.cost.iron,
    );
    setTutorialStage("pickUpgrade");
  } else if (
    tutorialStage === "upgradeWork" &&
    state.bridges.find((b) => b.id === "blue")?.capacity === 2
  ) {
    const bridge = state.bridges.find((b) => b.id === "blue")!;
    bridge.level = 1;
    bridge.damage = 1;
    setTutorialStage("pickRepair");
  } else if (
    tutorialStage === "repairWork" &&
    state.bridges.find((b) => b.id === "blue")?.level === 2
  )
    setTutorialStage("bridgeOptions");
  else if (
    tutorialStage === "attack" &&
    state.teams.blue.stats.attacks > 0 &&
    state.bots.find((b) => b.id === tutorialMarchBot)?.state === "IDLE"
  )
    setTutorialStage("returned");
  else if (
    tutorialStage === "embankWork" &&
    state.bridges.find((b) => b.id === "red")?.blockedBy === "blue"
  )
    setTutorialStage("pickDestroy");
  else if (
    tutorialStage === "destroyWork" &&
    state.bridges.find((b) => b.id === "red")?.level === 0
  ) {
    state.bridges.find((b) => b.id === "blue")!.blockedBy = "red";
    setTutorialStage("pickClear");
  } else if (
    tutorialStage === "clearWork" &&
    !state.bridges.find((b) => b.id === "blue")?.blockedBy
  )
    setTutorialStage("complete");
}
function prepareTutorialSabotage() {
  // Practice fixtures are confined to the tutorial's disposable match.
  const enemy = state.bridges.find((bridge) => bridge.id === "red")!;
  enemy.owner = "red";
  enemy.level = enemy.capacity = 1;
  enemy.damage = 0;
  enemy.blockedBy = null;
  enemy.lock = null;
  const resources = state.teams.blue.resources;
  resources.soil = Math.max(resources.soil, M.tasks.embank.cost.soil);
  resources.iron = Math.max(
    resources.iron,
    M.tasks.destroy.cost.iron + M.tasks.clear.cost.iron,
  );
  setTutorialStage("pickEmbank");
}
const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
function introTeamCard(team: Team, own: boolean) {
  const name =
    mode === "online"
      ? (onlinePlayers[team]?.name ??
        (team === "blue" ? "プレイヤー1" : "プレイヤー2"))
      : own
        ? "あなた"
        : "CPU";
  return `<div class="intro-card ${team}"><div class="intro-burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="intro-castle">${icon("castle")}</div><div class="intro-eyebrow">${own ? "YOUR TEAM" : "RIVAL TEAM"}</div><strong>${escapeHtml(name)}</strong><div class="intro-bots" aria-label="5体のBot">${icon("helmet").repeat(5)}</div><span>${own ? "道をつくれ！" : "この城をめざせ！"}</span></div>`;
}
function beginIntro(remainingMs: number) {
  introActive = remainingMs > 0;
  introUntil = performance.now() + Math.max(0, remainingMs);
  introStage = -1;
  const overlay = $("#match-intro");
  overlay.classList.toggle("hidden", !introActive);
  $("#hud").classList.toggle("hidden", introActive);
  if (introActive) updateIntro(performance.now());
}
function updateIntro(now: number) {
  if (!introActive) return;
  const elapsed = introDuration - Math.max(0, introUntil - now);
  if (elapsed >= introDuration) {
    introActive = false;
    $("#match-intro").classList.add("hidden");
    $("#hud").classList.remove("hidden");
    world.setHomeTeam(playerTeam);
    toast(
      mode === "cpu"
        ? "Botをタップして、掘ってみよう！"
        : "試合開始！ Botをタップして作業を指示しよう",
    );
    return;
  }
  const stage =
    elapsed < teamRevealDuration
      ? 0
      : elapsed < teamRevealDuration * 2
        ? 1
        : elapsed < teamRevealDuration * 2 + 1000
          ? 2
          : elapsed < teamRevealDuration * 2 + 2000
            ? 3
            : elapsed < teamRevealDuration * 2 + 3000
              ? 4
              : 5;
  if (stage === introStage) return;
  introStage = stage;
  const team =
    stage === 0 ? playerTeam : playerTeam === "blue" ? "red" : "blue";
  if (stage < 2) world.focusIntro(team);
  else if (stage === 2) world.setHomeTeam(playerTeam);
  const overlay = $("#match-intro");
  overlay.className = stage < 2 ? `intro-team ${team}` : "intro-count";
  overlay.innerHTML =
    stage < 2
      ? introTeamCard(team, stage === 0)
      : `<div class="intro-count-card"><span class="intro-kicker">READY TO RUSH?</span><strong>${stage === 5 ? "GO!" : 5 - stage}</strong><span class="intro-ring" aria-hidden="true"></span></div>`;
  sound.play(stage === 5 ? "complete" : "ui");
}
function cancelIntro() {
  introActive = false;
  introStage = -1;
  $("#match-intro").classList.add("hidden");
}
function resetTitleDemo() {
  titleState = createGame();
  for (const team of ["blue", "red"] as const) {
    titleState.teams[team].resources.stone = M.tasks.build.cost.stone! - 2;
  }
  titleBlueCPU = new CPU("normal", "blue");
  titleRedCPU = new CPU("normal", "red");
  titleAccumulator = 0;
}
function updateTitleDemo(dt: number) {
  titleAccumulator += dt;
  while (titleAccumulator >= M.game.tick) {
    titleBlueCPU.update(titleState);
    titleRedCPU.update(titleState);
    tick(titleState, M.game.tick);
    titleAccumulator -= M.game.tick;
  }
  if (titleState.status !== "playing") resetTitleDemo();
}
function renderOnlineLobby() {
  const lobby = $("#online-lobby");
  if (lobby.classList.contains("hidden")) return;
  const connected = online?.connected ?? false;
  const status = onlineStatus || (connected ? "" : "対戦の準備中…");
  let content = "";
  if (onlinePhase === "menu") {
    content = `<h2>みんなで遊ぶ</h2><p>相手を探すか、数字5桁の招待コードで友だちと遊ぼう。</p>
      ${status === "公開対戦サーバーの設定が必要です" ? '<p role="status">公開版の対戦サーバーは準備中です。1人プレイは遊べます。</p>' : ""}
      <button id="online-random" class="primary" ${connected ? "" : "disabled"}>ランダム対戦 ${icon("march")}</button>
      <button id="online-create" class="secondary" ${connected ? "" : "disabled"}>専用部屋を作成する</button>
      <div class="room-join"><label>招待コードで参加</label><div class="room-input-row"><button id="room-id-input" type="button" class="${joinDraft ? "has-code" : ""}" aria-label="招待コードを入力" aria-expanded="${keypadOpen}">${joinDraft || "数字5桁を入力"}</button></div>${keypadOpen ? `<div class="room-keypad" aria-label="招待コード用テンキー">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-keypad="${n}">${n}</button>`).join("")}<button type="button" data-keypad="erase" aria-label="一文字消す">⌫</button><button type="button" data-keypad="0">0</button><button type="button" data-keypad="join" ${connected && joinDraft.length === 5 && !joinPending ? "" : "disabled"}>${joinPending ? "探しています…" : "参加"}</button></div><p id="join-feedback" class="join-feedback" role="status" aria-live="polite">${escapeHtml(joinFeedback)}</p>` : ""}</div>`;
  } else if (onlinePhase === "queueing") {
    content = `<div class="match-spinner" aria-hidden="true"></div><h2>相手を探しています</h2><p>ランダム対戦を選んだ人とマッチングします。</p>`;
  } else if (onlinePhase === "waiting") {
    content = `<div class="eyebrow">専用部屋</div><h2>友だちを待っています</h2><p>招待コードは数字5桁です。</p><button id="copy-room" class="room-code" aria-label="招待コードをコピー">${onlineRoom}</button><button id="share-room" class="primary" type="button">SNSで招待する ${icon("march")}</button><p>リンクを開くと、この部屋へ直接参加できます。</p>`;
  } else if (onlinePhase === "ready") {
    const me = onlinePlayers[playerTeam];
    const opponent = onlinePlayers[playerTeam === "blue" ? "red" : "blue"];
    content = `<div class="eyebrow">対戦相手が見つかりました</div><h2>まもなく工事開始！</h2><div class="match-players"><span>${escapeHtml(onlinePlayers.blue?.name ?? "プレイヤー1")}</span><b>VS</b><span>${escapeHtml(onlinePlayers.red?.name ?? "プレイヤー2")}</span></div>
      <label for="online-name">あなたの名前</label><input id="online-name" maxlength="16" autocomplete="nickname" value="${escapeHtml(nameDraft || me?.name || (playerTeam === "blue" ? "プレイヤー1" : "プレイヤー2"))}">
      <p class="ready-status">${opponent?.ready ? "相手は準備OK！" : "相手の準備を待っています"}</p><button id="online-ready" class="primary" ${me?.ready || !connected ? "disabled" : ""}>${me?.ready ? "準備OK · 相手を待っています" : "準備OK！ 試合へ"}</button>`;
  }
  lobby.innerHTML = `<article class="dialog online-dialog ${onlinePhase === "menu" && keypadOpen ? "keypad-open" : ""}"><button id="online-close" class="circle close-online" aria-label="オンライン対戦を閉じる">${icon("close")}</button>${content}${status ? `<small class="online-status">${escapeHtml(status)}</small>` : ""}</article>`;
}
function updateJoinKeypad() {
  const input = document.getElementById("room-id-input");
  if (!input) return;
  input.textContent = joinDraft || "数字5桁を入力";
  input.classList.toggle("has-code", !!joinDraft);
  const join = document.querySelector<HTMLButtonElement>(
    '[data-keypad="join"]',
  );
  if (join) {
    join.disabled = joinPending || joinDraft.length !== 5 || !online?.connected;
    join.textContent = joinPending ? "探しています…" : "参加";
  }
  const feedback = document.getElementById("join-feedback");
  if (feedback) feedback.textContent = joinFeedback;
}
function showOnline() {
  mode = "online";
  keypadOpen = false;
  showOpponentConnection(false);
  onlinePhase = "menu";
  onlineStatus = "";
  joinPending = false;
  joinFeedback = "";
  $("#online-lobby").classList.remove("hidden");
  if (!online) {
    online = new OnlineClient();
    online.onStatus = (status) => {
      if (status === "reconnecting" && joinPending) {
        joinPending = false;
        joinFeedback = "接続が切れました。もう一度参加してください";
      }
      onlineStatus =
        status === "connected"
          ? ""
          : status === "reconnecting"
            ? "再接続中… サーバーを確認してください"
            : status === "unavailable"
              ? "公開対戦サーバーの設定が必要です"
              : "接続していません";
      renderOnlineLobby();
      renderRematchStatus();
      if (mode === "online" && started && status === "reconnecting")
        toast("通信が切れました。再接続しています…");
      if (status === "connected") {
        pingAt = Date.now();
        online?.send({ type: "ping" });
        if (pendingInvite) {
          online?.send({ type: "join", roomId: pendingInvite });
          pendingInvite = "";
        }
      }
    };
    online.onMessage = handleOnlineMessage;
  }
  online.connect();
  renderOnlineLobby();
}
function enterOnlineGame(startAt = 0, serverNow = 0) {
  if (started) return;
  triviaViewer.stop();
  rememberMatch();
  sound.unlock();
  state = createGame();
  lastEvent = 0;
  started = true;
  paused = false;
  selected = null;
  bridgeContext = null;
  shownHp = { blue: M.castle.hp, red: M.castle.hp };
  previousResources = null;
  world.reset();
  visualPositions.clear();
  world.setHomeTeam(playerTeam);
  $("#title").classList.add("hidden");
  $("#online-lobby").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#latency").classList.remove("hidden");
  $("#result").classList.add("hidden");
  $("#map-review").classList.add("hidden");
  $("#bridge-labels").classList.remove("hidden");
  sound.setMusicScene("game");
  syncSoundButtons();
  beginIntro(Math.max(0, startAt - serverNow));
}
function renderRematchStatus() {
  if (mode !== "online" || $("#result").classList.contains("hidden")) return;
  const status = document.getElementById("result-rematch-status");
  const button = document.querySelector<HTMLButtonElement>("#restart");
  if (!status || !button) return;
  const mine = rematchVotes[playerTeam === "blue" ? 0 : 1];
  const other = rematchVotes[playerTeam === "blue" ? 1 : 0];
  const opponent = onlinePlayers[playerTeam === "blue" ? "red" : "blue"];
  status.classList.toggle("requested", !!opponent && other && !mine);
  if (!opponent) {
    status.textContent =
      "相手が退出しました。次の対戦はタイトルから始めてください";
    button.disabled = true;
  } else if (mine) {
    status.textContent = "再戦を申し込みました。相手の返事を待っています…";
    button.disabled = true;
  } else if (other) {
    status.textContent = "相手が再戦を希望しています！";
    button.disabled = !online?.connected;
  } else {
    status.textContent = "";
    button.disabled = !online?.connected;
  }
  button.innerHTML = `${other && !mine ? "再戦する" : mine ? "相手の返事を待っています…" : "同じ相手と再戦"} ${icon("march")}`;
}
function handleOnlineMessage(message: ServerMessage) {
  if (message.type === "hello") {
    if (mode === "online" && started && !message.resumed) {
      backTitle();
      toast("試合への復帰時間が過ぎました");
    }
  } else if (message.type === "queueing") {
    onlinePhase = "queueing";
    renderOnlineLobby();
  } else if (message.type === "room") {
    joinPending = false;
    joinFeedback = "";
    keypadOpen = false;
    onlineRoom = message.roomId;
    playerTeam = message.team;
    onlinePlayers = message.players;
    rematchVotes = message.rematch ?? [false, false];
    onlinePhase = message.phase;
    const enemy = playerTeam === "blue" ? "red" : "blue";
    showOpponentConnection(
      message.phase === "playing" && onlinePlayers[enemy]?.connected === false,
    );
    if (message.phase === "playing")
      enterOnlineGame(message.startAt, message.serverNow);
    else if (message.phase === "waiting" || message.phase === "ready") {
      forgetMatch();
      if (started && (introActive || state.status === "finished")) {
        cancelIntro();
        triviaViewer.stop();
        started = false;
        $("#result").classList.add("hidden");
        $("#map-review").classList.add("hidden");
        $("#hud").classList.add("hidden");
        state = createGame();
        world.reset();
        world.setHomeTeam(playerTeam);
        sound.setMusicScene("title");
      }
      $("#online-lobby").classList.remove("hidden");
      renderOnlineLobby();
    }
    if (started) renderUI();
    renderRematchStatus();
  } else if (message.type === "state") {
    if (mode !== "online") return;
    enterOnlineGame();
    rememberMatch();
    state = message.state;
    processEvents();
    renderUI();
    if (
      state.status === "finished" &&
      $("#result").classList.contains("hidden")
    )
      finish();
  } else if (message.type === "ack" && message.error) {
    toast(message.error);
    sound.play("warning");
  } else if (message.type === "error") {
    if (joinPending && onlinePhase === "menu") {
      joinPending = false;
      joinFeedback = message.message;
      updateJoinKeypad();
      return;
    }
    onlineStatus = message.message;
    renderOnlineLobby();
    toast(message.message);
  } else if (message.type === "opponent_disconnected") {
    if (message.team !== playerTeam) showOpponentConnection(true);
  } else if (message.type === "rematch") {
    rematchVotes = message.players;
    renderRematchStatus();
  } else if (message.type === "pong") {
    const latency = document.getElementById("latency");
    if (latency && pingAt) latency.textContent = `${Date.now() - pingAt}ms`;
  } else if (message.type === "left" && mode === "online" && !started) {
    onlinePhase = "menu";
    onlineRoom = "";
    renderOnlineLobby();
  }
}
function doAction(action: Action | "cancel") {
  if (!selected) return;
  const tutorialAction = tutorialAllowedAction(tutorialStage);
  if (tutorialStage && action !== tutorialAction) {
    toast("まずは下の案内の仕事をやってみよう！");
    return;
  }
  const target = resolveTaskTarget(state, playerTeam, action, bridgeContext);
  const request = { botId: selected, action, target };
  if (mode === "online") {
    if (!online?.connected) {
      toast("サーバーへ再接続中です");
      return;
    }
    online.command(request);
  } else {
    const r = command(state, playerTeam, request);
    if (!r.ok) {
      toast(r.reason!);
      return;
    }
  }
  sound.play("command");
  if (tutorialStage === "mine") {
    tutorialMiningBot = selected;
    setTutorialStage("pickSecond");
  } else if (tutorialStage === "secondMine") setTutorialStage("gather");
  else if (tutorialStage === "build") {
    const bridge = state.bridges.find((b) => b.id === target);
    if (bridge)
      resourceSpendPop([bridge.x, 0], "stone", M.tasks.build.cost.stone);
    setTutorialStage("construction");
  } else if (tutorialStage === "upgrade") setTutorialStage("upgradeWork");
  else if (tutorialStage === "repair") setTutorialStage("repairWork");
  else if (tutorialStage === "march") {
    tutorialMarchBot = selected;
    setTutorialStage("attack");
  } else if (tutorialStage === "embank") setTutorialStage("embankWork");
  else if (tutorialStage === "destroy") setTutorialStage("destroyWork");
  else if (tutorialStage === "clear") setTutorialStage("clearWork");
  const actingBot = state.bots.find((b) => b.id === selected);
  if (actingBot && action !== "cancel")
    worldPop(actingBot.position, action === "march" ? "rush" : "command");
  if (action === "march") world.followMarch(selected);
  toast(
    action === "cancel"
      ? "掘るのをやめて戻ります"
      : `${botName(state.bots.find((b) => b.id === selected)!.index)}が「${labels[action]}」を始めます`,
  );
  closePanel();
}
function costText(action: Action) {
  const b = state.bridges.find(
      (b) =>
        b.id === resolveTaskTarget(state, playerTeam, action, bridgeContext),
    ),
    spec = taskSpec(action, b);
  const cost = Object.entries(spec.cost)
    .map(([r, n]) => `${resourceNames[r as Resource]} ${n}`)
    .join(" / ");
  return action === "mine"
    ? "石・土・鉄"
    : action === "march"
      ? "相手の城へ"
      : `${cost} · ${spec.seconds}秒`;
}
function renderUI() {
  if (!started) return;
  $("#pause").classList.toggle("hidden", !!tutorialStage);
  $("#hud .help").classList.toggle("hidden", !!tutorialStage);
  for (const team of ["blue", "red"] as const) {
    const label = $(`#${team}-score .score-top small`);
    label.textContent =
      mode === "online"
        ? (onlinePlayers[team]?.name ??
          (team === "blue" ? "プレイヤー1" : "プレイヤー2"))
        : team === "blue"
          ? "あなたの城"
          : "相手の城";
  }
  for (const team of ["blue", "red"] as const) {
    const hp = state.teams[team].hp;
    if (hp < shownHp[team]) {
      const score = $(`#${team}-score`);
      score.classList.remove("damage-flash");
      void score.offsetWidth;
      score.classList.add("damage-flash");
      setTimeout(() => score.classList.remove("damage-flash"), 520);
    }
    shownHp[team] = hp;
    $(`#${team}-hp-count`).innerHTML = `${hp}<em>/${M.castle.hp}</em>`;
    html(
      `#${team}-hp`,
      Array.from(
        { length: M.castle.hp },
        (_, i) => `<i class="${i < hp ? "filled" : ""}"></i>`,
      ).join(""),
    );
    $(`#${team}-hp`).setAttribute("aria-valuenow", String(hp));
  }
  const remain = Math.ceil(M.game.duration - state.time);
  $("#timer").textContent = tutorialStage
    ? "練習中"
    : `${Math.floor(remain / 60)
        .toString()
        .padStart(2, "0")}:${(remain % 60).toString().padStart(2, "0")}`;
  const resources = state.teams[playerTeam].resources;
  const deltas = previousResources
    ? (Object.fromEntries(
        (["soil", "stone", "iron"] as const).map((r) => [
          r,
          resources[r] - previousResources![r],
        ]),
      ) as Record<Resource, number>)
    : { soil: 0, stone: 0, iron: 0 };
  html(
    "#resources",
    (["soil", "stone", "iron"] as const)
      .map(
        (r) =>
          `<div class="resource ${r}">${resourceIcon(r)}<span>${resourceNames[r]}<b>${resources[r]}</b></span></div>`,
      )
      .join(""),
  );
  for (const r of ["soil", "stone", "iron"] as const) {
    if (!deltas[r]) continue;
    const el = $(`#resources .${r}`);
    el.classList.remove("resource-gain", "resource-spend");
    void el.offsetWidth;
    el.classList.add(deltas[r] > 0 ? "resource-gain" : "resource-spend");
    const bubble = document.createElement("em");
    bubble.className = `resource-change ${deltas[r] > 0 ? "gain" : "spend"}`;
    bubble.textContent = `${deltas[r] > 0 ? "+" : "−"}${Math.abs(deltas[r])}`;
    el.append(bubble);
    setTimeout(() => bubble.remove(), 850);
  }
  previousResources = { ...resources };
  const bridge = state.bridges.find((b) => b.exclusive === playerTeam)!;
  const bridgeReady =
    !bridge.level &&
    state.bots.some(
      (bot) =>
        bot.team === playerTeam &&
        canCommand(state, playerTeam, {
          botId: bot.id,
          action: "build",
          target: bridge.id,
        }) === null,
    );
  $("#hint").classList.toggle("hidden", bridgeReady || !!tutorialStage);
  html(
    "#hint",
    !bridge.level
      ? `${resourceIcon("stone")} <span>石を50集めて、手前の橋をつくろう</span>`
      : bridge.blockedBy
        ? `${icon("clear")} <span>道がふさがれた！ <b>土をならす</b>と通れるよ</span>`
        : `${icon("march")} <span>橋ができた！ <b>攻める</b>で相手の城へ。あと${state.teams[playerTeam === "blue" ? "red" : "blue"].hp}回！</span>`,
  );
  if (selected) {
    const b = state.bots.find((x) => x.id === selected)!;
    const busy = b.state !== "IDLE" && b.action !== "mine";
    html(
      "#task-panel",
      `<div class="panel-heading"><span class="panel-bot">${icon("helmet")}</span><div><small>BOT ${b.index + 1}</small><h2>${botName(b.index)} <span>${states[b.state]}</span></h2></div><button class="circle" id="close-panel" aria-label="指示パネルを閉じる">${icon("close")}</button></div>
  ${
    busy
      ? `<div class="busy-note">${b.action ? icon(b.action) : ""}<b>${states[b.state]}</b><p>終わったら自分で戻ってくるよ。</p><div class="busy-progress"><i style="width:${b.duration ? Math.min(100, (b.progress / b.duration) * 100) : 50}%"></i></div></div>`
      : `<div class="actions">${(Object.keys(labels) as Action[])
          .map((a) => {
            const reason =
              canCommand(state, playerTeam, {
                botId: b.id,
                action: a,
                target: resolveTaskTarget(state, playerTeam, a, bridgeContext),
              }) ??
              (tutorialStage && a !== tutorialAllowedAction(tutorialStage)
                ? "練習の案内に進もう"
                : null);
            return `<button data-action="${a}" ${reason ? "disabled" : ""} title="${reason ?? labels[a]}" class="action ${a === "march" ? "rush" : ""}">${icon(a)}<span><b>${labels[a]}</b><small>${reason ? compactReason(reason) : costText(a)}</small></span></button>`;
          })
          .join(
            "",
          )}</div>${b.action === "mine" && !tutorialStage ? '<button id="cancel-mine" class="cancel-mine">掘るのをやめる</button>' : ""}${bridgeContext === "center" ? '<p class="panel-tip">真ん中の橋で作業</p>' : ""}`
  }`,
    );
  }
  renderTutorial();
}
function showHelp() {
  paused = true;
  sound.pauseMusic();
  sound.unlock();
  clearTimeout(modalCloseTimer);
  $("#modal").classList.remove("hidden", "leaving");
  $("#modal").innerHTML =
    `<article class="dialog"><div class="eyebrow">あそびかた</div><h2>橋をつくって、相手の城へ！</h2><p>5体のBotに仕事をお願いしよう。<br>相手の城に${M.castle.hp}回たどり着けば勝ち。</p><div class="guide-steps"><div>${icon("mine")}<b>01 掘る</b><p>Botをタップして「掘る」。<br>複数のBotに同時に頼めるよ。</p></div><div>${icon("build")}<b>02 橋をつくる</b><p>石が50あれば橋をつくれる。<br>真ん中の橋は早い者勝ち！</p></div><div>${icon("march")}<b>03 攻める</b><p>橋ができたら「攻める」。<br>仕事を終えたBotは城へ戻るよ。</p></div></div><p class="guide-extra">自分の城につながる橋は自分だけ、相手の城につながる橋は相手だけが架けられる。自分の橋を架けると中央も狙える。橋の旗と手すりの色で持ち主を見分けよう。</p><p class="guide-extra">相手の道は「道をふさぐ」「橋を壊す」で妨害できる。自分の橋は「土をならす」「直す」で復旧し、「強くする」で耐久を増やせる。地震でも橋の耐久が1つ減るよ。</p><p class="guide-extra">途中でやめられるのは「掘る」だけ。5分で時間切れなら、城の体力が多い方が勝つ。</p><button id="modal-close" class="primary">わかった！ ${icon("march")}</button><small class="keyboard-note">ドラッグで移動、ピンチ・ホイールで拡大縮小、2本指・右ドラッグで回転。PCは1〜5でBot選択、Escで閉じる。</small></article>`;
}
function showPause() {
  paused = true;
  sound.pauseMusic();
  clearTimeout(modalCloseTimer);
  $("#modal").classList.remove("hidden", "leaving");
  $("#modal").innerHTML =
    `<article class="dialog compact"><div class="eyebrow">TAKE A BREAK</div><h2>ちょっと、ひと休み。</h2><p>${mode === "online" ? "オンラインの試合は進行中です。" : "CPUとタイマーも停止しています。"}</p><button id="modal-close" class="primary">ゲームに戻る ${icon("march")}</button><button id="back-title" class="secondary">${icon("home")}<span>タイトルへ戻る</span></button></article>`;
}
function hideModal() {
  const modal = $("#modal");
  modal.classList.add("leaving");
  clearTimeout(modalCloseTimer);
  modalCloseTimer = setTimeout(
    () => {
      modal.classList.add("hidden");
      modal.classList.remove("leaving");
      paused = false;
      if (!started || state.status === "playing") sound.resumeMusic();
    },
    reducedMotion.matches ? 0 : 190,
  );
}
function closeOnlineLobby() {
  forgetMatch();
  showOpponentConnection(false);
  online?.leave();
  online?.close();
  $("#online-lobby").classList.add("hidden");
  onlinePhase = "menu";
  onlineRoom = "";
  rematchVotes = [false, false];
  mode = "cpu";
}
function showTrivia(
  index: number,
  target: "#result-trivia" | "#title-trivia-content",
) {
  try {
    localStorage.setItem(triviaStorageKey, String(index));
  } catch {
    // Private browsing may block storage; the current result still works.
  }
  const fact = civilTrivia[index];
  const nextModel = civilTrivia[(index + 1) % civilTrivia.length].model;
  if (nextModel !== fact.model) {
    const preload = new Image();
    preload.src = `${import.meta.env.BASE_URL}ui/trivia/${nextModel}.png`;
  }
  const host = $(target);
  const nextButtonId =
    target === "#title-trivia-content"
      ? "title-trivia-next"
      : "result-trivia-next";
  host.innerHTML = `<div class="trivia-top"><span>土木まめちしき</span><small>${index + 1}/${civilTrivia.length}</small></div><div class="trivia-content"><div class="trivia-visual"><img class="trivia-model" src="${import.meta.env.BASE_URL}ui/trivia/${fact.model}.png" alt="${fact.modelName}のゲーム内モデル"><div class="trivia-model-wait" role="status" aria-label="3Dモデルを読み込み中"><span class="match-spinner" aria-hidden="true"></span><small>読み込み中…</small></div><span class="trivia-model-name">${fact.modelName}</span></div><div class="trivia-bubble"><small>${fact.topic}</small><h3>${fact.title}</h3><p>${fact.text}</p></div></div><div class="trivia-bottom"><a href="${fact.source}" target="_blank" rel="noopener noreferrer">出典：${fact.sourceLabel} ↗</a><button id="${nextButtonId}" type="button">次の話を聞く ${icon("march")}</button></div>`;
  triviaViewer.show(
    host.querySelector<HTMLElement>(".trivia-visual")!,
    fact.model,
  );
}
function lastTriviaIndex(fallback: number) {
  let previous = fallback;
  try {
    const saved = localStorage.getItem(triviaStorageKey);
    if (
      saved !== null &&
      Number.isInteger(Number(saved)) &&
      Number(saved) >= 0 &&
      Number(saved) < civilTrivia.length
    )
      previous = Number(saved);
  } catch {
    // The in-memory index still advances between matches.
  }
  return previous;
}
function showResultTrivia(index: number) {
  resultTriviaIndex = index;
  showTrivia(index, "#result-trivia");
}
function firstResultTrivia() {
  showResultTrivia(
    (lastTriviaIndex(resultTriviaIndex) + 1) % civilTrivia.length,
  );
}
function showTitleTrivia(index: number) {
  titleTriviaIndex = index;
  showTrivia(index, "#title-trivia-content");
}
function openTitleTrivia() {
  $("#title-trivia").classList.remove("hidden");
  showTitleTrivia((lastTriviaIndex(titleTriviaIndex) + 1) % civilTrivia.length);
  document.querySelector<HTMLButtonElement>("#title-trivia-close")?.focus();
}
function closeTitleTrivia() {
  triviaViewer.stop();
  $("#title-trivia").classList.add("hidden");
  document.querySelector<HTMLButtonElement>("#title-trivia-open")?.focus();
}
function finish() {
  if (!$("#result").classList.contains("hidden")) return;
  forgetMatch();
  showOpponentConnection(false);
  closePanel();
  const win = state.winner === playerTeam,
    draw = state.winner === "draw";
  if (mode === "cpu" && !tutorialStage && soloMatchId) {
    void submitSoloMatch({
      id: soloMatchId,
      selectedDifficulty: difficulty,
      configVersion: cpuConfigVersion(M.cpu, difficulty),
      outcome: draw ? "draw" : win ? "win" : "loss",
      durationSeconds: Math.round(state.time),
      playerCastleHp: state.teams[playerTeam].hp,
      cpuCastleHp: state.teams[playerTeam === "blue" ? "red" : "blue"].hp,
    });
  }
  $("#map-review").classList.add("hidden");
  $("#result").classList.remove("hidden");
  $("#result").innerHTML =
    `<article class="result-card ${win ? "victory" : ""}"><div class="result-main"><div class="result-crown">${icon("crown")}</div><div class="eyebrow">ゲーム終了</div><h2>${draw ? "引き分け！" : win ? "道をつないだ。<br>勝利をつかんだ！" : "次こそ、<br>勝利への道を。"}</h2><p>${draw ? "最後まで守り切りました。次の工事で決着を。" : win ? "5体の小さなBotたちに、大きな拍手を。" : "掘るBotと攻めるBotの配分、相手の道をふさぐタイミングがカギ。"}</p><div class="result-score"><span class="blue">${state.teams.blue.hp}</span><small>城の残り</small><span class="red">${state.teams.red.hp}</span></div><div class="result-stats"><div><b>${state.teams[playerTeam].stats.mined}</b><small>集めた資源</small></div><div><b>${state.teams[playerTeam].stats.built}</b><small>つないだ橋</small></div><div><b>${Math.floor(state.time / 60)}:${Math.floor(
      state.time % 60,
    )
      .toString()
      .padStart(
        2,
        "0",
      )}</b><small>工事時間</small></div></div><button id="review-map" class="result-map-button" type="button">試合の最後を見る</button>${mode === "cpu" && !tutorialStage ? `<section class="result-feedback" aria-label="CPUの強さについてのアンケート"><strong>今回のCPU、どう感じた？ <small>任意</small></strong><div class="result-feedback-choices">${(["easy", "normal", "hard"] as const).map((value) => `<button type="button" data-feedback="${value}">${{ easy: "かんたん", normal: "ふつう", hard: "むずかしい" }[value]}</button>`).join("")}</div><p id="feedback-status" role="status" aria-live="polite"></p></section>` : ""}</div><section id="result-trivia" class="result-trivia" aria-label="土木まめちしき"></section>${mode === "online" ? '<p id="result-rematch-status" class="result-rematch-status" role="status" aria-live="polite"></p>' : ""}<div class="result-actions"><button id="restart" class="primary">${mode === "online" ? "同じ相手と再戦" : "もう一度遊ぶ"} ${icon("march")}</button><button id="back-title" class="secondary">${icon("home")}<span>タイトルへ戻る</span></button></div></article>`;
  firstResultTrivia();
  renderRematchStatus();
  sound.play("end");
  sound.setMusicScene(win ? "victory" : "retry");
}
function showFinalMap() {
  if (state.status === "playing") return;
  triviaViewer.stop();
  $("#result").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#bridge-labels").classList.add("hidden");
  $("#map-review").classList.remove("hidden");
  world.resetView();
}
function returnToResult() {
  $("#map-review").classList.add("hidden");
  $("#result").classList.remove("hidden");
  if (resultTriviaIndex >= 0) showResultTrivia(resultTriviaIndex);
}
function backTitle() {
  forgetMatch();
  showOpponentConnection(false);
  cancelIntro();
  triviaViewer.stop();
  tutorialStage = null;
  $("#tutorial").classList.add("hidden");
  if (mode === "online") {
    online?.leave();
    online?.close();
  }
  mode = "cpu";
  playerTeam = "blue";
  onlineRoom = "";
  rematchVotes = [false, false];
  onlinePhase = "menu";
  sound.setMusicScene("title");
  started = false;
  paused = false;
  closePanel();
  $("#result").classList.add("hidden");
  $("#map-review").classList.add("hidden");
  $("#modal").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#latency").classList.add("hidden");
  $("#title").classList.remove("hidden");
  showSoloMenu(false);
  state = createGame();
  resetTitleDemo();
  world.reset();
  visualPositions.clear();
  world.setHomeTeam("blue");
  syncSoundButtons();
}
function syncSoundButtons() {
  for (const id of ["sound", "title-sound"]) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.classList.toggle("muted", sound.muted);
    button.setAttribute("aria-pressed", String(sound.muted));
  }
}
// Browsers that permit autoplay start on load; otherwise any first tap or key
// resumes the already prepared title track, including taps on the 3D scene.
for (const event of ["pointerdown", "keydown"]) {
  document.addEventListener(
    event,
    () => {
      if (!sound.muted) sound.resumeMusic();
    },
    { capture: true },
  );
}
app.addEventListener("pointerdown", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (button && !button.disabled) button.classList.add("pressing");
});
for (const event of ["pointerup", "pointercancel", "pointerleave"]) {
  app.addEventListener(event, () => {
    app
      .querySelectorAll("button.pressing")
      .forEach((button) => button.classList.remove("pressing"));
  });
}
app.addEventListener("click", (e) => {
  if (
    e.target === $("#title-trivia") &&
    !$("#title-trivia").classList.contains("hidden")
  ) {
    sound.play("ui");
    closeTitleTrivia();
    return;
  }
  if (e.target === $("#modal") && !$("#modal").classList.contains("hidden")) {
    sound.play("ui");
    hideModal();
    return;
  }
  if (
    e.target === $("#online-lobby") &&
    !$("#online-lobby").classList.contains("hidden")
  ) {
    sound.play("ui");
    closeOnlineLobby();
    return;
  }
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (
    !button ||
    button.disabled ||
    (transitioning && button.id !== "tutorial-skip")
  )
    return;
  const firstAudioGesture = !audioGestureSeen;
  audioGestureSeen = true;
  if (!button.dataset.keypad) tapBurst(button);
  if (button.dataset.action) doAction(button.dataset.action as Action);
  else if (button.dataset.keypad) {
    const key = button.dataset.keypad;
    if (key === "erase") joinDraft = joinDraft.slice(0, -1);
    else if (key === "join") {
      if (/^[0-9]{5}$/.test(joinDraft) && online?.connected) {
        joinPending = true;
        joinFeedback = "部屋を探しています…";
        online.send({ type: "join", roomId: joinDraft });
      } else joinFeedback = "招待コードは数字5桁です";
    } else if (joinDraft.length < 5) joinDraft += key;
    if (key !== "join") joinFeedback = "";
    sound.play("ui");
    updateJoinKeypad();
  } else if (button.dataset.feedback) {
    const answer = button.dataset.feedback as Difficulty;
    if (mode !== "cpu" || feedbackAnswer || !soloMatchId) return;
    feedbackAnswer = answer;
    sound.play("ui");
    document
      .querySelectorAll<HTMLButtonElement>("[data-feedback]")
      .forEach((choice) => {
        choice.disabled = true;
        choice.classList.toggle("chosen", choice === button);
      });
    const status = $("#feedback-status");
    status.textContent = "回答を送っています…";
    void submitDifficultyFeedback({
      id: soloMatchId,
      selectedDifficulty: difficulty,
      feltDifficulty: answer,
      outcome:
        state.winner === "draw"
          ? "draw"
          : state.winner === playerTeam
            ? "win"
            : "loss",
      durationSeconds: Math.round(state.time),
      playerCastleHp: state.teams[playerTeam].hp,
      cpuCastleHp: state.teams[playerTeam === "blue" ? "red" : "blue"].hp,
    }).then((sent) => {
      status.textContent = sent
        ? "ありがとう！ 次の調整に役立てます。"
        : "回答を保存しました。通信が戻ったら送信します。";
    });
  } else if (button.dataset.difficulty) {
    sound.unlock();
    sound.resumeMusic();
    sound.play("ui");
    difficulty = button.dataset.difficulty as Difficulty;
    document
      .querySelectorAll("[data-difficulty]")
      .forEach((x) =>
        x.classList.toggle(
          "active",
          (x as HTMLElement).dataset.difficulty === difficulty,
        ),
      );
  } else if (button.classList.contains("help")) {
    sound.unlock();
    sound.play("ui");
    showHelp();
  } else {
    switch (button.id) {
      case "start":
        sound.unlock();
        sound.play("ui");
        showSoloMenu(true);
        break;
      case "solo-back":
        sound.play("ui");
        showSoloMenu(false);
        break;
      case "tutorial-start":
        sound.unlock();
        sound.play("ui");
        sceneTransition(button, startTutorial, 520);
        break;
      case "cpu-start":
        sound.unlock();
        sound.play("ui");
        sceneTransition(button, start, 520);
        break;
      case "tutorial-skip":
        sound.play("ui");
        start();
        break;
      case "tutorial-home":
        sound.play("ui");
        backTitle();
        break;
      case "tutorial-next":
        sound.play("ui");
        if (tutorialStage === "returned") prepareTutorialSabotage();
        else if (tutorialStage === "bridgeRules" && bridgeRuleFocus < 2) {
          bridgeRuleFocus++;
          focusTutorialBridge();
          renderTutorial();
        } else {
          const next: Partial<Record<TutorialStage, TutorialStage>> = {
            rules: "bridgeRules",
            bridgeRules: "camera",
            camera: "pick",
            bridgeOptions: "pickMarch",
          };
          if (tutorialStage && next[tutorialStage])
            setTutorialStage(next[tutorialStage]!);
        }
        break;
      case "review-map":
        sound.play("ui");
        showFinalMap();
        break;
      case "review-back":
        sound.play("ui");
        returnToResult();
        break;
      case "restart":
        sound.play("ui");
        if (mode === "online") {
          if (!online?.connected) {
            toast("サーバーへ再接続中です");
            break;
          }
          online?.send({ type: "rematch" });
          rematchVotes[playerTeam === "blue" ? 0 : 1] = true;
          renderRematchStatus();
        } else sceneTransition(button, start, 520);
        break;
      case "result-trivia-next":
        sound.play("ui");
        showResultTrivia((resultTriviaIndex + 1) % civilTrivia.length);
        break;
      case "title-trivia-open":
        sound.unlock();
        sound.play("ui");
        openTitleTrivia();
        break;
      case "title-trivia-next":
        sound.play("ui");
        showTitleTrivia((titleTriviaIndex + 1) % civilTrivia.length);
        break;
      case "title-trivia-close":
        sound.play("ui");
        closeTitleTrivia();
        break;
      case "online-start":
        sound.unlock();
        sound.play("ui");
        showOnline();
        break;
      case "online-random":
        onlinePhase = "queueing";
        online?.send({ type: "queue" });
        renderOnlineLobby();
        break;
      case "online-create":
        online?.send({ type: "create" });
        break;
      case "room-id-input":
        keypadOpen = !keypadOpen;
        renderOnlineLobby();
        break;
      case "online-ready":
        nameDraft = (
          document.querySelector<HTMLInputElement>("#online-name")?.value ?? ""
        ).trim();
        online?.send({ type: "name", name: nameDraft });
        online?.send({ type: "ready", ready: true });
        button.disabled = true;
        break;
      case "online-close":
        closeOnlineLobby();
        break;
      case "copy-room":
        void navigator.clipboard?.writeText(onlineRoom).then(() => {
          onlineStatus = "招待コードをコピーしました";
          renderOnlineLobby();
        });
        break;
      case "share-room": {
        const inviteURL = new URL(import.meta.env.BASE_URL, location.href);
        inviteURL.searchParams.set("room", onlineRoom);
        const message = `INFRA RUSHで一緒に遊ぼう！\n招待コード: ${onlineRoom}\n${inviteURL.href}`;
        if (navigator.share)
          void navigator
            .share({ title: "INFRA RUSH に招待", text: message })
            .catch(() => {});
        else
          void navigator.clipboard?.writeText(message).then(() => {
            onlineStatus = "招待メッセージをコピーしました";
            renderOnlineLobby();
          });
        break;
      }
      case "close-panel":
        closePanel();
        break;
      case "cancel-mine":
        doAction("cancel");
        break;
      case "sound":
      case "title-sound": {
        sound.unlock();
        if (button.id !== "title-sound" || !firstAudioGesture)
          sound.muted = !sound.muted;
        if (!sound.muted && !paused) sound.resumeMusic();
        syncSoundButtons();
        break;
      }
      case "pause":
        sound.play("ui");
        showPause();
        break;
      case "modal-close":
        sound.play("ui");
        hideModal();
        break;
      case "back-title":
        sound.play("ui");
        sceneTransition(button, backTitle);
        break;
    }
  }
});
app.addEventListener("input", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id === "online-name") nameDraft = input.value;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#title-trivia").classList.contains("hidden")) {
    closeTitleTrivia();
    return;
  }
  if (e.key === "Escape" && !$("#modal").classList.contains("hidden")) {
    hideModal();
    return;
  }
  if (e.key === "Escape" && !$("#online-lobby").classList.contains("hidden")) {
    closeOnlineLobby();
    return;
  }
  if (e.key === "Escape" && !$("#solo-menu").classList.contains("hidden")) {
    showSoloMenu(false);
    return;
  }
  if (!started || paused || introActive || state.status !== "playing") return;
  if (/^[1-5]$/.test(e.key)) chooseBot(`${playerTeam}-${Number(e.key) - 1}`);
  if (e.key === "Escape") closePanel();
});
document.addEventListener("visibilitychange", () => {
  if (
    document.hidden &&
    started &&
    !tutorialStage &&
    state.status === "playing"
  )
    showPause();
});
let accumulator = 0,
  last = performance.now(),
  uiClock = 0;
function processEvents() {
  for (const e of state.events) {
    if (e.id <= lastEvent) continue;
    world.effect(e);
    if (e.kind === "attack" && e.team === playerTeam && e.position) {
      const flash = $("#impact-flash");
      const point = world.project(e.position, 1);
      flash.style.setProperty("--impact-x", `${point.x}px`);
      flash.style.setProperty("--impact-y", `${point.y}px`);
      flash.classList.remove("active");
      void flash.offsetWidth;
      flash.classList.add("active");
    }
    if (
      e.team === playerTeam ||
      ["earthquake", "warning", "end", "collapse"].includes(e.kind)
    )
      sound.play(e.kind);
    if (
      e.kind === "earthquake" ||
      e.kind === "warning" ||
      e.kind === "collapse" ||
      (e.team === playerTeam && e.kind === "complete")
    )
      toast(e.text);
    if (
      e.position &&
      e.team === playerTeam &&
      ["resource", "attack", "complete"].includes(e.kind)
    ) {
      const p = world.project(e.position, 2),
        el = document.createElement("span");
      el.className = `floater effect-${e.kind}`;
      const gain =
        e.kind === "resource" ? /^([土石鉄])\s*\+(\d+)$/.exec(e.text) : null;
      if (gain) {
        const resource = ({ 土: "soil", 石: "stone", 鉄: "iron" } as const)[
          gain[1] as "土" | "石" | "鉄"
        ];
        el.classList.add("resource-floater");
        el.innerHTML = `${resourceIcon(resource)}<b>+${gain[2]}</b>`;
      } else el.textContent = e.text;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      $("#floaters").append(el);
      setTimeout(() => el.remove(), 1400);
    }
    lastEvent = e.id;
    if (e.kind === "end") finish();
  }
}
function simulationStep() {
  if (cpuEnabled) cpu.update(state);
  tick(state, M.game.tick);
  if (tutorialStage) {
    state.time = 0;
    checkTutorialProgress();
  }
}
function simulate(seconds: number) {
  const steps = Math.round(seconds / M.game.tick);
  for (let i = 0; i < steps; i++) simulationStep();
  processEvents();
  renderUI();
}
function frame(now: number) {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(0.1, elapsed);
  last = now;
  updateIntro(now);
  const lobbyVisible = !$("#online-lobby").classList.contains("hidden");
  if (!started && !document.hidden && !lobbyVisible) updateTitleDemo(dt);
  if (mode === "online" && online?.connected && Date.now() - pingAt > 10000) {
    pingAt = Date.now();
    online.send({ type: "ping" });
  }
  if (
    mode === "online" &&
    started &&
    online?.connected &&
    state.status === "playing"
  )
    rememberMatch();
  if (
    started &&
    mode === "cpu" &&
    !paused &&
    !introActive &&
    !qaFrozen &&
    state.status === "playing"
  ) {
    accumulator += dt;
    while (accumulator >= M.game.tick) {
      simulationStep();
      accumulator -= M.game.tick;
    }
    processEvents();
  }
  sound.updateWork(
    state.bots
      .filter((bot) => bot.team === playerTeam)
      .map((bot) => workSoundByState[bot.state])
      .filter((cue): cue is WorkSound => !!cue),
    started &&
      !paused &&
      !introActive &&
      !qaFrozen &&
      state.status === "playing",
  );
  let displayState = started ? state : titleState;
  if (mode === "online" && started) {
    const alpha = Math.min(1, dt * 15);
    displayState = {
      ...state,
      bots: state.bots.map((bot) => {
        let position: Point = visualPositions.get(bot.id) ?? [...bot.position];
        if (
          Math.hypot(
            position[0] - bot.position[0],
            position[1] - bot.position[1],
          ) > 5
        )
          position = [...bot.position];
        else
          position = [
            position[0] + (bot.position[0] - position[0]) * alpha,
            position[1] + (bot.position[1] - position[1]) * alpha,
          ];
        visualPositions.set(bot.id, position);
        return { ...bot, position };
      }),
    };
  }
  if (started || !lobbyVisible)
    world.update(displayState, dt, elapsed, !started);
  if (opponentOffline && started) {
    const enemy = playerTeam === "blue" ? "red" : "blue";
    const p = world.project(M.castle[enemy] as Point, 5.7);
    const badge = $("#opponent-connection");
    badge.style.left = `${p.x}px`;
    badge.style.top = `${p.y}px`;
  }
  uiClock += dt;
  if (uiClock > 0.15) {
    renderUI();
    const meter = document.getElementById("qa-metrics");
    if (meter) {
      const memory = (
        performance as Performance & { memory?: { usedJSHeapSize: number } }
      ).memory;
      meter.textContent = JSON.stringify({
        ...world.metrics(),
        heapMB: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
      });
    }
    uiClock = 0;
  }
  if (started) {
    const availableSites: string[] = [];
    for (const b of state.bridges) {
      let el = document.querySelector<HTMLButtonElement>(
        `#bridge-labels [data-target="${b.id}"]`,
      );
      if (!el) {
        el = document.createElement("button");
        el.dataset.target = b.id;
        $("#bridge-labels").append(el);
      }
      const p = world.project([b.x, 0], 1);
      const empty = b.level === 0 && !b.lock;
      const buildable = empty && bridgeBuilder(b.id) !== null;
      if (buildable) availableSites.push(b.id);
      el.disabled = !buildable;
      el.style.pointerEvents = buildable ? "auto" : "none";
      el.className = `bridge-label ${b.owner ?? "neutral"} ${b.blockedBy ? "blocked" : ""} ${empty ? "empty" : ""} ${buildable ? "available" : ""} ${empty && b.exclusive && b.exclusive !== playerTeam ? "unavailable" : ""}`;
      if (tutorialStage === "bridge" && b.id === "blue")
        el.classList.add("tutorial-target");
      el.setAttribute(
        "aria-label",
        `${b.id === "center" ? "真ん中の橋" : b.id === playerTeam ? "自分の城につながる橋" : "相手の城につながる橋"}${buildable ? "、つくれる" : ""}`,
      );
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      const markup = buildable ? "<b>!</b>" : "";
      if (el.innerHTML !== markup) el.innerHTML = markup;
      el.classList.toggle("hidden", !buildable);
    }
    world.setSiteAvailability(availableSites);
  }
  positionPanel();
  requestAnimationFrame(frame);
}
try {
  sound.setMusicScene("title");
  await waitForOpeningStart();
  world = new World($("#world"));
  world.onPick = (kind, id) => {
    if (!started || paused || introActive || state.status !== "playing") return;
    if (kind === "bot") {
      if (state.bots.find((bot) => bot.id === id)?.team === playerTeam)
        chooseBot(id);
    } else if (kind === "bridge") chooseBridge(id);
    else if (selected) closePanel();
  };
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectStall: (reason: Error) => void = () => {};
  const stalled = new Promise<never>((_, reject) => {
    rejectStall = reject;
  });
  const resetStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(
      () => rejectStall(new Error("Asset load stalled")),
      60000,
    );
  };
  resetStallTimer();
  try {
    await Promise.race([
      world.load((n) => {
        resetStallTimer();
        $("#loading .loading-spinner").setAttribute(
          "aria-valuenow",
          String(Math.round(n * 100)),
        );
        $("#loading .opening-progress span").style.width =
          `${Math.round(n * 100)}%`;
      }),
      stalled,
    ]);
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }
  $("#loading .opening-status p").textContent = "準備できたよ！";
  ready = true;
  $("#loading").classList.add("opening-ready");
  await waitForOpeningPresentation();
  resetTitleDemo();
  $("#title").classList.remove("hidden");
  $("#title").classList.add("title-arriving");
  $("#loading").classList.add("opening-exit");
  sound.setMusicScene("title");
  requestAnimationFrame(frame);
  await new Promise<void>((resolve) =>
    setTimeout(resolve, openingReducedMotion ? 0 : 700),
  );
  $("#loading").classList.add("hidden");
  stopOpening();
  $("#title").classList.remove("title-arriving");
  if (
    pendingInvite ||
    Date.now() - Number(localStorage.getItem(resumeKey) ?? 0) < 100_000
  )
    showOnline();
  $("#bridge-labels").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-target]");
    if (b) chooseBridge(b.dataset.target!);
  });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa")) {
    const qaControls = document.createElement("aside");
    qaControls.id = "qa-controls";
    qaControls.style.cssText =
      "position:fixed;left:8px;top:8px;z-index:100;max-width:min(180px,45vw);background:#fff;padding:6px;border:2px solid #f0b640;border-radius:8px;font-size:11px;overflow-wrap:anywhere";
    qaControls.innerHTML =
      '<b>QA</b> <button data-seconds="15">+15秒</button> <button data-seconds="30">+30秒</button> <button id="qa-freeze">時計停止</button><small id="qa-metrics" style="display:block;max-width:150px;font-size:8px;overflow-wrap:anywhere"></small>';
    qaControls.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (!button || !started) return;
      if (button.dataset.seconds) simulate(Number(button.dataset.seconds));
      else {
        qaFrozen = !qaFrozen;
        button.textContent = qaFrozen ? "時計再開" : "時計停止";
      }
    });
    document.body.append(qaControls);
    Object.assign(window, {
      infraQA: {
        snapshot: () => structuredClone(state),
        attractSnapshot: () => structuredClone(titleState),
        advance: simulate,
        metrics: () => world.metrics(),
        camera: () => ({
          position: world.camera.position.toArray(),
          target: world.controls.target.toArray(),
          zoom: world.camera.zoom,
        }),
        inspectVehicle: (id: string) => world.inspectVehicle(id),
        previewMarine: (
          kind: "fish" | "birds" | "dolphin" | "whale" | null,
          progress = 0.5,
        ) => world.previewMarine(kind, progress),
        marineSnapshot: () => world.marineSnapshot(),
        setCpu: (level: Difficulty) => {
          cpu = new CPU(level);
        },
        setCpuEnabled: (enabled: boolean) => {
          cpuEnabled = enabled;
        },
        setResources: (
          team: Team,
          resources: Partial<Record<Resource, number>>,
        ) => {
          Object.assign(state.teams[team].resources, resources);
        },
        command: (team: Team, botId: string, action: Action, target?: string) =>
          command(state, team, { botId, action, target }),
        quake: () => {
          state.nextQuake = state.time + 1;
        },
        suppressQuake: () => {
          state.nextQuake = Number.MAX_SAFE_INTEGER;
        },
        setBridge: (
          id: string,
          patch: Partial<GameState["bridges"][number]>,
        ) => {
          Object.assign(
            state.bridges.find((bridge) => bridge.id === id)!,
            patch,
          );
        },
        focus: (x: number, z: number, zoom = 2.6) => {
          world.camera.position.set(x + 9, 8, z + 12);
          world.controls.target.set(x, 0, z);
          world.camera.zoom = zoom;
          world.camera.updateProjectionMatrix();
          world.controls.update();
        },
        projectBot: (id: string) => {
          const b = state.bots.find((b) => b.id === id)!;
          return world.project(b.position, 1);
        },
        projectBridge: (id: string) => {
          const b = state.bridges.find((bridge) => bridge.id === id)!;
          return world.project([b.x, 0], 0.4);
        },
      },
    });
  }
} catch (error) {
  console.error(error);
  stopOpening();
  $("#loading").classList.add("opening-failed");
  const loadingFailed =
    error instanceof Error && /fetch|load|network|timeout/i.test(error.message);
  $("#loading").innerHTML =
    `<div class="dialog"><h2>準備中に問題が発生しました</h2><p>${loadingFailed ? "ゲームデータの読み込みが止まりました。通信を確認して、もう一度お試しください。" : "3D描画を開始できませんでした。WebGL対応ブラウザでお試しください。"}</p><button onclick="location.reload()" class="primary">再読み込み</button></div>`;
}
// QA hooks are removed from production builds by Vite.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const registerOffline = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        registration.active?.postMessage("CACHE_GAME_ASSETS");
      })
      .catch(() => {
        // The game stays playable if a browser disallows offline installation.
      });
  };
  if (document.readyState === "complete") registerOffline();
  else window.addEventListener("load", registerOffline, { once: true });
}
void flushFeedback();
void flushSoloMatches();
