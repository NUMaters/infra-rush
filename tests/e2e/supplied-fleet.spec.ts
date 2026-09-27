import { expect, test } from "@playwright/test";

test("supplied fleet operates at its work sites for both teams", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const models = ["dozer", "grader", "drill", "launcher"];
  const responses = models.flatMap((name) =>
    [name, `${name}-red`].map((variant) =>
      page.waitForResponse((response) =>
        response.url().endsWith(`/models/${variant}.glb`),
      ),
    ),
  );
  await page.goto("/?qa");
  for (const response of await Promise.all(responses))
    expect(response.status()).toBe(200);
  await page.locator("#start").click();
  await page.getByRole("button", { name: "かんたん", exact: true }).click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#match-intro")).toBeHidden({ timeout: 15000 });
  await page.evaluate(() => {
    window.infraQA.setCpuEnabled(false);
    window.infraQA.suppressQuake();
    window.infraQA.setResources("blue", { soil: 100, stone: 200, iron: 200 });
    window.infraQA.setResources("red", { soil: 100, stone: 200, iron: 200 });
    window.infraQA.setBridge("blue", {
      owner: "blue",
      level: 1,
      capacity: 1,
      blockedBy: "red",
    });
    window.infraQA.setBridge("red", {
      owner: "red",
      level: 1,
      capacity: 1,
    });
  });
  const tasks = [
    {
      action: "build",
      target: "center",
      id: "blue-0",
      x: 0,
      z: -4.6,
      state: "BUILDING_BRIDGE",
    },
    {
      action: "clear",
      target: "blue",
      id: "blue-1",
      x: -7,
      z: -4.6,
      state: "CLEARING_EMBANKMENT",
    },
    {
      action: "embank",
      target: "red",
      id: "blue-2",
      x: 7,
      z: -4.6,
      state: "BUILDING_EMBANKMENT",
    },
    {
      action: "destroy",
      target: "red",
      id: "blue-3",
      x: 7,
      z: -4.6,
      state: "DESTROYING_BRIDGE",
    },
  ] as const;
  for (const task of tasks) {
    const result = await page.evaluate(({ action, target, id, x, z }) => {
      const result = window.infraQA.command("blue", id, action, target);
      window.infraQA.focus(x, z, 3.2);
      return result;
    }, task);
    expect(result.ok, `${task.action}: ${result.reason ?? ""}`).toBe(true);
    const workState = await page.evaluate(({ id, state }) => {
      for (let i = 0; i < 30; i++) {
        window.infraQA.advance(0.25);
        if (
          window.infraQA.snapshot().bots.find((bot) => bot.id === id)?.state ===
          state
        )
          return state;
      }
      return window.infraQA.snapshot().bots.find((bot) => bot.id === id)?.state;
    }, task);
    expect(workState).toBe(task.state);
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`${task.action}.png`) });
  }
  const red = await page.evaluate(() => {
    const result = window.infraQA.command("red", "red-0", "destroy", "blue");
    window.infraQA.focus(-7, 4.6, 3.2);
    return result;
  });
  expect(red.ok, red.reason).toBe(true);
  const redState = await page.evaluate(() => {
    for (let i = 0; i < 30; i++) {
      window.infraQA.advance(0.25);
      if (
        window.infraQA.snapshot().bots.find((bot) => bot.id === "red-0")
          ?.state === "DESTROYING_BRIDGE"
      )
        return "DESTROYING_BRIDGE";
    }
    return window.infraQA.snapshot().bots.find((bot) => bot.id === "red-0")
      ?.state;
  });
  expect(redState).toBe("DESTROYING_BRIDGE");
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("red-drill.png") });
  expect(errors).toEqual([]);
});
