import { expect, test } from "@playwright/test";

test("solo practice can be skipped at any time and starts a fresh CPU match", async ({
  page,
}) => {
  await page.goto("/?qa");
  await expect(page.locator("#title-modes")).toBeVisible();
  await expect(page.locator("#solo-menu")).toBeHidden();
  await page.locator("#start").click();
  await expect(page.locator("#solo-menu")).toBeVisible();
  await expect(page.locator("#tutorial-start")).toBeVisible();
  await expect(page.locator("#cpu-start")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#title-modes")).toBeVisible();
  await page.locator("#start").click();
  await page.locator("#tutorial-start").click();
  await expect(page.locator("#tutorial-card")).toContainText("Botをタップ！");
  await expect(page.locator("#tutorial-skip")).toBeVisible();
  expect(await page.evaluate(() => window.infraQA.snapshot().time)).toBe(0);
  expect(
    await page.evaluate(
      () => window.infraQA.snapshot().teams.blue.resources.stone,
    ),
  ).toBe(48);
  await page.keyboard.press("1");
  await expect(page.locator("#tutorial-card")).toContainText("石を掘ろう");
  await expect(page.locator("#tutorial-skip")).toBeVisible();
  await page.locator("#tutorial-skip").click();
  await expect(page.locator("#tutorial")).toBeHidden();
  await expect(page.locator("#match-intro")).toBeVisible();
  const fresh = await page.evaluate(() => window.infraQA.snapshot());
  expect(fresh.teams.blue.resources.stone).toBe(0);
  expect(fresh.bridges.every((bridge) => bridge.level === 0)).toBe(true);
  expect(fresh.teams.red.hp).toBe(15);
  await expect(page.locator("#hud")).toBeVisible();
});

test("single player can begin a CPU match without practice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?qa");
  await page.locator("#start").click();
  await expect(page.locator("#cpu-start")).toBeInViewport();
  await page.locator("#solo-back").click();
  await expect(page.locator("#online-start")).toBeVisible();
  await page.locator("#start").click();
  await page.getByRole("button", { name: "チャレンジ", exact: true }).click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#tutorial")).toBeHidden();
  await expect(page.locator("#match-intro")).toBeVisible();
  await expect(page.locator("#hud")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("solo practice teaches mining, bridge building and one castle attack", async ({
  page,
}, info) => {
  await page.goto("/?qa");
  await page.locator("#start").click();
  await page.locator("#tutorial-start").click();
  await expect(page.locator("#tutorial-card")).toContainText("Botをタップ！");
  await page.locator("#qa-freeze").click();
  const tapBot = async (id: string) => {
    const p = await page.evaluate(
      (botId) => window.infraQA.projectBot(botId),
      id,
    );
    if (info.project.name === "mobile") await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
  };
  await tapBot("blue-0");
  await expect(page.locator("#tutorial-card")).toContainText("石を掘ろう");
  await expect(page.locator('[data-action="march"]')).toBeDisabled();
  await page.locator('[data-action="mine"]').click();
  await expect(page.locator("#tutorial-card")).toContainText("採掘中！");
  await page.evaluate(() => window.infraQA.advance(13));
  await expect(page.locator("#tutorial-card")).toContainText(
    "橋の場所をタップ！",
  );
  expect(await page.evaluate(() => window.infraQA.snapshot().time)).toBe(0);
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bots
      .filter((b) => b.team === "red")
      .every((b) => b.state === "IDLE"),
  ).toBe(true);
  await page
    .getByRole("button", { name: "自分の城につながる橋、つくれる" })
    .click();
  await expect(page.locator("#tutorial-card")).toContainText("橋をつくろう");
  await page.locator('[data-action="build"]').click();
  await page.evaluate(() => window.infraQA.advance(23));
  await expect(page.locator("#tutorial-card")).toContainText(
    "攻めるBotを選ぼう",
  );
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[0].level,
  ).toBe(1);
  await tapBot("blue-1");
  await expect(page.locator("#tutorial-card")).toContainText("進軍しよう！");
  await page.locator('[data-action="march"]').click();
  await page.evaluate(() => window.infraQA.advance(16));
  await expect(page.locator("#tutorial-card")).toContainText("練習クリア！");
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).teams.red.hp,
  ).toBe(14);
  await expect(page.locator("#tutorial-skip")).toBeVisible();
  await expect(page.locator("#tutorial")).toBeHidden({ timeout: 6000 });
  await expect(page.locator("#match-intro")).toBeVisible();
  const fresh = await page.evaluate(() => window.infraQA.snapshot());
  expect(fresh.teams.red.hp).toBe(15);
  expect(fresh.teams.blue.resources.stone).toBe(0);
  expect(fresh.bridges.every((bridge) => bridge.level === 0)).toBe(true);
  await expect(page.locator("#hud")).toBeVisible();
});
