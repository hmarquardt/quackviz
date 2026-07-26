import { deepClone, sanitizeTableName } from "./utils.js";

export const JSON_STRUCTURE_CONTRACT_VERSION = 1;
export const JSON_IMPORT_PLAN_VERSION = 1;
export const AI_JSON_MODELING_CONTRACT_VERSION = 1;

export const JSON_DISCOVERY_LIMITS = Object.freeze({
  maxDocumentBytes: 25 * 1024 * 1024,
  maxDepth: 12,
  maxObjects: 5000,
  maxArrayElements: 1000,
  maxCandidates: 30,
  maxFieldsPerCandidate: 100,
  maxRelationships: 60,
});

const SENSITIVE_NAME = /(account|email|phone|address|ssn|social.?security|medical|diagnos|card|credential|password|token|secret|api.?key|free.?text|description)/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]{7,}$/;
const TOKEN = /^[A-Za-z0-9_-]{24,}$/;

export function discoverJsonStructure(document, options = {}) {
  const limits = { ...JSON_DISCOVERY_LIMITS, ...options };
  const estimatedBytes = byteLength(document);
  const statistics = { estimatedBytes, objectsInspected: 0, arrayElementsInspected: 0, maximumDepth: 0, sampled: false, scalarFieldCount: 0 };
  const warnings = [];
  if (estimatedBytes > limits.maxDocumentBytes) warnings.push({ code: "DOCUMENT_SAMPLE_LIMIT", message: "The structural profile uses a bounded sample because the document is large." });
  const rootType = classifyRoot(document);
  if (rootType === "invalid") return profile(rootType, [], [], warnings, statistics);

  const candidateMap = new Map();
  walk(document, "$", null, 0);
  const candidates = [...candidateMap.values()].slice(0, limits.maxCandidates).map((candidate, index) => finalizeCandidate(candidate, index, statistics));
  const byPath = new Map(candidates.map((candidate) => [candidate.path, candidate]));
  for (const candidate of candidates) {
    const parent = nearestParentCandidate(candidate.path, byPath);
    candidate.parentCandidateId = parent?.id || null;
    candidate.parentPath = parent?.path || null;
  }
  const relationships = candidates
    .filter((candidate) => candidate.parentCandidateId)
    .slice(0, limits.maxRelationships)
    .map((child) => inferRelationship(candidates.find((item) => item.id === child.parentCandidateId), child));
  const structuralFingerprint = fingerprint(candidates);
  return {
    contract: "quackviz-json-structure-profile",
    contractVersion: JSON_STRUCTURE_CONTRACT_VERSION,
    id: `profile_${structuralFingerprint}`,
    rootType,
    rootFields: objectFields(document),
    candidateTables: candidates,
    relationships,
    warnings,
    statistics: { ...statistics, candidateTableCount: candidates.length, relationshipCount: relationships.length },
    structuralFingerprint,
  };

  function walk(value, path, parentPath, depth, suppressCandidate = false) {
    statistics.maximumDepth = Math.max(statistics.maximumDepth, depth);
    if (depth > limits.maxDepth) {
      statistics.sampled = true;
      return;
    }
    if (Array.isArray(value)) {
      const sample = value.slice(0, limits.maxArrayElements);
      if (sample.length < value.length) statistics.sampled = true;
      statistics.arrayElementsInspected += sample.length;
      const objects = sample.filter(isRecord);
      if (objects.length && candidateMap.size < limits.maxCandidates) addCandidate(path, objects, value.length, objects.length / Math.max(sample.length, 1), parentPath);
      sample.forEach((item) => walk(item, path, parentPath, depth + 1, objects.length > 0));
      return;
    }
    if (!isRecord(value) || statistics.objectsInspected >= limits.maxObjects) {
      if (statistics.objectsInspected >= limits.maxObjects) statistics.sampled = true;
      return;
    }
    statistics.objectsInspected += 1;
    const scalars = Object.entries(value).filter(([, item]) => !isContainer(item));
    if (!suppressCandidate && (scalars.length || path === "$") && candidateMap.size < limits.maxCandidates) addCandidate(path, [value], 1, 1, parentPath);
    for (const [key, child] of Object.entries(value)) {
      if (isContainer(child)) walk(child, `${path}.${escapePathSegment(key)}`, path, depth + 1);
    }
  }

  function addCandidate(path, rows, rowCount, objectCoverage, parentPath) {
    const current = candidateMap.get(path) || { path, rows: [], rowCount: 0, objectCoverage, parentPath };
    current.rows.push(...rows.slice(0, Math.max(0, limits.maxArrayElements - current.rows.length)));
    current.rowCount = Math.max(current.rowCount, rowCount);
    current.objectCoverage = Math.min(current.objectCoverage, objectCoverage);
    candidateMap.set(path, current);
  }

  function finalizeCandidate(candidate, index) {
    const fields = inferFields(candidate.rows, limits.maxFieldsPerCandidate);
    statistics.scalarFieldCount += fields.length;
    return {
      id: `candidate_${index + 1}`,
      path: candidate.path,
      suggestedName: suggestedName(candidate.path, rootType),
      rowCount: candidate.rowCount,
      estimated: statistics.sampled,
      objectCoverage: round(candidate.objectCoverage),
      fields,
      parentCandidateId: null,
      parentPath: null,
    };
  }
}

export function createJsonImportPlan(structureProfile, { strategy = "relational", selectedCandidateIds = null } = {}) {
  assertProfile(structureProfile);
  if (strategy === "raw") {
    return {
      contract: "quackviz-json-import-plan",
      contractVersion: JSON_IMPORT_PLAN_VERSION,
      sourceProfileId: structureProfile.id,
      structuralFingerprint: structureProfile.structuralFingerprint,
      strategy,
      tables: [{
        id: "__raw_document",
        name: "document",
        sourcePath: "$",
        include: true,
        key: { mode: "generated", fields: ["__row_id"], confidence: 1 },
        fields: [{ sourcePath: "$", outputName: "document_json", mode: "raw-document", sensitive: false }],
        inheritedFields: [],
      }],
      relationships: [],
      warnings: [...structureProfile.warnings],
      provenance: { generatedBy: "deterministic", model: null, sampleValuesShared: false, approvedAt: null },
    };
  }
  const selected = selectedCandidateIds ? new Set(selectedCandidateIds) : null;
  const tables = structureProfile.candidateTables.map((candidate) => {
    const fields = candidate.fields.map((field) => ({
      sourcePath: field.name,
      outputName: sanitizeColumnName(field.name),
      mode: fieldMode(structureProfile, candidate, field, strategy),
      sensitive: field.sensitive,
    }));
    if (structureProfile.rootType === "GeoJSON" && candidate.path === "$.features" && candidate.fields.some((field) => field.name === "geometry")) {
      fields.push(
        { sourcePath: "geometry", outputName: "longitude", mode: "geojson-longitude", sensitive: false },
        { sourcePath: "geometry", outputName: "latitude", mode: "geojson-latitude", sensitive: false },
      );
    }
    return {
      id: candidate.id,
      name: sanitizeTableName(candidate.suggestedName),
      sourcePath: candidate.path,
      include: selected
        ? selected.has(candidate.id)
        : structureProfile.rootType === "GeoJSON"
          ? candidate.path === "$.features"
          : candidate.objectCoverage >= 0.5,
      key: keyInstruction(candidate),
      fields,
      inheritedFields: [],
    };
  });
  const tableIds = new Set(tables.filter((table) => table.include).map((table) => table.id));
  const relationships = structureProfile.relationships.filter((relationship) => tableIds.has(relationship.parentCandidateId) && tableIds.has(relationship.childCandidateId));
  for (const relationship of relationships) {
    const child = tables.find((table) => table.id === relationship.childCandidateId);
    child.inheritedFields.push({
      parentCandidateId: relationship.parentCandidateId,
      sourceField: relationship.parentKey,
      outputName: relationship.childForeignKey,
      generated: relationship.generatedKey,
    });
  }
  return {
    contract: "quackviz-json-import-plan",
    contractVersion: JSON_IMPORT_PLAN_VERSION,
    sourceProfileId: structureProfile.id,
    structuralFingerprint: structureProfile.structuralFingerprint,
    strategy,
    tables,
    relationships,
    warnings: [...structureProfile.warnings],
    provenance: { generatedBy: "deterministic", model: null, sampleValuesShared: false, approvedAt: null },
  };
}

export function validateJsonImportPlan(plan, structureProfile) {
  const errors = [];
  if (plan?.contract !== "quackviz-json-import-plan" || plan?.contractVersion !== JSON_IMPORT_PLAN_VERSION) errors.push(issue("$", "Unsupported import-plan contract."));
  if (plan?.sourceProfileId !== structureProfile?.id) errors.push(issue("sourceProfileId", "Plan does not match this structural profile."));
  const candidates = new Map((structureProfile?.candidateTables || []).map((candidate) => [candidate.id, candidate]));
  const names = new Set();
  for (const [index, table] of (plan?.tables || []).entries()) {
    const path = `tables[${index}]`;
    if (plan.strategy === "raw" && table.id === "__raw_document") {
      if (table.sourcePath !== "$" || table.fields?.length !== 1 || table.fields[0].mode !== "raw-document") errors.push(issue(path, "Invalid raw-document instruction."));
      continue;
    }
    const candidate = candidates.get(table.id);
    if (!candidate || candidate.path !== table.sourcePath) errors.push(issue(`${path}.sourcePath`, "Source path does not exist in the profile."));
    if (!isSafeName(table.name) || names.has(table.name)) errors.push(issue(`${path}.name`, "Table name must be safe and unique."));
    names.add(table.name);
    const fields = new Set(candidate?.fields.map((field) => field.name) || []);
    for (const field of table.fields || []) {
      const rootField = String(field.sourcePath || "").split(".")[0];
      if (!fields.has(rootField)) errors.push(issue(`${path}.fields`, `Source field '${field.sourcePath}' does not exist.`));
      if (!["scalar", "flatten", "json", "omit", "geojson-latitude", "geojson-longitude"].includes(field.mode)) errors.push(issue(`${path}.fields`, "Unsupported field mode."));
      if (!isSafeName(field.outputName)) errors.push(issue(`${path}.fields`, "Unsafe output field name."));
    }
  }
  const included = new Set((plan?.tables || []).filter((table) => table.include).map((table) => table.id));
  for (const relationship of plan?.relationships || []) {
    if (!candidates.has(relationship.parentCandidateId) || !candidates.has(relationship.childCandidateId)) errors.push(issue("relationships", "Relationship references an unknown table."));
    if (included.has(relationship.childCandidateId) && !included.has(relationship.parentCandidateId)) errors.push(issue("relationships", "An included child table requires its included parent table."));
  }
  return { valid: errors.length === 0, errors };
}

export function extractJsonTables(document, plan, structureProfile) {
  const validation = validateJsonImportPlan(plan, structureProfile);
  if (!validation.valid) throw Object.assign(new Error(validation.errors[0].message), { code: "JSON_IMPORT_PLAN_INVALID", validation });
  if (plan.strategy === "raw") {
    const table = plan.tables.find((item) => item.include);
    return table ? [{ tableId: table.id, name: table.name, sourcePath: "$", rows: [{ __row_id: "__raw_document_1", document_json: JSON.stringify(document), __source_path: "$", __source_index: 0 }] }] : [];
  }
  const occurrences = collectOccurrences(document, structureProfile.candidateTables);
  const output = [];
  for (const table of plan.tables.filter((item) => item.include)) {
    const rows = (occurrences.get(table.id) || []).map((occurrence, index) => {
      const row = {};
      for (const field of table.fields.filter((item) => item.mode !== "omit")) {
        const value = getRelative(occurrence.value, field.sourcePath);
        if (field.mode === "geojson-latitude") row[field.outputName] = pointCoordinate(value, 1);
        else if (field.mode === "geojson-longitude") row[field.outputName] = pointCoordinate(value, 0);
        else if (field.mode === "flatten" && isRecord(value)) flattenObject(value, field.outputName, row);
        else row[field.outputName] = isContainer(value) ? JSON.stringify(value) : value;
      }
      if (table.key.mode === "generated") row[table.key.fields[0]] = `${table.id}_${index + 1}`;
      row.__source_path = table.sourcePath;
      row.__source_index = occurrence.index;
      for (const inherited of table.inheritedFields) {
        const parent = occurrence.parents[inherited.parentCandidateId];
        row[inherited.outputName] = inherited.generated
          ? parent?.generatedId || null
          : getRelative(parent?.value, inherited.sourceField);
      }
      return row;
    });
    output.push({ tableId: table.id, name: table.name, sourcePath: table.sourcePath, rows });
  }
  return output;
}

export function buildJsonModelingAiContext(profile, deterministicPlan, { mode = "structure-only", examples = {} } = {}) {
  assertProfile(profile);
  const context = {
    contract: "quackviz-ai-json-modeling-context",
    contractVersion: 1,
    sourceProfileId: profile.id,
    rootType: profile.rootType,
    candidateTables: profile.candidateTables.map((candidate) => ({
      id: candidate.id,
      path: candidate.path,
      suggestedName: candidate.suggestedName,
      rowCount: candidate.rowCount,
      fields: candidate.fields.map(({ name, inferredType, nullable, distinctCount, candidateKey, keyConfidence, sensitive }) => ({ name, inferredType, nullable, distinctCount, candidateKey, keyConfidence, sensitive })),
    })),
    relationships: profile.relationships,
    deterministicPlan,
  };
  if (mode !== "structure-only") {
    context.examples = redactExamples(examples, mode === "selected-raw-samples");
  }
  return context;
}

export function validateAiJsonModelingProposal(proposal, profile, deterministicPlan) {
  const errors = [];
  if (proposal?.contract !== "quackviz-ai-json-modeling-plan" || proposal?.contractVersion !== AI_JSON_MODELING_CONTRACT_VERSION) errors.push(issue("$", "Unsupported AI modeling contract."));
  if (proposal?.sourceProfileId !== profile?.id) errors.push(issue("sourceProfileId", "AI proposal references a different profile."));
  const serialized = JSON.stringify(proposal || {});
  if (/\b(SELECT|CREATE|DROP|INSERT|UPDATE|DELETE)\b/i.test(serialized)) errors.push(issue("$", "Raw SQL is not allowed in AI modeling proposals."));
  if (/\b(function|javascript|eval|script)\b/i.test(serialized)) errors.push(issue("$", "Executable content is not allowed."));
  const proposedPlan = proposal?.proposedPlan;
  if (proposedPlan) errors.push(...validateJsonImportPlan({ ...proposedPlan, contract: "quackviz-json-import-plan", contractVersion: JSON_IMPORT_PLAN_VERSION, sourceProfileId: profile.id }, profile).errors);
  const diff = proposedPlan ? diffJsonImportPlans(deterministicPlan, proposedPlan) : null;
  return { valid: errors.length === 0, errors, diff };
}

export function diffJsonImportPlans(before, after) {
  const oldTables = new Map((before?.tables || []).map((table) => [table.id, table]));
  const newTables = new Map((after?.tables || []).map((table) => [table.id, table]));
  const tablesAdded = [...newTables.keys()].filter((id) => !oldTables.has(id));
  const tablesRemoved = [...oldTables.keys()].filter((id) => !newTables.has(id));
  const tablesRenamed = [];
  const fieldsChanged = [];
  for (const [id, table] of newTables) {
    const previous = oldTables.get(id);
    if (!previous) continue;
    if (previous.name !== table.name) tablesRenamed.push({ id, from: previous.name, to: table.name });
    const oldFields = new Map((previous.fields || []).map((field) => [field.sourcePath, field]));
    for (const field of table.fields || []) {
      const old = oldFields.get(field.sourcePath);
      if (old && (old.mode !== field.mode || old.outputName !== field.outputName)) fieldsChanged.push({ tableId: id, sourcePath: field.sourcePath, from: old, to: field });
    }
  }
  return { tablesAdded, tablesRemoved, tablesRenamed, fieldsChanged, relationshipsAdded: difference(after?.relationships, before?.relationships), relationshipsRemoved: difference(before?.relationships, after?.relationships) };
}

export function structuralSimilarity(profile, previousPlan) {
  return profile?.structuralFingerprint && profile.structuralFingerprint === previousPlan?.structuralFingerprint
    ? { compatible: true, changedPaths: [], missingPaths: [] }
    : { compatible: false, changedPaths: profile?.candidateTables.map((candidate) => candidate.path) || [], missingPaths: previousPlan?.tables?.map((table) => table.sourcePath).filter((path) => !profile?.candidateTables.some((candidate) => candidate.path === path)) || [] };
}

function inferFields(rows, limit) {
  const names = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, limit);
  return names.map((name) => {
    const values = rows.map((row) => row[name]);
    const present = values.filter((value) => value != null);
    const scalar = present.filter((value) => !isContainer(value));
    const types = [...new Set(present.map(valueType))];
    const distinct = new Set(scalar.map(stableValue)).size;
    const unique = scalar.length > 0 && distinct === scalar.length && scalar.length === present.length;
    const stableType = types.length <= 1;
    const nameSignal = name === "id" ? 0.2 : /_id$/i.test(name) ? 0.12 : 0;
    const confidence = Math.min(0.99, (unique ? 0.6 : 0) + (stableType ? 0.15 : 0) + (present.length === values.length ? 0.1 : 0) + nameSignal);
    const sensitive = isSensitive(name, scalar);
    return {
      name,
      inferredType: types.length === 1 ? types[0] : types.length ? "mixed" : "unknown",
      nullable: present.length !== values.length,
      distinctCount: distinct,
      candidateKey: confidence >= 0.75,
      keyConfidence: round(confidence),
      sensitive,
    };
  });
}

function inferRelationship(parent, child) {
  const natural = parent.fields.filter((field) => field.candidateKey).sort((a, b) => b.keyConfidence - a.keyConfidence)[0];
  return {
    parentCandidateId: parent.id,
    childCandidateId: child.id,
    relationshipType: "one-to-many",
    parentKey: natural?.name || "__row_id",
    childForeignKey: natural?.name || "__parent_row_id",
    confidence: natural ? round(0.7 + natural.keyConfidence * 0.25) : 0.72,
    generatedKey: !natural,
  };
}

function fieldMode(profileValue, candidate, field, strategy) {
  if (profileValue.rootType === "GeoJSON" && candidate.path === "$.features" && field.name === "properties") return "flatten";
  if (isScalarType(field.inferredType)) return "scalar";
  return strategy === "preserve" ? "json" : strategy === "flatten" || strategy === "hybrid" ? "flatten" : "json";
}

function pointCoordinate(geometry, index) {
  return geometry?.type === "Point" && Array.isArray(geometry.coordinates) ? geometry.coordinates[index] ?? null : null;
}

function collectOccurrences(document, candidates) {
  const paths = new Map(candidates.map((candidate) => [candidate.path, candidate.id]));
  const output = new Map(candidates.map((candidate) => [candidate.id, []]));
  visit(document, "$", {}, 0);
  return output;

  function visit(value, path, parents, index) {
    if (Array.isArray(value)) {
      value.forEach((item, itemIndex) => visit(item, path, parents, itemIndex));
      return;
    }
    if (!isRecord(value)) return;
    let nextParents = parents;
    const candidateId = paths.get(path);
    if (candidateId) {
      const occurrence = { value, index, parents, generatedId: `${candidateId}_${(output.get(candidateId)?.length || 0) + 1}` };
      output.get(candidateId).push(occurrence);
      nextParents = { ...parents, [candidateId]: occurrence };
    }
    for (const [key, child] of Object.entries(value)) {
      if (isContainer(child)) visit(child, `${path}.${escapePathSegment(key)}`, nextParents, 0);
    }
  }
}

function classifyRoot(value) {
  if (value === undefined) return "invalid";
  if (Array.isArray(value)) {
    if (!value.length) return "primitive-array";
    const objectCount = value.filter(isRecord).length;
    if (objectCount === value.length) return "array-of-records";
    if (objectCount === 0 && value.every((item) => !isContainer(item))) return "primitive-array";
    return "mixed-array";
  }
  if (!isRecord(value)) return "invalid";
  if (value.type === "FeatureCollection" && Array.isArray(value.features)) return "GeoJSON";
  const arrays = Object.entries(value).filter(([, item]) => Array.isArray(item));
  if (arrays.some(([name]) => ["data", "results", "items", "records"].includes(name)) && arrays.some(([, item]) => item.some(isRecord))) return "JSON API envelope";
  if (Object.values(value).some(isContainer)) return "nested-document";
  return "single-record";
}

function keyInstruction(candidate) {
  const keys = candidate.fields.filter((field) => field.candidateKey).sort((a, b) => b.keyConfidence - a.keyConfidence);
  if (keys[0]) return { mode: "existing", fields: [keys[0].name], confidence: keys[0].keyConfidence };
  const composite = candidate.fields.filter((field) => isScalarType(field.inferredType) && !field.nullable).slice(0, 2);
  if (composite.length === 2) return { mode: "composite", fields: composite.map((field) => field.name), confidence: 0.55 };
  return { mode: "generated", fields: ["__row_id"], confidence: 0.7 };
}

function redactExamples(examples, allowRaw) {
  const output = {};
  for (const [field, values] of Object.entries(examples || {})) {
    output[field] = (Array.isArray(values) ? values : [values]).slice(0, 3).map((value) => allowRaw && !isSensitive(field, [value]) ? value : "[redacted]");
  }
  return output;
}

function isSensitive(name, values) {
  return SENSITIVE_NAME.test(name) || values.some((value) => typeof value === "string" && (EMAIL.test(value) || PHONE.test(value) || TOKEN.test(value)));
}

function nearestParentCandidate(path, byPath) {
  let current = path;
  while (current.includes(".")) {
    current = current.slice(0, current.lastIndexOf("."));
    if (byPath.has(current)) return byPath.get(current);
  }
  return path !== "$" ? byPath.get("$") : null;
}

function suggestedName(path, rootType) {
  if (path === "$") return rootType === "GeoJSON" ? "document" : "records";
  return path.split(".").pop().replaceAll("\\.", ".") || "records";
}

function flattenObject(value, prefix, output, depth = 0) {
  if (depth > 3) {
    output[prefix] = JSON.stringify(value);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const name = sanitizeColumnName(`${prefix}_${key}`);
    if (isRecord(child)) flattenObject(child, name, output, depth + 1);
    else output[name] = Array.isArray(child) ? JSON.stringify(child) : child;
  }
}

function getRelative(value, path) {
  return String(path || "").split(".").filter(Boolean).reduce((current, key) => current?.[key], value);
}

function objectFields(value) {
  return isRecord(value) ? Object.keys(value) : [];
}

function fingerprint(candidates) {
  const text = candidates.map((candidate) => `${candidate.path}:${candidate.fields.map((field) => `${field.name}:${field.inferredType}`).sort().join(",")}`).sort().join("|");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function byteLength(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { return 0; }
}
function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (isRecord(value)) return "object";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "string" && !Number.isNaN(Date.parse(value)) && /[-T:/]/.test(value)) return "date-time";
  return typeof value;
}
function stableValue(value) { return typeof value === "object" ? JSON.stringify(value) : `${typeof value}:${value}`; }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isContainer(value) { return Array.isArray(value) || isRecord(value); }
function isScalarType(type) { return !["array", "object", "mixed"].includes(type); }
function escapePathSegment(value) { return String(value).replaceAll(".", "\\."); }
function sanitizeColumnName(value) { return sanitizeTableName(value).replace(/_table$/, ""); }
function isSafeName(value) { return typeof value === "string" && /^[a-z_][a-z0-9_]{0,127}$/.test(value); }
function round(value) { return Math.round(value * 100) / 100; }
function issue(path, message) { return { path, message }; }
function assertProfile(profileValue) {
  if (profileValue?.contract !== "quackviz-json-structure-profile" || profileValue?.contractVersion !== JSON_STRUCTURE_CONTRACT_VERSION) throw new Error("Invalid JSON structural profile.");
}
function difference(left = [], right = []) {
  const other = new Set(right.map((item) => JSON.stringify(item)));
  return left.filter((item) => !other.has(JSON.stringify(item))).map(deepClone);
}
