#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Deliberately independent: this extractor imports neither the snapshot,
// projection, generator, nor their canonical-JSON implementation.
function jcs(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite baseline number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${jcs(value[key])}`).join(",")}}`;
  }
  throw new TypeError(`unsupported baseline value: ${typeof value}`);
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valueAfter = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const input = path.resolve(root, valueAfter(
  "--input", "sources/PRD-002-rest-contract-baseline.md",
));
const baselineBytes = await readFile(input);
const baseline = baselineBytes.toString("utf8");

function cells(line) {
  return line.trim().replace(/^\|/u, "").replace(/\|$/u, "")
    .split("|").map((cell) => cell.trim());
}

const operations = [];
for (const line of baseline.split(/\r?\n/u)) {
  if (!/^\| `(?:me|records|sessions)\.[a-z]+` \|/u.test(line)) continue;
  const row = cells(line);
  const operationKey = row[0].replaceAll("`", "");
  const method = row[1].replaceAll("`", "");
  const route = row[2].replaceAll("`", "");
  const status = Number(row[6].replace(/[^0-9]/gu, ""));
  operations.push({
    identity: `operation:${operationKey}`,
    method,
    operation_key: operationKey,
    path: route,
    path_parameters: route.includes(":id") ? ["id"] : [],
    request_shape: row[4],
    source_ref: `PRD-002#6.1/table:${operationKey}`,
    success_shape: row[5],
    success_status: status,
  });
}
operations.sort((left, right) => left.operation_key.localeCompare(right.operation_key));
if (operations.length !== 13 || new Set(operations.map((item) => item.operation_key)).size !== 13) {
  throw new Error("R-003-27: PRD-002 operation extraction is incomplete or duplicated.");
}

const requiredSourcePhrases = [
  ["wire:follow-redirects", "Redirects are never successful responses and are never followed.", false],
  ["wire:max-response-bytes", "reads at most 8 MiB of response body", 8_388_608],
  ["wire:request-accept", "Accept: application/json", "application/json"],
  ["wire:request-content-type", "Content-Type: application/json; charset=utf-8", "application/json; charset=utf-8"],
  ["wire:response-encoding", "encoded as UTF-8", "utf-8"],
  ["wire:response-media-type", "response consumed by the SDK is `application/json`", "application/json"],
];
const wireFacts = requiredSourcePhrases.map(([identity, phrase, value]) => {
  if (!baseline.includes(phrase)) throw new Error(`R-003-27: missing source phrase for ${identity}`);
  return { identity, source_ref: "PRD-002#6.1.1", value };
}).sort((left, right) => left.identity.localeCompare(right.identity));

const facts = operations.flatMap((operation) => [
  { identity: `${operation.identity}:method`, source_ref: operation.source_ref, value: operation.method },
  { identity: `${operation.identity}:path-template`, source_ref: operation.source_ref, value: operation.path },
  { identity: `${operation.identity}:path-parameters`, source_ref: operation.source_ref, value: operation.path_parameters },
  { identity: `${operation.identity}:request-shape`, source_ref: operation.source_ref, value: operation.request_shape },
  { identity: `${operation.identity}:success-shape`, source_ref: operation.source_ref, value: operation.success_shape },
  { identity: `${operation.identity}:success-status`, source_ref: operation.source_ref, value: operation.success_status },
]).concat(wireFacts).sort((left, right) => left.identity.localeCompare(right.identity));

const openQuestions = [];
for (const line of baseline.split(/\r?\n/u)) {
  if (!/^\| OQ-002-\d+ \|/u.test(line)) continue;
  const row = cells(line);
  openQuestions.push({
    evidence_state: row[1].includes("**Resolved:**") ? "resolved" : "unresolved",
    id: row[0],
    source_ref: `PRD-002#11:${row[0]}`,
  });
}
openQuestions.sort((left, right) => left.id.localeCompare(right.id));
if (openQuestions.length !== 8 || new Set(openQuestions.map((item) => item.id)).size !== 8) {
  throw new Error("R-003-27: PRD-002 question extraction is incomplete or duplicated.");
}

const output = Buffer.from(jcs({
  accepted_baseline: {
    path: "sources/PRD-002-rest-contract-baseline.md",
    sha256: digest(baselineBytes),
  },
  facts,
  questions: openQuestions,
  schema_version: 1,
}), "utf8");

if (process.argv.includes("--check")) {
  const checked = await readFile(path.join(root, "runa-sdk-contract.prd002-expected-manifest.json"));
  if (!checked.equals(output)) {
    throw new Error("R-003-27: baseline expectation is stale; regenerate after accepted review.");
  }
  console.log(`baseline extraction: PASS (${operations.length} operations; ${openQuestions.length} question records)`);
} else {
  const outputPath = valueAfter("--output");
  if (outputPath === undefined) process.stdout.write(output);
  else await writeFile(path.resolve(root, outputPath), output);
}
