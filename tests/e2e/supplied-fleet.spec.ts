import { expect, test } from "@playwright/test";

for (const team of ["blue", "red"] as const) {
  test(team + " supplied fleet and work axes", async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const models = ["dozer", "grader", "drill", "launcher"];
    const responses = models.flatMap((name) =>
      [name, name + "-red"].map((variant) =>
        page.waitForResponse((response) =>
          response.url().endsWith("/models/" + variant + ".glb"),
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
    await page.getByRole("button", { name: "時計停止", exact: true }).click();
    await page.evaluate((team) => {
      window.infraQA.setCpuEnabled(false);
      window.infraQA.suppressQuake();
      window.infraQA.setResources("blue", { soil: 100, stone: 200, iron: 200 });
      window.infraQA.setResources("red", { soil: 100, stone: 200, iron: 200 });
      window.infraQA.setBridge("blue", {
        owner: "blue",
        level: 1,
        capacity: 1,
        blockedBy: team === "blue" ? "red" : null,
      });
      window.infraQA.setBridge("red", {
        owner: "red",
        level: 1,
        capacity: 1,
        blockedBy: team === "red" ? "blue" : null,
      });
    }, team);
    const enemy = team === "blue" ? "red" : "blue";
    const tasks = [
      {
        action: "build",
        target: "center",
        asset: "launcher",
        state: "BUILDING_BRIDGE",
      },
      {
        action: "clear",
        target: team,
        asset: "grader",
        state: "CLEARING_EMBANKMENT",
      },
      {
        action: "destroy",
        target: enemy,
        asset: "drill",
        state: "DESTROYING_BRIDGE",
      },
      {
        action: "embank",
        target: enemy,
        asset: "dozer",
        state: "BUILDING_EMBANKMENT",
      },
    ] as const;
    for (const [index, task] of tasks.entries()) {
      const id = team + "-" + index;
      const result = await page.evaluate(
        ({ team, id, action, target }) =>
          window.infraQA.command(team, id, action, target),
        { team, id, action: task.action, target: task.target },
      );
      expect(
        result.ok,
        team + " " + task.action + ": " + (result.reason ?? ""),
      ).toBe(true);
      const workState = await page.evaluate(
        ({ id, state }) => {
          for (let i = 0; i < 35; i++) {
            window.infraQA.advance(0.25);
            if (
              window.infraQA.snapshot().bots.find((bot) => bot.id === id)
                ?.state === state
            )
              return state;
          }
          return window.infraQA.snapshot().bots.find((bot) => bot.id === id)
            ?.state;
        },
        { id, state: task.state },
      );
      expect(workState).toBe(task.state);
      const x = task.target === "center" ? 0 : task.target === "blue" ? -7 : 7;
      await page.evaluate(({ x, z }) => window.infraQA.focus(x, z, 3.2), {
        x,
        z: team === "blue" ? -4.6 : 4.6,
      });
      await page.waitForTimeout(450);
      const before = await page.evaluate(
        (id) => window.infraQA.inspectVehicle(id),
        id,
      );
      expect(before?.asset).toBe(task.asset + (team === "red" ? "-red" : ""));
      if (task.asset === "launcher") {
        await page.evaluate(() => window.infraQA.advance(3));
        await page.waitForTimeout(250);
        const after = await page.evaluate(
          (id) => window.infraQA.inspectVehicle(id),
          id,
        );
        expect(before?.output).not.toBeNull();
        expect(after?.output).not.toBeNull();
        const dx = after!.output![0] - before!.output![0];
        const dz = after!.output![2] - before!.output![2];
        expect(dz * (team === "blue" ? 1 : -1)).toBeGreaterThan(0.35);
        expect(Math.abs(dx)).toBeLessThan(0.35);
      }
      if (task.asset === "drill") {
        await page.evaluate(() => window.infraQA.advance(0.2));
        await page.waitForTimeout(200);
        const after = await page.evaluate(
          (id) => window.infraQA.inspectVehicle(id),
          id,
        );
        expect(before?.bitAxis).not.toBeNull();
        expect(after?.bitAxis).not.toBeNull();
        const alignment = before!.bitAxis!.reduce(
          (sum, value, i) => sum + value * after!.bitAxis![i],
          0,
        );
        expect(alignment).toBeGreaterThan(0.98);
        expect(after!.bitRotation).not.toEqual(before!.bitRotation);
      }
      await page.screenshot({
        path: testInfo.outputPath(team + "-" + task.asset + ".png"),
      });
    }
    expect(errors).toEqual([]);
  });
}
