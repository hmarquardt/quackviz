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
];

for (const path of requiredShowcaseFiles) await access(path);
const manifest = JSON.parse(await readFile("vendor/manifest.json", "utf8"));
const echarts = manifest.dependencies.find((dependency) => dependency.name === "echarts");
if (echarts?.version !== "6.1.0") throw new Error("RC check requires the audited ECharts 6.1.0 runtime.");
console.log(`RC static checks passed: ${requiredShowcaseFiles.length} showcase assets; ECharts ${echarts.version}.`);
