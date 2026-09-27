import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Action, GameState } from "../../src/game/types";
declare global {
  interface Window {
    infraQA: {
      snapshot: () => GameState;
      attractSnapshot: () => GameState;
      advance: (s: number) => void;
      metrics: () => Record<string, number>;
      inspectVehicle: (id: string) => {
        asset: string;
        output: number[] | null;
        girder: number[] | null;
        bitAxis: number[] | null;
        bitRotation: number[] | null;
        helmetTop: number | null;
        roofTop: number | null;
      } | null;
      quake: () => void;
      setCpuEnabled: (enabled: boolean) => void;
      setCpu: (difficulty: "easy" | "normal" | "hard") => void;
      setResources: (
        team: "blue" | "red",
        resources: Partial<Record<"soil" | "stone" | "iron", number>>,
      ) => void;
      setBridge: (
        id: string,
        patch: Partial<GameState["bridges"][number]>,
      ) => void;
      suppressQuake: () => void;
      projectBot: (id: string) => { x: number; y: number };
      projectBridge: (id: string) => { x: number; y: number };
      command: (
        team: "blue" | "red",
        botId: string,
        action: Action,
        target?: string,
      ) => { ok: boolean; reason?: string };
      focus: (x: number, z: number, zoom?: number) => void;
    };
  }
}
test("map bridge taps expose central reinforcement and pre-construction embankment", async ({
  page,
}) => {
  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible({ timeout: 60000 });
  await expect(
    page.locator("#online-start svg").first().locator("circle"),
  ).toHaveCount(2);
  await page.locator("#online-start").click();
  await page.locator("#room-id-input").click();
  await expect(page.locator(".room-keypad")).toBeVisible();
  await page.locator("#online-close").click();
  await page.locator("#online-start").click();
  await expect(page.locator(".room-keypad")).toHaveCount(0);
  await page.locator("#online-close").click();
  await page.locator("#start").click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await page.evaluate(() => {
    window.infraQA.setCpuEnabled(false);
    window.infraQA.suppressQuake();
    window.infraQA.setResources("blue", { soil: 100, stone: 100, iron: 100 });
    window.infraQA.setBridge("blue", { owner: "blue", level: 1, capacity: 1 });
    window.infraQA.setBridge("center", {
      owner: "blue",
      level: 1,
      capacity: 1,
    });
  });
  const center = await page.evaluate(() =>
    window.infraQA.projectBridge("center"),
  );
  await page.mouse.click(center.x, center.y);
  await expect(page.locator("#task-panel")).toBeVisible();
  await expect(page.locator('[data-action="upgrade"]')).toBeEnabled();
  await page.locator('[data-action="upgrade"]').click();
  await advance(page, 35);
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[1].level,
  ).toBe(2);
  const enemy = await page.evaluate(() => window.infraQA.projectBridge("red"));
  await page.mouse.click(enemy.x, enemy.y);
  await expect(page.locator("#task-panel")).toBeVisible();
  await expect(page.locator('[data-action="embank"]')).toBeEnabled();
  await page.locator('[data-action="embank"]').click();
  await advance(page, 35);
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[2],
  ).toMatchObject({ level: 0, blockedBy: "blue" });
});
async function selectBot(page: Page, index: number) {
  if (await page.locator("#close-panel").isVisible()) {
    await page.keyboard.press("Escape");
    await expect(page.locator("#task-panel")).toBeHidden();
  }
  const p = await page.evaluate(
    (i) => window.infraQA.projectBot(`blue-${i}`),
    index,
  );
  await page.mouse.click(p.x, p.y);
  await expect(page.locator("#task-panel")).toBeVisible();
}
const advance = (page: Page, s: number) =>
  page.evaluate((seconds) => window.infraQA.advance(seconds), s);
test("real UI: mine, build, march, attack, return, fifteen hits, results and restart", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: `docs/qa/${info.project.name}-title.png` });
  await page.locator("#start").click();
  await page.getByRole("button", { name: "かんたん", exact: true }).click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await expect(page.locator("#bot-roster")).toHaveCount(0);
  // Direct 3D Bot hit testing, then on-screen task control.
  const p = await page.evaluate(() => window.infraQA.projectBot("blue-0"));
  await page.mouse.click(p.x, p.y);
  await expect(page.locator("#task-panel")).toBeVisible();
  // Freeze only wall-clock progression; advance runs the real simulation and CPU.
  await page.getByRole("button", { name: "時計停止", exact: true }).click();
  await page
    .locator('[data-action="build"]')
    .isDisabled()
    .then((v) => expect(v).toBe(true));
  await page.locator('[data-action="mine"]').click();
  for (let i = 1; i < 5; i++) {
    await selectBot(page, i);
    await page.locator('[data-action="mine"]').click();
  }
  await advance(page, 32);
  let s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.teams.blue.resources.stone).toBeGreaterThanOrEqual(50);
  expect(s.teams.blue.resources.iron).toBeGreaterThan(0);
  await selectBot(page, 0);
  await page.screenshot({ path: `docs/qa/${info.project.name}-mining.png` });
  await page.locator('[data-action="build"]').click();
  await advance(page, 23);
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.bridges[0].level).toBe(1);
  const readyBot = await page.evaluate(() =>
    window.infraQA.projectBot("blue-0"),
  );
  if (info.project.name === "mobile")
    await page.touchscreen.tap(readyBot.x, readyBot.y);
  else await page.mouse.click(readyBot.x, readyBot.y);
  await expect(page.locator("#task-panel")).toBeVisible();
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.bots[0].action).toBeNull();
  expect(s.teams.red.hp).toBe(15);
  await page.locator('[data-action="march"]').click();
  await advance(page, 14);
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.teams.red.hp).toBe(14);
  await expect(page.locator("#impact-flash")).toHaveClass(/active/);
  expect(s.bots[0].state).toBe("IDLE");
  expect(s.bots[0].position).toEqual(s.bots[0].home);
  await page.screenshot({ path: `docs/qa/${info.project.name}-bridge.png` });
  for (let i = 1; i < 5; i++) {
    await selectBot(page, i);
    await page.locator('[data-action="march"]').click();
  }
  await advance(page, 25);
  for (let wave = 0; wave < 2; wave++) {
    for (let i = 0; i < 5; i++) {
      await selectBot(page, i);
      await page.locator('[data-action="march"]').click();
    }
    await advance(page, 25);
  }
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#bgm-victory")).toHaveJSProperty("paused", false);
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.winner).toBe("blue");
  expect(s.teams.red.hp).toBe(0);
  await page.screenshot({ path: `docs/qa/${info.project.name}-result.png` });
  await page.locator("#restart").click();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.teams.blue.resources.stone).toBe(0);
  expect(s.teams.red.hp).toBe(15);
  expect(s.bridges.every((b) => b.level === 0)).toBe(true);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("pause freezes clock, help resumes, sound and bridge targeting respond", async ({
  page,
}) => {
  await page.goto("/?qa");
  await page.locator("#start").click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await page.locator("#pause").click();
  const before = await page.evaluate(() => window.infraQA.snapshot().time);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.infraQA.snapshot().time)).toBe(
    before,
  );
  await page.locator("#modal-close").click();
  await expect(page.locator("#modal")).toBeHidden();
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#qa-freeze").click();
  await expect(page.locator(".bridge-label.empty:visible")).toHaveCount(0);
  const emptyBridge = await page.evaluate(() =>
    window.infraQA.projectBridge("blue"),
  );
  await page.mouse.click(emptyBridge.x, emptyBridge.y);
  await expect(page.locator("#task-panel")).toBeHidden();
  for (let i = 0; i < 5; i++) {
    await selectBot(page, i);
    await page.locator('[data-action="mine"]').click();
  }
  await advance(page, 32);
  await expect(page.locator(".resource.soil img")).toHaveAttribute(
    "src",
    /ui\/resources\/soil.png/,
  );
  await expect(page.locator(".resource.stone img")).toHaveAttribute(
    "src",
    /ui\/resources\/stone.png/,
  );
  await expect(page.locator(".resource.iron img")).toHaveAttribute(
    "src",
    /ui\/resources\/iron.png/,
  );
  const bridge = page.getByRole("button", {
    name: "自分の城につながる橋、つくれる",
  });
  await expect(bridge).toHaveText("!");
  await expect(bridge).toBeVisible();
  await expect(page.locator("#hint")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#task-panel")).toBeHidden();
  await bridge.click();
  await expect(page.locator("#task-panel")).toBeVisible();
  await expect(page.locator('[data-action="build"]')).toBeEnabled();
});

test("civil works: reinforcement, earthquake, repair, embankment, CPU clearance and demolition", async ({
  page,
}, info) => {
  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible({ timeout: 60000 });
  await page.locator("#start").click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await page.evaluate(() => window.infraQA.suppressQuake());
  await page.getByRole("button", { name: "時計停止", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await selectBot(page, i);
    await page.locator('[data-action="mine"]').click();
  }
  await advance(page, 60);
  // CPU earns and spends its own resources to build its bridge.
  let state = await page.evaluate(() => window.infraQA.snapshot());
  expect(state.bridges[2].level).toBeGreaterThan(0);
  await page.evaluate(() => window.infraQA.setCpuEnabled(false));
  const order = async (action: string) => {
    await selectBot(page, 0);
    await page.locator(`[data-action="${action}"]`).click();
  };
  await order("build");
  await advance(page, 25);
  await order("upgrade");
  await advance(page, 20);
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[0].level,
  ).toBe(2);
  // Schedule the real earthquake path; do not write bridge state or resources.
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.infraQA.quake());
    await advance(page, 2);
    state = await page.evaluate(() => window.infraQA.snapshot());
    if (state.bridges[0].damage) break;
  }
  expect(state.bridges[0].damage).toBeGreaterThan(0);
  await page.screenshot({ path: `docs/qa/${info.project.name}-quake.png` });
  await order("repair");
  await advance(page, 20);
  state = await page.evaluate(() => window.infraQA.snapshot());
  expect(state.bridges[0].damage).toBe(0);
  expect(state.bridges[0].level).toBe(2);
  await order("embank");
  await advance(page, 22);
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[2].blockedBy,
  ).toBe("blue");
  await page.screenshot({
    path: `docs/qa/${info.project.name}-embankment.png`,
  });
  await page.evaluate(() => window.infraQA.setCpuEnabled(true));
  for (let i = 0; i < 30; i++) {
    await advance(page, 1);
    if (
      !(await page.evaluate(() => window.infraQA.snapshot())).bridges[2]
        .blockedBy
    )
      break;
  }
  await page.evaluate(() => window.infraQA.setCpuEnabled(false));
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[2].blockedBy,
  ).toBe(null);
  await advance(page, 2);
  state = await page.evaluate(() => window.infraQA.snapshot());
  const previousLevel = state.bridges[2].level;
  await order("destroy");
  await advance(page, 25);
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[2].level,
  ).toBe(previousLevel - 1);
  await page.screenshot({
    path: `docs/qa/${info.project.name}-demolition.png`,
  });
});

test("camera: own team in foreground, gesture controls and compact direct commands", async ({
  page,
}, info) => {
  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible({ timeout: 60000 });
  await page.locator("#start").click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await page.getByRole("button", { name: "時計停止", exact: true }).click();
  const project = (id: string) =>
    page.evaluate((id) => window.infraQA.projectBot(id), id);
  const blue = await project("blue-0"),
    red = await project("red-0");
  expect(blue.y).toBeGreaterThan(red.y);
  await expect(page.locator("#bot-roster")).toHaveCount(0);
  await expect(page.locator("#hud .zoom")).toHaveCount(0);
  const viewport = page.viewportSize()!;
  const start = { x: viewport.width * 0.28, y: viewport.height * 0.72 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 65, start.y - 35, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const p = await project("blue-0");
      return Math.hypot(p.x - blue.x, p.y - blue.y);
    })
    .toBeGreaterThan(25);
  await expect(page.locator("#task-panel")).toBeHidden();
  await page.reload();
  await page.locator("#start").click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await page.getByRole("button", { name: "時計停止", exact: true }).click();
  const a = await project("blue-0"),
    b = await project("blue-4");
  const width = Math.hypot(a.x - b.x, a.y - b.y);
  if (info.project.name === "mobile") {
    const client = await page.context().newCDPSession(page);
    const y = viewport.height * 0.55,
      cx = viewport.width * 0.5;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 30, y, id: 1 },
        { x: cx + 30, y, id: 2 },
      ],
    });
    for (let i = 1; i <= 8; i++)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - 30 - i * 4, y, id: 1 },
          { x: cx + 30 + i * 4, y, id: 2 },
        ],
      });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => {
        const a = await project("blue-0"),
          b = await project("blue-4");
        return Math.hypot(a.x - b.x, a.y - b.y);
      })
      .toBeGreaterThan(width * 1.4);
    await expect(page.locator("#task-panel")).toBeHidden();
  } else {
    await page.mouse.move(viewport.width * 0.5, viewport.height * 0.55);
    await page.mouse.wheel(0, -500);
    await expect
      .poll(async () => {
        const first = await project("blue-0"),
          last = await project("blue-4");
        return Math.hypot(first.x - last.x, first.y - last.y);
      })
      .toBeGreaterThan(width * 1.2);
    const beforeRotate = await project("blue-0");
    await page.mouse.move(viewport.width * 0.28, viewport.height * 0.65);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(viewport.width * 0.46, viewport.height * 0.68, {
      steps: 12,
    });
    await page.mouse.up({ button: "right" });
    await expect
      .poll(async () => {
        const after = await project("blue-0");
        return Math.hypot(after.x - beforeRotate.x, after.y - beforeRotate.y);
      })
      .toBeGreaterThan(15);
  }
  await page.reload();
  await page.locator("#start").click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await page.getByRole("button", { name: "時計停止", exact: true }).click();
  await expect
    .poll(async () => {
      const p = await project("blue-0");
      return Math.hypot(p.x - blue.x, p.y - blue.y);
    })
    .toBeLessThan(5);
  await selectBot(page, 0);
  await expect
    .poll(async () => (await page.locator("#task-panel").boundingBox())?.width)
    .toBeLessThanOrEqual(281);
  const panel = await page.locator("#task-panel").boundingBox();
  expect(panel!.height).toBeLessThan(400);
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(viewport.width);
  await expect(page.locator("#task-panel [data-target]")).toHaveCount(0);
  await page.screenshot({
    path: `docs/qa/${info.project.name}-compact-camera.png`,
  });
});
