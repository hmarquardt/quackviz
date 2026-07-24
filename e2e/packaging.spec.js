const fs = require("node:fs");
const { test, expect, gotoApp, waitForDuckDB, loadSampleAndRunQuery, saveQueryAndVisualization, selectWorkspaceTab } = require("./fixtures");

test("portable package can be generated and inspected without leaking API keys", async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => localStorage.setItem("quackviz.openrouter.apiKey", "sk-e2e-secret"));
  await waitForDuckDB(page);
  await loadSampleAndRunQuery(page);
  await saveQueryAndVisualization(page);

  await selectWorkspaceTab(page, "debug");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-workspace-package").click();
  const download = await downloadPromise;
  const filePath = await download.path();
  const exported = fs.readFileSync(filePath, "utf8");

  await expect(page.getByTestId("package-inspection")).toContainText('"valid": true');
  await expect(page.getByTestId("debug-report")).not.toContainText("sk-e2e-secret");
  expect(exported).toMatch(/"format"\s*:\s*"quackviz-package"/);
  expect(exported).not.toContain("sk-e2e-secret");
});
