const { test, expect, gotoApp } = require("../fixtures");

test("Data and Help expose the ordinary showcase import", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByTestId("browse-showcase")).toBeVisible();
  await page.getByTestId("browse-showcase").click();
  await expect(page.getByTestId("showcase-gallery").locator(".showcase-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByTestId("open-help").click();
  await page.getByRole("button", { name: /Showcase examples/ }).click();
  await page.getByTestId("help-content").getByRole("button", { name: "Browse showcase datasets" }).click();
  await page.getByRole("button", { name: "Load Iris Morphology Lab" }).click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("150 rows");
});
