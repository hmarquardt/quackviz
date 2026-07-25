import { vizSpecTests } from "./viz-spec.test.js";
import { vizCompilerTests } from "./viz-compiler.test.js";
import { workspaceTests } from "./workspace.test.js";
import { aiContractTests } from "./ai-contracts.test.js";
import { aiSqlSafetyTests } from "./ai-sql-safety.test.js";
import { aiContextTests } from "./ai-context.test.js";
import { aiProposalTests } from "./ai-proposals.test.js";
import { versionTests } from "./version.test.js";
import { dashboardModelTests } from "./dashboard-model.test.js";
import { dashboardFilterTests } from "./dashboard-filters.test.js";
import { dashboardExportTests } from "./dashboard-export.test.js";
import { dashboardRunnerTests } from "./dashboard-runner.test.js";
import { aiDashboardTests } from "./ai-dashboard.test.js";
import { reportModelTests } from "./report-model.test.js";
import { reportRunnerTests } from "./report-runner.test.js";
import { reportExportTests } from "./report-export.test.js";
import { aiReportTests } from "./ai-report.test.js";
import { mapSpatialTests } from "./map-spatial.test.js";
import { mapSpecTests } from "./map-spec.test.js";
import { mapRendererTests } from "./map-renderer.test.js";
import { aiMapTests } from "./ai-map.test.js";
import { interactionTests } from "./interactions.test.js";
import { packageTests } from "./package.test.js";
import { operationalTests } from "./operational.test.js";
import { importTests } from "./import.test.js";

const resultsEl = document.getElementById("results");
const tests = [...vizSpecTests, ...vizCompilerTests, ...workspaceTests, ...importTests, ...aiContractTests, ...aiSqlSafetyTests, ...aiContextTests, ...aiProposalTests, ...versionTests, ...dashboardModelTests, ...dashboardFilterTests, ...dashboardExportTests, ...dashboardRunnerTests, ...aiDashboardTests, ...reportModelTests, ...reportRunnerTests, ...reportExportTests, ...aiReportTests, ...mapSpatialTests, ...mapSpecTests, ...mapRendererTests, ...aiMapTests, ...interactionTests, ...packageTests, ...operationalTests];
const results = [];

for (const test of tests) {
  try {
    await test.run();
    results.push({ name: test.name, ok: true });
  } catch (error) {
    results.push({ name: test.name, ok: false, message: error.message, stack: error.stack });
  }
}

const passed = results.filter((result) => result.ok).length;
resultsEl.innerHTML = `
  <p>${passed}/${results.length} passed</p>
  ${results.map((result) => `<div class="${result.ok ? "pass" : "fail"}">${result.ok ? "PASS" : "FAIL"} · ${result.name}${result.message ? ` · ${result.message}` : ""}</div>`).join("")}
  <pre>${JSON.stringify(results, null, 2)}</pre>
`;

window.__QUACKVIZ_TEST_RESULTS__ = results;
