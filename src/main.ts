import "./style.css";
import "./motion.css";
import "./tutorial.css";
import { M } from "./game/master";
import type { Difficulty } from "./game/master";
import { canCommand, command, createGame, taskSpec, tick } from "./game/engine";
import { CPU } from "./game/cpu";
import { resolveTaskTarget } from "./game/intent";
import type { Action, BotState, Point, Resource } from "./game/types";
import { World } from "./render/world";
import { Sound } from "./ui/audio";
import type { WorkSound } from "./ui/audio";
import { icon } from "./ui/icons";
import { OnlineClient } from "./net/client";
import type { OnlinePlayer, ServerMessage } from "./net/client";
import type { Team } from "./game/types";

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
app.innerHTML = `<main id="world"></main><div id="vignette"></div>
<section id="loading"><div class="mini-brand">INFRA <b>RUSH</b></div><div class="loading-track"><i></i></div><p>小さなBotたちが準備しています…</p></section>
<section id="title" class="hidden">
 <div class="title-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
 <div class="title-top"><span class="edition">CIVIL ENGINEERING STRATEGY</span><div class="title-actions"><button id="title-sound" class="circle" aria-label="音楽を再生・停止" aria-pressed="false">${icon("sound")}</button><button class="circle help" aria-label="遊び方">?</button></div></div>
 <div class="title-copy"><div class="logo"><span>INFRA</span><b>RUSH<span class="logo-dot">!</span></b></div><h1>勝利への道を、つくろう。</h1><p>5体のBot。3つの橋。ひとつの勝利。<br>掘って、つないで、相手の城へ。</p></div>
 <div class="start-card"><label for="difficulty">CPUの強さ</label><div class="difficulty-options"><button data-difficulty="easy">はじめて</button><button data-difficulty="normal" class="active">スタンダード</button><button data-difficulty="hard">チャレンジ</button></div><button id="start" class="primary">${icon("helmet")}<span>工事をはじめる<small>操作を練習してからCPU戦へ</small></span>${icon("march")}</button><button id="online-start" class="secondary online-entry">マルチプレイ ${icon("march")}</button><p>1ゲーム 6分 · 先に城を${M.castle.hp}回たたけば勝ち</p></div>
 <div class="title-footer"><span>BUILD. CONNECT. RUSH.</span><span>音楽は右上のボタンから ${icon("sound")}</span></div>
</section>
<section id="hud" class="hidden">
 <header class="match-header"><div class="team-score blue" id="blue-score"><div class="score-top"><span>${icon("castle")}<small>あなたの城</small></span><b id="blue-hp-count">${M.castle.hp}<em>/${M.castle.hp}</em></b></div><div class="health-meter" id="blue-hp" style="--castle-hp:${M.castle.hp}" role="progressbar" aria-label="あなたの城の残り" aria-valuemin="0" aria-valuemax="${M.castle.hp}"></div></div><div class="timer"><small>のこり時間</small><b id="timer">06:00</b></div><div class="team-score red" id="red-score"><div class="score-top"><span>${icon("castle")}<small>相手の城</small></span><b id="red-hp-count">${M.castle.hp}<em>/${M.castle.hp}</em></b></div><div class="health-meter" id="red-hp" style="--castle-hp:${M.castle.hp}" role="progressbar" aria-label="相手の城の残り" aria-valuemin="0" aria-valuemax="${M.castle.hp}"></div></div></header>
 <div class="resource-bar" id="resources"></div>
 <div class="utilities"><span id="latency" class="latency hidden" aria-label="通信遅延"></span><button id="sound" class="circle" aria-label="BGMと効果音を切り替え" aria-pressed="false">${icon("sound")}</button><button id="pause" class="circle" aria-label="一時停止">${icon("pause")}</button><button class="circle help" aria-label="遊び方">?</button></div>
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
<section id="result" class="overlay hidden"></section><div id="scene-wipe" aria-hidden="true"></div>`;
let state = createGame();
let cpu = new CPU();
let cpuEnabled = true;
let difficulty: Difficulty = "normal";
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
let onlinePhase:
  "menu" | "queueing" | "waiting" | "ready" | "playing" | "finished" = "menu";
let onlineStatus = "";
let nameDraft = "";
let joinDraft = "";
let pingAt = 0;
const visualPositions = new Map<string, Point>();
const sound = new Sound();
let world: World;
const labels: Record<Action, string> = {
  mine: "掘る",
  build: "橋をつくる",
  upgrade: "強くする",
  repair: "直す",
  embank: "道をふさぐ",
  clear: "土をどける",
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
type TutorialStage =
  | "pick"
  | "mine"
  | "gather"
  | "bridge"
  | "build"
  | "construction"
  | "pickMarch"
  | "march"
  | "attack"
  | "complete";
let tutorialStage: TutorialStage | null = null;
let tutorialMarchBot: string | null = null;
let tutorialCompleteTimer: ReturnType<typeof setTimeout>;
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
function chooseBot(id: string, context: string | null = null) {
  if (tutorialStage === "pick") setTutorialStage("mine");
  else if (tutorialStage === "pickMarch") {
    const bot = state.bots.find((b) => b.id === id);
    if (bot?.state !== "IDLE") {
      toast("待機中のBotを選ぼう");
      return;
    }
    setTutorialStage("march");
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
  chooseBot(bot, id === "center" ? id : null);
}
function bridgeBuilder(id: string): string | null {
  const bridge = state.bridges.find((b) => b.id === id);
  if (!bridge || bridge.level || bridge.lock) return null;
  const candidates = [
    ...state.bots.filter((b) => b.id === selected),
    ...state.bots.filter((b) => b.id !== selected && b.team === playerTeam),
  ];
  return (
    candidates.find(
      (bot) =>
        canCommand(state, playerTeam, {
          botId: bot.id,
          action: "build",
          target: id,
        }) === null,
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
  clearTimeout(tutorialCompleteTimer);
  tutorialStage = null;
  tutorialMarchBot = null;
  mode = "cpu";
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
  world.reset();
  visualPositions.clear();
  world.setHomeTeam("blue");
  clearTimeout(panelCloseTimer);
  $("#title").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#tutorial").classList.add("hidden");
  $("#result").classList.add("hidden");
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
  tutorialStage = "pick";
  $("#hud").classList.remove("hidden");
  $("#tutorial").classList.remove("hidden");
  renderUI();
  sound.play("complete");
}
const tutorialSteps: TutorialStage[] = [
  "pick",
  "mine",
  "gather",
  "bridge",
  "build",
  "construction",
  "pickMarch",
  "march",
  "attack",
  "complete",
];
function tutorialStepNumber(stage: TutorialStage) {
  const index = tutorialSteps.indexOf(stage);
  return index < 1 ? 1 : index < 3 ? 2 : index < 6 ? 3 : 4;
}
function setTutorialStage(stage: TutorialStage) {
  if (!tutorialStage || tutorialStage === stage) return;
  tutorialStage = stage;
  sound.play(stage === "complete" ? "complete" : "ui");
  renderUI();
  if (stage === "complete")
    tutorialCompleteTimer = setTimeout(() => {
      if (tutorialStage === "complete") start();
    }, 2400);
}
function renderTutorial() {
  const stage = tutorialStage;
  const tutorial = $("#tutorial");
  tutorial.classList.toggle("hidden", !stage);
  if (!stage) return;
  const stone = state.teams.blue.resources.stone;
  const descriptions: Record<TutorialStage, [string, string]> = {
    pick: ["Botをタップ！", "手前の青いBotをタップして、仕事を選ぼう。"],
    mine: [
      "石を掘ろう",
      "作業メニューの「掘る」を押そう。練習用の石はあと2個で橋をつくれるよ。",
    ],
    gather: [
      "採掘中！",
      `重機が採石場へ向かうよ。石が50になれば橋をつくれる！ ${Math.min(stone, 50)}/50`,
    ],
    bridge: [
      "橋の場所をタップ！",
      "黄色い「!」をタップして、手前の橋にBotを呼ぼう。",
    ],
    build: [
      "橋をつくろう",
      "「橋をつくる」を押して、向こう岸への道をつなごう。",
    ],
    construction: ["架橋中！", "架橋機が桁を送り出す様子を見てみよう。"],
    pickMarch: ["攻めるBotを選ぼう", "手前の青いBotをもう一度タップしよう。"],
    march: [
      "進軍しよう！",
      "「攻める」を押すと、Botが橋を渡って相手の城へ向かうよ。",
    ],
    attack: ["城へ一直線！", "Botが城を一度たたき、シュポンと帰ってくるよ。"],
    complete: [
      "練習クリア！",
      "採掘、架橋、進軍ができたね！ 次はCPUとの本番だ。",
    ],
  };
  const [title, description] = descriptions[stage];
  const step = tutorialStepNumber(stage);
  html(
    "#tutorial-card",
    `<article class="tutorial-card ${stage === "complete" ? "cleared" : ""}">
    <div class="tutorial-top"><span>れんしゅう <b>${step}/4</b></span><button id="tutorial-skip" type="button">${stage === "complete" ? "今すぐ対戦" : "スキップして対戦"} ${icon("march")}</button></div>
    <div class="tutorial-message"><span class="tutorial-emblem">${icon(stage === "mine" || stage === "gather" ? "mine" : stage === "bridge" || stage === "build" || stage === "construction" ? "build" : stage === "pick" ? "helmet" : "march")}</span><div><h2>${title}</h2><p>${description}</p></div></div>
    <div class="tutorial-progress" aria-label="練習の進み具合 ${step}/4">${Array.from({ length: 4 }, (_, i) => `<i class="${i < step ? "done" : ""}"></i>`).join("")}</div>
  </article>`,
  );
  document
    .querySelectorAll(".tutorial-target")
    .forEach((node) => node.classList.remove("tutorial-target"));
  const action =
    stage === "mine"
      ? "mine"
      : stage === "build"
        ? "build"
        : stage === "march"
          ? "march"
          : null;
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
  if (stage === "pick" || stage === "pickMarch") {
    const bot = state.bots.find((b) => b.team === "blue" && b.state === "IDLE");
    if (bot) point = world.project(bot.position, 1);
  } else if (stage === "bridge" || stage === "construction") {
    const bridge = state.bridges.find((b) => b.id === "blue")!;
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
  )
    setTutorialStage("pickMarch");
  else if (
    tutorialStage === "attack" &&
    state.teams.blue.stats.attacks > 0 &&
    state.bots.find((b) => b.id === tutorialMarchBot)?.state === "IDLE"
  )
    setTutorialStage("complete");
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
function renderOnlineLobby() {
  const lobby = $("#online-lobby");
  if (lobby.classList.contains("hidden")) return;
  const connected = online?.connected ?? false;
  const status =
    onlineStatus || (connected ? "オンライン" : "サーバーに接続中…");
  let content = "";
  if (onlinePhase === "menu") {
    content = `<h2>マルチプレイ</h2><p>誰かとすぐ対戦するか、5文字の部屋IDで友だちを招待できます。</p>
      ${status === "公開対戦サーバーの設定が必要です" ? '<p role="status">公開版の対戦サーバーは準備中です。1人プレイは遊べます。</p>' : ""}
      <button id="online-random" class="primary" ${connected ? "" : "disabled"}>ランダム対戦 ${icon("march")}</button>
      <button id="online-create" class="secondary" ${connected ? "" : "disabled"}>部屋をロックして招待</button>
      <div class="room-join"><label for="room-id-input">部屋IDで参加</label><div><input id="room-id-input" maxlength="5" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCDE" value="${escapeHtml(joinDraft)}"><button id="online-join" class="secondary" ${connected ? "" : "disabled"}>参加</button></div></div>`;
  } else if (onlinePhase === "queueing") {
    content = `<div class="match-spinner" aria-hidden="true"></div><h2>相手を探しています</h2><p>ランダム対戦を選んだ人とマッチングします。</p>`;
  } else if (onlinePhase === "waiting") {
    content = `<div class="eyebrow">招待する</div><h2>友だちを待っています</h2><p>この5文字の部屋IDを伝えてください。</p><button id="copy-room" class="room-code" aria-label="部屋IDをコピー">${onlineRoom}</button><p>相手が「部屋IDで参加」から入力するとマッチします。</p>`;
  } else if (onlinePhase === "ready") {
    const me = onlinePlayers[playerTeam];
    const opponent = onlinePlayers[playerTeam === "blue" ? "red" : "blue"];
    content = `<div class="eyebrow">対戦相手が見つかりました</div><h2>まもなく工事開始！</h2><div class="match-players"><span>${escapeHtml(onlinePlayers.blue?.name ?? "プレイヤー1")}</span><b>VS</b><span>${escapeHtml(onlinePlayers.red?.name ?? "プレイヤー2")}</span></div>
      <label for="online-name">あなたの名前</label><input id="online-name" maxlength="16" autocomplete="nickname" value="${escapeHtml(nameDraft || me?.name || (playerTeam === "blue" ? "プレイヤー1" : "プレイヤー2"))}">
      <p class="ready-status">${opponent?.ready ? "相手は準備OK！" : "相手の準備を待っています"}</p><button id="online-ready" class="primary" ${me?.ready || !connected ? "disabled" : ""}>${me?.ready ? "準備OK · 相手を待っています" : "準備OK！ 試合へ"}</button>`;
  }
  lobby.innerHTML = `<article class="dialog online-dialog"><button id="online-close" class="circle close-online" aria-label="オンライン対戦を閉じる">${icon("close")}</button>${content}<small class="online-status">${escapeHtml(status)}</small></article>`;
}
function showOnline() {
  mode = "online";
  onlinePhase = "menu";
  onlineStatus = "サーバーに接続中…";
  $("#online-lobby").classList.remove("hidden");
  if (!online) {
    online = new OnlineClient();
    online.onStatus = (status) => {
      onlineStatus =
        status === "connected"
          ? "サーバーに接続しました"
          : status === "reconnecting"
            ? "再接続中… サーバーを確認してください"
            : status === "unavailable"
              ? "公開対戦サーバーの設定が必要です"
              : "接続していません";
      renderOnlineLobby();
      if (mode === "online" && started && status === "reconnecting")
        toast("通信が切れました。再接続しています…");
      if (status === "connected") {
        pingAt = Date.now();
        online?.send({ type: "ping" });
      }
    };
    online.onMessage = handleOnlineMessage;
  }
  online.connect();
  renderOnlineLobby();
}
function enterOnlineGame(startAt = 0, serverNow = 0) {
  if (started) return;
  sound.unlock();
  state = createGame();
  lastEvent = 0;
  started = true;
  paused = false;
  selected = null;
  bridgeContext = null;
  shownHp = { blue: M.castle.hp, red: M.castle.hp };
  world.reset();
  visualPositions.clear();
  world.setHomeTeam(playerTeam);
  $("#title").classList.add("hidden");
  $("#online-lobby").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#latency").classList.remove("hidden");
  $("#result").classList.add("hidden");
  sound.setMusicScene("game");
  syncSoundButtons();
  beginIntro(Math.max(0, startAt - serverNow));
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
    onlineRoom = message.roomId;
    playerTeam = message.team;
    onlinePlayers = message.players;
    onlinePhase = message.phase;
    if (message.phase === "playing")
      enterOnlineGame(message.startAt, message.serverNow);
    else if (message.phase === "waiting" || message.phase === "ready") {
      if (started && (introActive || state.status === "finished")) {
        cancelIntro();
        started = false;
        $("#result").classList.add("hidden");
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
  } else if (message.type === "state") {
    if (mode !== "online") return;
    enterOnlineGame();
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
    onlineStatus = message.message;
    renderOnlineLobby();
    toast(message.message);
  } else if (message.type === "opponent_disconnected") {
    toast("相手が切断されました。30秒間、復帰を待ちます");
  } else if (message.type === "rematch") {
    toast("相手の再戦を待っています");
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
  const tutorialAction =
    tutorialStage === "mine"
      ? "mine"
      : tutorialStage === "build"
        ? "build"
        : tutorialStage === "march"
          ? "march"
          : null;
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
  if (tutorialStage === "mine") setTutorialStage("gather");
  else if (tutorialStage === "build") setTutorialStage("construction");
  else if (tutorialStage === "march") {
    tutorialMarchBot = selected;
    setTutorialStage("attack");
  }
  const actingBot = state.bots.find((b) => b.id === selected);
  if (actingBot && action !== "cancel")
    worldPop(actingBot.position, action === "march" ? "rush" : "command");
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
  $("#resources").innerHTML = (["soil", "stone", "iron"] as const)
    .map(
      (r) =>
        `<div class="resource ${r}">${resourceIcon(r)}<span>${resourceNames[r]}<b>${state.teams[playerTeam].resources[r]}</b></span></div>`,
    )
    .join("");
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
  $("#hint").innerHTML = !bridge.level
    ? `${resourceIcon("stone")} <span>石を50集めて、手前の橋をつくろう</span>`
    : bridge.blockedBy
      ? `${icon("clear")} <span>道がふさがれた！ <b>土をどける</b>と通れるよ</span>`
      : `${icon("march")} <span>橋ができた！ <b>攻める</b>で相手の城へ。あと${state.teams[playerTeam === "blue" ? "red" : "blue"].hp}回！</span>`;
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
              (tutorialStage &&
              a !==
                (tutorialStage === "mine"
                  ? "mine"
                  : tutorialStage === "build"
                    ? "build"
                    : tutorialStage === "march"
                      ? "march"
                      : null)
                ? "練習の案内に進もう"
                : null);
            return `<button data-action="${a}" ${reason ? "disabled" : ""} title="${reason ?? labels[a]}" class="action ${a === "march" ? "rush" : ""}">${icon(a)}<span><b>${labels[a]}</b><small>${costText(a)}</small></span></button>`;
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
    `<article class="dialog"><div class="eyebrow">あそびかた</div><h2>橋をつくって、相手の城へ！</h2><p>5体のBotに仕事をお願いしよう。<br>相手の城に${M.castle.hp}回たどり着けば勝ち。</p><div class="guide-steps"><div>${icon("mine")}<b>01 掘る</b><p>Botをタップして「掘る」。<br>石・土・鉄を集めよう。</p></div><div>${icon("build")}<b>02 橋をつくる</b><p>石が50あれば橋をつくれる。<br>真ん中の橋は現地をタップ。</p></div><div>${icon("march")}<b>03 攻める</b><p>橋ができたら「攻める」。<br>城を一度たたいて戻るよ。</p></div></div><p class="guide-extra">土を盛って相手の道をふさいだり、重機で土をどけて自分の道を開いたりできるよ。橋を強くする・直す・壊す作業もできる。資源が足りない行動は灰色になるよ。</p><p class="guide-extra">途中でやめられるのは「掘る」だけ。地震に備えて橋を直しながら、6分以内に攻めよう。</p><button id="modal-close" class="primary">わかった！ ${icon("march")}</button><small class="keyboard-note">ドラッグで移動、ピンチ・ホイールで拡大縮小、2本指・右ドラッグで回転。PCは1〜5でBot選択、Escで閉じる。</small></article>`;
}
function showPause() {
  paused = true;
  sound.pauseMusic();
  clearTimeout(modalCloseTimer);
  $("#modal").classList.remove("hidden", "leaving");
  $("#modal").innerHTML =
    `<article class="dialog compact"><div class="eyebrow">TAKE A BREAK</div><h2>ちょっと、ひと休み。</h2><p>${mode === "online" ? "オンラインの試合は進行中です。" : "CPUとタイマーも停止しています。"}</p><button id="modal-close" class="primary">工事を再開 ${icon("march")}</button><button id="back-title" class="secondary">タイトルへ戻る</button></article>`;
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
  online?.leave();
  online?.close();
  $("#online-lobby").classList.add("hidden");
  onlinePhase = "menu";
  onlineRoom = "";
  mode = "cpu";
}
function finish() {
  if (!$("#result").classList.contains("hidden")) return;
  closePanel();
  const win = state.winner === playerTeam,
    draw = state.winner === "draw";
  $("#result").classList.remove("hidden");
  $("#result").innerHTML =
    `<article class="result-card ${win ? "victory" : ""}"><div class="result-crown">${icon("crown")}</div><div class="eyebrow">ゲーム終了</div><h2>${draw ? "引き分け！" : win ? "道をつないだ。<br>勝利をつかんだ！" : "次こそ、<br>勝利への道を。"}</h2><p>${draw ? "最後まで守り切りました。次の工事で決着を。" : win ? "5体の小さなBotたちに、大きな拍手を。" : "掘るBotと攻めるBotの配分、相手の道をふさぐタイミングがカギ。"}</p><div class="result-score"><span class="blue">${state.teams.blue.hp}</span><small>城の残り</small><span class="red">${state.teams.red.hp}</span></div><div class="result-stats"><div><b>${state.teams[playerTeam].stats.mined}</b><small>集めた資源</small></div><div><b>${state.teams[playerTeam].stats.built}</b><small>つないだ橋</small></div><div><b>${Math.floor(state.time / 60)}:${Math.floor(
      state.time % 60,
    )
      .toString()
      .padStart(
        2,
        "0",
      )}</b><small>工事時間</small></div></div><button id="restart" class="primary">${mode === "online" ? "同じ相手と再戦" : "もう一戦、つくろう"} ${icon("march")}</button><button id="back-title" class="secondary">タイトルへ戻る</button></article>`;
  sound.play("end");
  sound.setMusicScene(win ? "victory" : "retry");
}
function backTitle() {
  cancelIntro();
  clearTimeout(tutorialCompleteTimer);
  tutorialStage = null;
  $("#tutorial").classList.add("hidden");
  if (mode === "online") {
    online?.leave();
    online?.close();
  }
  mode = "cpu";
  playerTeam = "blue";
  onlineRoom = "";
  onlinePhase = "menu";
  sound.setMusicScene("title");
  started = false;
  paused = false;
  closePanel();
  $("#result").classList.add("hidden");
  $("#modal").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#latency").classList.add("hidden");
  $("#title").classList.remove("hidden");
  state = createGame();
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
  tapBurst(button);
  if (button.dataset.action) doAction(button.dataset.action as Action);
  else if (button.dataset.difficulty) {
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
        sceneTransition(button, startTutorial, 520);
        break;
      case "tutorial-skip":
        sound.play("ui");
        start();
        break;
      case "restart":
        sound.play("ui");
        if (mode === "online") {
          online?.send({ type: "rematch" });
          button.disabled = true;
          button.textContent = "相手の再戦を待っています…";
        } else sceneTransition(button, start, 520);
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
      case "online-join":
        joinDraft = (
          document.querySelector<HTMLInputElement>("#room-id-input")?.value ??
          joinDraft
        )
          .toUpperCase()
          .trim();
        if (!/^[A-Z0-9]{5}$/.test(joinDraft)) {
          onlineStatus = "部屋IDは5文字で入力してください";
          renderOnlineLobby();
        } else online?.send({ type: "join", roomId: joinDraft });
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
          onlineStatus = "部屋IDをコピーしました";
          renderOnlineLobby();
        });
        break;
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
  if (input.id === "room-id-input") {
    input.value = input.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5);
    joinDraft = input.value;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#modal").classList.contains("hidden")) {
    hideModal();
    return;
  }
  if (e.key === "Escape" && !$("#online-lobby").classList.contains("hidden")) {
    closeOnlineLobby();
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
      el.textContent = e.text;
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
  if (mode === "online" && online?.connected && Date.now() - pingAt > 10000) {
    pingAt = Date.now();
    online.send({ type: "ping" });
  }
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
  let displayState = state;
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
  world.update(displayState, dt, elapsed);
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
      const markup = `<b>${b.lock ? "作業中…" : b.blockedBy ? "ふさがれている" : b.damage && b.level ? "直そう" : b.level ? "渡れる" : buildable ? "!" : ""}</b>${b.level ? `<span class="bridge-strength" aria-label="橋の強さ${b.level}段階">${"●".repeat(b.level)}${"○".repeat(3 - b.level)}</span>` : ""}`;
      if (el.innerHTML !== markup) el.innerHTML = markup;
    }
  }
  positionPanel();
  requestAnimationFrame(frame);
}
try {
  world = new World($("#world"));
  world.onPick = (kind, id) => {
    if (!started || paused || introActive || state.status !== "playing") return;
    if (kind === "bot") {
      if (state.bots.find((bot) => bot.id === id)?.team === playerTeam)
        chooseBot(id);
    } else if (kind === "bridge") chooseBridge(id);
    else if (selected) closePanel();
  };
  await Promise.race([
    world.load((n) => {
      $("#loading i").style.width = `${Math.round(n * 100)}%`;
      $("#loading p").textContent =
        `小さなBotたちが準備しています… ${Math.round(n * 100)}%`;
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Asset load timed out")), 45000),
    ),
  ]);
  ready = true;
  $("#loading").classList.add("hidden");
  $("#title").classList.remove("hidden");
  sound.setMusicScene("title");
  requestAnimationFrame(frame);
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
        advance: simulate,
        metrics: () => world.metrics(),
        setCpu: (level: Difficulty) => {
          cpu = new CPU(level);
        },
        setCpuEnabled: (enabled: boolean) => {
          cpuEnabled = enabled;
        },
        quake: () => {
          state.nextQuake = state.time + 1;
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
  const loadingFailed =
    error instanceof Error && /fetch|load|network|timeout/i.test(error.message);
  $("#loading").innerHTML =
    `<div class="dialog"><h2>準備中に問題が発生しました</h2><p>${loadingFailed ? "ゲームデータの読み込みが止まりました。通信を確認して、もう一度お試しください。" : "3D描画を開始できませんでした。WebGL対応ブラウザでお試しください。"}</p><button onclick="location.reload()" class="primary">再読み込み</button></div>`;
}
// QA hooks are removed from production builds by Vite.
