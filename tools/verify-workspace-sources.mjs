#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "./lib/canonical-json.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "source-artifacts.manifest.json"), "utf8"));
assert.deepEqual(Object.keys(manifest).sort(), ["schemaVersion", "sources"].sort());
assert.equal(manifest.schemaVersion, 1);
assert(Array.isArray(manifest.sources) && manifest.sources.length > 0);
const seen = new Set();
for (const source of manifest.sources) {
  assert.deepEqual(Object.keys(source).sort(), ["path", "sha256"]);
  assert.equal(seen.has(source.path), false, `duplicate source ${source.path}`);
  seen.add(source.path);
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
  const bytes = await readFile(path.resolve(root, source.path));
  assert.equal(sha256(bytes), source.sha256, `source digest mismatch: ${source.path}`);
}

for (const name of ["runa-api.openapi.json", "runa-api.openapi.sha256", "runa-sdk.projection.json"]) {
  const infra = await readFile(path.resolve(root, "../../infra/contracts", name));
  const typescript = await readFile(path.resolve(root, "../../libs/typescript/contracts", name));
  assert.deepEqual(typescript, infra, `shared source bytes differ: ${name}`);
}
for (const name of ["runa-api.openapi.json", "runa-api.openapi.sha256"]) {
  const candidate = await readFile(path.join(root, name), "utf8");
  const source = await readFile(path.resolve(root, "../../libs/typescript/contracts", name), "utf8");
  if (name.endsWith(".json")) {
    assert.equal(canonicalJson(JSON.parse(candidate)), canonicalJson(JSON.parse(source)),
      `canonical repository semantic drift: ${name}`);
  } else {
    assert.equal(candidate, source, `canonical repository byte drift: ${name}`);
  }
}
const acceptedBaseline = await readFile(path.join(root, "sources/PRD-002-rest-contract-baseline.md"));
const workspaceBaseline = await readFile(path.resolve(
  root, "../../prds/libs/shared/PRD-002-rest-contract-baseline.md",
));
assert.deepEqual(acceptedBaseline, workspaceBaseline, "accepted PRD-002 source bytes differ");
console.log("workspace source verification: PASS");
