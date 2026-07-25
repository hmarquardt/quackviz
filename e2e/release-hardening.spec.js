const { test, expect, gotoApp, selectWorkspaceTab } = require("./fixtures");

test("safe mode and hardening diagnostics expose canonical version", async ({ page }) => {
  await gotoApp(page, "/?safeMode=1");
  await expect(page.locator("body")).toHaveAttribute("data-workspace-state", "safe-mode");
  await expect(page.getByTestId("app-footer")).toContainText("v0.10.0");

  await selectWorkspaceTab(page, "debug");
  await expect(page.getByTestId("recovery-status")).toContainText("Workspace validation");
  const debug = JSON.parse(await page.getByTestId("debug-report").textContent());
  expect(debug.appVersion).toBe("0.10.0");
  expect(debug.startup.safeMode).toBe(true);
  expect(debug.startup.vendoredDependencyStatus.validation.warnings.length).toBeGreaterThan(0);
});

test("support bundle is downloadable and redacts API keys", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("quackviz.openrouter.apiKey", "sk-e2e-support-secret"));
  await gotoApp(page);
  await selectWorkspaceTab(page, "debug");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-support-bundle").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  expect(text).toContain('"format": "quackviz-support-bundle"');
  expect(text).toContain('"appVersion": "0.10.0"');
  expect(text).not.toContain("sk-e2e-support-secret");
  expect(await page.getByTestId("package-inspection").textContent()).not.toContain("sk-e2e-support-secret");
});
