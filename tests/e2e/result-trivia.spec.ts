import { expect, test } from "@playwright/test";

test("result trivia presents sourced facts with matching models", async ({
  page,
}) => {
  await page.goto("/?qa");
  await page.evaluate(() => localStorage.removeItem("infra-rush-last-trivia"));
  const finishSolo = async () => {
    await page.locator("#start").click();
    await page.locator("#cpu-start").click();
    await expect(page.locator("#match-intro")).toBeVisible();
    await expect(page.locator("#match-intro")).toBeHidden({ timeout: 15000 });
    await page.evaluate(() => {
      window.infraQA.setCpuEnabled(false);
      window.infraQA.advance(360);
    });
    await expect(page.locator("#result")).toBeVisible();
  };

  await finishSolo();
  await expect(page.locator("#result-trivia h3")).toContainText("Ⅲ判定");
  await expect(page.locator("#result-trivia .trivia-bubble p")).toContainText(
    "早期措置段階",
  );
  await expect(page.locator("#result-trivia .trivia-bottom a")).toHaveAttribute(
    "href",
    /mlit\.go\.jp/,
  );
  await expect(page.locator("#result-trivia .trivia-model")).toHaveAttribute(
    "src",
    /stone-bridge\.png$/,
  );
  expect(
    await page
      .locator("#result-trivia .trivia-model")
      .evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator("#result-trivia .trivia-guide")).toHaveCount(0);
  await expect(page.locator("#result-trivia .trivia-top")).toContainText(
    "土木まめちしき",
  );
  await page.locator("#result-trivia-next").click();
  await expect(page.locator("#result-trivia h3")).toContainText("ショベル");
  await expect(page.locator("#result-trivia .trivia-model")).toHaveAttribute(
    "src",
    /excavator\.png$/,
  );
  await expect
    .poll(() =>
      page
        .locator("#result-trivia .trivia-model")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator("#result-trivia .trivia-top")).toContainText(
    "2/12",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("infra-rush-last-trivia")),
  ).toBe("1");
  await page.locator("#result #back-title").click();
  await expect(page.locator("#title")).toBeVisible();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await finishSolo();
  await expect(page.locator("#result-trivia h3")).toContainText("ブルドーザー");
  await expect(page.locator("#result-trivia .trivia-model")).toHaveAttribute(
    "src",
    /dozer\.png$/,
  );
  await expect
    .poll(() =>
      page
        .locator("#result-trivia .trivia-model")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.locator("#restart").scrollIntoViewIfNeeded();
  await expect(page.locator("#restart")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
