# Testing

Browser unit tests live under `tests/`.

Playwright end-to-end tests live under `e2e/` and start QuackViz with:

```sh
python3 -m http.server 8080
```

The E2E suite mocks AI provider responses and fails on unexpected page errors, fatal console errors, required asset failures, and DuckDB initialization failures.
