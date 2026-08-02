#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalBytes, sha256 } from "./lib/canonical-json.mjs";
import { loadBundle, validateBundle, validateCanonicalArtifacts, validateManifest } from "./lib/contract-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const language = argument("--language");
const generatedRoot = argument("--generated-root");
const sourceRevision = argument("--source-revision");
const output = argument("--output");
if (!new Set(["python", "typescript"]).has(language) || !generatedRoot || !sourceRevision || !output) {
  throw new Error("Usage: emit-release-attestation --language <python|typescript> --generated-root <root> --source-revision <sha> --output <new-json>");
}
const bundle = await loadBundle(root);
await validateCanonicalArtifacts(root);
await validateManifest(root, bundle.manifest);
const result = validateBundle(bundle);
if (bundle.provenance.status !== "APPROVED") {
  throw new Error("R-003-20: release attestation blocked by detached provenance; no output was written.");
}
if (sourceRevision !== bundle.provenance.source_revision) throw new Error("R-003-20: source revision differs from approved provenance.");
const generatedManifestPath = path.join(path.resolve(generatedRoot), "generated-manifest.json");
const generatedManifestBytes = await readFile(generatedManifestPath);
const generatedManifest = JSON.parse(generatedManifestBytes.toString("utf8"));
if (generatedManifest.language !== language || generatedManifest.snapshot.sha256 !== result.snapshotSha256 ||
    generatedManifest.snapshot.version !== bundle.snapshot.snapshot_version) throw new Error("R-003-20: generated manifest contract identity differs.");
const generatedOutputs = [];
for (const entry of generatedManifest.files) {
  const bytes = await readFile(path.join(path.resolve(generatedRoot), entry.path));
  if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`R-003-20: generated digest differs: ${entry.path}`);
  generatedOutputs.push({ path: entry.path, sha256: entry.sha256 });
}
const artifactManifestBytes = await readFile(path.join(root, "artifact-manifest.json"));
const attestation = {
  contract_id: "runa-sdk-contract",
  digests: {
    artifact_manifest: sha256(artifactManifestBytes),
    baseline: sha256(bundle.baselineSourceBytes),
    baseline_expectation_manifest: sha256(bundle.expectedBytes),
    generated_file_manifest: sha256(generatedManifestBytes),
    generated_outputs: generatedOutputs,
    projection: sha256(bundle.projectionBytes),
    provenance: sha256(bundle.provenanceBytes),
    schema: sha256(bundle.schemaBytes),
    snapshot: sha256(bundle.snapshotBytes),
  },
  generator_identity: bundle.provenance.generator_identity,
  language,
  baseline_extractor_identity: bundle.provenance.baseline_extractor_identity,
  semantic_change_class: bundle.provenance.semantic_change_class,
  snapshot_version: bundle.snapshot.snapshot_version,
  source_revision: sourceRevision,
  status: "PASS",
  verification_results: ["TC-003-01", "TC-003-03", "TC-003-04", "TC-003-08", "TC-003-10", "TC-003-11", "TC-003-12"],
};
const bytes = canonicalBytes(attestation);
const text = bytes.toString("utf8");
if (/runa_sk_|Bearer\s+[A-Za-z0-9._~-]{8,}|raw_response|provider[_-]?internal/iu.test(text)) {
  throw new Error("R-003-21: prohibited secret or internal marker in attestation.");
}
await writeFile(path.resolve(output), bytes, { flag: "wx" });
console.log(`release attestation: PASS (${language})`);
