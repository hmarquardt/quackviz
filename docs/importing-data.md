# Importing Data

Use the Data tab to choose files, drop files, or enter a direct URL.

Supported formats:

- CSV
- JSON arrays of objects
- NDJSON / JSONL
- Parquet

URL imports are subject to the remote server's browser CORS policy. QuackViz cannot bypass CORS and does not proxy through a third party.

Imported local tables live in DuckDB memory for the current page session. Saved source metadata is restored after reload, but local files may need to be re-imported.
