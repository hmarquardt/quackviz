self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.contract !== "quackviz-worker-task" || message.contractVersion !== 1 || !message.taskId) {
    return;
  }
  const base = { contract: "quackviz-worker-result", contractVersion: 1, taskId: message.taskId };
  try {
    if (message.type === "discover-json-structure") {
      const { discoverJsonStructure } = await import("../js/json-modeling.js");
      self.postMessage({ ...base, status: "progress", payload: { stage: "Inspecting document structure", progress: 0.2 } });
      const profile = discoverJsonStructure(message.payload?.document, message.payload?.limits);
      self.postMessage({ ...base, status: "success", payload: { profile } });
      return;
    }
    if (message.type === "cancel") {
      self.postMessage({ ...base, status: "cancelled", payload: { message: "Cancelled." } });
      return;
    }
    if (message.type === "echo") {
      self.postMessage({ ...base, status: "success", payload: message.payload });
      return;
    }
    if (message.type === "hash-text") {
      const text = String(message.payload?.text || "");
      const bytes = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      self.postMessage({ ...base, status: "success", payload: { sha256: [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("") } });
      return;
    }
    self.postMessage({ ...base, status: "error", payload: { message: `Unknown worker task ${message.type}.` } });
  } catch (error) {
    self.postMessage({ ...base, status: "error", payload: { message: error.message || String(error) } });
  }
};
