const { test, expect, gotoApp } = require("./fixtures");

async function addNotifications(page, items) {
  await page.evaluate(async (notifications) => {
    const { addError, addStatus } = await import("/js/state.js");
    for (const item of notifications) {
      if (item.level === "error") addError("e2e", item.operation, new Error(item.message));
      else addStatus("e2e", item.operation, item.message, item.level);
    }
  }, items);
}

async function expectNoOverlap(first, second) {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  if (!a || !b) return;
  const overlaps = a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
  expect(overlaps, `${await first.getAttribute("data-testid")} overlaps ${await second.getAttribute("data-testid")}`).toBe(false);
}

test("notifications are bounded, coalesced, and keyboard dismissible", async ({ page }) => {
  await gotoApp(page);
  await addNotifications(page, [
    { level: "success", operation: "saved", message: "Visualization saved." },
    { level: "info", operation: "query", message: "Query finished." },
    { level: "warning", operation: "storage", message: "Storage is almost full." },
    { level: "error", operation: "import", message: "Import could not be completed." },
  ]);

  await expect(page.getByTestId("toast")).toHaveCount(3);
  await addNotifications(page, [
    { level: "error", operation: "import", message: "Import could not be completed." },
  ]);
  await expect(page.getByTestId("toast")).toHaveCount(3);
  await expect(page.getByText("e2e: Import could not be completed.")).toHaveCount(1);

  const dismiss = page.getByTestId("toast").first().getByRole("button", { name: "Dismiss notification" });
  await dismiss.focus();
  await page.keyboard.press("Escape");
  await expect(page.getByText("e2e: Import could not be completed.")).toHaveCount(0);
});

test("long and persistent notifications do not cover import or footer controls", async ({ page }) => {
  await gotoApp(page);
  await addNotifications(page, [
    { level: "error", operation: "import", message: "A long import explanation remains readable and gives the user enough information to correct the selected file without obscuring the actions needed to try again.".repeat(2) },
    { level: "warning", operation: "storage", message: "Workspace storage needs attention." },
    { level: "success", operation: "ready", message: "Data source loaded." },
  ]);

  const region = page.getByTestId("toast-region");
  await expect(region).toBeVisible();
  await expect(region).toContainText("correct the selected file");
  for (const control of [
    page.getByTestId("data-import-confirm"),
    page.getByTestId("data-import-cancel"),
    page.getByTestId("data-url-load"),
    page.locator(".sidebar-footer"),
    page.locator(".app-footer"),
  ]) {
    await expectNoOverlap(region, control);
  }
});

for (const scenario of [
  { name: "1280 by 720", viewport: { width: 1280, height: 720 }, zoom: 1 },
  { name: "1024 by 768", viewport: { width: 1024, height: 768 }, zoom: 1 },
  { name: "200 percent zoom", viewport: { width: 1280, height: 720 }, zoom: 2 },
  { name: "stacked layout", viewport: { width: 800, height: 900 }, zoom: 1 },
]) {
  test(`notification layout avoids controls at ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize(scenario.viewport);
    await gotoApp(page);
    if (scenario.zoom !== 1) await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, scenario.zoom);
    await addNotifications(page, [
      { level: "error", operation: "import", message: "The selected dataset could not be imported. Review its format and try again." },
      { level: "warning", operation: "storage", message: "Workspace storage needs attention." },
      { level: "info", operation: "query", message: "Query execution details are available." },
    ]);
    const region = page.getByTestId("toast-region");
    await expect(region).toBeVisible();
    await expect(page.getByTestId("toast")).toHaveCount(3);
    for (const control of [
      page.getByTestId("data-import-confirm"),
      page.getByTestId("data-import-cancel"),
      page.getByTestId("data-url-load"),
      page.locator(".app-footer"),
    ]) {
      await expectNoOverlap(region, control);
    }
  });
}
