import { APP_VERSION } from "../js/constants.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";
import { HELP_TOPICS, SHOWCASE_DATASETS, aboutMetadata, buildCommandItems, createOnboardingState, recentItems, searchCommandItems } from "../js/product.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

export const tests = [
  {
    name: "product: detects first-run onboarding state",
    run: () => {
      const onboarding = createOnboardingState({ workspace: createWorkspace() });
      assert(onboarding.firstRun, "first-run state not detected");
      assert(onboarding.steps.every((step) => step.complete === false), "empty workspace has completed steps");
    },
  },
  {
    name: "product: checklist progresses from workspace state",
    run: () => {
      const workspace = createWorkspace();
      workspace.dataSources.push({ id: "source_1", name: "Orders", tableName: "orders", columns: [{ name: "id", duckType: "INTEGER" }] });
      const query = addOrUpdateQuery(workspace, { name: "Count", sql: "SELECT COUNT(*) FROM orders" });
      addOrUpdateVisualization(workspace, { name: "Count chart", queryId: query.id, spec: { version: 1, type: "bar", title: "Count", dataset: { queryId: query.id }, encoding: { x: { field: "id", dataType: "category" }, y: [{ field: "count", dataType: "number" }] }, options: {} } });
      const onboarding = createOnboardingState({ workspace });
      assert(onboarding.steps.filter((step) => step.complete).length >= 4, "checklist did not reflect workspace progress");
    },
  },
  {
    name: "product: recent items are bounded and ordered",
    run: () => {
      const workspace = createWorkspace();
      workspace.dataSources.push({ id: "source_a", name: "Older", tableName: "older", importedAt: "2026-01-01T00:00:00Z" });
      addOrUpdateQuery(workspace, { id: "query_b", name: "Newer", sql: "SELECT 1", updatedAt: "2026-02-01T00:00:00Z" });
      const recent = recentItems(workspace, 1);
      assert(recent.length === 1 && recent[0].name === "Newer", "recent item ordering failed");
    },
  },
  {
    name: "product: command palette searches commands and help",
    run: () => {
      const items = buildCommandItems(createWorkspace());
      assert(searchCommandItems(items, "add data")[0]?.label === "Add data", "command search failed");
      assert(searchCommandItems(items, "cors").some((item) => item.type === "Help"), "help search failed");
    },
  },
  {
    name: "product: developer commands are not exposed in normal palette",
    run: () => {
      const labels = buildCommandItems(createWorkspace()).map((item) => item.label.toLowerCase());
      assert(!labels.some((label) => label.includes("fixture") || label.includes("synthetic")), "developer command exposed");
    },
  },
  {
    name: "product: help topics are local",
    run: () => {
      assert(HELP_TOPICS.length >= 10, "help topic index too small");
      assert(HELP_TOPICS.every((topic) => topic.path.startsWith("docs/")), "help topic is not local");
    },
  },
  {
    name: "product: showcase recipes reference real dataset columns",
    run: async () => {
      for (const dataset of SHOWCASE_DATASETS) {
        const response = await fetch(`../examples/showcase/${dataset.file}`);
        const rows = await response.json();
        const columns = new Set(Object.keys(rows[0] || {}));
        assert(rows.length === dataset.rows, `${dataset.title} row count is stale`);
        assert(dataset.recipe.requiredColumns.every((column) => columns.has(column)), `${dataset.title} recipe references a missing column`);
      }
    },
  },
  {
    name: "product: about metadata uses canonical version",
    run: () => {
      const about = aboutMetadata();
      assert(about.appVersion === APP_VERSION, "about version mismatch");
      assert(about.releaseChannel === "beta", "beta channel missing");
    },
  },
];
