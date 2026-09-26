import "./style.css";
import { M } from "./game/master";
import type { Difficulty } from "./game/master";
import { canCommand, command, createGame, taskSpec, tick } from "./game/engine";
import { CPU } from "./game/cpu";
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
 <header class="match-header"><div class="team-score blue">${icon("crown")}<div><small>あなたの城</small><strong id="blue-hp"></strong></div></div><div class="timer"><small>INFRA RUSH</small><b id="timer">06:00</b></div><div class="team-score red"><div><small>CPUの城</small><strong id="red-hp"></strong></div>${icon("crown")}</div></header>
 <div class="resource-bar" id="resources"></div>
 <div class="utilities"><button id="sound" class="circle" aria-label="音声を切り替え">${icon("sound")}</button><button id="pause" class="circle" aria-label="一時停止">${icon("pause")}</button><button class="circle help" aria-label="遊び方">?</button></div>
 <div class="zoom"><button id="zoom-in" aria-label="拡大">+</button><button id="zoom-out" aria-label="縮小">−</button></div>
 <div id="bridge-labels"></div><div id="floaters" aria-hidden="true"></div>
 <div id="toast" role="status" aria-live="polite"></div>
 <section class="crew"><div class="crew-heading"><span>${icon("helmet")} <b>YOUR CREW</b> <small>作業Botをタップ</small></span><span id="idle-count"></span></div><div id="bot-roster"></div><div id="hint"></div></section>
 <section id="task-panel" class="hidden" aria-label="Botへの作業指示"></section>
 <div class="corner-brand">INFRA <b>RUSH</b></div>
</section>
<section id="modal" class="overlay hidden"></section>
<section id="result" class="overlay hidden"></section>`;
let state = createGame();
let cpu = new CPU();
let difficulty: Difficulty = "normal";
let started = false,
  paused = false,
  selected: string | null = null,
  target = "blue",
  ready = false,
  lastEvent = 0;
const sound = new Sound();
let world: World;
const labels: Record<Action, string> = {
  mine: "採掘",
  build: "架橋",
  upgrade: "補強",
  repair: "修繕",
  embank: "盛土",
  clear: "整地",
  destroy: "橋を壊す",
  march: "進軍",
};
const states: Record<string, string> = {
  IDLE: "待機中",
  MOVING: "移動中",
  MINING: "採掘中",
  BUILDING_BRIDGE: "架橋中",
  UPGRADING_BRIDGE: "補強中",
  REPAIRING_BRIDGE: "修繕中",
  BUILDING_EMBANKMENT: "盛土中",
  CLEARING_EMBANKMENT: "整地中",
  DESTROYING_BRIDGE: "解体中",
  MARCHING: "進軍中",
  ATTACKING_CASTLE: "城を攻撃！",
  RETURNING: "帰還中",
};
const resourceNames: Record<Resource, string> = {
  soil: "土",
  stone: "石",
  iron: "鉄",
};
const botName = (i: number) => ["アオ", "ソラ", "リク", "ナギ", "ウミ"][i];
let toastTimer: ReturnType<typeof setTimeout>;
function toast(text: string) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function chooseBot(id: string) {
  selected = id;
  world.setSelected(id);
  sound.unlock();
  sound.play("select");
  $("#task-panel").classList.remove("hidden");
  renderUI();
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
  lastEvent = 0;
  started = true;
  paused = false;
  selected = null;
  target = "blue";
  world.reset();
  $("#title").classList.add("hidden");
  $("#hud").classList.remove("hidden");
  $("#result").classList.add("hidden");
  $("#modal").classList.add("hidden");
  $("#task-panel").classList.add("hidden");
  renderUI();
  toast("まずは青いBotをタップ → 採掘！");
}
function doAction(action: Action | "cancel") {
  if (!selected) return;
  const r = command(state, "blue", { botId: selected, action, target });
  if (!r.ok) {
    toast(r.reason!);
    return;
  }
  sound.play("command");
  toast(
    action === "cancel"
      ? "採掘を終えて帰還します"
      : `${botName(state.bots.find((b) => b.id === selected)!.index)}に「${labels[action]}」を指示しました`,
  );
  closePanel();
}
function costText(action: Action) {
  const b = state.bridges.find((b) => b.id === target),
    spec = taskSpec(action, b);
  const cost = Object.entries(spec.cost)
    .map(([r, n]) => `${resourceNames[r as Resource]} ${n}`)
    .join(" / ");
  return action === "mine"
    ? "無料 · 自動で資源獲得"
    : action === "march"
      ? "無料 · 敵城へ自動移動"
      : `${cost} · ${spec.seconds}秒`;
}
function renderUI() {
  if (!started) return;
  for (const team of ["blue", "red"] as const)
    $(`#${team}-hp`).innerHTML = Array.from(
      { length: M.castle.hp },
      (_, i) =>
        `<i class="heart ${i < state.teams[team].hp ? "filled" : ""}">♥</i>`,
    ).join("");
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
  const bots = state.bots.filter((b) => b.team === "blue");
  $("#idle-count").textContent =
    `${bots.filter((b) => b.state === "IDLE").length} / 5 待機`;
  html(
    "#bot-roster",
    bots
      .map(
        (b) =>
          `<button class="bot-card ${selected === b.id ? "selected" : ""} ${b.state === "IDLE" ? "idle" : ""}" data-bot="${b.id}" aria-label="Bot ${b.index + 1} ${botName(b.index)} ${states[b.state]}"><span class="bot-portrait">${icon("helmet")}<i>${b.index + 1}</i></span><strong>${botName(b.index)}</strong><small>${states[b.state]}</small>${b.duration && b.state !== "RETURNING" ? `<span class="work-progress" style="width:${Math.min(100, (b.progress / b.duration) * 100)}%"></span>` : ""}</button>`,
      )
      .join(""),
  );
  const bridge = state.bridges[0];
  $("#hint").innerHTML = !bridge.level
    ? `${icon("stone")} <span>採掘で <b>石50</b> → 青専用橋を架けよう</span>`
    : bridge.blockedBy
      ? `${icon("clear")} <span>道が塞がれています。<b>整地</b>で再開通！</span>`
      : `${icon("march")} <span>道がつながった！ <b>進軍</b>で敵城へ。あと${state.teams.red.hp}回！</span>`;
  if (selected) {
    const b = state.bots.find((x) => x.id === selected)!;
    const busy = b.state !== "IDLE" && b.action !== "mine";
    html(
      "#task-panel",
      `<div class="panel-heading"><span class="panel-bot">${icon("helmet")}</span><div><small>BOT ${b.index + 1}</small><h2>${botName(b.index)} <span>${states[b.state]}</span></h2></div><button class="circle" id="close-panel" aria-label="指示パネルを閉じる">${icon("close")}</button></div>
  ${
    busy
      ? `<div class="busy-note">${b.action ? icon(b.action) : ""}<b>${states[b.state]}</b><p>施工と進軍は、完了までおまかせ。</p><div class="busy-progress"><i style="width:${b.duration ? Math.min(100, (b.progress / b.duration) * 100) : 50}%"></i></div></div>`
      : `<div class="target-caption">施工する橋 <span>マップの橋をタップでも選べます</span></div><div class="target-tabs">${state.bridges.map((x) => `<button data-target="${x.id}" class="${target === x.id ? "active" : ""}">${x.id === "blue" ? "青専用" : x.id === "center" ? "中央共有" : "赤専用"}<small>${x.level ? "●".repeat(x.level) + "○".repeat(3 - x.level) : "未建設"}${x.blockedBy ? " · 通行止" : ""}</small></button>`).join("")}</div><div class="actions">${(
          Object.keys(labels) as Action[]
        )
          .map((a) => {
            const reason = canCommand(state, "blue", {
              botId: b.id,
              action: a,
              target,
            });
            return `<button data-action="${a}" ${reason ? "disabled" : ""} title="${reason ?? labels[a]}" class="action ${a === "march" ? "rush" : ""}">${icon(a)}<span><b>${labels[a]}</b><small>${costText(a)}</small></span></button>`;
          })
          .join(
            "",
          )}</div>${b.action === "mine" ? '<button id="cancel-mine" class="cancel-mine">採掘をやめて帰還</button>' : ""}<p class="panel-tip">${target === "red" ? "相手の橋への盛土・破壊で進軍を止めよう。" : target === "center" ? "自軍の専用橋を完成させると建設できます。" : "まず採掘。石50が集まったら、1体に架橋を指示。"}</p>`
  }`,
    );
  }
}
function showHelp() {
  paused = true;
  sound.unlock();
  $("#modal").classList.remove("hidden");
  $("#modal").innerHTML =
    `<article class="dialog"><div class="eyebrow">FIELD GUIDE</div><h2>つくった道が、勝ち筋になる。</h2><p>Bot同士は戦いません。5体の作業Botを使い、<br>相手の城を合計5回たたこう。</p><div class="guide-steps"><div>${icon("mine")}<b>01 掘る</b><p>Botを選んで採掘。<br>石・土・鉄が増えます。</p></div><div>${icon("build")}<b>02 つなぐ</b><p>石50で専用橋を建設。<br>余裕があれば中央橋も。</p></div><div>${icon("march")}<b>03 進む</b><p>進軍すると自動で攻撃。<br>一発たたいて帰還！</p></div></div><p class="guide-extra">土30の盛土で敵の道をふさぎ、鉄10の整地で自分の道を復旧。鉄で補強・修繕・橋の破壊も。資源や条件が足りない作業は灰色になります。</p><p class="guide-extra">中断できるのは採掘だけ。有限作業が終わると自城へ帰還します。地震は両軍共通、時間切れは引き分けです。</p><button id="modal-close" class="primary">わかった、工事を始めよう ${icon("march")}</button><small class="keyboard-note">PC: 1〜5でBot選択 / Escで閉じる · スマホ: タップで指示</small></article>`;
}
function showPause() {
  paused = true;
  $("#modal").classList.remove("hidden");
  $("#modal").innerHTML =
    `<article class="dialog compact"><div class="eyebrow">TAKE A BREAK</div><h2>ちょっと、ひと休み。</h2><p>CPUとタイマーも停止しています。</p><button id="modal-close" class="primary">工事を再開 ${icon("march")}</button><button id="back-title" class="secondary">タイトルへ戻る</button></article>`;
}
function finish() {
  closePanel();
  const win = state.winner === "blue",
    draw = state.winner === "draw";
  $("#result").classList.remove("hidden");
  $("#result").innerHTML =
    `<article class="result-card ${win ? "victory" : ""}"><div class="result-crown">${icon("crown")}</div><div class="eyebrow">${draw ? "TIME UP" : win ? "MISSION COMPLETE" : "NEXT CONSTRUCTION"}</div><h2>${draw ? "引き分け！" : win ? "道をつないだ。<br>勝利をつかんだ！" : "次こそ、<br>勝利への道を。"}</h2><p>${draw ? "最後まで守り切りました。次の工事で決着を。" : win ? "5体の小さなBotたちに、大きな拍手を。" : "採掘と進軍の人数、相手の道への盛土がカギ。"}</p><div class="result-score"><span class="blue">${state.teams.blue.hp}</span><small>城の残りHP</small><span class="red">${state.teams.red.hp}</span></div><div class="result-stats"><div><b>${state.teams.blue.stats.mined}</b><small>採掘した資源</small></div><div><b>${state.teams.blue.stats.built}</b><small>つないだ橋</small></div><div><b>${Math.floor(state.time / 60)}:${Math.floor(
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
  if (button.dataset.bot) chooseBot(button.dataset.bot);
  else if (button.dataset.target) {
    target = button.dataset.target;
    sound.play("select");
    renderUI();
  } else if (button.dataset.action) doAction(button.dataset.action as Action);
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
        button.classList.toggle("muted", sound.muted);
        button.setAttribute("aria-pressed", String(sound.muted));
        break;
      case "pause":
        showPause();
        break;
      case "modal-close":
        $("#modal").classList.add("hidden");
        paused = false;
        break;
      case "back-title":
        backTitle();
        break;
      case "zoom-in":
        world.setZoom(0.15);
        break;
      case "zoom-out":
        world.setZoom(-0.15);
        break;
    }
});
document.addEventListener("keydown", (e) => {
  if (!started) return;
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
    cpu.update(state);
    tick(state, M.game.tick);
  }
  processEvents();
  renderUI();
}
function frame(now: number) {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(0.1, elapsed);
  last = now;
  if (started && !paused && state.status === "playing") {
    accumulator += dt;
    while (accumulator >= M.game.tick) {
      cpu.update(state);
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
          b.id === "blue"
            ? "青専用橋"
            : b.id === "center"
              ? "中央共有橋"
              : "赤専用橋",
        );
        $("#bridge-labels").append(el);
      }
      const p = world.project([b.x, 0], 1);
      el.className = `bridge-label ${b.owner ?? "neutral"} ${b.blockedBy ? "blocked" : ""}`;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      const markup = `<span>${b.id === "center" ? "中央共有" : b.id === "blue" ? "青専用" : "赤専用"}</span><b>${b.lock ? "施工中…" : b.blockedBy ? "通行止" : b.level ? "●".repeat(b.level) + "○".repeat(3 - b.level) : "＋ 架橋"}</b>${b.damage && b.level ? "<i>要修繕</i>" : ""}`;
      if (el.innerHTML !== markup) el.innerHTML = markup;
    }
  }
  requestAnimationFrame(frame);
}
try {
  world = new World($("#world"));
  world.onPick = (kind, id) => {
    if (!started || paused || state.status !== "playing") return;
    if (kind === "bot") chooseBot(id);
    else {
      target = id;
      if (!selected)
        chooseBot(
          state.bots.find((b) => b.team === "blue" && b.state === "IDLE")?.id ??
            "blue-0",
        );
      renderUI();
    }
  };
  await Promise.race([
    world.load((n) => {
      $("#loading i").style.width = `${Math.round(n * 100)}%`;
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
    if (b) {
      target = b.dataset.target!;
      if (!selected)
        chooseBot(
          state.bots.find((b) => b.team === "blue" && b.state === "IDLE")?.id ??
            "blue-0",
        );
      renderUI();
    }
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
        paused = !paused;
        button.textContent = paused ? "時計再開" : "時計停止";
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
  $("#loading").innerHTML =
    '<div class="dialog"><h2>準備中に問題が発生しました</h2><p>WebGLが利用できるブラウザで再読み込みしてください。</p><button onclick="location.reload()" class="primary">再読み込み</button></div>';
}
// QA hooks are removed from production builds by Vite.
