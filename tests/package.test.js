import { AI_CONTRACTS } from "../js/ai-contracts.js";
import { validateAiResponse } from "../js/ai-validate.js";
import { APP_VERSION, BUILD_DATE } from "../js/constants.js";
import { addCard, addDashboard, createDashboard } from "../js/dashboard.js";
import { createEmbedConfig, createIframeSnippet, validateEmbedConfig, validateEmbedMessage } from "../js/embed.js";
import { disableExtension, enableExtension, installExtension, uninstallExtension, validateExtension } from "../js/extensions.js";
import { dataFingerprint, sha256Hex, verifyIntegrity, createIntegrity } from "../js/package-integrity.js";
import { validateExternalSchema, createColumnPrunedExtractPlan, createPreAggregatedPlan } from "../js/package-data.js";
import { resolvePackageDependencies } from "../js/package-dependencies.js";
import { createPortablePackage, importPortablePackage, inspectPortablePackage, validatePortablePackage, verifyPortablePackageIntegrity } from "../js/package.js";
import { migratePackage } from "../js/package-migrations.js";
import { createStandaloneHtml, runtimeHarnessLoad } from "../js/standalone-runtime.js";
import { addReport, addSection, createReport } from "../js/report.js";
import { applyTemplate, BUILT_IN_TEMPLATES, createTemplate, exportTemplate, matchTemplate, validateTemplate } from "../js/templates.js";
import { addOrUpdateDataSource, addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixture() {
  const workspace = createWorkspace();
  addOrUpdateDataSource(workspace, { id: "source_sales", name: "Sales", tableName: "sales", sourceType: "sample", columns: [
    { name: "order_date", duckType: "DATE", semanticType: "date" },
    { name: "region", duckType: "VARCHAR", semanticType: "category" },
    { name: "revenue", duckType: "DOUBLE", semanticType: "number" },
    { name: "customer_email", duckType: "VARCHAR", semanticType: "category" },
  ], rowCount: 2 });
  const query = addOrUpdateQuery(workspace, { id: "query_sales", name: "Sales", sql: "SELECT order_date, region, revenue FROM sales", sourceTables: ["sales"] });
  const viz = addOrUpdateVisualization(workspace, { id: "viz_sales", name: "Revenue", queryId: query.id, spec: { version: 1, type: "bar", title: "Revenue", dataset: { queryId: query.id }, encoding: { x: { field: "region" }, y: [{ field: "revenue" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  const dashboard = addDashboard(workspace, createDashboard({ id: "dashboard_sales", name: "Sales dashboard" }));
  addCard(dashboard, viz.id);
  const report = addReport(workspace, createReport({ id: "report_sales", title: "Sales report" }));
  addSection(report, { type: "visualization", source: { visualizationId: viz.id } });
  workspace.active.dashboardId = dashboard.id;
  return { workspace, query, viz, dashboard, report };
}

const rows = { sales: [{ order_date: "2026-01-01", region: "East", revenue: 100, customer_email: "a@example.com" }] };

export const packageTests = [
  { name: "package-dependencies: dashboard resolves visualizations and queries", run: () => { const { workspace, dashboard } = fixture(); const plan = resolvePackageDependencies(workspace, { dashboards: [dashboard.id] }); assert(plan.valid && plan.required.visualizations.includes("viz_sales") && plan.required.queries.includes("query_sales"), "closure missing"); } },
  { name: "package-dependencies: report resolves sources", run: () => { const { workspace, report } = fixture(); const plan = resolvePackageDependencies(workspace, { reports: [report.id] }); assert(plan.required.visualizations.includes("viz_sales"), "report viz missing"); } },
  { name: "package-dependencies: missing query detected", run: () => { const { workspace, viz } = fixture(); workspace.queries = []; const plan = resolvePackageDependencies(workspace, { visualizations: [viz.id] }); assert(!plan.valid && plan.missing.some((item) => item.type === "query"), "missing not detected"); } },
  { name: "package: manifest version and counts", run: async () => { const { workspace, dashboard } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "standalone", dataMode: "external", selection: { dashboards: [dashboard.id] } }); assert(pkg.manifest.createdBy.appVersion === APP_VERSION && pkg.manifest.artifactCounts.dashboards === 1, "manifest invalid"); } },
  { name: "package: API key omitted", run: async () => { const { workspace } = fixture(); workspace.settings.ai.apiKey = "secret"; const pkg = await createPortablePackage(workspace, { packageMode: "workspace-backup" }); assert(!JSON.stringify(pkg).includes("secret") && validatePortablePackage(pkg).valid, "secret leaked"); } },
  { name: "package: included CSV and fingerprint", run: async () => { const { workspace, dashboard } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "standalone", dataMode: "included", selection: { dashboards: [dashboard.id] }, tableRows: rows }); assert(pkg.data.tables.sales.content.includes("East") && pkg.data.tables.sales.fingerprint, "included data missing"); } },
  { name: "package: external schema requirements", run: async () => { const { workspace, dashboard } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "standalone", dataMode: "external", selection: { dashboards: [dashboard.id] } }); assert(pkg.data.requirements[0].tableName === "sales", "requirement missing"); } },
  { name: "package: snapshot-only mode", run: async () => { const { workspace, dashboard } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "standalone", dataMode: "snapshot-only", selection: { dashboards: [dashboard.id] } }); assert(pkg.data.snapshots && pkg.data.limitations.length, "snapshot mode missing"); } },
  { name: "package: column-pruned and pre-aggregated plans", run: () => { const { workspace, dashboard } = fixture(); const plan = resolvePackageDependencies(workspace, { dashboards: [dashboard.id] }); assert(createColumnPrunedExtractPlan(workspace, plan).length === 1 && createPreAggregatedPlan(workspace, plan).length === 1, "extract plans missing"); } },
  { name: "package: integrity verifies and detects mismatch", run: async () => { const files = [{ path: "a.json", content: "ok" }]; const integrity = await createIntegrity(files); assert((await verifyIntegrity(files, integrity)).ok, "hash did not verify"); assert(!(await verifyIntegrity([{ path: "a.json", content: "changed" }], integrity)).ok, "mismatch accepted"); } },
  { name: "package: portable package integrity", run: async () => { const { workspace } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "workspace-backup" }); assert((await verifyPortablePackageIntegrity(pkg)).ok, "package integrity failed"); } },
  { name: "package: import merges package", run: async () => { const { workspace } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "workspace-backup" }); const target = createWorkspace(); const result = importPortablePackage(target, pkg); assert(result.workspace.queries.length === 1, "import failed"); } },
  { name: "package: migration prior version", run: () => { const result = migratePackage({ format: "quackviz-package", formatVersion: 0, manifest: {}, workspace: createWorkspace() }); assert(result.migrated && result.package.formatVersion === 1, "migration failed"); } },
  { name: "package: future version rejected", run: () => { let failed = false; try { migratePackage({ format: "quackviz-package", formatVersion: 99 }); } catch { failed = true; } assert(failed, "future accepted"); } },
  { name: "standalone: html and runtime footer version", run: async () => { const { workspace, dashboard } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "standalone", selection: { dashboards: [dashboard.id] } }); const html = createStandaloneHtml(pkg); assert(html.includes(APP_VERSION) && runtimeHarnessLoad(pkg).footerVersion === APP_VERSION, "runtime invalid"); } },
  { name: "standalone: disabled capabilities unavailable", run: async () => { const { workspace, dashboard } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "standalone", selection: { dashboards: [dashboard.id] }, capabilities: { dataExport: false, queryEditing: false } }); assert(!runtimeHarnessLoad(pkg).capabilities.dataExport && !runtimeHarnessLoad(pkg).capabilities.queryEditing, "disabled caps enabled"); } },
  { name: "external data: schema compatibility", run: () => { const expected = { requiredColumns: [{ name: "revenue", compatibleTypes: ["DOUBLE"], semanticType: "number" }] }; assert(validateExternalSchema(expected, { columns: [{ name: "revenue", duckType: "DOUBLE" }] }).valid, "compatible schema rejected"); assert(!validateExternalSchema(expected, { columns: [] }).valid, "missing field accepted"); } },
  { name: "embed: valid config and snippet", run: () => { const { workspace, viz } = fixture(); const config = createEmbedConfig({ artifactType: "visualization", artifactId: viz.id }); assert(validateEmbedConfig(config, workspace).valid && createIframeSnippet(config).includes("iframe"), "embed invalid"); } },
  { name: "embed: unsafe message rejected", run: () => { const config = createEmbedConfig({ capabilities: { filters: false } }); const result = validateEmbedMessage({ format: "quackviz-embed-message", version: 1, type: "set-filter", payload: { sql: "SELECT 1" } }, { allowedOrigin: "https://example.com", origin: "https://evil.test", config }); assert(!result.valid, "unsafe message accepted"); } },
  { name: "templates: valid dashboard template", run: () => assert(validateTemplate(createTemplate({ templateType: "dashboard", name: "T" })).valid, "template invalid") },
  { name: "templates: semantic matching requires approval", run: () => { const { workspace } = fixture(); const match = matchTemplate(BUILT_IN_TEMPLATES[0], workspace); assert(match.requiresApproval && match.mappings.length, "template approval missing"); } },
  { name: "templates: apply requires approved mapping", run: () => { const { workspace } = fixture(); assert(!applyTemplate(BUILT_IN_TEMPLATES[0], workspace).applied, "template applied without approval"); } },
  { name: "templates: export has app version", run: () => assert(exportTemplate(BUILT_IN_TEMPLATES[0]).metadata.appVersion === APP_VERSION, "template version mismatch") },
  { name: "extensions: valid chart definition", run: () => { const result = validateExtension({ format: "quackviz-extension", formatVersion: 1, id: "extension_valid", extensionTypes: ["chart-definition"], contributions: { chartDefinitions: [{ id: "lollipop", compilerFamily: "bar" }] } }); assert(result.valid, "extension rejected"); } },
  { name: "extensions: executable rejected", run: () => assert(!validateExtension({ format: "quackviz-extension", formatVersion: 1, id: "extension_bad", extensionTypes: ["chart-definition"], contributions: { script: "() => true" } }).valid, "executable accepted") },
  { name: "extensions: raw options and unknown compiler rejected", run: () => assert(!validateExtension({ format: "quackviz-extension", formatVersion: 1, id: "extension_bad_chart", extensionTypes: ["chart-definition"], contributions: { chartDefinitions: [{ id: "x", compilerFamily: "custom", rawOption: {} }] } }).valid, "bad chart accepted") },
  { name: "extensions: install disable enable uninstall", run: () => { let registry = installExtension([], { format: "quackviz-extension", formatVersion: 1, id: "extension_lifecycle", extensionTypes: ["recommendation-rule"], contributions: {} }, { enable: true }); registry = disableExtension(registry, "extension_lifecycle"); registry = enableExtension(registry, "extension_lifecycle"); registry = uninstallExtension(registry, "extension_lifecycle"); assert(registry.length === 0, "extension lifecycle failed"); } },
  { name: "privacy: warnings and API key excluded", run: async () => { const { workspace } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "workspace-backup", dataMode: "included", tableRows: rows }); assert(pkg.manifest.privacy.suspectedSensitiveFields > 0 && pkg.manifest.privacy.apiKeysExcluded, "privacy review missing"); } },
  { name: "ai-package: valid package plan", run: () => { const { workspace, dashboard } = fixture(); const result = validateAiResponse({ contract: AI_CONTRACTS.packagePlan, contractVersion: 1, recommendedMode: "standalone", recommendedDataMode: "external", entrypoints: [{ type: "dashboard", id: dashboard.id }], include: { dashboards: [dashboard.id] }, privacyRecommendations: [{ action: "disable-data-export", reason: "Reduce disclosure." }], capabilities: { filters: true, dataExport: false }, cautions: [] }, { expectedContract: AI_CONTRACTS.packagePlan, dataset: workspace }); assert(result.valid, "AI package plan rejected"); } },
  { name: "version: package metadata matches canonical version", run: async () => { const { workspace } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "workspace-backup" }); assert(pkg.manifest.createdBy.appVersion === APP_VERSION && pkg.manifest.createdBy.buildDate === BUILD_DATE, "package version mismatch"); } },
  { name: "fingerprint: deterministic", run: async () => assert(await dataFingerprint("abc") === await sha256Hex("abc"), "fingerprint mismatch") },
  { name: "package: inspection summary", run: async () => { const { workspace } = fixture(); const pkg = await createPortablePackage(workspace, { packageMode: "workspace-backup" }); assert(inspectPortablePackage(pkg).integrityFileCount >= 4, "inspection incomplete"); } },
];
