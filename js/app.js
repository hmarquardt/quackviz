import { initDuckDb } from "./db.js";
import { loadWorkspace, saveWorkspace } from "./storage.js";
import { bindUi } from "./ui.js";

window.addEventListener("error", (event) => {
  console.error(event.error || event.message);
});

await loadWorkspace();
bindUi();
try {
  await initDuckDb();
  await saveWorkspace();
  document.getElementById("dataStatus").textContent = "DuckDB ready";
} catch (error) {
  document.getElementById("dataStatus").textContent = `DuckDB failed: ${error.message}`;
}

