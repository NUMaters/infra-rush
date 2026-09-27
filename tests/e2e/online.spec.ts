import { expect, test } from "@playwright/test";

const onlineTestURL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.ONLINE_TEST_URL ?? "http://localhost:8080/?qa";
const enterCode = async (
  page: import("@playwright/test").Page,
  code: string,
) => {
  await page.locator("#room-id-input").click();
  for (const digit of code)
    await page.locator(`[data-keypad="${digit}"]`).click();
};

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
    await expect(second.locator("#match-intro")).toBeVisible();
    expect(await second.evaluate(() => window.infraQA.snapshot().time)).toBe(0);
    await expect(first.locator("#hud")).toBeVisible();
    await expect(second.locator("#hud")).toBeVisible();
    expect(
      await first.evaluate(() => window.infraQA.snapshot().teams.blue.hp),
    ).toBe(15);
    expect(
      await second.evaluate(() => window.infraQA.snapshot().teams.red.hp),
    ).toBe(15);
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

test("private room shares a five-digit invite and accepts a friend", async ({
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
    expect(roomID).toMatch(/^[0-9]{5}$/);
    await host.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        value: async (data: ShareData) => {
          (window as Window & { sharedInvite?: ShareData }).sharedInvite = data;
        },
      });
    });
    await host.locator("#share-room").click();
    const invitation = await host.evaluate(
      () => (window as Window & { sharedInvite?: ShareData }).sharedInvite,
    );
    expect(invitation?.text).toContain(`招待コード: ${roomID}`);
    const inviteURL = invitation?.text?.match(/https?:\/\/\S+/)?.[0];
    expect(inviteURL).toContain(`room=${roomID}`);
    await guest.goto(inviteURL!);
    await expect(host.locator("#online-name")).toBeVisible();
    await expect(guest.locator("#online-name")).toBeVisible();
    await expect(host.locator("#online-name")).toHaveValue("プレイヤー1");
    await expect(guest.locator("#online-name")).toHaveValue("プレイヤー2");
    await host.locator("#online-ready").click();
    await guest.locator("#online-ready").click();
    await host.bringToFront();
    await expect(host.locator("#hud")).toBeVisible();
    await expect(guest.locator("#hud")).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("invite keypad stays still and shows a missing room in place", async ({
  page,
}) => {
  await page.goto(onlineTestURL);
  await page.locator("#online-start").click();
  await expect(page.locator("#online-create")).toBeEnabled();
  await page.locator("#room-id-input").click();
  await page.evaluate(() => {
    const saved = window as Window & {
      joinDialog?: Element;
      joinMessages?: string[];
    };
    saved.joinDialog = document.querySelector(".online-dialog")!;
    saved.joinMessages = [];
    const feedback = document.getElementById("join-feedback")!;
    new MutationObserver(() =>
      saved.joinMessages!.push(feedback.textContent ?? ""),
    ).observe(feedback, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  for (const digit of "00000")
    await page.locator(`[data-keypad="${digit}"]`).click();
  expect(
    await page.evaluate(
      () =>
        document.querySelector(".online-dialog") ===
        (window as Window & { joinDialog?: Element }).joinDialog,
    ),
  ).toBe(true);
  expect(
    await page
      .locator("#room-id-input")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(25);
  await expect(page.locator("#online-join")).toHaveCount(0);
  await page.locator('[data-keypad="join"]').click();
  await expect(page.locator("#join-feedback")).toHaveText(
    "部屋が見つかりません",
  );
  expect(
    await page.evaluate(() =>
      (window as Window & { joinMessages?: string[] }).joinMessages?.some(
        (message) => message.includes("部屋を探しています"),
      ),
    ),
  ).toBe(true);
  await expect(page.locator(".room-keypad")).toBeVisible();
});

test("a player can reconnect and continue issuing sequenced commands", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  let host = await a.newPage();
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
    await enterCode(guest, roomID);
    await guest.locator('[data-keypad="join"]').click();
    await host.locator("#online-ready").click();
    await guest.locator("#online-ready").click();
    await host.bringToFront();
    await expect(host.locator("#hud")).toBeVisible();
    await host.keyboard.press("1");
    await host.locator('[data-action="mine"]').click();
    await expect
      .poll(() => host.evaluate(() => window.infraQA.snapshot().bots[0].action))
      .toBe("mine");

    await host.close();
    await expect(guest.locator("#opponent-connection")).toBeVisible();
    host = await a.newPage();
    await host.goto(onlineTestURL);
    await expect(host.locator("#hud")).toBeVisible();
    await expect(guest.locator("#opponent-connection")).toBeHidden();
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
