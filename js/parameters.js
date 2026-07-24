const PARAM_PATTERN = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;

export function extractParameterNames(sql) {
  const names = [];
  const stripped = stripComments(sql || "");
  let match = PARAM_PATTERN.exec(stripped);
  while (match) {
    if (!names.includes(match[1])) names.push(match[1]);
    match = PARAM_PATTERN.exec(stripped);
  }
  return names;
}

export function compileParameterizedSql(sql, parameters = [], values = {}) {
  const byName = new Map(parameters.map((param) => [param.name, param]));
  const appliedParameters = [];
  const missingParameters = [];
  const warnings = [];
  const compiled = String(sql || "").replace(PARAM_PATTERN, (token, name) => {
    const parameter = byName.get(name) || { name, dataType: "string", required: false, defaultValue: null };
    const value = values[name] ?? parameter.currentValue ?? parameter.defaultValue;
    if ((value == null || value === "") && parameter.required) {
      missingParameters.push(name);
      return token;
    }
    const literal = encodeParameterValue(parameter, value);
    appliedParameters.push({ name, dataType: parameter.dataType || "string", value });
    return literal;
  });
  return { sql: compiled, appliedParameters, missingParameters, warnings };
}

export function normalizeParameter(input = {}) {
  return {
    id: input.id || `param_${input.name || "unnamed"}`,
    name: input.name || "",
    label: input.label || input.name || "Parameter",
    dataType: input.dataType || "string",
    required: Boolean(input.required),
    defaultValue: input.defaultValue ?? null,
    currentValue: input.currentValue ?? null,
    source: input.source || "user",
    allowedValues: Array.isArray(input.allowedValues) ? input.allowedValues : null,
    min: input.min ?? null,
    max: input.max ?? null,
  };
}

function encodeParameterValue(parameter, value) {
  const type = parameter.dataType || "string";
  if (Array.isArray(value) || type === "multi-category") {
    const values = Array.isArray(value) ? value : [value];
    return `(${values.map((item) => encodeScalar({ ...parameter, dataType: type === "multi-category" ? "category" : type }, item)).join(", ")})`;
  }
  return encodeScalar(parameter, value);
}

function encodeScalar(parameter, value) {
  const type = parameter.dataType || "string";
  if (value == null || value === "") return "NULL";
  if (["number", "numeric"].includes(type)) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Parameter '${parameter.name}' must be numeric.`);
    return String(number);
  }
  if (type === "integer") {
    const number = Number(value);
    if (!Number.isInteger(number)) throw new Error(`Parameter '${parameter.name}' must be an integer.`);
    return String(number);
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value === "true" || value === "false") return value === "true" ? "TRUE" : "FALSE";
    throw new Error(`Parameter '${parameter.name}' must be boolean.`);
  }
  if (type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error(`Parameter '${parameter.name}' must be an ISO date.`);
  if (type === "datetime" && Number.isNaN(Date.parse(String(value)))) throw new Error(`Parameter '${parameter.name}' must be a datetime.`);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stripComments(sql) {
  return String(sql).replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
