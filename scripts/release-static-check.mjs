import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const constants = readFileSync("js/constants.js", "utf8");
const version = constants.match(/APP_VERSION = "([^"]+)"/)?.[1];
const buildDate = constants.match(/BUILD_DATE = "([^"]+)"/)?.[1];
if (!version || !buildDate) throw new Error("Canonical version metadata is missing.");

const release = JSON.parse(readFileSync("release-metadata.json", "utf8"));
const vendor = JSON.parse(readFileSync("vendor/manifest.json", "utf8"));
if (release.version !== version || release.buildDate !== buildDate) throw new Error("Release metadata does not match canonical constants.");
if (vendor.appVersion !== version || vendor.buildDate !== buildDate) throw new Error("Vendor metadata does not match canonical constants.");
if (!readFileSync("README.md", "utf8").includes(`Current version: \`${version}\``)) throw new Error("README version does not match canonical constants.");

for (const dependency of vendor.dependencies.filter((item) => item.required)) {
  const files = [{ path: dependency.path, sha256: dependency.sha256 }, ...(dependency.files || [])];
  for (const file of files) {
    if (!file.path || !existsSync(file.path)) throw new Error(`Required vendor file is missing: ${dependency.name} (${file.path})`);
    const hash = createHash("sha256").update(readFileSync(file.path)).digest("hex");
    if (hash !== file.sha256) throw new Error(`Vendor hash mismatch: ${dependency.name} (${file.path})`);
  }
}

console.log(`Static release checks passed: version ${version}, required vendor hashes verified.`);
