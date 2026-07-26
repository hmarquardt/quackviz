import { access, readFile } from "node:fs/promises";

const requiredShowcaseFiles = [
  "examples/showcase/01_global_development_odyssey.json",
  "examples/showcase/02_montreal_mobility_constellation.json",
  "examples/showcase/03_tech_stock_time_machine.json",
  "examples/showcase/04_iris_morphology_lab.json",
  "examples/showcase/05_wind_rose_observatory.json",
  "examples/showcase/showcase_catalog.json",
  "examples/showcase/SQL_COOKBOOK.md",
  "docs/showcase.md",
  "docs/usability-test-plan.md",
  "docs/usability-feedback-form.md",
  "docs/usability-findings.md",
  "docs/manual-safari-checklist.md",
  "docs/rc-human-signoff.md",
  "assets/quackviz-logo.svg",
  "assets/quackviz-banner.svg",
  "docs/images/quackviz-data.png",
  "docs/images/quackviz-showcase.png",
  "docs/images/quackviz-analysis.png",
  "docs/images/quackviz-chart.png",
  "docs/images/quackviz-map.png",
  "docs/images/quackviz-dashboard.png",
  "docs/images/quackviz-report.png",
  "docs/images/quackviz-dark.png",
];

for (const path of requiredShowcaseFiles) await access(path);
const findings = await readFile("docs/usability-findings.md", "utf8");
if (!findings.includes("Open P0: **0**") || !findings.includes("Open P1: **0**")) {
  throw new Error("RC check requires the usability register to state open P0 and P1 counts.");
}
const manifest = JSON.parse(await readFile("vendor/manifest.json", "utf8"));
const echarts = manifest.dependencies.find((dependency) => dependency.name === "echarts");
if (echarts?.version !== "6.1.0") throw new Error("RC check requires the audited ECharts 6.1.0 runtime.");
console.log(`RC static checks passed: ${requiredShowcaseFiles.length} showcase assets; ECharts ${echarts.version}.`);
