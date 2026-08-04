#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "./lib/canonical-json.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(process.env.RUNA_WORKSPACE_ROOT ?? path.join(root, "../../.."));
const infraRoot = path.resolve(process.env.RUNA_INFRA_ROOT ?? path.join(workspaceRoot, "infra"));
const resolveSourcePath = (sourcePath) => {
  const infraPrefix = "../../../infra/";
  const prdPrefix = "../../../prds/";
  if (sourcePath.startsWith(infraPrefix)) {
    return path.join(infraRoot, sourcePath.slice(infraPrefix.length));
  }
  if (sourcePath.startsWith(prdPrefix)) {
    return path.join(workspaceRoot, "prds", sourcePath.slice(prdPrefix.length));
  }
  return path.resolve(root, sourcePath);
};
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
  const bytes = await readFile(resolveSourcePath(source.path));
  assert.equal(sha256(bytes), source.sha256, `source digest mismatch: ${source.path}`);
}

for (const name of ["runa-api.openapi.json", "runa-api.openapi.sha256", "runa-sdk.projection.json"]) {
  const infra = await readFile(path.join(infraRoot, "contracts", name));
  const typescript = await readFile(path.resolve(root, ".", name));
  if (name.endsWith(".json")) {
    assert.equal(
      canonicalJson(JSON.parse(typescript.toString("utf8"))),
      canonicalJson(JSON.parse(infra.toString("utf8"))),
      `shared source semantics differ: ${name}`,
    );
  } else {
    assert.equal(
      typescript.toString("utf8").trim(),
      infra.toString("utf8").trim(),
      `shared source digest differs: ${name}`,
    );
  }
}
for (const name of ["runa-api.openapi.json", "runa-api.openapi.sha256"]) {
  const candidate = await readFile(path.join(root, name), "utf8");
  const source = await readFile(path.resolve(root, ".", name), "utf8");
  if (name.endsWith(".json")) {
    assert.equal(canonicalJson(JSON.parse(candidate)), canonicalJson(JSON.parse(source)),
      `canonical repository semantic drift: ${name}`);
  } else {
    assert.equal(candidate, source, `canonical repository byte drift: ${name}`);
  }
}
const acceptedBaseline = await readFile(path.join(root, "sources/PRD-002-rest-contract-baseline.md"));
const workspaceBaseline = await readFile(path.join(
  workspaceRoot, "prds/libs/shared/PRD-002-rest-contract-baseline.md",
));
assert.deepEqual(acceptedBaseline, workspaceBaseline, "accepted PRD-002 source bytes differ");
console.log("workspace source verification: PASS");
