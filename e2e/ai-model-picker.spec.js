const { test, expect, gotoApp, selectWorkspaceTab } = require("./fixtures");

const providers = ["xai", "openai", "mistral", "meta", "qwen", "google", "anthropic"];
const models = Array.from({ length: 35 }, (_, index) => {
  const provider = providers[index % providers.length];
  const version = [10, 2, 4.1, 3.5, 3][index % 5];
  return { id: `${provider}/model-${version}-${index}`, name: `${provider} Model ${version} ${index}`, context_length: 32000 + index * 1000 };
}).reverse();

async function openPicker(page) {
  await page.route("https://openrouter.ai/api/v1/models", (route) => route.fulfill({ json: { data: models } }));
  await gotoApp(page);
  await selectWorkspaceTab(page, "ai");
}

test("AI enable row stays aligned and toggles by pointer and keyboard", async ({ page }) => {
  await openPicker(page);
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    const checkbox = page.getByTestId("ai-enabled");
    const label = page.getByTestId("ai-enable-label");
    const [box, text] = await Promise.all([checkbox.boundingBox(), label.boundingBox()]);
    expect(text.x).toBeGreaterThan(box.x + box.width);
    expect(Math.min(box.y + box.height, text.y + text.height)).toBeGreaterThan(Math.max(box.y, text.y));
    expect(await page.getByTestId("ai-enable-row").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await page.getByTestId("ai-enable-label").click();
  await expect(page.getByTestId("ai-enabled")).toBeChecked();
  await page.getByTestId("ai-enabled").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("ai-enabled")).not.toBeChecked();
  await page.getByTestId("theme-select").selectOption("dark");
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  expect(await page.getByTestId("ai-enable-row").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("model picker sorts, filters, preserves selection, and persists favorites", async ({ page }) => {
  await openPicker(page);
  await page.getByRole("button", { name: "Refresh models" }).click();
  await expect(page.getByTestId("model-count")).toContainText("35 models · 7 providers");
  const providerOptions = await page.getByTestId("model-provider").locator("option").allTextContents();
  expect(providerOptions).toEqual(["All providers", "anthropic", "google", "meta", "mistral", "openai", "qwen", "xai"]);
  const groupLabels = await page.getByTestId("model-select").locator("optgroup").evaluateAll((groups) => groups.map((group) => group.label));
  expect(groupLabels).toEqual(["anthropic", "google", "meta", "mistral", "openai", "qwen", "xai"]);

  const selected = "openai/model-2-1";
  await page.getByTestId("model-search").fill(selected);
  await expect(page.getByTestId("model-count")).toContainText("1 model");
  await page.getByTestId("model-select").selectOption(selected);
  await page.waitForFunction((id) => window.__QUACKVIZ_E2E__.state.workspace.settings.ai.model === id, selected);
  await page.getByTestId("model-search").fill("openai Model 2");
  await expect(page.getByTestId("model-select")).toHaveValue(selected);
  await page.getByTestId("model-search").fill("");
  await page.getByTestId("model-provider").selectOption("openai");
  await expect(page.getByTestId("model-select")).toHaveValue(selected);
  await page.getByTestId("favorite-model").click();
  await expect(page.getByTestId("favorite-model")).toContainText("Unfavorite");
  await page.evaluate(async () => (await import("/js/storage.js")).saveWorkspace(window.__QUACKVIZ_E2E__.state.workspace));
  await page.reload();
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.dbReady);
  await selectWorkspaceTab(page, "ai");
  await expect(page.getByTestId("favorite-model")).toContainText("Unfavorite");
  await page.getByTestId("model-search").fill("no catalog result");
  await expect(page.getByTestId("model-count")).toContainText("0 models");
  await expect(page.getByTestId("model-select")).toContainText("saved selection unavailable");
});

test("model picker labels fallback refresh honestly", async ({ page }) => {
  await page.route("https://openrouter.ai/api/v1/models", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{" }));
  await gotoApp(page);
  await selectWorkspaceTab(page, "ai");
  await page.getByRole("button", { name: "Refresh models" }).click();
  await expect(page.getByTestId("model-refresh-status")).toContainText("could not be refreshed");
  await expect(page.getByTestId("model-select")).toContainText("fallback");
});
