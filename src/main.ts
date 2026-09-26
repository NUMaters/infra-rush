import "./style.css";
import { M } from "./game/master";
import type { Difficulty } from "./game/master";
import { canCommand, command, createGame, taskSpec, tick } from "./game/engine";
import { CPU } from "./game/cpu";
import { resolveTaskTarget } from "./game/intent";
import type { Action, Resource } from "./game/types";
import { World } from "./render/world";
import { Sound } from "./ui/audio";
import { icon } from "./ui/icons";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
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
 <div class="title-top"><span class="edition">CIVIL ENGINEERING STRATEGY</span><button class="circle help" aria-label="遊び方">?</button></div>
 <div class="title-copy"><div class="logo"><span>INFRA</span><b>RUSH<span class="logo-dot">!</span></b></div><h1>勝利への道を、つくろう。</h1><p>5体のBot。3つの橋。ひとつの勝利。<br>掘って、つないで、相手の城へ。</p></div>
 <div class="start-card"><label for="difficulty">CPUの強さ</label><div class="difficulty-options"><button data-difficulty="easy">はじめて</button><button data-difficulty="normal" class="active">スタンダード</button><button data-difficulty="hard">チャレンジ</button></div><button id="start" class="primary">${icon("helmet")}<span>工事をはじめる<small>PLAYER vs CPU</small></span>${icon("march")}</button><p>1ゲーム 6分 · 先に城を5回たたけば勝ち</p></div>
 <div class="title-footer"><span>BUILD. CONNECT. RUSH.</span><span>音声ONがおすすめ ${icon("sound")}</span></div>
</section>
<section id="hud" class="hidden">
 <header class="match-header"><div class="team-score blue" id="blue-score"><div class="score-top"><span>${icon("castle")}<small>あなたの城</small></span><b id="blue-hp-count">${M.castle.hp}<em>/${M.castle.hp}</em></b></div><div class="health-meter" id="blue-hp" role="progressbar" aria-label="あなたの城の残り" aria-valuemin="0" aria-valuemax="${M.castle.hp}"></div></div><div class="timer"><small>のこり時間</small><b id="timer">06:00</b></div><div class="team-score red" id="red-score"><div class="score-top"><span>${icon("castle")}<small>相手の城</small></span><b id="red-hp-count">${M.castle.hp}<em>/${M.castle.hp}</em></b></div><div class="health-meter" id="red-hp" role="progressbar" aria-label="相手の城の残り" aria-valuemin="0" aria-valuemax="${M.castle.hp}"></div></div></header>
 <div class="resource-bar" id="resources"></div>
 <div class="utilities"><button id="sound" class="circle" aria-label="BGMと効果音を切り替え" aria-pressed="false">${icon("sound")}</button><button id="pause" class="circle" aria-label="一時停止">${icon("pause")}</button><button class="circle help" aria-label="遊び方">?</button></div>
 <div id="bridge-labels"></div><div id="floaters" aria-hidden="true"></div>
 <div id="toast" role="status" aria-live="polite"></div>
 <div id="hint" class="field-hint"></div>
 <section id="task-panel" class="hidden" aria-label="Botへの作業指示"></section>
 <div class="corner-brand">INFRA <b>RUSH</b></div>
</section>
<section id="modal" class="overlay hidden"></section>
<section id="result" class="overlay hidden"></section>`;
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
const resourceNames: Record<Resource, string> = {
  soil: "土",
  stone: "石",
  iron: "鉄",
};
const botName = (i: number) => ["アオ", "ソラ", "リク", "ナギ", "ウミ"][i];
let toastTimer: ReturnType<typeof setTimeout>;
let shownHp: Record<"blue" | "red", number> = {
  blue: M.castle.hp,
  red: M.castle.hp,
};
function toast(text: string) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function chooseBot(id: string, context: string | null = null) {
  selected = id;
  bridgeContext = context;
  world.setSelected(id);
  sound.unlock();
  sound.play("select");
  $("#task-panel").classList.remove("hidden");
  renderUI();
}
function chooseBridge(id: string) {
  if (!started || paused || state.status !== "playing") return;
  const bot =
    selected ??
    state.bots.find((b) => b.team === "blue" && b.state === "IDLE")?.id ??
    "blue-0";
  chooseBot(bot, id === "center" ? id : null);
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
  $("#task-panel").classList.add("hidden");
  renderUI();
}
function start() {
  if (!ready) return;
  sound.unlock();
  sound.play("complete");
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
  $("#title").classList.add("hidden");
  $("#hud").classList.remove("hidden");
  $("#result").classList.add("hidden");
  $("#modal").classList.add("hidden");
  $("#task-panel").classList.add("hidden");
  renderUI();
  sound.startMusic();
  toast("まずは青いBotをタップして、掘ってみよう！");
}
function doAction(action: Action | "cancel") {
  if (!selected) return;
  const target = resolveTaskTarget(state, "blue", action, bridgeContext);
  const r = command(state, "blue", { botId: selected, action, target });
  if (!r.ok) {
    toast(r.reason!);
    return;
  }
  sound.play("command");
  toast(
    action === "cancel"
      ? "掘るのをやめて戻ります"
      : `${botName(state.bots.find((b) => b.id === selected)!.index)}が「${labels[action]}」を始めます`,
  );
  closePanel();
}
function costText(action: Action) {
  const b = state.bridges.find(
      (b) => b.id === resolveTaskTarget(state, "blue", action, bridgeContext),
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
  $("#timer").textContent = `${Math.floor(remain / 60)
    .toString()
    .padStart(2, "0")}:${(remain % 60).toString().padStart(2, "0")}`;
  $("#resources").innerHTML = (["soil", "stone", "iron"] as const)
    .map(
      (r) =>
        `<div class="resource ${r}">${icon(r)}<span>${resourceNames[r]}<b>${state.teams.blue.resources[r]}</b></span></div>`,
    )
    .join("");
  const bridge = state.bridges[0];
  $("#hint").innerHTML = !bridge.level
    ? `${icon("stone")} <span>石を50集めて、手前の橋をつくろう</span>`
    : bridge.blockedBy
      ? `${icon("clear")} <span>道がふさがれた！ <b>土をどける</b>と通れるよ</span>`
      : `${icon("march")} <span>橋ができた！ <b>攻める</b>で相手の城へ。あと${state.teams.red.hp}回！</span>`;
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
            const reason = canCommand(state, "blue", {
              botId: b.id,
              action: a,
              target: resolveTaskTarget(state, "blue", a, bridgeContext),
            });
            return `<button data-action="${a}" ${reason ? "disabled" : ""} title="${reason ?? labels[a]}" class="action ${a === "march" ? "rush" : ""}">${icon(a)}<span><b>${labels[a]}</b><small>${costText(a)}</small></span></button>`;
          })
          .join(
            "",
          )}</div>${b.action === "mine" ? '<button id="cancel-mine" class="cancel-mine">掘るのをやめる</button>' : ""}${bridgeContext === "center" ? '<p class="panel-tip">真ん中の橋で作業</p>' : ""}`
  }`,
    );
  }
}
function showHelp() {
  paused = true;
  sound.pauseMusic();
  sound.unlock();
  $("#modal").classList.remove("hidden");
  $("#modal").innerHTML =
    `<article class="dialog"><div class="eyebrow">あそびかた</div><h2>橋をつくって、相手の城へ！</h2><p>5体のBotに仕事をお願いしよう。<br>相手の城に5回たどり着けば勝ち。</p><div class="guide-steps"><div>${icon("mine")}<b>01 掘る</b><p>Botをタップして「掘る」。<br>石・土・鉄を集めよう。</p></div><div>${icon("build")}<b>02 橋をつくる</b><p>石が50あれば橋をつくれる。<br>真ん中の橋は現地をタップ。</p></div><div>${icon("march")}<b>03 攻める</b><p>橋ができたら「攻める」。<br>城を一度たたいて戻るよ。</p></div></div><p class="guide-extra">土を盛って相手の道をふさいだり、重機で土をどけて自分の道を開いたりできるよ。橋を強くする・直す・壊す作業もできる。資源が足りない行動は灰色になるよ。</p><p class="guide-extra">途中でやめられるのは「掘る」だけ。地震に備えて橋を直しながら、6分以内に攻めよう。</p><button id="modal-close" class="primary">わかった！ ${icon("march")}</button><small class="keyboard-note">ドラッグで移動、ピンチ・ホイールで拡大縮小、2本指・右ドラッグで回転。PCは1〜5でBot選択、Escで閉じる。</small></article>`;
}
function showPause() {
  paused = true;
  sound.pauseMusic();
  $("#modal").classList.remove("hidden");
  $("#modal").innerHTML =
    `<article class="dialog compact"><div class="eyebrow">TAKE A BREAK</div><h2>ちょっと、ひと休み。</h2><p>CPUとタイマーも停止しています。</p><button id="modal-close" class="primary">工事を再開 ${icon("march")}</button><button id="back-title" class="secondary">タイトルへ戻る</button></article>`;
}
function finish() {
  sound.stopMusic();
  closePanel();
  const win = state.winner === "blue",
    draw = state.winner === "draw";
  $("#result").classList.remove("hidden");
  $("#result").innerHTML =
    `<article class="result-card ${win ? "victory" : ""}"><div class="result-crown">${icon("crown")}</div><div class="eyebrow">ゲーム終了</div><h2>${draw ? "引き分け！" : win ? "道をつないだ。<br>勝利をつかんだ！" : "次こそ、<br>勝利への道を。"}</h2><p>${draw ? "最後まで守り切りました。次の工事で決着を。" : win ? "5体の小さなBotたちに、大きな拍手を。" : "掘るBotと攻めるBotの配分、相手の道をふさぐタイミングがカギ。"}</p><div class="result-score"><span class="blue">${state.teams.blue.hp}</span><small>城の残り</small><span class="red">${state.teams.red.hp}</span></div><div class="result-stats"><div><b>${state.teams.blue.stats.mined}</b><small>集めた資源</small></div><div><b>${state.teams.blue.stats.built}</b><small>つないだ橋</small></div><div><b>${Math.floor(state.time / 60)}:${Math.floor(
      state.time % 60,
    )
      .toString()
      .padStart(
        2,
        "0",
      )}</b><small>工事時間</small></div></div><button id="restart" class="primary">もう一戦、つくろう ${icon("march")}</button><button id="back-title" class="secondary">タイトルへ戻る</button></article>`;
  sound.play("end");
}
function backTitle() {
  sound.stopMusic();
  started = false;
  paused = false;
  closePanel();
  $("#result").classList.add("hidden");
  $("#modal").classList.add("hidden");
  $("#hud").classList.add("hidden");
  $("#title").classList.remove("hidden");
  state = createGame();
  world.reset();
}
app.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button || button.disabled) return;
  if (button.dataset.action) doAction(button.dataset.action as Action);
  else if (button.dataset.difficulty) {
    difficulty = button.dataset.difficulty as Difficulty;
    document
      .querySelectorAll("[data-difficulty]")
      .forEach((x) =>
        x.classList.toggle(
          "active",
          (x as HTMLElement).dataset.difficulty === difficulty,
        ),
      );
  } else if (button.classList.contains("help")) showHelp();
  else
    switch (button.id) {
      case "start":
      case "restart":
        start();
        break;
      case "close-panel":
        closePanel();
        break;
      case "cancel-mine":
        doAction("cancel");
        break;
      case "sound":
        sound.unlock();
        sound.muted = !sound.muted;
        if (!sound.muted && !paused) sound.resumeMusic();
        button.classList.toggle("muted", sound.muted);
        button.setAttribute("aria-pressed", String(sound.muted));
        break;
      case "pause":
        showPause();
        break;
      case "modal-close":
        $("#modal").classList.add("hidden");
        paused = false;
        if (started && state.status === "playing") sound.resumeMusic();
        break;
      case "back-title":
        backTitle();
        break;
    }
});
document.addEventListener("keydown", (e) => {
  if (!started || paused || state.status !== "playing") return;
  if (/^[1-5]$/.test(e.key)) chooseBot(`blue-${Number(e.key) - 1}`);
  if (e.key === "Escape") closePanel();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started && state.status === "playing") showPause();
});
let accumulator = 0,
  last = performance.now(),
  uiClock = 0;
function processEvents() {
  for (const e of state.events) {
    if (e.id <= lastEvent) continue;
    world.effect(e);
    if (
      e.team === "blue" ||
      ["earthquake", "warning", "end", "collapse"].includes(e.kind)
    )
      sound.play(e.kind);
    if (
      e.kind === "earthquake" ||
      e.kind === "warning" ||
      e.kind === "collapse" ||
      (e.team === "blue" && e.kind === "complete")
    )
      toast(e.text);
    if (
      e.position &&
      e.team === "blue" &&
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
function simulate(seconds: number) {
  const steps = Math.round(seconds / M.game.tick);
  for (let i = 0; i < steps; i++) {
    if (cpuEnabled) cpu.update(state);
    tick(state, M.game.tick);
  }
  processEvents();
  renderUI();
}
function frame(now: number) {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(0.1, elapsed);
  last = now;
  if (started && !paused && !qaFrozen && state.status === "playing") {
    accumulator += dt;
    while (accumulator >= M.game.tick) {
      if (cpuEnabled) cpu.update(state);
      tick(state, M.game.tick);
      accumulator -= M.game.tick;
    }
    processEvents();
  }
  world.update(state, dt, elapsed);
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
        el.setAttribute(
          "aria-label",
          b.id === "center"
            ? "真ん中の橋"
            : b.id === "blue"
              ? "自分の城につながる橋"
              : "相手の城につながる橋",
        );
        $("#bridge-labels").append(el);
      }
      const p = world.project([b.x, 0], 1);
      el.className = `bridge-label ${b.owner ?? "neutral"} ${b.blockedBy ? "blocked" : ""}`;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      const markup = `<b>${b.lock ? "作業中…" : b.blockedBy ? "ふさがれている" : b.damage && b.level ? "直そう" : b.level ? "渡れる" : "橋をつくる"}</b>${b.level ? `<span class="bridge-strength" aria-label="橋の強さ${b.level}段階">${"●".repeat(b.level)}${"○".repeat(3 - b.level)}</span>` : ""}`;
      if (el.innerHTML !== markup) el.innerHTML = markup;
    }
  }
  positionPanel();
  requestAnimationFrame(frame);
}
try {
  world = new World($("#world"));
  world.onPick = (kind, id) => {
    if (!started || paused || state.status !== "playing") return;
    if (kind === "bot") chooseBot(id);
    else chooseBridge(id);
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
  requestAnimationFrame(frame);
  $("#bridge-labels").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-target]");
    if (b) chooseBridge(b.dataset.target!);
  });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa")) {
    const qaControls = document.createElement("aside");
    qaControls.id = "qa-controls";
    qaControls.style.cssText =
      "position:fixed;left:8px;top:8px;z-index:100;background:#fff;padding:6px;border:2px solid #f0b640;border-radius:8px;font-size:11px";
    qaControls.innerHTML =
      '<b>QA</b> <button data-seconds="15">+15秒</button> <button data-seconds="30">+30秒</button> <button id="qa-freeze">時計停止</button><small id="qa-metrics" style="display:block;max-width:270px;font-size:8px"></small>';
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
