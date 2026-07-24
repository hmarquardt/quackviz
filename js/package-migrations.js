import { PACKAGE_FORMAT_VERSION } from "./constants.js";
import { deepClone } from "./utils.js";

export function migratePackage(input) {
  const pkg = deepClone(input);
  if (!pkg || typeof pkg !== "object") throw new Error("Package must be a JSON object.");
  if (pkg.format !== "quackviz-package") throw new Error("Unsupported package format.");
  if (pkg.formatVersion > PACKAGE_FORMAT_VERSION) throw new Error(`Unsupported future package version ${pkg.formatVersion}.`);
  if (pkg.formatVersion === PACKAGE_FORMAT_VERSION) return { package: pkg, migrated: false, report: [] };
  if (pkg.formatVersion === 0) {
    pkg.formatVersion = 1;
    pkg.manifest ||= {};
    pkg.manifest.formatMigratedFrom = 0;
    pkg.artifacts ||= {};
    pkg.data ||= {};
    pkg.assets ||= {};
    pkg.extensions ||= [];
    return { package: pkg, migrated: true, report: ["Migrated package formatVersion 0 to 1 with safe default containers."] };
  }
  throw new Error(`Unsupported package version ${pkg.formatVersion}.`);
}
