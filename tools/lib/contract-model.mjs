import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { canonicalBytes, canonicalJson, sha256 } from "./canonical-json.mjs";

export const EXPECTED = "runa-sdk-contract.prd002-expected-manifest.json";
export const PROJECTION = "runa-sdk-contract.prd002-projection.json";
export const ARTIFACT_SPEC = Object.freeze({
  "runa-api.openapi.json": ["application/vnd.oai.openapi+json", "source-openapi"],
  "runa-api.openapi.sha256": ["text/plain", "canonical-openapi-digest"],
  [EXPECTED]: ["application/json", "independent-baseline-expectation"],
  [PROJECTION]: ["application/json", "prd002-contract-projection"],
  "runa-sdk-contract.provenance.json": ["application/json", "detached-provenance"],
  "runa-sdk-contract.provenance.schema.json": ["application/schema+json", "provenance-schema"],
  "runa-sdk-contract.snapshot.json": ["application/json", "canonical-sdk-snapshot"],
  "runa-sdk-contract.snapshot.schema.json": ["application/schema+json", "closed-structural-snapshot-schema"],
  "source-artifacts.manifest.json": ["application/json", "source-chain"],
  "sources/PRD-002-rest-contract-baseline.md": ["text/markdown", "accepted-baseline"],
  "tools/approve-provenance.mjs": ["text/javascript", "blocked-to-approved-transition"],
  "tools/build-contract-artifacts.mjs": ["text/javascript", "snapshot-projection-builder"],
  "tools/emit-release-attestation.mjs": ["text/javascript", "release-attestation-emitter"],
  "tools/extract-prd002-expectations.mjs": ["text/javascript", "independent-baseline-extractor"],
  "tools/runa-contract-generator.mjs": ["text/javascript", "sole-binding-generator"],
});
export const ARTIFACTS = Object.freeze(Object.keys(ARTIFACT_SPEC).sort());
export const CANONICAL_JSON_ARTIFACTS = Object.freeze([
  "artifact-manifest.json", EXPECTED, PROJECTION, "runa-sdk-contract.provenance.json",
  "runa-sdk-contract.provenance.schema.json", "runa-sdk-contract.snapshot.json",
  "runa-sdk-contract.snapshot.schema.json", "source-artifacts.manifest.json",
]);
export const OPERATION_KEYS = Object.freeze([
  "me.get", "records.list", "sessions.checkpoint", "sessions.create", "sessions.delete",
  "sessions.exec", "sessions.get", "sessions.list", "sessions.open", "sessions.pause",
  "sessions.resume", "sessions.start", "sessions.stop",
]);
const COMPONENTS = Object.freeze([
  "CheckpointRequest", "Error", "ExecRequest", "ExecResult", "Me", "Ok", "OpenResult",
  "OutboundPolicy", "Record", "RuntimeUrl", "SdkCreateSession", "Session", "Uuid",
]);
const SOURCE_BASELINE = "sources/PRD-002-rest-contract-baseline.md";
const GENERATOR = "tools/runa-contract-generator.mjs";
const EXTRACTOR = "tools/extract-prd002-expectations.mjs";
const fail = (requirement, artifact, detail) => { throw new Error(`${requirement}: ${artifact}: ${detail}`); };
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

function resolveLocalRef(document, value) {
  if (value?.$ref === undefined) return value;
  if (typeof value.$ref !== "string" || !value.$ref.startsWith("#/")) fail("R-003-28", "openapi", "external reference");
  let current = document;
  for (const token of value.$ref.slice(2).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))) current = current?.[token];
  if (current === undefined) fail("R-003-28", "openapi", `unresolved ${value.$ref}`);
  return current;
}

function openApiOperations(openapi) {
  const output = new Map();
  for (const [route, item] of Object.entries(openapi.paths ?? {})) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const operation = item[method];
      if (operation?.["x-sdk-exposed"] === true) output.set(operation.operationId, { method: method.toUpperCase(), operation, route });
    }
  }
  return output;
}

function validateStructuralSchema(rootSchema, input, schema = rootSchema, location = "$") {
  if (schema.$ref !== undefined) {
    let resolved = rootSchema;
    for (const token of schema.$ref.slice(2).split("/")) resolved = resolved[token];
    return validateStructuralSchema(rootSchema, input, resolved, location);
  }
  if (Object.hasOwn(schema, "const") && !same(input, schema.const)) fail("R-003-02", "snapshot schema", `${location} differs from const`);
  if (schema.enum !== undefined && !schema.enum.some((item) => same(item, input))) fail("R-003-02", "snapshot schema", `${location} is outside enum`);
  const matchesType = (type) => type === "null" ? input === null
    : type === "array" ? Array.isArray(input)
      : type === "object" ? input !== null && typeof input === "object" && !Array.isArray(input)
        : type === "integer" ? Number.isInteger(input) : typeof input === type;
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(matchesType)) fail("R-003-02", "snapshot schema", `${location} has invalid type`);
  }
  if (typeof input === "string" && schema.pattern !== undefined && !(new RegExp(schema.pattern, "u")).test(input)) fail("R-003-02", "snapshot schema", `${location} fails pattern`);
  if (Array.isArray(input)) {
    if (schema.minItems !== undefined && input.length < schema.minItems) fail("R-003-02", "snapshot schema", `${location} has too few items`);
    if (schema.maxItems !== undefined && input.length > schema.maxItems) fail("R-003-02", "snapshot schema", `${location} has too many items`);
    if (schema.items !== undefined) input.forEach((item, index) => validateStructuralSchema(rootSchema, item, schema.items, `${location}[${index}]`));
  }
  if (input !== null && typeof input === "object" && !Array.isArray(input)) {
    for (const required of schema.required ?? []) if (!Object.hasOwn(input, required)) fail("R-003-02", "snapshot schema", `${location}.${required} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(input)) if (!Object.hasOwn(schema.properties ?? {}, key)) fail("R-003-02", "snapshot schema", `${location}.${key} is undeclared`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(input, key)) validateStructuralSchema(rootSchema, input[key], child, `${location}.${key}`);
  }
}

export async function loadBundle(root) {
  const bytes = async (name) => readFile(path.join(root, name));
  const json = async (name) => JSON.parse((await bytes(name)).toString("utf8"));
  return {
    baselineSourceBytes: await bytes(SOURCE_BASELINE),
    expected: await json(EXPECTED), expectedBytes: await bytes(EXPECTED),
    extractorBytes: await bytes(EXTRACTOR), generatorBytes: await bytes(GENERATOR),
    manifest: await json("artifact-manifest.json"), openapi: await json("runa-api.openapi.json"),
    openapiBytes: await bytes("runa-api.openapi.json"),
    openapiDigestText: (await bytes("runa-api.openapi.sha256")).toString("utf8"),
    projection: await json(PROJECTION), projectionBytes: await bytes(PROJECTION),
    provenance: await json("runa-sdk-contract.provenance.json"),
    provenanceBytes: await bytes("runa-sdk-contract.provenance.json"),
    provenanceSchema: await json("runa-sdk-contract.provenance.schema.json"),
    provenanceSchemaBytes: await bytes("runa-sdk-contract.provenance.schema.json"),
    schema: await json("runa-sdk-contract.snapshot.schema.json"),
    schemaBytes: await bytes("runa-sdk-contract.snapshot.schema.json"),
    snapshot: await json("runa-sdk-contract.snapshot.json"), snapshotBytes: await bytes("runa-sdk-contract.snapshot.json"),
  };
}

export function deriveSemanticProjection(snapshot) {
  const referenceMap = new Map(snapshot.source_reference_map.map((item) => [item.identity, item.source_ref]));
  const referenced = new Set(referenceMap.keys());
  const projected = (identity, value) => ({ identity, source_ref: referenceMap.get(identity), value });
  const facts = snapshot.operations.flatMap((operation) => [
    projected(`operation:${operation.operation_key}:method`, operation.method),
    projected(`operation:${operation.operation_key}:path-template`, operation.path_template),
    projected(`operation:${operation.operation_key}:path-parameters`, operation.path_parameters.map((item) => item.name)),
    projected(`operation:${operation.operation_key}:request-shape`, operation.request.source_shape),
    projected(`operation:${operation.operation_key}:success-shape`, operation.success.source_shape),
    projected(`operation:${operation.operation_key}:success-status`, operation.success.selector.status),
  ]).concat([
    { identity: "wire:follow-redirects", source_ref: "PRD-002#6.1.1", value: snapshot.operations[0].http_binding.follow_redirects },
    { identity: "wire:max-response-bytes", source_ref: "PRD-002#6.1.1", value: snapshot.operations[0].http_binding.max_response_bytes },
    { identity: "wire:request-accept", source_ref: "PRD-002#6.1.1", value: snapshot.operations[0].http_binding.accept },
    { identity: "wire:request-content-type", source_ref: "PRD-002#6.1.1", value: snapshot.operations[0].http_binding.content_type_with_body },
    { identity: "wire:response-encoding", source_ref: "PRD-002#6.1.1", value: snapshot.operations[0].http_binding.response_encoding },
    { identity: "wire:response-media-type", source_ref: "PRD-002#6.1.1", value: snapshot.operations[0].http_binding.response_media_type },
  ]).filter((item) => referenced.has(item.identity)).sort((a, b) => a.identity.localeCompare(b.identity));
  return { facts, questions: snapshot.question_map };
}

function compareStable(actual, expected, artifact, key) {
  const map = (items, label) => {
    const result = new Map();
    for (const item of items ?? []) {
      const identity = item[key];
      if (typeof identity !== "string" || result.has(identity)) fail("R-003-14", artifact, `${label} duplicate/invalid identity ${identity}`);
      result.set(identity, item);
    }
    return result;
  };
  const left = map(actual, "actual");
  const right = map(expected, "expected");
  for (const [identity, expectedValue] of right) {
    const actualValue = left.get(identity);
    if (actualValue === undefined) fail("R-003-14", artifact, `missing ${identity} (${expectedValue.source_ref})`);
    if (!same(actualValue, expectedValue)) fail("R-003-14", artifact, `changed ${identity} (${expectedValue.source_ref})`);
  }
  for (const [identity, actualValue] of left) if (!right.has(identity)) fail("R-003-14", artifact, `added ${identity} (${actualValue.source_ref})`);
}

function validateSnapshot(snapshot, openapi) {
  const topKeys = ["components", "contract_id", "generator_configuration", "operations", "question_map", "schema_version", "snapshot_version", "source_reference_map", "unresolved_question_map"].sort();
  if (!same(Object.keys(snapshot).sort(), topKeys) || snapshot.contract_id !== "runa-sdk-contract" ||
      snapshot.schema_version !== 1 || !/^\d+\.\d+\.\d+$/.test(snapshot.snapshot_version)) fail("R-003-02", "snapshot", "closed top-level structure differs");
  if (snapshot.generator_configuration?.configuration_version !== "1.0.0" ||
      snapshot.generator_configuration?.generator_version !== "0.2.0" ||
      !same(snapshot.generator_configuration?.languages, ["python", "typescript"]) ||
      !same(snapshot.generator_configuration?.generated_roots, { python: "src/runa/_internal/contract/generated/", typescript: "src/internal/contract/generated/" })) {
    fail("R-003-02", "snapshot.generator_configuration", "configuration differs");
  }
  const openOperations = openApiOperations(openapi);
  const operationKeys = snapshot.operations.map((item) => item.operation_key);
  if (!same(operationKeys, OPERATION_KEYS) || new Set(operationKeys).size !== 13) fail("R-003-03", "snapshot.operations", "exact operation catalog differs");
  const descriptorKeys = ["error_facts", "http_binding", "method", "operation_key", "path_parameters", "path_template", "request", "source_refs", "success", "unresolved_refs"].sort();
  const exactHttp = { accept: "application/json", authorization_scheme: "Bearer", content_type_with_body: "application/json; charset=utf-8", follow_redirects: false, max_response_bytes: 8_388_608, response_encoding: "utf-8", response_media_type: "application/json", source_ref: "PRD-002#6.1.1" };
  for (const descriptor of snapshot.operations) {
    const source = openOperations.get(descriptor.operation_key);
    if (!same(Object.keys(descriptor).sort(), descriptorKeys) || source === undefined) fail("R-003-28", `snapshot.operations.${descriptor.operation_key}`, "descriptor is not binding-complete");
    if (descriptor.method !== source.method || descriptor.path_template !== source.route.replaceAll("{id}", ":id")) fail("R-003-03", `snapshot.operations.${descriptor.operation_key}`, "method/path differs (PRD-002#6.1)");
    if (!same(descriptor.http_binding, exactHttp)) fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.http_binding`, "wire binding differs (PRD-002#6.1.1)");
    const expectedStatus = descriptor.operation_key === "sessions.create" ? 201 : 200;
    if (!same(descriptor.success.selector, { kind: "exact", status: expectedStatus }) || descriptor.success.media_type !== "application/json" || descriptor.success.encoding !== "utf-8") fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.success`, "success selector/media differs (PRD-002#6.1)");
    const expectedRequest = source.operation["x-sdk-request-schema"] ?? source.operation.requestBody?.content?.["application/json; charset=utf-8"]?.schema ?? null;
    if (!same(descriptor.request.schema, expectedRequest)) fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.request.schema`, "typed request differs (PRD-002#6.1.1)");
    if (expectedRequest === null) {
      if (descriptor.request.body_presence !== "absent" || descriptor.request.body_bytes !== "none" || descriptor.request.content_type_rule !== "omit" || descriptor.request.media_type !== null || descriptor.request.encoding !== null) fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.request`, "body omission differs (PRD-002#6.1.1)");
    } else if (descriptor.request.body_presence !== "required" || descriptor.request.body_bytes !== "one-json-value" || descriptor.request.content_type_rule !== "send" || descriptor.request.media_type !== "application/json; charset=utf-8" || descriptor.request.encoding !== "utf-8") fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.request`, "body binding differs (PRD-002#6.1.1)");
    const expectedResponse = resolveLocalRef(openapi, source.operation.responses[String(expectedStatus)]).content["application/json"].schema;
    if (!same(descriptor.success.schema, expectedResponse)) fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.success.schema`, "typed response differs (PRD-002#6.1.1)");
    const names = [...source.route.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1]);
    if (!same(descriptor.path_parameters.map((item) => item.name), names)) fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.path_parameters`, "path parameters differ");
    for (const parameter of descriptor.path_parameters) {
      const renderer = { case_fold: false, format: "uuid", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", percent_encode: false, segment_count: 1, substitution: "unchanged", trim: false, type: "string", unicode_normalize: false };
      if (!same(parameter.renderer, renderer)) fail("R-003-28", `snapshot.operations.${descriptor.operation_key}.path_parameters.id`, "UUID renderer differs (PRD-002#6.1.1)");
    }
    for (const unresolved of descriptor.unresolved_refs) {
      if (!same(Object.keys(unresolved).sort(), ["evidence_state", "question_id", "source_ref"].sort()) || unresolved.evidence_state !== "unresolved") fail("R-003-06", `snapshot.operations.${descriptor.operation_key}.unresolved_refs`, "unresolved value asserted");
    }
  }
  if (!same(Object.keys(snapshot.components.schemas).sort(), COMPONENTS)) fail("R-003-28", "snapshot.components", "component catalog differs");
  for (const name of COMPONENTS) if (!same(snapshot.components.schemas[name], openapi.components.schemas[name])) fail("R-003-28", `snapshot.components.${name}`, "typed schema differs");
  const unresolved = snapshot.question_map.filter((item) => item.evidence_state === "unresolved")
    .map((item) => ({ evidence_state: "unresolved", question_id: item.id, source_ref: item.source_ref }));
  if (!same(unresolved, snapshot.unresolved_question_map)) fail("R-003-05", "snapshot.unresolved_question_map", "unresolved coverage differs");
  for (const item of snapshot.unresolved_question_map) if (!same(Object.keys(item).sort(), ["evidence_state", "question_id", "source_ref"].sort())) fail("R-003-06", "snapshot.unresolved_question_map", "unresolved assertion contains a value");
}

function validateProvenance(bundle) {
  const value = bundle.provenance;
  const artifacts = {
    baseline_expectation_manifest: { path: EXPECTED, sha256: sha256(bundle.expectedBytes) },
    contract_projection: { path: PROJECTION, sha256: sha256(bundle.projectionBytes) },
    snapshot: { path: "runa-sdk-contract.snapshot.json", sha256: sha256(bundle.snapshotBytes) },
    snapshot_schema: { path: "runa-sdk-contract.snapshot.schema.json", sha256: sha256(bundle.schemaBytes) },
  };
  if (value.schema_version !== 3 || value.contract_id !== "runa-sdk-contract" || value.snapshot_version !== bundle.snapshot.snapshot_version ||
      value.accepted_baseline_sha256 !== sha256(bundle.baselineSourceBytes) || !same(value.artifacts, artifacts) ||
      value.generation_command_id !== "runa-contract-generator/v1" ||
      !same({ ...value.generator_identity, git_commit_sha: null }, { git_commit_sha: null, node_major: 24, path: GENERATOR, sha256: sha256(bundle.generatorBytes), version: "0.2.0" }) ||
      !same({ ...value.baseline_extractor_identity, git_commit_sha: null }, { git_commit_sha: null, node_major: 24, path: EXTRACTOR, sha256: sha256(bundle.extractorBytes) }) ||
      value.semantic_change_class !== "additive") fail("R-003-13", "provenance", "detached digest/identity differs");
  if (value.status === "BLOCKED") {
    if (value.canonical_ref !== null || value.approval_reference !== null || value.source_revision !== null ||
        value.generator_identity.git_commit_sha !== null || value.baseline_extractor_identity.git_commit_sha !== null ||
        typeof value.reason !== "string") fail("R-003-15", "provenance", "blocked evidence differs");
  } else if (value.status === "APPROVED") {
    const approval = value.approval_reference;
    const sha = /^[a-f0-9]{40}$/u;
    const url = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/u;
    if (!sha.test(value.canonical_ref ?? "") || !sha.test(value.source_revision ?? "") || value.reason !== null ||
        value.generator_identity.git_commit_sha !== value.canonical_ref || value.baseline_extractor_identity.git_commit_sha !== value.canonical_ref ||
        approval === null || !sha.test(approval.contract_merge_commit_sha ?? "") || !sha.test(approval.prd002_merge_commit_sha ?? "") ||
        approval.contract_merge_commit_sha !== value.canonical_ref ||
        !url.test(approval.contract_pull_request_url ?? "") || !url.test(approval.prd002_pull_request_url ?? "")) fail("R-003-15", "provenance", "approved evidence incomplete");
  } else fail("R-003-15", "provenance", "unknown status");
}

export function validateBundle(bundle) {
  if (bundle.schema?.["x-schema-format-version"] !== 1 || bundle.schema?.additionalProperties !== false || bundle.schema?.$defs?.operation?.additionalProperties !== false || !bundle.schema?.$defs?.unresolved?.properties?.evidence_state) fail("R-003-02", "snapshot schema", "structural closure/evidence enum missing");
  validateStructuralSchema(bundle.schema, bundle.snapshot);
  validateSnapshot(bundle.snapshot, bundle.openapi);
  if (bundle.expected.accepted_baseline?.path !== SOURCE_BASELINE || bundle.expected.accepted_baseline?.sha256 !== sha256(bundle.baselineSourceBytes)) fail("R-003-13", EXPECTED, "accepted baseline digest differs");
  const derived = deriveSemanticProjection(bundle.snapshot);
  compareStable(derived.facts, bundle.expected.facts, "snapshot semantic projection", "identity");
  compareStable(bundle.projection.facts, bundle.expected.facts, PROJECTION, "identity");
  compareStable(derived.questions, bundle.expected.questions, "snapshot question map", "id");
  compareStable(bundle.projection.questions, bundle.expected.questions, PROJECTION, "id");
  if (!same(bundle.projection.accepted_baseline, bundle.expected.accepted_baseline)) fail("R-003-14", PROJECTION, "baseline identity differs");
  const declared = `${sha256(canonicalBytes(bundle.openapi))}  runa-api.openapi.json\n`;
  if (bundle.openapiDigestText !== declared) fail("R-003-13", "runa-api.openapi.sha256", "canonical OpenAPI digest differs");
  validateProvenance(bundle);
  return { canonicalContractSha256: sha256(canonicalBytes(bundle.openapi)), operationKeys: [...OPERATION_KEYS], provenanceStatus: bundle.provenance.status, snapshotSha256: sha256(bundle.snapshotBytes), status: "PASS" };
}

export async function validateManifest(root, manifest) {
  assert.deepEqual(Object.keys(manifest).sort(), ["artifacts", "hashAlgorithm", "schemaVersion"].sort(), "R-003-11: artifact manifest shape differs");
  if (manifest.schemaVersion !== 3 || manifest.hashAlgorithm !== "sha256" || !Array.isArray(manifest.artifacts)) fail("R-003-11", "artifact-manifest.json", "header differs");
  const paths = manifest.artifacts.map((entry) => entry.path);
  if (!same(paths, ARTIFACTS) || new Set(paths).size !== paths.length) fail("R-003-11", "artifact-manifest.json", "catalog differs");
  for (const entry of manifest.artifacts) {
    const [mediaType, role] = ARTIFACT_SPEC[entry.path] ?? [];
    if (!same(Object.keys(entry).sort(), ["bytes", "mediaType", "path", "role", "sha256"].sort()) || entry.mediaType !== mediaType || entry.role !== role || !Number.isSafeInteger(entry.bytes) || !/^[a-f0-9]{64}$/.test(entry.sha256)) fail("R-003-11", "artifact-manifest.json", `invalid ${entry.path}`);
    const bytes = await readFile(path.join(root, entry.path));
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) fail("R-003-11", "artifact-manifest.json", `digest mismatch ${entry.path}`);
  }
}

export async function validateCanonicalArtifacts(root) {
  for (const name of CANONICAL_JSON_ARTIFACTS) {
    const bytes = await readFile(path.join(root, name));
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!bytes.equals(canonicalBytes(parsed))) fail("R-003-18", name, "not RFC 8785 JCS bytes");
  }
}
