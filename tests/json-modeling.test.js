import {
  buildJsonModelingAiContext,
  createJsonImportPlan,
  diffJsonImportPlans,
  discoverJsonStructure,
  extractJsonTables,
  structuralSimilarity,
  validateAiJsonModelingProposal,
  validateJsonImportPlan,
} from "../js/json-modeling.js";

const assert = (value, message) => { if (!value) throw new Error(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const company = {
  company: {
    name: "Example Corp",
    departments: [
      { department_id: 10, name: "Engineering", employees: [{ employee_id: 101, name: "Ada" }, { employee_id: 102, name: "Lin" }] },
      { department_id: 20, name: "Research", employees: [{ employee_id: 103, name: "Sam" }] },
    ],
  },
};
const ecommerce = {
  orders: [
    { order_id: "o1", customer: { name: "A", email: "a@example.test" }, items: [{ sku: "x", quantity: 2 }, { sku: "y", quantity: 1 }] },
    { order_id: "o2", customer: { name: "B", email: "b@example.test" }, items: [{ sku: "z", quantity: 3 }] },
  ],
};
const geojson = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { site: "North", category: "A" }, geometry: { type: "Point", coordinates: [-73.5, 45.5] } },
    { type: "Feature", properties: { site: "South", category: "B" }, geometry: { type: "Point", coordinates: [-73.6, 45.4] } },
  ],
};

function profileAndPlan(document, strategy = "relational") {
  const profile = discoverJsonStructure(document);
  return { profile, plan: createJsonImportPlan(profile, { strategy }) };
}

export const jsonModelingTests = [
  { name: "json modeling: classifies record array", run: () => assert(discoverJsonStructure([{ id: 1 }, { id: 2 }]).rootType === "array-of-records", "root") },
  { name: "json modeling: classifies single record", run: () => assert(discoverJsonStructure({ id: 1, name: "A" }).rootType === "single-record", "root") },
  { name: "json modeling: detects API envelope", run: () => assert(discoverJsonStructure({ data: [{ id: 1 }], meta: { page: 1 } }).rootType === "JSON API envelope", "envelope") },
  { name: "json modeling: detects GeoJSON", run: () => assert(discoverJsonStructure(geojson).rootType === "GeoJSON", "geojson") },
  { name: "json modeling: classifies primitive and mixed arrays", run: () => { assert(discoverJsonStructure([1, 2]).rootType === "primitive-array", "primitive"); assert(discoverJsonStructure([1, { id: 2 }]).rootType === "mixed-array", "mixed"); } },
  { name: "json modeling: discovers arbitrary nested candidates", run: () => { const profile = discoverJsonStructure(company); assert(profile.candidateTables.some((item) => item.path.endsWith(".departments")) && profile.candidateTables.some((item) => item.path.endsWith(".employees")), "nested arrays missing"); } },
  { name: "json modeling: discovers sibling arrays", run: () => { const profile = discoverJsonStructure({ users: [{ id: 1 }], logs: [{ event: "open" }] }); assert(profile.candidateTables.some((item) => item.suggestedName === "users") && profile.candidateTables.some((item) => item.suggestedName === "logs"), "siblings"); } },
  { name: "json modeling: bounds depth and candidates", run: () => { const profile = discoverJsonStructure({ a: { b: { c: { rows: [{ id: 1 }] } } } }, { maxDepth: 1, maxCandidates: 1 }); assert(profile.candidateTables.length <= 1 && profile.statistics.sampled, "limits"); } },
  { name: "json modeling: infers natural keys by values and names", run: () => { const field = discoverJsonStructure([{ id: 1 }, { id: 2 }]).candidateTables[0].fields[0]; assert(field.candidateKey && field.keyConfidence >= 0.75, "key"); } },
  { name: "json modeling: infers generated parent relationship", run: () => { const profile = discoverJsonStructure({ groups: [{ label: "same", children: [{ value: 1 }] }, { label: "same", children: [{ value: 2 }] }] }); assert(profile.relationships.some((item) => item.generatedKey), "generated relation"); } },
  { name: "json modeling: infers natural parent relationship", run: () => { const profile = discoverJsonStructure(company); assert(profile.relationships.some((item) => !item.generatedKey && item.parentKey === "department_id"), "natural relation"); } },
  { name: "json modeling: relational extraction propagates parent key", run: () => { const { profile, plan } = profileAndPlan(company); const tables = extractJsonTables(company, plan, profile); const employees = tables.find((item) => item.sourcePath.endsWith(".employees")); assert(employees.rows.length === 3 && employees.rows[0].department_id === 10 && employees.rows[2].department_id === 20, "inheritance"); } },
  { name: "json modeling: flatten strategy flattens scalar object", run: () => { const { profile, plan } = profileAndPlan(ecommerce, "flatten"); const orders = extractJsonTables(ecommerce, plan, profile).find((item) => item.sourcePath === "$.orders"); assert(orders.rows[0].customer_name === "A" && orders.rows[0].customer_email === "a@example.test", "flatten"); } },
  { name: "json modeling: preserve strategy retains JSON", run: () => { const { profile, plan } = profileAndPlan(ecommerce, "preserve"); const orders = extractJsonTables(ecommerce, plan, profile).find((item) => item.sourcePath === "$.orders"); assert(JSON.parse(orders.rows[0].customer).name === "A", "preserve"); } },
  { name: "json modeling: raw strategy stores one document", run: () => { const { profile, plan } = profileAndPlan(company, "raw"); const tables = extractJsonTables(company, plan, profile); assert(tables.length === 1 && tables[0].rows.length === 1 && JSON.parse(tables[0].rows[0].document_json).company.name === "Example Corp", "raw"); } },
  { name: "json modeling: GeoJSON extracts properties and point coordinates", run: () => { const { profile, plan } = profileAndPlan(geojson, "hybrid"); const features = extractJsonTables(geojson, plan, profile).find((item) => item.sourcePath === "$.features"); assert(features.rows[0].properties_site === "North" && features.rows[0].longitude === -73.5 && features.rows[0].latitude === 45.5, "geo fields"); } },
  { name: "json modeling: sensitive fields are flagged", run: () => { const profile = discoverJsonStructure(ecommerce); const email = profile.candidateTables.find((item) => item.path === "$.orders.customer")?.fields.find((field) => field.name === "email"); assert(email?.sensitive, "email not sensitive"); } },
  { name: "json modeling: structure-only AI context contains no values", run: () => { const { profile, plan } = profileAndPlan(ecommerce); const text = JSON.stringify(buildJsonModelingAiContext(profile, plan)); assert(!text.includes("a@example.test") && !text.includes("\"examples\""), "value leaked"); } },
  { name: "json modeling: examples are redacted", run: () => { const { profile, plan } = profileAndPlan(ecommerce); const context = buildJsonModelingAiContext(profile, plan, { mode: "redacted-examples", examples: { email: ["a@example.test"], category: ["safe"] } }); assert(context.examples.email[0] === "[redacted]" && context.examples.category[0] === "[redacted]", "redaction"); } },
  { name: "json modeling: valid AI proposal and diff", run: () => { const { profile, plan } = profileAndPlan(company); const proposed = clone(plan); proposed.tables[0].name = "organization"; const value = validateAiJsonModelingProposal({ contract: "quackviz-ai-json-modeling-plan", contractVersion: 1, sourceProfileId: profile.id, proposedPlan: proposed }, profile, plan); assert(value.valid && value.diff.tablesRenamed.length === 1, "valid proposal"); } },
  { name: "json modeling: AI invented path rejected", run: () => { const { profile, plan } = profileAndPlan(company); const proposed = clone(plan); proposed.tables[0].sourcePath = "$.invented"; assert(!validateAiJsonModelingProposal({ contract: "quackviz-ai-json-modeling-plan", contractVersion: 1, sourceProfileId: profile.id, proposedPlan: proposed }, profile, plan).valid, "invented path accepted"); } },
  { name: "json modeling: AI SQL and code rejected", run: () => { const { profile, plan } = profileAndPlan(company); for (const summary of ["CREATE TABLE x", "javascript function(){}"]) assert(!validateAiJsonModelingProposal({ contract: "quackviz-ai-json-modeling-plan", contractVersion: 1, sourceProfileId: profile.id, summary, proposedPlan: plan }, profile, plan).valid, "unsafe proposal accepted"); } },
  { name: "json modeling: unsafe and missing plan data rejected", run: () => { const { profile, plan } = profileAndPlan(company); const bad = clone(plan); bad.tables[0].name = "bad name;"; bad.tables[0].fields[0].sourcePath = "invented"; assert(!validateJsonImportPlan(bad, profile).valid, "bad plan"); } },
  { name: "json modeling: plan diff reports field changes", run: () => { const { plan } = profileAndPlan(company); const after = clone(plan); after.tables[0].fields[0].outputName = "renamed"; assert(diffJsonImportPlans(plan, after).fieldsChanged.length === 1, "field diff"); } },
  { name: "json modeling: structural similarity recognizes compatible files", run: () => { const { profile, plan } = profileAndPlan(company); assert(structuralSimilarity(profile, plan).compatible && !structuralSimilarity(discoverJsonStructure(ecommerce), plan).compatible, "similarity"); } },
  { name: "json modeling: discovery and planning do not mutate input", run: () => { const before = JSON.stringify(company); const profile = discoverJsonStructure(company); createJsonImportPlan(profile); assert(JSON.stringify(company) === before, "input mutated"); } },
];
