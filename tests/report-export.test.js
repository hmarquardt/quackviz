import { APP_VERSION } from "../js/constants.js";
import { createReportPackageFiles, exportReportJson, importReportJson, renderReportHtml, renderReportMarkdown } from "../js/report-export.js";
import { addReport, addSection, createReport } from "../js/report.js";
import { createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixture() {
  const workspace = createWorkspace();
  const report = addReport(workspace, createReport({ title: "Quarterly Review", subtitle: "Sales" }));
  addSection(report, { type: "text", title: "Summary", content: { narrative: "Revenue increased.", caption: "", finding: "", sqlVisible: false } });
  return { workspace, report };
}

export const reportExportTests = [
  { name: "report-export: html includes title", run: () => { const { report } = fixture(); assert(renderReportHtml(report).includes("Quarterly Review"), "title missing"); } },
  { name: "report-export: html includes app version", run: () => { const { report } = fixture(); assert(renderReportHtml(report).includes(APP_VERSION), "version missing"); } },
  { name: "report-export: html omits api key", run: () => { const { report } = fixture(); assert(!renderReportHtml(report).includes("apiKey"), "key leaked"); } },
  { name: "report-export: html has no remote scripts", run: () => { const { report } = fixture(); assert(!/<script/i.test(renderReportHtml(report)), "script found"); } },
  { name: "report-export: markdown headings", run: () => { const { report } = fixture(); assert(renderReportMarkdown(report).startsWith("# Quarterly Review"), "heading missing"); } },
  { name: "report-export: markdown version metadata", run: () => { const { report } = fixture(); assert(renderReportMarkdown(report).includes(APP_VERSION), "md version missing"); } },
  { name: "report-export: package manifest version", run: () => { const { report } = fixture(); assert(createReportPackageFiles(report).manifest.generatedBy.appVersion === APP_VERSION, "manifest version mismatch"); } },
  { name: "report-export: json import export", run: () => { const { workspace, report } = fixture(); const pkg = exportReportJson(workspace, report.id); const result = importReportJson(workspace, pkg); assert(result.report.id !== report.id && workspace.reports.length === 2, "import failed"); } },
  { name: "report-export: reject future report json", run: () => { const { workspace, report } = fixture(); const pkg = exportReportJson(workspace, report.id); pkg.formatVersion = 99; let failed = false; try { importReportJson(workspace, pkg); } catch { failed = true; } assert(failed, "future accepted"); } },
];
