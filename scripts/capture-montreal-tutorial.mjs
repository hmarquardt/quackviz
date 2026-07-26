import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { APP_VERSION } from "../js/constants.js";

const output = "docs/images/tutorials/montreal";
const aiScreenshot = "docs/images/quackviz-ai-model-picker.png";
const baseUrl = "http://127.0.0.1:8091";
await mkdir(output, { recursive: true });
const server = spawn("python3", ["-m", "http.server", "8091", "--bind", "127.0.0.1"], { stdio: "ignore" });
const files = [];

try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const providers = ["anthropic", "google", "meta", "mistral", "openai", "qwen", "xai"];
  const models = Array.from({ length: 210 }, (_, index) => {
    const provider = providers[index % providers.length];
    const version = [2, 3, 3.5, 4, 4.1, 10][index % 6];
    return {
      id: index === 0 ? "openai/gpt-4.1-mini" : `${provider}/model-${version}-${String(index + 1).padStart(3, "0")}`,
      name: index === 0 ? "GPT-4.1 Mini" : `${provider[0].toUpperCase()}${provider.slice(1)} Model ${version}`,
      context_length: 32_000 + (index % 6) * 32_000,
    };
  }).reverse();
  await page.route("https://openrouter.ai/api/v1/models", (route) => route.fulfill({ json: { data: models } }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("quackviz.onboarding.welcomeDismissed", "true");
    localStorage.setItem("quackviz.theme", "light");
  });
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.appReady && window.__QUACKVIZ_E2E__?.dbReady, null, { timeout: 60_000 });
  const shot = async (name) => { await page.screenshot({ path: `${output}/${name}`, animations: "disabled" }); files.push(name); };
  const tab = async (name) => { await page.getByTestId(`tab-${name}`).click(); await page.locator(`#${name}Tab`).waitFor({ state: "visible" }); };
  const dismiss = async () => { while (await page.locator(".toast-dismiss").count()) await page.locator(".toast-dismiss").first().click(); };

  await tab("ai");
  await page.getByRole("button", { name: "Refresh models" }).click();
  await page.getByTestId("model-count").getByText("210 models · 7 providers").waitFor();
  await dismiss();
  await page.screenshot({ path: aiScreenshot, animations: "disabled" });
  await tab("data");

  await shot("01-open-data.png");
  await page.getByTestId("browse-showcase").click();
  await page.getByRole("heading", { name: "Showcase datasets" }).waitFor();
  await shot("02-open-showcase.png");
  const card = page.getByTestId("showcase-gallery").locator(".showcase-card").filter({ hasText: "Montreal Mobility Constellation" });
  await card.getByRole("heading", { name: "Montreal Mobility Constellation" }).waitFor();
  await shot("03-select-montreal.png");
  await card.getByRole("button", { name: "Load Montreal Mobility Constellation" }).click();
  await page.getByTestId("data-import-status").getByText(/Starting import|Reading file|Registering file|Creating table|Inspecting columns|Finalizing metadata/).waitFor({ timeout: 5_000 });
  await shot("04-import-progress.png");
  await page.getByTestId("data-import-status").getByText(/Imported/).waitFor({ timeout: 30_000 });
  await page.getByTestId("schema-view").getByText(/249 rows/).waitFor();
  await page.getByTestId("schema-view").scrollIntoViewIfNeeded();
  await shot("05-imported-schema.png");
  await dismiss();

  await page.getByTestId("browse-showcase").click();
  await card.getByRole("button", { name: "View Montreal Mobility Constellation demo recipe" }).click();
  await page.getByTestId("recipe-content").getByText("Montreal availability hotspots").waitFor();
  await shot("06-open-recipe.png");
  await page.getByRole("button", { name: "Open SQL in Analyze" }).click();
  await shot("07-query-ready.png");
  await page.getByTestId("query-name").fill("Montreal mobility hotspots");
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await page.getByTestId("query-rows").getByText("Rows: 249").waitFor({ timeout: 30_000 });
  await dismiss();
  await shot("08-query-results.png");

  await tab("visualize");
  await page.getByTestId("chart-type").selectOption("map-category-point");
  await page.getByTestId("map-latitude-field").selectOption("latitude");
  await page.getByTestId("map-longitude-field").selectOption("longitude");
  await page.getByTestId("map-label-field").selectOption("hotspot_id");
  await page.getByTestId("map-color-field").selectOption("peak_period");
  await page.getByTestId("map-basemap").selectOption("blank");
  await page.locator("#vizTitle").fill("Montreal mobility by peak period");
  await shot("09-map-settings.png");
  await page.locator("#chart .maplibregl-canvas").waitFor({ timeout: 30_000 });
  const diagnostics = await page.evaluate(async () => (await import("/js/map-renderer.js")).getMapInstanceDiagnostics("main_map"));
  if (diagnostics?.runtimeVersion !== "5.24.0" || diagnostics.featureCount !== 249) throw new Error(`Map diagnostics failed: ${JSON.stringify(diagnostics)}`);
  await shot("10-map-rendered.png");
  await page.getByTestId("save-viz").click();
  await dismiss();
  await shot("11-visualization-saved.png");

  await tab("dashboard");
  await page.getByTestId("new-dashboard").click();
  await page.getByTestId("add-dashboard-viz").click();
  await page.getByTestId("refresh-dashboard").click();
  await page.getByTestId("dashboard-card").filter({ hasText: "ready" }).waitFor({ timeout: 30_000 });
  await page.waitForFunction(async () => {
    const cardId = document.querySelector("[data-testid='dashboard-card']")?.dataset.cardId;
    if (!cardId) return false;
    const diagnostics = (await import("/js/map-renderer.js")).getMapInstanceDiagnostics(`dashboard_map_${cardId}`);
    return diagnostics?.featureCount === 249;
  }, null, { timeout: 30_000 });
  await page.evaluate(async () => {
    const cardId = document.querySelector("[data-testid='dashboard-card']")?.dataset.cardId;
    await (await import("/js/map-renderer.js")).waitForMapIdle(`dashboard_map_${cardId}`);
  });
  await dismiss();
  await shot("12-dashboard-created.png");
  await browser.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  await writeFile(`${output}/manifest.json`, JSON.stringify({
    tutorial: "montreal-mobility", viewport: "1440x900", theme: "light",
    dataset: "02_montreal_mobility_constellation.json", expectedRows: 249,
    appVersion: APP_VERSION, generatedBy: "Playwright", files,
  }, null, 2));
} finally {
  server.kill("SIGTERM");
}
