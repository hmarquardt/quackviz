# Intelligent JSON Import

Last verified: 2026-07-26 with QuackViz 1.0.0-beta.5.

QuackViz can turn a nested JSON document into one or more related DuckDB tables. Structural discovery and import run locally and do not require AI.

```text
local structural discovery
→ deterministic table plan
→ optional AI suggestions
→ user approval
→ deterministic extraction and DuckDB import
```

## Structural discovery

QuackViz classifies the root, samples bounded portions of large documents, discovers repeated object arrays, profiles scalar fields, proposes keys, and records parent-child paths. Limits cap inspected bytes, depth, objects, array elements, candidate tables, fields, and relationships. A sampled profile is labeled as an estimate.

Candidate keys are suggestions only. Scores combine uniqueness, null rate, stable type, and weak field-name signals. No database constraint is created automatically.

## Example: organization export

```text
$.company.departments          → departments
$.company.departments.employees → employees

departments.department_id
  └─ employees.department_id
```

When a natural parent key is unavailable, QuackViz generates `__row_id` and `__parent_row_id`. It also records `__source_path` and `__source_index`. Entire parent objects and sensitive-looking fields are not inherited.

## Example: API envelope

```json
{
  "data": [{"record_id": 1, "status": "open"}],
  "meta": {"page": 1}
}
```

The root is labeled `JSON API envelope`. `data` is proposed as a row table; metadata remains independently reviewable rather than being duplicated into every row.

## Example: GeoJSON

```text
FeatureCollection
  └─ features
       ├─ properties_* flattened columns
       ├─ geometry JSON
       ├─ longitude
       └─ latitude
```

Point features receive map-ready latitude and longitude columns. Original geometry remains available as JSON. Non-Point geometries keep null point coordinates and preserve their geometry JSON.

## Import strategies

* **Preserve nested JSON:** scalar fields become columns; nested objects and arrays remain JSON text.
* **Flatten selected objects:** nested scalar objects become prefixed columns.
* **Split repeated arrays:** child arrays become tables with inherited or generated parent keys.
* **Hybrid:** flattens scalar objects while splitting repeated arrays.
* **Single raw document:** stores one JSON document row for advanced SQL exploration.

The review dialog supports table inclusion and safe renaming. The approved declarative plan is validated again before execution. QuackViz creates a recovery checkpoint, imports each extracted JSON array through DuckDB, validates row counts, then persists source paths, relationships, plan versions, and provenance. A failed multi-table import removes tables created by that attempt and reports the failure.

## Optional AI modeling

AI receives **structure only** by default: paths, field names, inferred types, nullability, distinct-count summaries, key scores, relationships, and the deterministic plan. The exact context is visible before sending.

The redacted-example mode requires an explicit selection and redacts sensitive-looking values. API keys, credentials, and the full raw document are never part of the modeling contract.

AI may return a versioned declarative plan. QuackViz rejects invented paths or fields, unsafe names, SQL, JavaScript, and unsupported transformations. Users can accept individual renames, accept the validated plan, or reject it. AI does not execute SQL, import data, or save workspace changes.

## Privacy and provenance

Deterministic warnings identify likely identity, contact, account, medical, payment, credential, token, address, and free-text fields. Warnings do not remove data. Imported source metadata records:

* source filename and root classification
* structural fingerprint and contract versions
* table source paths and relationships
* deterministic or AI-assisted generation
* AI model when applicable
* whether sample values were shared
* approval timestamp

API keys and private prompts are excluded.

## Re-import

The declarative plan and structural fingerprint persist with source metadata. The modeling module can compare a new profile with a previous plan and reports changed and missing paths. QuackViz does not blindly apply a mismatched plan.

## Limitations

* Discovery currently parses the JSON document before worker profiling; browser memory still bounds maximum practical input size.
* The review UI supports table inclusion, table renaming, strategy selection, and AI rename approval. Fine-grained key, inheritance, and per-field mode editing remains advanced contract functionality rather than a complete visual editor.
* External JSON Schema references are not fetched automatically and are not yet imported into the profile.
* Domain templates and constrained AI-derived columns are not enabled in this beta.
* Structural fingerprints use paths and inferred types, not raw values; they detect structural compatibility, not document identity.

