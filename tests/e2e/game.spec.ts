import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { GameState } from "../../src/game/types";
declare global {
  interface Window {
    infraQA: {
      snapshot: () => GameState;
      advance: (s: number) => void;
      metrics: () => Record<string, number>;
      quake: () => void;
      projectBot: (id: string) => { x: number; y: number };
    };
  }
}
const advance = (page: Page, s: number) =>
  page.evaluate((seconds) => window.infraQA.advance(seconds), s);
test("real UI: mine, build, march, attack, return, five hits, results and restart", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible();
  await page.screenshot({ path: `docs/qa/${info.project.name}-title.png` });
  await page.getByRole("button", { name: "はじめて", exact: true }).click();
  await page.locator("#start").click();
  // Freeze only wall-clock progression; advance runs the real simulation and CPU.
  await page.getByRole("button", { name: "時計停止", exact: true }).click();
  await expect(page.locator("#bot-roster button")).toHaveCount(5);
  // Direct 3D Bot hit testing, then on-screen task control.
  const p = await page.evaluate(() => window.infraQA.projectBot("blue-0"));
  await page.mouse.click(p.x, p.y);
  await expect(page.locator("#task-panel")).toBeVisible();
  await page
    .locator('[data-action="build"]')
    .isDisabled()
    .then((v) => expect(v).toBe(true));
  await page.locator('[data-action="mine"]').click();
  for (let i = 1; i < 5; i++) {
    await page.locator(`[data-bot="blue-${i}"]`).click();
    await page.locator('[data-action="mine"]').click();
  }
  await advance(page, 32);
  let s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.teams.blue.resources.stone).toBeGreaterThanOrEqual(50);
  expect(s.teams.blue.resources.iron).toBeGreaterThan(0);
  await page.locator('[data-bot="blue-0"]').click();
  await page.screenshot({ path: `docs/qa/${info.project.name}-mining.png` });
  await page.locator('[data-action="build"]').click();
  await advance(page, 23);
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.bridges[0].level).toBe(1);
  await page.locator('[data-bot="blue-0"]').click();
  await page.locator('[data-action="march"]').click();
  await advance(page, 14);
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.teams.red.hp).toBe(4);
  expect(s.bots[0].state).toBe("IDLE");
  expect(s.bots[0].position).toEqual(s.bots[0].home);
  await page.screenshot({ path: `docs/qa/${info.project.name}-bridge.png` });
  for (let i = 1; i < 5; i++) {
    await page.locator(`[data-bot="blue-${i}"]`).click();
    await page.locator('[data-action="march"]').click();
  }
  await advance(page, 25);
  await expect(page.locator("#result")).toBeVisible();
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.winner).toBe("blue");
  expect(s.teams.red.hp).toBe(0);
  await page.screenshot({ path: `docs/qa/${info.project.name}-result.png` });
  await page.locator("#restart").click();
  s = await page.evaluate(() => window.infraQA.snapshot());
  expect(s.teams.blue.resources.stone).toBe(0);
  expect(s.teams.red.hp).toBe(5);
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
  await page.locator("#pause").click();
  const before = await page.evaluate(() => window.infraQA.snapshot().time);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.infraQA.snapshot().time)).toBe(
    before,
  );
  await page.locator("#modal-close").click();
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "中央共有橋", exact: true }).click();
  await expect(page.locator('#task-panel [data-target="center"]')).toHaveClass(
    "active",
  );
  await expect(page.locator('[data-action="build"]')).toBeDisabled();
});
