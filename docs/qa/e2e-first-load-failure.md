# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: game.spec.ts >> real UI: mine, build, march, attack, return, five hits, results and restart
- Location: tests/e2e/game.spec.ts:17:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#start')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" locator('#start') with timeout 5000ms
  - waiting for locator('#start')
    14 × locator resolved to <button id="start" class="primary">…</button>
       - unexpected value "hidden"

```

```yaml
- main
- text: INFRA RUSH
- paragraph: 小さなBotたちが準備しています…
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import type { Page } from "@playwright/test";
  3   | import type { GameState } from "../../src/game/types";
  4   | declare global {
  5   |   interface Window {
  6   |     infraQA: {
  7   |       snapshot: () => GameState;
  8   |       advance: (s: number) => void;
  9   |       metrics: () => Record<string, number>;
  10  |       quake: () => void;
  11  |       projectBot: (id: string) => { x: number; y: number };
  12  |     };
  13  |   }
  14  | }
  15  | const advance = (page: Page, s: number) =>
  16  |   page.evaluate((seconds) => window.infraQA.advance(seconds), s);
  17  | test("real UI: mine, build, march, attack, return, five hits, results and restart", async ({
  18  |   page,
  19  | }, info) => {
  20  |   const errors: string[] = [];
  21  |   page.on("pageerror", (e) => errors.push(e.message));
  22  |   await page.goto("/?qa");
> 23  |   await expect(page.locator("#start")).toBeVisible();
      |                                        ^ Error: expect(locator).toBeVisible() failed
  24  |   await page.screenshot({ path: `docs/qa/${info.project.name}-title.png` });
  25  |   await page.getByRole("button", { name: "はじめて", exact: true }).click();
  26  |   await page.locator("#start").click();
  27  |   // Freeze only wall-clock progression; advance runs the real simulation and CPU.
  28  |   await page.getByRole("button", { name: "時計停止", exact: true }).click();
  29  |   await expect(page.locator("#bot-roster button")).toHaveCount(5);
  30  |   // Direct 3D Bot hit testing, then on-screen task control.
  31  |   const p = await page.evaluate(() => window.infraQA.projectBot("blue-0"));
  32  |   await page.mouse.click(p.x, p.y);
  33  |   await expect(page.locator("#task-panel")).toBeVisible();
  34  |   await page
  35  |     .locator('[data-action="build"]')
  36  |     .isDisabled()
  37  |     .then((v) => expect(v).toBe(true));
  38  |   await page.locator('[data-action="mine"]').click();
  39  |   for (let i = 1; i < 5; i++) {
  40  |     await page.locator(`[data-bot="blue-${i}"]`).click();
  41  |     await page.locator('[data-action="mine"]').click();
  42  |   }
  43  |   await advance(page, 32);
  44  |   let s = await page.evaluate(() => window.infraQA.snapshot());
  45  |   expect(s.teams.blue.resources.stone).toBeGreaterThanOrEqual(50);
  46  |   expect(s.teams.blue.resources.iron).toBeGreaterThan(0);
  47  |   await page.locator('[data-bot="blue-0"]').click();
  48  |   await page.screenshot({ path: `docs/qa/${info.project.name}-mining.png` });
  49  |   await page.locator('[data-action="build"]').click();
  50  |   await advance(page, 23);
  51  |   s = await page.evaluate(() => window.infraQA.snapshot());
  52  |   expect(s.bridges[0].level).toBe(1);
  53  |   await page.locator('[data-bot="blue-0"]').click();
  54  |   await page.locator('[data-action="march"]').click();
  55  |   await advance(page, 14);
  56  |   s = await page.evaluate(() => window.infraQA.snapshot());
  57  |   expect(s.teams.red.hp).toBe(4);
  58  |   expect(s.bots[0].state).toBe("IDLE");
  59  |   expect(s.bots[0].position).toEqual(s.bots[0].home);
  60  |   await page.screenshot({ path: `docs/qa/${info.project.name}-bridge.png` });
  61  |   for (let i = 1; i < 5; i++) {
  62  |     await page.locator(`[data-bot="blue-${i}"]`).click();
  63  |     await page.locator('[data-action="march"]').click();
  64  |   }
  65  |   await advance(page, 25);
  66  |   await expect(page.locator("#result")).toBeVisible();
  67  |   s = await page.evaluate(() => window.infraQA.snapshot());
  68  |   expect(s.winner).toBe("blue");
  69  |   expect(s.teams.red.hp).toBe(0);
  70  |   await page.screenshot({ path: `docs/qa/${info.project.name}-result.png` });
  71  |   await page.locator("#restart").click();
  72  |   s = await page.evaluate(() => window.infraQA.snapshot());
  73  |   expect(s.teams.blue.resources.stone).toBe(0);
  74  |   expect(s.teams.red.hp).toBe(5);
  75  |   expect(s.bridges.every((b) => b.level === 0)).toBe(true);
  76  |   expect(errors).toEqual([]);
  77  |   expect(
  78  |     await page.evaluate(
  79  |       () => document.documentElement.scrollWidth <= innerWidth,
  80  |     ),
  81  |   ).toBe(true);
  82  | });
  83  | test("pause freezes clock, help resumes, sound and bridge targeting respond", async ({
  84  |   page,
  85  | }) => {
  86  |   await page.goto("/?qa");
  87  |   await page.locator("#start").click();
  88  |   await page.locator("#pause").click();
  89  |   const before = await page.evaluate(() => window.infraQA.snapshot().time);
  90  |   await page.waitForTimeout(500);
  91  |   expect(await page.evaluate(() => window.infraQA.snapshot().time)).toBe(
  92  |     before,
  93  |   );
  94  |   await page.locator("#modal-close").click();
  95  |   await page.locator("#sound").click();
  96  |   await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  97  |   await page.getByRole("button", { name: "中央共有橋", exact: true }).click();
  98  |   await expect(page.locator('#task-panel [data-target="center"]')).toHaveClass(
  99  |     "active",
  100 |   );
  101 |   await expect(page.locator('[data-action="build"]')).toBeDisabled();
  102 | });
  103 | 
```