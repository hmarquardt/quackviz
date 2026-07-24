import { APP_VERSION, BUILD_DATE, DEPENDENCIES, VENDOR_MANIFEST_URL } from "./constants.js";

export async function loadVendorManifest(fetcher = fetch) {
  const response = await fetcher(VENDOR_MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Vendor manifest failed to load: ${response.status}`);
  return response.json();
}

export function expectedVendorManifest() {
  return {
    format: "quackviz-vendor-manifest",
    formatVersion: 1,
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    dependencies: Object.values(DEPENDENCIES).map((dep) => ({
      name: dep.packageName,
      version: dep.version,
      path: dep.localUrl || null,
      source: dep.url,
      license: "See upstream package license",
      sha256: null,
      usedBy: ["authoring", "standalone"],
      status: dep.localUrl ? "vendored" : "cdn-pinned",
    })),
  };
}

export function validateVendorManifest(manifest, { requireLocal = false } = {}) {
  const errors = [];
  const warnings = [];
  if (manifest?.format !== "quackviz-vendor-manifest") errors.push({ path: "format", message: "Unsupported vendor manifest format." });
  if (manifest?.formatVersion !== 1) errors.push({ path: "formatVersion", message: "Unsupported vendor manifest version." });
  for (const dep of Object.values(DEPENDENCIES)) {
    const found = manifest?.dependencies?.find((item) => item.name === dep.packageName);
    if (!found) {
      errors.push({ path: `dependencies.${dep.packageName}`, message: "Dependency missing from vendor manifest." });
      continue;
    }
    if (found.version !== dep.version) errors.push({ path: `dependencies.${dep.packageName}.version`, message: `Expected ${dep.version}.` });
    if (requireLocal && !found.path) errors.push({ path: `dependencies.${dep.packageName}.path`, message: "Local vendored path is required for offline release mode." });
    if (!found.path) warnings.push({ path: `dependencies.${dep.packageName}.path`, message: "Dependency is still loaded from a pinned CDN, not a local vendor file." });
  }
  return { valid: errors.length === 0, errors, warnings };
}
