import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
const rules = JSON.parse(
  await readFile(new URL("../rules/network-protection.json", import.meta.url))
);

if (manifest.manifest_version !== 3) {
  throw new Error("Expected a Manifest V3 extension");
}

const ids = new Set();
for (const rule of rules) {
  if (!Number.isInteger(rule.id) || ids.has(rule.id)) {
    throw new Error(`Invalid or duplicate rule id: ${rule.id}`);
  }
  ids.add(rule.id);
  if (!rule.action?.type || !rule.condition?.resourceTypes?.length) {
    throw new Error(`Incomplete network rule: ${rule.id}`);
  }
}

console.log(`Validated manifest and ${rules.length} network rules`);
