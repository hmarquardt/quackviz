import { APP_VERSION, BUILD_DATE } from "../js/constants.js";
import { createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export const versionTests = [
  { name: "version: workspace metadata uses canonical version", run: () => assert(createWorkspace().metadata.appVersion === APP_VERSION, "workspace version mismatch") },
  { name: "version: build date present", run: () => assert(BUILD_DATE === "2026-07-23", "build date mismatch") },
];
