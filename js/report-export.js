import { APP_VERSION, BUILD_DATE, REPORT_VERSION } from "./constants.js";
import { createReport, normalizeReport } from "./report.js";
import { deepClone, nowIso, uid } from "./utils.js";

export function exportReportJson(workspace, reportId) {
  const report = workspace.reports.find((item) => item.id === reportId);
  if (!report) throw new Error("Report not found.");
  const refs = collectReferences(workspace, report);
  return {
    format: "quackviz-report",
    formatVersion: 1,
    exportedBy: { app: "QuackViz", appVersion: APP_VERSION, buildDate: BUILD_DATE, exportedAt: nowIso() },
    report: deepClone(report),
    referencedVisualizations: refs.visualizations,
    referencedQueries: refs.queries,
    referencedDashboards: refs.dashboards,
  };
}

export function importReportJson(workspace, pkg) {
  if (!pkg || pkg.format !== "quackviz-report") throw new Error("Unsupported report package.");
  if (pkg.formatVersion > 1) throw new Error(`Unsupported future report format ${pkg.formatVersion}.`);
  const report = normalizeReport({ ...pkg.report, id: uniqueId(workspace.reports, pkg.report.id, "report") });
  workspace.reports.push(report);
  workspace.active.reportId = report.id;
  workspace.updatedAt = nowIso();
  return { report, importedReports: 1, skippedSections: 0 };
}

export function renderReportHtml(report, { workspace = null } = {}) {
  const sections = visibleSections(report).map((section) => renderHtmlSection(section, report)).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="quackviz-report" content="${escapeHtml(JSON.stringify(reportMetadata(report)))}"><title>${escapeHtml(report.title)}</title><style>${reportCss()}</style></head><body><main class="report"><section class="cover"><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.subtitle)}</p><p>${escapeHtml(report.description)}</p></section>${sections}<footer>Generated with QuackViz ${APP_VERSION} (${BUILD_DATE})</footer></main></body></html>`;
}

export function renderReportMarkdown(report) {
  const lines = [`# ${report.title}`, "", report.subtitle ? `_${report.subtitle}_` : "", "", `Generated with QuackViz ${APP_VERSION} (${BUILD_DATE})`, ""].filter((line) => line !== null);
  for (const section of visibleSections(report)) lines.push(...markdownSection(section));
  return lines.join("\n");
}

export function createReportManifest(report, files = []) {
  return {
    format: "quackviz-report-package",
    formatVersion: 1,
    reportId: report.id,
    reportVersion: REPORT_VERSION,
    title: report.title,
    generatedAt: nowIso(),
    generatedBy: { app: "QuackViz", appVersion: APP_VERSION, buildDate: BUILD_DATE },
    sections: report.sections.map((section) => ({ id: section.id, type: section.type, title: section.title })),
    files,
    filters: [],
    provenance: report.provenance,
  };
}

export function createReportPackageFiles(report) {
  const html = renderReportHtml(report);
  const markdown = renderReportMarkdown(report);
  const manifest = createReportManifest(report, [
    { path: "report/index.html", type: "text/html" },
    { path: "report/report.md", type: "text/markdown" },
    { path: "report/manifest.json", type: "application/json" },
  ]);
  return {
    manifest,
    files: [
      { path: "report/index.html", content: html },
      { path: "report/report.md", content: markdown },
      { path: "report/manifest.json", content: JSON.stringify(manifest, null, 2) },
    ],
  };
}

function renderHtmlSection(section) {
  const narrative = renderMarkdownLite(section.content.narrative || section.content.markdown || "");
  if (section.type === "divider") return `<hr>`;
  if (section.type === "visualization" || section.type === "dashboard-snapshot") {
    const image = section.snapshot.imageDataUrl ? `<img src="${escapeHtml(section.snapshot.imageDataUrl)}" alt="${escapeHtml(section.title)}">` : `<p class="warning">Snapshot missing.</p>`;
    return `<section><h2>${escapeHtml(section.title)}</h2>${narrative}${image}<p>${escapeHtml(section.content.caption)}</p>${section.content.sqlVisible ? renderSql(section) : ""}</section>`;
  }
  if (section.type === "query-table" || section.type === "data-source-summary") return `<section><h2>${escapeHtml(section.title)}</h2>${narrative}${renderTable(section)}${section.content.sqlVisible ? renderSql(section) : ""}</section>`;
  if (section.type === "kpi") return `<section class="kpi"><h2>${escapeHtml(section.title)}</h2><strong>${escapeHtml(kpiValue(section))}</strong>${narrative}</section>`;
  return `<section><h2>${escapeHtml(section.title)}</h2>${narrative}<p>${escapeHtml(section.content.finding)}</p></section>`;
}

function markdownSection(section) {
  const lines = [`## ${section.title}`, "", section.content.narrative || section.content.markdown || "", ""];
  if (section.type === "visualization" || section.type === "dashboard-snapshot") lines.push(section.snapshot.imageDataUrl ? `![${section.title}](${section.snapshot.imageDataUrl})` : "_Snapshot missing._", "");
  if (section.type === "query-table" || section.type === "data-source-summary") lines.push(markdownTable(section), "");
  if (section.content.sqlVisible && section.source.queryId) lines.push("```sql", `-- SQL retained in source query ${section.source.queryId}`, "```", "");
  return lines;
}

function renderTable(section) {
  const columns = section.snapshot.columns || [];
  const rows = section.snapshot.rows || [];
  if (!columns.length) return `<p>No table snapshot.</p>`;
  return `<table><caption>${escapeHtml(section.title)}</caption><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.name)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.name])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function markdownTable(section) {
  const columns = section.snapshot.columns || [];
  const rows = section.snapshot.rows || [];
  if (!columns.length) return "_No table snapshot._";
  return [`| ${columns.map((c) => c.name).join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${columns.map((c) => String(row[c.name] ?? "")).join(" | ")} |`)].join("\n");
}

function renderSql(section) {
  return `<pre><code>-- SQL retained by source query ${escapeHtml(section.source.queryId || "")}</code></pre>`;
}

function renderMarkdownLite(text) {
  return escapeHtml(text).split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
}

function kpiValue(section) {
  const first = section.snapshot.rows?.[0] || {};
  const field = section.content.kpi?.valueField || Object.keys(first)[0];
  return first[field] ?? "";
}

function collectReferences(workspace, report) {
  const queryIds = new Set(report.sections.map((s) => s.source.queryId).filter(Boolean));
  const vizIds = new Set(report.sections.map((s) => s.source.visualizationId).filter(Boolean));
  const dashboardIds = new Set(report.sections.map((s) => s.source.dashboardId).filter(Boolean));
  for (const viz of workspace.visualizations.filter((v) => vizIds.has(v.id))) queryIds.add(viz.queryId);
  return {
    queries: deepClone(workspace.queries.filter((query) => queryIds.has(query.id))),
    visualizations: deepClone(workspace.visualizations.filter((viz) => vizIds.has(viz.id))),
    dashboards: deepClone(workspace.dashboards.filter((dashboard) => dashboardIds.has(dashboard.id))),
  };
}

function visibleSections(report) {
  return report.sections.filter((section) => section.visible !== false).sort((a, b) => a.position - b.position);
}

function reportMetadata(report) {
  return { reportId: report.id, reportVersion: REPORT_VERSION, appVersion: APP_VERSION, buildDate: BUILD_DATE, generatedAt: nowIso() };
}

function reportCss() {
  return `body{font:16px/1.5 system-ui;margin:0;color:#17202f;background:#fff}.report{max-width:960px;margin:0 auto;padding:40px}section{break-inside:avoid;margin:0 0 28px}h1{font-size:40px}h2{font-size:24px;margin-top:28px}img{max-width:100%;height:auto;border:1px solid #d5dce5}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #d5dce5;padding:6px;text-align:left}pre{white-space:pre-wrap;background:#f4f6f8;padding:12px}.warning{color:#8a4b00}@media print{.report{max-width:none;padding:0}section{page-break-inside:avoid}thead{display:table-header-group}@page{margin:0.7in}}`;
}

function uniqueId(items, id, prefix) {
  return items.some((item) => item.id === id) ? uid(prefix) : id;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
