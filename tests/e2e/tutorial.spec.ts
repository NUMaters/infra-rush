import { expect, test } from "@playwright/test";

test("solo practice can be skipped at any time and starts a fresh CPU match", async ({
  page,
}) => {
  await page.goto("/?qa");
  await expect(page.locator("#title-modes")).toBeVisible();
  await expect(page.locator("#solo-menu")).toBeHidden();
  await page.locator("#start").click();
  await expect(page.locator("#start")).toHaveCount(1);
  await expect(page.locator("#solo-menu")).toBeVisible();
  await expect(page.locator("#tutorial-start")).toBeVisible();
  await expect(page.locator("#cpu-start")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#title-modes")).toBeVisible();
  await page.locator("#start").click();
  await page.locator("#tutorial-start").click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "まずはゲームのルール",
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "3つの橋を覚えよう",
  );
  await expect(page.locator("#tutorial-card")).toContainText("早い者勝ち");
  await page.locator("#tutorial-next").click();
  await expect(page.locator(".tutorial-bridge-map .contested")).toHaveClass(
    /active/,
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator(".tutorial-bridge-map .enemy")).toHaveClass(
    /active/,
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "マップを見渡そう",
  );
  await expect(page.locator("#tutorial-card")).toContainText("2本指");
  await page.locator("#tutorial-next").click();
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
  await page.getByRole("button", { name: "むずかしい", exact: true }).click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#tutorial")).toBeHidden();
  await expect(page.locator("#match-intro")).toBeVisible();
  await expect(page.locator("#hud")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("solo practice teaches mining, routes, sabotage and clearing", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  await page.goto("/?qa");
  await page.locator("#start").click();
  await page.locator("#tutorial-start").click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "まずはゲームのルール",
  );
  await expect(page.locator("#tutorial-card")).toContainText(
    "15回たたいたチームの勝ち",
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator(".tutorial-bridge-map")).toContainText(
    "青の橋青だけ",
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator(".tutorial-bridge-map .contested")).toHaveClass(
    /active/,
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator(".tutorial-bridge-map .enemy")).toHaveClass(
    /active/,
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "マップを見渡そう",
  );
  await page.locator("#tutorial-next").click();
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
  await expect(page.locator("#tutorial-card")).toContainText(
    "同時に仕事を頼めるよ",
  );
  await tapBot("blue-1");
  await expect(page.locator("#tutorial-card")).toContainText("2体目にも頼もう");
  await page.locator('[data-action="mine"]').click();
  await expect(page.locator("#tutorial-card")).toContainText("採掘中！");
  await page.evaluate(() => window.infraQA.advance(13));
  await expect(page.locator("#resources .stone img")).toHaveAttribute(
    "src",
    /resources\/stone\.png$/,
  );
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
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).teams.blue.resources
      .stone,
  ).toBeGreaterThanOrEqual(50);
  await page.locator('[data-action="build"]').click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "石50個を使ったよ",
  );
  await expect(page.locator("#tutorial-card img")).toHaveAttribute(
    "src",
    /stone\.png$/,
  );
  await page.evaluate(() => window.infraQA.advance(23));
  await expect(page.locator("#tutorial-card")).toContainText("橋を強くしよう");
  await tapBot("blue-2");
  await expect(page.locator("#tutorial-card")).toContainText("強くする");
  await page.locator('[data-action="upgrade"]').click();
  await page.evaluate(() => window.infraQA.advance(20));
  await expect(page.locator("#tutorial-card")).toContainText(
    "傷んだ橋を直そう",
  );
  await tapBot("blue-3");
  await expect(page.locator("#tutorial-card")).toContainText("橋を直す");
  await page.locator('[data-action="repair"]').click();
  await page.evaluate(() => window.infraQA.advance(18));
  await expect(page.locator("#tutorial-card")).toContainText(
    "真ん中も狙える！",
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "攻めるBotを選ぼう",
  );
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[0].level,
  ).toBe(2);
  await tapBot("blue-4");
  await expect(page.locator("#tutorial-card")).toContainText("進軍しよう！");
  await page.locator('[data-action="march"]').click();
  await page.evaluate(() => window.infraQA.advance(16));
  await expect(page.locator("#tutorial-card")).toContainText(
    "Botが帰ってきた！",
  );
  await page.locator("#tutorial-next").click();
  await expect(page.locator("#tutorial-card")).toContainText(
    "相手の道をふさごう",
  );
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).teams.red.hp,
  ).toBe(14);
  await page.keyboard.press("3");
  await expect(page.locator("#tutorial-card")).toContainText("土を盛ろう");
  await page.locator('[data-action="embank"]').click();
  await page.evaluate(() => window.infraQA.advance(23));
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[2].blockedBy,
  ).toBe("blue");
  await expect(page.locator("#tutorial-card")).toContainText(
    "今度は橋を壊そう",
  );
  await page.keyboard.press("4");
  await expect(page.locator("#tutorial-card")).toContainText(
    "ドリルで橋を壊そう",
  );
  await page.locator('[data-action="destroy"]').click();
  await page.evaluate(() => window.infraQA.advance(27));
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[2].level,
  ).toBe(0);
  await expect(page.locator("#tutorial-card")).toContainText(
    "自分の道を直そう",
  );
  await page.keyboard.press("5");
  await expect(page.locator("#tutorial-card")).toContainText("土をならそう");
  await page.locator('[data-action="clear"]').click();
  await page.evaluate(() => window.infraQA.advance(24));
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges[0].blockedBy,
  ).toBeNull();
  await expect(page.locator("#tutorial-card")).toContainText("練習クリア！");
  await expect(page.locator("#tutorial-skip")).toBeVisible();
  await page.waitForTimeout(2800);
  await expect(page.locator("#tutorial")).toBeVisible();
  await expect(page.locator("#match-intro")).toBeHidden();
  await expect(page.locator("#tutorial-home")).toBeVisible();
  await page.locator("#tutorial-skip").click();
  await expect(page.locator("#tutorial")).toBeHidden();
  await expect(page.locator("#match-intro")).toBeVisible();
  const fresh = await page.evaluate(() => window.infraQA.snapshot());
  expect(fresh.teams.red.hp).toBe(15);
  expect(fresh.teams.blue.resources.stone).toBe(0);
  expect(fresh.bridges.every((bridge) => bridge.level === 0)).toBe(true);
  await expect(page.locator("#hud")).toBeVisible();
});
