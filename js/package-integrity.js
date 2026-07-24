export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createIntegrity(files) {
  const records = [];
  for (const file of files) {
    records.push({ path: file.path, critical: file.critical !== false, hash: await sha256Hex(file.content) });
  }
  return { algorithm: "SHA-256", files: records };
}

export async function verifyIntegrity(files, integrity) {
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const mismatches = [];
  const missing = [];
  const verified = [];
  for (const record of integrity?.files || []) {
    if (!byPath.has(record.path)) {
      missing.push({ path: record.path, critical: record.critical !== false });
      continue;
    }
    const actual = await sha256Hex(byPath.get(record.path));
    if (actual !== record.hash) mismatches.push({ path: record.path, expected: record.hash, actual, critical: record.critical !== false });
    else verified.push({ path: record.path, hash: actual });
  }
  return {
    ok: missing.filter((item) => item.critical).length === 0 && mismatches.filter((item) => item.critical).length === 0,
    verified,
    missing,
    mismatches,
  };
}

export async function dataFingerprint(rowsOrText) {
  return sha256Hex(rowsOrText);
}
