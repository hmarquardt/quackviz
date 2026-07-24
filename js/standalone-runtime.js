import { APP_VERSION, BUILD_DATE, PACKAGE_FORMAT_VERSION } from "./constants.js";
import { html, nowIso } from "./utils.js";

export function createStandaloneHtml(pkg, options = {}) {
  const runtimePackage = JSON.stringify(pkg).replaceAll("</script", "<\\/script");
  const title = options.title || pkg.manifest?.name || "QuackViz Standalone";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="quackviz-runtime" content="${html(JSON.stringify(runtimeMetadata(pkg)))}">
  <title>${html(title)}</title>
  <style>${runtimeCss()}</style>
</head>
<body>
  <main id="runtime" class="runtime-shell">
    <header><h1>${html(title)}</h1><p id="packageSummary"></p></header>
    <nav id="entrypoints" aria-label="Package entry points"></nav>
    <section id="content" class="runtime-content"></section>
    <details><summary>Package metadata</summary><pre id="metadata"></pre></details>
  </main>
  <footer data-quackviz-runtime-version="${APP_VERSION}" data-quackviz-package-version="${PACKAGE_FORMAT_VERSION}">
    © 2026 Hank Marquardt · QuackViz Standalone · Package Version ${PACKAGE_FORMAT_VERSION} · Runtime ${APP_VERSION} (${BUILD_DATE})
  </footer>
  <script type="application/json" id="quackviz-package">${runtimePackage}</script>
  <script type="module">
    const pkg = JSON.parse(document.getElementById("quackviz-package").textContent);
    const content = document.getElementById("content");
    document.getElementById("packageSummary").textContent = pkg.manifest.packageMode + " · " + pkg.manifest.dataMode + " · " + pkg.manifest.createdBy.appVersion;
    document.getElementById("metadata").textContent = JSON.stringify(pkg.manifest, null, 2);
    const entrypoints = pkg.manifest.entrypoints || [];
    document.getElementById("entrypoints").innerHTML = entrypoints.map((entry, index) => '<button data-entry="' + index + '">' + entry.type + ': ' + entry.id + '</button>').join("");
    document.getElementById("entrypoints").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-entry]");
      if (button) renderEntry(entrypoints[Number(button.dataset.entry)]);
    });
    function renderEntry(entry) {
      if (!entry) { content.textContent = "No entrypoint selected."; return; }
      const artifacts = pkg.artifacts || {};
      if (entry.type === "dashboard") {
        const dashboard = (artifacts.dashboards || []).find((item) => item.id === entry.id);
        content.innerHTML = dashboard ? '<h2>' + escapeHtml(dashboard.name) + '</h2>' + (dashboard.layout || []).map(cardHtml).join("") : '<p>Dashboard missing.</p>';
      } else if (entry.type === "report") {
        const report = (artifacts.reports || []).find((item) => item.id === entry.id);
        content.innerHTML = report ? '<article><h2>' + escapeHtml(report.title) + '</h2>' + (report.sections || []).filter((section) => section.visible !== false).map((section) => '<section><h3>' + escapeHtml(section.title || section.type) + '</h3><p>' + escapeHtml(section.content?.narrative || section.content?.finding || "") + '</p></section>').join("") + '</article>' : '<p>Report missing.</p>';
      } else {
        const viz = (artifacts.visualizations || []).find((item) => item.id === entry.id);
        content.innerHTML = viz ? '<h2>' + escapeHtml(viz.name) + '</h2><pre>' + escapeHtml(JSON.stringify(viz.spec, null, 2)) + '</pre>' : '<p>Visualization missing.</p>';
      }
    }
    function cardHtml(card) {
      const viz = (pkg.artifacts.visualizations || []).find((item) => item.id === card.visualizationId);
      return '<section class="card"><h3>' + escapeHtml(card.titleOverride || viz?.name || "Card") + '</h3><p>' + escapeHtml(viz?.question || viz?.description || "Packaged visualization") + '</p></section>';
    }
    function escapeHtml(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
    renderEntry(entrypoints[0]);
  </script>
</body>
</html>`;
}

export function runtimeMetadata(pkg) {
  return {
    runtimeVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    packageFormatVersion: pkg.formatVersion,
    packageName: pkg.manifest?.name,
    dataMode: pkg.manifest?.dataMode,
    generatedAt: nowIso(),
  };
}

export function runtimeHarnessLoad(pkg) {
  if (pkg?.format !== "quackviz-package") throw new Error("Runtime can only load quackviz-package payloads.");
  return {
    ready: true,
    footerVersion: APP_VERSION,
    packageVersion: pkg.formatVersion,
    entrypointCount: pkg.manifest?.entrypoints?.length || 0,
    capabilities: pkg.manifest?.capabilities || {},
  };
}

function runtimeCss() {
  return `:root{font-family:system-ui,sans-serif;color:#17202a;background:#f6f7f8}body{margin:0}.runtime-shell{max-width:1120px;margin:0 auto;padding:24px}.runtime-content{background:#fff;border:1px solid #d9dee3;padding:16px;min-height:280px}.card{border:1px solid #d9dee3;margin:12px 0;padding:12px}button{margin:4px;padding:8px 10px}footer{border-top:1px solid #d9dee3;padding:12px 24px;color:#5f6b76}`;
}
