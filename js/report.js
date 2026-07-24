import { APP_VERSION, BUILD_DATE, REPORT_VERSION } from "./constants.js";
import { deepClone, nowIso, uid } from "./utils.js";

export const REPORT_SECTION_TYPES = ["cover", "heading", "text", "finding", "kpi", "visualization", "dashboard-snapshot", "query-table", "sql", "divider", "appendix", "methodology", "data-source-summary"];

export function createReport(input = {}) {
  const timestamp = nowIso();
  return normalizeReport({
    id: uid("report"),
    version: REPORT_VERSION,
    name: "New report",
    title: "New Report",
    subtitle: "",
    description: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "user",
    settings: {
      theme: "inherit",
      pageSize: "letter",
      orientation: "portrait",
      showGeneratedAt: true,
      showAppVersion: true,
      showSqlByDefault: false,
      showProvenance: true,
      showTableRowCounts: true,
      includeInteractiveChartsInHtml: false,
    },
    sections: [],
    metadata: { appVersion: APP_VERSION, buildDate: BUILD_DATE },
    provenance: { createdBy: "user", provider: null, model: null, interactionId: null, createdAt: timestamp },
    ...input,
  });
}

export function normalizeReport(input) {
  if (!input || typeof input !== "object") throw new Error("Report must be an object.");
  if (input.version && input.version > REPORT_VERSION) throw new Error(`Unsupported future report version ${input.version}.`);
  const timestamp = nowIso();
  return {
    id: input.id || uid("report"),
    version: REPORT_VERSION,
    name: input.name || input.title || "Untitled report",
    title: input.title || input.name || "Untitled Report",
    subtitle: input.subtitle || "",
    description: input.description || "",
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
    createdBy: input.createdBy || input.provenance?.createdBy || "user",
    settings: {
      theme: input.settings?.theme || "inherit",
      pageSize: input.settings?.pageSize || "letter",
      orientation: input.settings?.orientation || "portrait",
      showGeneratedAt: input.settings?.showGeneratedAt !== false,
      showAppVersion: input.settings?.showAppVersion !== false,
      showSqlByDefault: Boolean(input.settings?.showSqlByDefault),
      showProvenance: input.settings?.showProvenance !== false,
      showTableRowCounts: input.settings?.showTableRowCounts !== false,
      includeInteractiveChartsInHtml: Boolean(input.settings?.includeInteractiveChartsInHtml),
    },
    sections: Array.isArray(input.sections) ? input.sections.map((section, index) => normalizeSection({ ...section, position: section.position ?? index })) : [],
    metadata: { appVersion: APP_VERSION, buildDate: BUILD_DATE },
    provenance: {
      createdBy: input.provenance?.createdBy || input.createdBy || "user",
      provider: input.provenance?.provider ?? null,
      model: input.provenance?.model ?? null,
      interactionId: input.provenance?.interactionId ?? null,
      createdAt: input.provenance?.createdAt || input.createdAt || timestamp,
    },
  };
}

export function normalizeSection(section) {
  const type = REPORT_SECTION_TYPES.includes(section.type) ? section.type : "text";
  return {
    id: section.id || uid("section"),
    type,
    title: section.title || defaultTitle(type),
    subtitle: section.subtitle || "",
    visible: section.visible !== false,
    position: Number(section.position || 0),
    source: {
      visualizationId: section.source?.visualizationId ?? null,
      queryId: section.source?.queryId ?? null,
      dashboardId: section.source?.dashboardId ?? null,
    },
    content: {
      narrative: section.content?.narrative || "",
      caption: section.content?.caption || "",
      finding: section.content?.finding || "",
      sqlVisible: Boolean(section.content?.sqlVisible),
      markdown: section.content?.markdown || "",
      kpi: section.content?.kpi || null,
      table: { rowLimit: 25, columns: null, ...(section.content?.table || {}) },
    },
    snapshot: {
      generatedAt: section.snapshot?.generatedAt || null,
      imageDataUrl: section.snapshot?.imageDataUrl || null,
      rows: Array.isArray(section.snapshot?.rows) ? section.snapshot.rows : [],
      columns: Array.isArray(section.snapshot?.columns) ? section.snapshot.columns : [],
      rowCount: section.snapshot?.rowCount ?? null,
      runtimeMs: section.snapshot?.runtimeMs ?? null,
      filters: Array.isArray(section.snapshot?.filters) ? section.snapshot.filters : [],
      error: section.snapshot?.error || null,
    },
    sourceRevision: section.sourceRevision || {},
    snapshotRevision: section.snapshotRevision || null,
    provenance: section.provenance || { createdBy: "user", provider: null, model: null, createdAt: nowIso() },
  };
}

export function addReport(workspace, report = createReport()) {
  const normalized = normalizeReport(report);
  workspace.reports.push(normalized);
  workspace.active.reportId = normalized.id;
  workspace.updatedAt = nowIso();
  return normalized;
}

export function duplicateReport(workspace, reportId) {
  const source = findReport(workspace, reportId);
  const copy = normalizeReport({
    ...deepClone(source),
    id: uid("report"),
    name: `${source.name} copy`,
    title: `${source.title} copy`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    sections: source.sections.map((section, index) => ({ ...section, id: uid("section"), position: index })),
  });
  workspace.reports.push(copy);
  workspace.active.reportId = copy.id;
  workspace.updatedAt = nowIso();
  return copy;
}

export function deleteReport(workspace, reportId) {
  workspace.reports = workspace.reports.filter((report) => report.id !== reportId);
  if (workspace.active.reportId === reportId) workspace.active.reportId = workspace.reports[0]?.id || null;
  workspace.updatedAt = nowIso();
}

export function updateReport(workspace, reportId, patch) {
  const report = findReport(workspace, reportId);
  Object.assign(report, patch, { updatedAt: nowIso() });
  workspace.updatedAt = nowIso();
  return report;
}

export function addSection(report, section) {
  const normalized = normalizeSection({ position: report.sections.length, ...section });
  report.sections.push(normalized);
  normalizePositions(report);
  report.updatedAt = nowIso();
  return normalized;
}

export function removeSection(report, sectionId) {
  report.sections = report.sections.filter((section) => section.id !== sectionId);
  normalizePositions(report);
  report.updatedAt = nowIso();
}

export function duplicateSection(report, sectionId) {
  const section = findSection(report, sectionId);
  const copy = normalizeSection({ ...deepClone(section), id: uid("section"), position: section.position + 1 });
  report.sections.splice(section.position + 1, 0, copy);
  normalizePositions(report);
  report.updatedAt = nowIso();
  return copy;
}

export function moveSection(report, sectionId, delta) {
  const index = report.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) throw new Error("Report section not found.");
  const next = Math.max(0, Math.min(report.sections.length - 1, index + delta));
  const [section] = report.sections.splice(index, 1);
  report.sections.splice(next, 0, section);
  normalizePositions(report);
  report.updatedAt = nowIso();
}

export function setSectionVisible(report, sectionId, visible) {
  findSection(report, sectionId).visible = Boolean(visible);
  report.updatedAt = nowIso();
}

export function findReport(workspace, reportId = workspace.active.reportId) {
  const report = workspace.reports.find((item) => item.id === reportId);
  if (!report) throw new Error("Report not found.");
  return report;
}

export function findSection(report, sectionId) {
  const section = report.sections.find((item) => item.id === sectionId);
  if (!section) throw new Error("Report section not found.");
  return section;
}

export function validateReport(report, workspace = { queries: [], visualizations: [], dashboards: [] }) {
  const errors = [];
  const queryIds = new Set(workspace.queries.map((query) => query.id));
  const vizIds = new Set(workspace.visualizations.map((viz) => viz.id));
  const dashboardIds = new Set(workspace.dashboards.map((dashboard) => dashboard.id));
  report.sections.forEach((section, index) => {
    if (!REPORT_SECTION_TYPES.includes(section.type)) errors.push({ path: `sections.${index}.type`, message: `Unsupported section type '${section.type}'.` });
    if (section.source.queryId && !queryIds.has(section.source.queryId)) errors.push({ path: `sections.${index}.source.queryId`, message: "Referenced query is missing." });
    if (section.source.visualizationId && !vizIds.has(section.source.visualizationId)) errors.push({ path: `sections.${index}.source.visualizationId`, message: "Referenced visualization is missing." });
    if (section.source.dashboardId && !dashboardIds.has(section.source.dashboardId)) errors.push({ path: `sections.${index}.source.dashboardId`, message: "Referenced dashboard is missing." });
  });
  return { valid: errors.length === 0, errors };
}

export function isSectionStale(section, workspace) {
  if (!section.snapshotRevision) return ["visualization", "dashboard-snapshot", "query-table", "kpi"].includes(section.type);
  const query = workspace.queries.find((item) => item.id === section.source.queryId);
  const viz = workspace.visualizations.find((item) => item.id === section.source.visualizationId);
  const dashboard = workspace.dashboards.find((item) => item.id === section.source.dashboardId);
  return Boolean(
    (query && section.snapshotRevision.queryUpdatedAt && query.updatedAt !== section.snapshotRevision.queryUpdatedAt) ||
    (viz && section.snapshotRevision.visualizationUpdatedAt && viz.updatedAt !== section.snapshotRevision.visualizationUpdatedAt) ||
    (dashboard && section.snapshotRevision.dashboardUpdatedAt && dashboard.updatedAt !== section.snapshotRevision.dashboardUpdatedAt)
  );
}

function normalizePositions(report) {
  report.sections.forEach((section, index) => { section.position = index; });
}

function defaultTitle(type) {
  return type.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}
