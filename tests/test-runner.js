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

const resultsEl = document.getElementById("results");
const tests = [...vizSpecTests, ...vizCompilerTests, ...workspaceTests, ...aiContractTests, ...aiSqlSafetyTests, ...aiContextTests, ...aiProposalTests, ...versionTests, ...dashboardModelTests, ...dashboardFilterTests, ...dashboardExportTests, ...dashboardRunnerTests, ...aiDashboardTests];
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
