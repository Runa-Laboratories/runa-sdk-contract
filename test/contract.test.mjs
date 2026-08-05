import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { canonicalJson } from "../tools/lib/canonical-json.mjs";
import { loadBundle, validateBundle, validateCanonicalArtifacts, validateManifest } from "../tools/lib/contract-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = await loadBundle(root);
const clone = () => structuredClone(baseline);

test("TC-003-01 validates 14 binding-complete descriptors and five canonical artifacts", async () => {
  await validateCanonicalArtifacts(root);
  await validateManifest(root, baseline.manifest);
  const report = validateBundle(baseline);
  assert.equal(report.status, "PASS");
  assert.equal(report.operationKeys.length, 14);
  assert.equal(new Set(["BLOCKED", "APPROVED"]).has(report.provenanceStatus), true);
  for (const operation of baseline.snapshot.operations) {
    assert.deepEqual(Object.keys(operation).sort(), ["error_facts", "http_binding", "method", "operation_key", "path_parameters", "path_template", "request", "source_refs", "success", "unresolved_refs"].sort());
  }
});

test("RFC 8785 currentness canonicalizer passes Appendix-B number vectors", () => {
  assert.equal(canonicalJson({ b: 1e30, a: 333333333.33333329, c: 4.50, d: 2e-3, e: 1e-27 }),
    '{"a":333333333.3333333,"b":1e+30,"c":4.5,"d":0.002,"e":1e-27}');
  assert.throws(() => canonicalJson(Number.NaN), /non-finite/u);
  assert.throws(() => canonicalJson("\ud800"), /lone Unicode surrogate/u);
});

test("TC-003-12 rejects status, media, UTF-8, header, cap, redirect, schema, and UUID mutations for every descriptor", () => {
  const mutations = [
    (operation) => { operation.success.selector.status = 299; },
    (operation) => { operation.success.media_type = "text/plain"; },
    (operation) => { operation.success.encoding = "utf-16"; },
    (operation) => { operation.http_binding.accept = "*/*"; },
    (operation) => { operation.http_binding.content_type_with_body = "application/json"; },
    (operation) => { operation.http_binding.max_response_bytes += 1; },
    (operation) => { operation.http_binding.follow_redirects = true; },
    (operation) => { operation.success.schema = { type: "string" }; },
  ];
  for (let index = 0; index < baseline.snapshot.operations.length; index += 1) {
    for (const mutate of mutations) {
      const candidate = clone();
      mutate(candidate.snapshot.operations[index]);
      assert.throws(() => validateBundle(candidate), /R-003-(?:02|28)/u, `${candidate.snapshot.operations[index].operation_key} mutation accepted`);
    }
    if (baseline.snapshot.operations[index].path_parameters.length > 0) {
      const candidate = clone();
      candidate.snapshot.operations[index].path_parameters[0].renderer.trim = true;
      assert.throws(() => validateBundle(candidate), /R-003-(?:02|28)/u);
    }
  }
});

test("TC-003-11 rejects a fact deleted from snapshot map and checked-in projection", () => {
  const candidate = clone();
  const identity = "operation:sessions.get:success-status";
  candidate.snapshot.source_reference_map = candidate.snapshot.source_reference_map.filter((item) => item.identity !== identity);
  candidate.projection.facts = candidate.projection.facts.filter((item) => item.identity !== identity);
  assert.throws(() => validateBundle(candidate), /R-003-14: snapshot semantic projection: missing operation:sessions\.get:success-status \(PRD-002#6\.1\/table:sessions\.get\)/u);
});

test("TC-003-11 rejects an OQ deleted from snapshot and projection", () => {
  const candidate = clone();
  candidate.snapshot.question_map = candidate.snapshot.question_map.filter((item) => item.id !== "OQ-002-06");
  candidate.snapshot.unresolved_question_map = candidate.snapshot.unresolved_question_map.filter((item) => item.question_id !== "OQ-002-06");
  candidate.projection.questions = candidate.projection.questions.filter((item) => item.id !== "OQ-002-06");
  assert.throws(() => validateBundle(candidate), /R-003-14: snapshot question map: missing OQ-002-06 \(PRD-002#11:OQ-002-06\)/u);
});

test("TC-003-02 rejects a weakened structural schema", () => {
  const candidate = clone();
  candidate.schema.$defs.operation.additionalProperties = true;
  assert.throws(() => validateBundle(candidate), /R-003-02/u);
});

test("TC-003-02 structural schema rejects an undeclared normative field", () => {
  const candidate = clone();
  candidate.snapshot.operations[0].inferred_retry_policy = "retry";
  assert.throws(() => validateBundle(candidate), /R-003-02: snapshot schema: .* is undeclared/u);
});

test("TC-002-27 binds background only as an optional boolean SDK create field", () => {
  const schema = baseline.snapshot.components.schemas.SdkCreateSession;
  assert.deepEqual(schema.properties.background, {
    description: "Optional asynchronous provisioning mode. Omission or false preserves synchronous creation. True may return status creating; poll sessions.get while status remains creating before treating the machine as ready.",
    type: "boolean",
  });
  assert.equal(schema.required.includes("background"), false);
  assert.equal(Object.hasOwn(baseline.openapi.components.schemas.ConsoleCreateSession.properties, "background"), true);
  for (const field of ["terminal", "api_key", "token_saving", "capture_tool_io"]) {
    assert.equal(Object.hasOwn(schema.properties, field), false);
  }
  const create = baseline.snapshot.operations.find((operation) => operation.operation_key === "sessions.create");
  assert.match(create.request.source_shape, /background\?/u);

  const candidate = clone();
  candidate.snapshot.components.schemas.SdkCreateSession.properties.background.type = "string";
  assert.throws(() => validateBundle(candidate), /R-003-28/u);
});

test("TC-003-04 rejects substituted provenance", () => {
  const candidate = clone();
  candidate.provenance.artifacts.contract_projection.sha256 = "0".repeat(64);
  assert.throws(() => validateBundle(candidate), /R-003-13/u);
});

test("TC-003-27 rejects independent expectation drift", () => {
  const candidate = clone();
  candidate.expected.facts[0].value = "PATCH";
  assert.throws(() => validateBundle(candidate), /R-003-14/u);
});

test("approval cannot be inferred from a local commit", () => {
  const candidate = clone();
  candidate.provenance.status = "APPROVED";
  candidate.provenance.canonical_ref = "local";
  candidate.provenance.source_revision = "local";
  candidate.provenance.approval_reference = {};
  candidate.provenance.reason = null;
  assert.throws(() => validateBundle(candidate), /R-003-15/u);
});
