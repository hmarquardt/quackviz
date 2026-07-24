import { createDashboard, addCard } from "../js/dashboard.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace, hydrateWorkspace } from "../js/workspace.js";
import { createInteractionBus } from "../js/interaction-bus.js";
import { addInteractionBinding, normalizeInteractionBinding, validateInteractionBinding } from "../js/interaction-bindings.js";
import { createInteractionEvent, interactionSignature, validateInteractionEvent } from "../js/interaction-events.js";
import { applyInteractionResolution, createInteractionState } from "../js/interaction-state.js";
import { resolveInteraction } from "../js/interaction-resolver.js";
import { buildBreadcrumb, drillDown, drillUp, resetDrill } from "../js/drilldown.js";
import { compileParameterizedSql, extractParameterNames, normalizeParameter } from "../js/parameters.js";
import { adaptEChartsBrush, adaptEChartsClick, adaptEChartsLegend, adaptMapLibreFeatureClick, adaptTableRowSelection } from "../js/selection-adapters.js";
import { AI_CONTRACTS } from "../js/ai-contracts.js";
import { validateAiResponse } from "../js/ai-validate.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixture() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, {
    id: "query_sales",
    name: "Sales",
    sql: "SELECT region, category, revenue FROM sales",
    sourceTables: ["sales"],
    parameters: [{ name: "selected_region", dataType: "category" }],
  });
  const spec = {
    version: 1,
    type: "bar",
    title: "Revenue",
    dataset: { queryId: query.id },
    encoding: { x: { field: "region", dataType: "category" }, y: [{ field: "revenue", dataType: "number" }], series: null, size: null, color: null },
    options: { tooltip: "axis", orientation: "vertical", zoom: false, legend: false },
  };
  const sourceViz = addOrUpdateVisualization(workspace, { id: "viz_source", name: "Source", queryId: query.id, spec });
  const targetViz = addOrUpdateVisualization(workspace, { id: "viz_target", name: "Target", queryId: query.id, spec });
  const dashboard = createDashboard({ id: "dashboard_sales", name: "Sales" });
  const sourceCard = addCard(dashboard, sourceViz.id);
  const targetCard = addCard(dashboard, targetViz.id);
  workspace.dashboards.push(dashboard);
  return { workspace, dashboard, query, sourceViz, targetViz, sourceCard, targetCard };
}

export const interactionTests = [
  { name: "interactions: valid category event", run: () => {
    const event = createInteractionEvent({ source: { cardId: "card_1" }, selection: { kind: "category", field: "region", values: ["East"] } });
    assert(validateInteractionEvent(event).valid, "category event invalid");
  } },
  { name: "interactions: valid range event", run: () => {
    const event = createInteractionEvent({ source: { cardId: "card_1" }, selection: { kind: "numeric-range", field: "revenue", semanticType: "number", min: 1, max: 5 } });
    assert(validateInteractionEvent(event).valid, "range event invalid");
  } },
  { name: "interactions: invalid kind rejected", run: () => {
    assert(!validateInteractionEvent({ source: { cardId: "card_1" }, selection: { kind: "script", field: "x" } }).valid, "invalid kind accepted");
  } },
  { name: "interactions: signature stable and input not mutated", run: () => {
    const event = createInteractionEvent({ source: { cardId: "card_1" }, selection: { kind: "category", field: "region", values: ["East"] } });
    const before = JSON.stringify(event);
    assert(interactionSignature(event) === interactionSignature(JSON.parse(JSON.stringify(event))), "signature changed");
    assert(JSON.stringify(event) === before, "event mutated");
  } },
  { name: "interaction bus: publish subscribe unsubscribe", run: () => {
    const bus = createInteractionBus();
    let count = 0;
    const off = bus.subscribe(() => { count += 1; });
    bus.publish(createInteractionEvent({ source: { cardId: "card_1" }, selection: { kind: "category", field: "region", values: ["East"] } }));
    off();
    bus.publish(createInteractionEvent({ source: { cardId: "card_2" }, selection: { kind: "category", field: "region", values: ["West"] } }));
    assert(count === 1 && bus.subscriptionCount() === 0, "subscription lifecycle failed");
  } },
  { name: "interaction bus: duplicate suppressed", run: () => {
    const bus = createInteractionBus();
    const event = createInteractionEvent({ source: { cardId: "card_1" }, selection: { kind: "category", field: "region", values: ["East"] } });
    assert(bus.publish(event).ok, "first publish failed");
    assert(bus.publish(event).duplicate, "duplicate not suppressed");
  } },
  { name: "bindings: explicit filter target", run: () => {
    const { workspace, dashboard, sourceCard, targetCard } = fixture();
    const binding = addInteractionBinding(dashboard, { source: { cardId: sourceCard.id, field: "region", eventKinds: ["category"] }, targets: { mode: "explicit", cardIds: [targetCard.id] }, action: { type: "filter", dashboardField: "region", operator: "in" } });
    assert(validateInteractionBinding(binding, dashboard, workspace).valid, "binding invalid");
  } },
  { name: "bindings: self target rejected", run: () => {
    const { workspace, dashboard, sourceCard } = fixture();
    const result = validateInteractionBinding({ source: { cardId: sourceCard.id, field: "region" }, targets: { mode: "explicit", cardIds: [sourceCard.id] } }, dashboard, workspace);
    assert(!result.valid, "self target accepted");
  } },
  { name: "bindings: circular binding rejected", run: () => {
    const { workspace, dashboard, sourceCard, targetCard } = fixture();
    dashboard.interactions.bindings = [normalizeInteractionBinding({ source: { cardId: targetCard.id, field: "region" }, targets: { mode: "explicit", cardIds: [sourceCard.id] } })];
    assert(!validateInteractionBinding({ source: { cardId: sourceCard.id, field: "region" }, targets: { mode: "explicit", cardIds: [targetCard.id] } }, dashboard, workspace).valid, "loop accepted");
  } },
  { name: "bindings: filter and highlight resolution", run: () => {
    const { workspace, dashboard, sourceCard, targetCard } = fixture();
    addInteractionBinding(dashboard, { source: { cardId: sourceCard.id, field: "region", eventKinds: ["category"] }, targets: { mode: "explicit", cardIds: [targetCard.id] }, action: { type: "filter", dashboardField: "region", operator: "in" } });
    const event = createInteractionEvent({ source: { cardId: sourceCard.id }, selection: { kind: "category", field: "region", values: ["East"] } });
    assert(resolveInteraction({ event, dashboard, workspace }).affectedCardIds[0] === targetCard.id, "filter target missing");
    dashboard.interactions.bindings = [normalizeInteractionBinding({ source: { cardId: sourceCard.id, field: "region", eventKinds: ["category"] }, targets: { mode: "explicit", cardIds: [targetCard.id] }, action: { type: "highlight", dashboardField: "region" } })];
    assert(resolveInteraction({ event, dashboard, workspace }).highlightedCardIds[0] === targetCard.id, "highlight target missing");
  } },
  { name: "parameters: extract and compile typed literals", run: () => {
    const sql = "SELECT * FROM sales WHERE region = {{ region }} AND revenue >= {{ min_revenue }} AND active = {{ active }}";
    const result = compileParameterizedSql(sql, [
      { name: "region", dataType: "string" },
      { name: "min_revenue", dataType: "number" },
      { name: "active", dataType: "boolean" },
    ], { region: "East", min_revenue: 100, active: true });
    assert(extractParameterNames(sql).length === 3, "parameter names missing");
    assert(result.sql.includes("'East'") && result.sql.includes("100") && result.sql.includes("TRUE"), "typed literals not compiled");
  } },
  { name: "parameters: required missing and escaping", run: () => {
    const missing = compileParameterizedSql("SELECT {{ region }}", [{ name: "region", required: true }], {});
    assert(missing.missingParameters[0] === "region", "missing parameter not reported");
    const escaped = compileParameterizedSql("SELECT {{ region }}", [{ name: "region", dataType: "string" }], { region: "O'Brien; DROP" });
    assert(escaped.sql.includes("'O''Brien; DROP'"), "string not escaped as literal");
  } },
  { name: "parameters: raw SQL fragment rejected for numeric type", run: () => {
    let rejected = false;
    try {
      compileParameterizedSql("SELECT {{ n }}", [{ name: "n", dataType: "number" }], { n: "1; DROP TABLE sales" });
    } catch {
      rejected = true;
    }
    assert(rejected, "numeric SQL fragment accepted");
  } },
  { name: "parameters: survive workspace round trip", run: () => {
    const workspace = createWorkspace();
    addOrUpdateQuery(workspace, { sql: "SELECT {{ region }}", parameters: [{ name: "region", dataType: "category" }] });
    const restored = hydrateWorkspace(JSON.parse(JSON.stringify(workspace)));
    assert(restored.queries[0].parameters[0].label === "region", "parameter not normalized");
  } },
  { name: "drilldown: breadcrumb, up, reset", run: () => {
    const drill = drillDown({ triggerField: "region", hierarchy: [{ field: "region", label: "Region" }, { field: "category", label: "Category" }] }, "East");
    assert(buildBreadcrumb(drill.path) === "All > East", "breadcrumb wrong");
    assert(drillUp(drill).path.length === 0, "drill up failed");
    assert(resetDrill(drill).currentLevel === 0, "reset failed");
  } },
  { name: "selection adapters: ECharts and MapLibre", run: () => {
    assert(adaptEChartsClick({ name: "East" }, { cardId: "card_1" }, "region").selection.values[0] === "East", "echarts click failed");
    assert(adaptEChartsBrush({ areas: [{ coordRange: [1, 5] }] }, { cardId: "card_1" }, "revenue").selection.kind === "numeric-range", "brush failed");
    assert(adaptEChartsLegend({ name: "Furniture", selected: { Furniture: true } }, { cardId: "card_1" }, "category").selection.kind === "legend", "legend failed");
    assert(adaptMapLibreFeatureClick({ id: "CA", properties: { state: "CA" } }, { cardId: "card_map" }, "state").selection.values[0] === "CA", "map click failed");
    assert(adaptTableRowSelection({ id: 1, region: "East" }, { cardId: "card_table" }, "region").selection.values[0] === "East", "table row failed");
  } },
  { name: "interaction state: resolution records lineage summary", run: () => {
    const event = createInteractionEvent({ source: { cardId: "card_1" }, selection: { kind: "category", field: "region", values: ["East"] } });
    const next = applyInteractionResolution(createInteractionState(), event, { filters: [{ field: "region", value: ["East"] }], highlights: [], parameters: {}, affectedCardIds: ["card_2"], skippedTargets: [] });
    assert(next.history[0].summary === "region = East" && next.activeFilters.length === 1, "state not recorded");
  } },
  { name: "ai interactions: valid proposal", run: () => {
    const { workspace, dashboard, sourceCard, targetCard } = fixture();
    dashboard.workspace = workspace;
    const payload = { contract: AI_CONTRACTS.interactions, contractVersion: 1, summary: "Region filters dashboard.", bindings: [{ title: "Region", sourceCardId: sourceCard.id, sourceField: "region", eventKinds: ["category"], targetMode: "explicit", targetCardIds: [targetCard.id], action: { type: "filter", dashboardField: "region", operator: "in" } }], drilldowns: [], parameters: [], assumptions: [], cautions: [] };
    assert(validateAiResponse(payload, { expectedContract: AI_CONTRACTS.interactions, dataset: dashboard }).valid, "valid AI interaction rejected");
  } },
  { name: "ai interactions: invalid card and executable rejected", run: () => {
    const { dashboard, targetCard } = fixture();
    const payload = { contract: AI_CONTRACTS.interactions, contractVersion: 1, summary: "Bad", bindings: [{ title: "Bad", sourceCardId: "missing", sourceField: "region", eventKinds: ["category"], targetMode: "explicit", targetCardIds: [targetCard.id], action: { type: "filter", dashboardField: "region", operator: "in", transform: "() => true" } }], drilldowns: [], parameters: [], assumptions: [], cautions: [] };
    assert(!validateAiResponse(payload, { expectedContract: AI_CONTRACTS.interactions, dataset: dashboard }).valid, "invalid AI interaction accepted");
  } },
];
