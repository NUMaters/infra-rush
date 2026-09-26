import { expect, test } from "@playwright/test";

const onlineTestURL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.ONLINE_TEST_URL ?? "http://localhost:8080/?qa";

test("random match starts with editable names and shared resources", async ({
  browser,
}) => {
  const firstContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const secondContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  try {
    for (const page of [first, second]) {
      await page.goto(onlineTestURL);
      await page.locator("#online-start").click();
      await expect(page.locator("#online-random")).toBeEnabled();
      await page
        .locator("#qa-controls")
        .evaluate((element) => element.remove());
      await page.locator("#online-random").click();
    }
    await expect(first.locator("#online-name")).toBeVisible();
    await expect(second.locator("#online-name")).toBeVisible();
    await first.locator("#online-name").fill("Rin");
    await first.locator("#online-ready").click();
    await second.locator("#online-name").fill("Sora");
    await second.locator("#online-ready").click();
    await expect(first.locator("#hud")).toBeVisible();
    await expect(second.locator("#hud")).toBeVisible();
    await expect(first.locator("#blue-score .score-top small")).toHaveText(
      "Rin",
    );
    await expect(second.locator("#red-score .score-top small")).toHaveText(
      "Sora",
    );

    const blueBot = await first.evaluate(() =>
      window.infraQA.projectBot("blue-0"),
    );
    await first.mouse.click(blueBot.x, blueBot.y);
    await expect(first.locator("#task-panel")).toBeVisible();
    await first.locator('[data-action="mine"]').click();
    const redBot = await second.evaluate(() =>
      window.infraQA.projectBot("red-0"),
    );
    await second.touchscreen.tap(redBot.x, redBot.y);
    await expect(second.locator("#task-panel")).toBeVisible();
    await second.locator('[data-action="mine"]').click();
    await expect
      .poll(() => first.locator(".resource.stone b").innerText(), {
        timeout: 25000,
      })
      .not.toBe("0");
    await expect
      .poll(() => second.locator(".resource.stone b").innerText(), {
        timeout: 25000,
      })
      .not.toBe("0");
    await expect
      .poll(() =>
        second.evaluate(
          () => window.infraQA.snapshot().teams.blue.resources.stone,
        ),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        first.evaluate(
          () => window.infraQA.snapshot().teams.red.resources.stone,
        ),
      )
      .toBeGreaterThan(0);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});

test("locked room displays a five-character ID and accepts a friend", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const host = await a.newPage();
  const guest = await b.newPage();
  try {
    for (const page of [host, guest]) {
      await page.goto(onlineTestURL);
      await page.locator("#online-start").click();
      await expect(page.locator("#online-create")).toBeEnabled();
      await page
        .locator("#qa-controls")
        .evaluate((element) => element.remove());
    }
    await host.locator("#online-create").click();
    const roomID = await host.locator("#copy-room").innerText();
    expect(roomID).toMatch(/^[A-Z2-9]{5}$/);
    await guest.locator("#room-id-input").fill(roomID.toLowerCase());
    await guest.locator("#online-join").click();
    await expect(host.locator("#online-name")).toBeVisible();
    await expect(guest.locator("#online-name")).toBeVisible();
    await expect(host.locator("#online-name")).toHaveValue("プレイヤー1");
    await expect(guest.locator("#online-name")).toHaveValue("プレイヤー2");
    await host.locator("#online-ready").click();
    await guest.locator("#online-ready").click();
    await expect(host.locator("#hud")).toBeVisible();
    await expect(guest.locator("#hud")).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("a player can reconnect and continue issuing sequenced commands", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const host = await a.newPage();
  const guest = await b.newPage();
  try {
    for (const page of [host, guest]) {
      await page.goto(onlineTestURL);
      await page.locator("#online-start").click();
      await expect(page.locator("#online-create")).toBeEnabled();
      await page
        .locator("#qa-controls")
        .evaluate((element) => element.remove());
    }
    await host.locator("#online-create").click();
    const roomID = await host.locator("#copy-room").innerText();
    await guest.locator("#room-id-input").fill(roomID);
    await guest.locator("#online-join").click();
    await host.locator("#online-ready").click();
    await guest.locator("#online-ready").click();
    await expect(host.locator("#hud")).toBeVisible();
    await host.keyboard.press("1");
    await host.locator('[data-action="mine"]').click();
    await expect
      .poll(() => host.evaluate(() => window.infraQA.snapshot().bots[0].action))
      .toBe("mine");

    await host.reload();
    await host.locator("#online-start").click();
    await expect(host.locator("#hud")).toBeVisible();
    await expect
      .poll(() => host.evaluate(() => window.infraQA.snapshot().bots[0].action))
      .toBe("mine");
    await host.keyboard.press("1");
    await host.locator("#cancel-mine").click();
    await expect
      .poll(() => host.evaluate(() => window.infraQA.snapshot().bots[0].state))
      .toBe("IDLE");
  } finally {
    await a.close();
    await b.close();
  }
});
