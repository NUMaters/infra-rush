import { expect, test } from "@playwright/test";

test("supplied excavator loads and mines in the actual 3D scene", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const asset = page.waitForResponse((response) =>
    response.url().endsWith("/models/excavator.glb"),
  );
  const redAsset = page.waitForResponse((response) =>
    response.url().endsWith("/models/excavator-red.glb"),
  );
  await page.goto("/?qa");
  expect((await asset).status()).toBe(200);
  expect((await redAsset).status()).toBe(200);
  await page.locator("#start").click();
  await page.getByRole("button", { name: "かんたん", exact: true }).click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#match-intro")).toBeHidden({ timeout: 15000 });
  await page.evaluate(() => {
    window.infraQA.setCpuEnabled(false);
    window.infraQA.suppressQuake();
    window.infraQA.command("blue", "blue-0", "mine");
    window.infraQA.advance(8);
    window.infraQA.focus(8, -10, 2.7);
  });
  await expect
    .poll(() => page.evaluate(() => window.infraQA.snapshot().bots[0].state))
    .toBe("MINING");
  await page.waitForTimeout(550);
  const blueCab = await page.evaluate(() =>
    window.infraQA.inspectVehicle("blue-0"),
  );
  expect(blueCab?.asset).toBe("excavator");
  expect(blueCab!.helmetTop!).toBeLessThan(blueCab!.roofTop! - 0.03);
  await page.screenshot({ path: testInfo.outputPath("excavator-mining.png") });
  if (testInfo.project.name === "desktop") {
    await page.mouse.move(730, 450);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(370, 450, { steps: 12 });
    await page.mouse.up({ button: "right" });
    await page.screenshot({ path: testInfo.outputPath("excavator-cab.png") });
    await page.evaluate(() => {
      window.infraQA.command("red", "red-0", "mine");
      window.infraQA.advance(8);
      window.infraQA.focus(-8, 10, 4.2);
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.infraQA.snapshot().bots.find((bot) => bot.id === "red-0")?.state,
        ),
      )
      .toBe("MINING");
    await page.waitForTimeout(250);
    const redCab = await page.evaluate(() =>
      window.infraQA.inspectVehicle("red-0"),
    );
    expect(redCab?.asset).toBe("excavator-red");
    expect(redCab!.helmetTop!).toBeLessThan(redCab!.roofTop! - 0.03);
    await page.screenshot({ path: testInfo.outputPath("excavator-red-mining.png") });
    await page.mouse.move(720, 450);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(1030, 450, { steps: 12 });
    await page.mouse.up({ button: "right" });
    await page.screenshot({ path: testInfo.outputPath("excavator-red-side.png") });
  }
  expect(errors).toEqual([]);
});
