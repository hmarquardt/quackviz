export function resolveInteraction({ event, dashboard, workspace }) {
  const bindings = (dashboard.interactions?.bindings || []).filter((binding) => binding.enabled !== false && binding.source.cardId === event.source.cardId && binding.source.eventKinds.includes(event.selection.kind));
  const filters = [];
  const highlights = [];
  const parameters = {};
  const affected = new Set();
  const skippedTargets = [];
  for (const binding of bindings) {
    const targets = targetCards(binding, dashboard);
    for (const card of targets) {
      if (card.id === event.source.cardId && binding.targets.mode !== "self") {
        skippedTargets.push({ cardId: card.id, reason: "Source card does not react to its own event." });
        continue;
      }
      const target = resolveTarget(card, workspace);
      if (!target.ok) { skippedTargets.push({ cardId: card.id, reason: target.reason }); continue; }
      const field = binding.action.dashboardField || event.selection.field;
      if (!target.columns.has(field) && binding.action.type !== "set-parameter") {
        skippedTargets.push({ cardId: card.id, reason: `Field '${field}' is not available in target result bindings.` });
        continue;
      }
      if (binding.action.type === "filter") {
        filters.push(interactionFilter(event, binding, card.id));
        affected.add(card.id);
      } else if (binding.action.type === "highlight") {
        highlights.push({ cardId: card.id, field, values: event.selection.values || [], sourceInteractionId: event.id });
      } else if (binding.action.type === "set-parameter") {
        parameters[binding.action.targetParameter] = transformValue(event.selection.values?.[0], binding.action.transform);
        affected.add(card.id);
      }
    }
  }
  return { filters, highlights, parameters, affectedCardIds: [...affected], highlightedCardIds: highlights.map((item) => item.cardId), skippedTargets };
}

function targetCards(binding, dashboard) {
  if (binding.targets.mode === "explicit") return dashboard.layout.filter((card) => (binding.targets.cardIds || []).includes(card.id));
  if (binding.targets.mode === "all-except-source") return dashboard.layout.filter((card) => card.id !== binding.source.cardId);
  return dashboard.layout;
}

function resolveTarget(card, workspace) {
  const viz = workspace.visualizations.find((item) => item.id === card.visualizationId);
  const query = workspace.queries.find((item) => item.id === viz?.queryId);
  if (!viz || !query) return { ok: false, reason: "Missing visualization or query." };
  const fields = new Set();
  for (const ref of Object.values(viz.spec?.encoding || {})) {
    if (Array.isArray(ref)) ref.forEach((item) => item?.field && fields.add(item.field));
    else if (ref?.field) fields.add(ref.field);
  }
  for (const table of query.sourceTables || []) fields.add(table);
  return { ok: true, columns: fields, viz, query };
}

function interactionFilter(event, binding, cardId) {
  const operator = binding.action.operator || "in";
  const value = event.selection.min != null ? [event.selection.min, event.selection.max] : event.selection.values;
  return { id: `filter_${event.id}_${cardId}`, cardId, source: "interaction", sourceInteractionId: event.id, field: binding.action.dashboardField || event.selection.field, semanticType: event.selection.semanticType, operator, value, enabled: true };
}

function transformValue(value, transform = "identity") {
  if (transform === "lowercase") return String(value ?? "").toLowerCase();
  if (transform === "uppercase") return String(value ?? "").toUpperCase();
  if (transform === "number") return Number(value);
  if (transform === "string") return String(value ?? "");
  return value;
}
