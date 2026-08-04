#!/usr/bin/env node
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalBytes, sha256 } from "./lib/canonical-json.mjs";
import { ARTIFACTS, ARTIFACT_SPEC, loadBundle, validateBundle } from "./lib/contract-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function updateSourceManifestProvenance() {
  const manifestPath = path.join(root, "source-artifacts.manifest.json");
  const manifestTemporary = `${manifestPath}.next`;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const provenanceBytes = await readFile(path.join(root, "runa-sdk-contract.provenance.json"));
  const sources = manifest.sources.map((source) => source.path === "runa-sdk-contract.provenance.json"
    ? { ...source, sha256: sha256(provenanceBytes) }
    : source);
  await writeFile(
    manifestTemporary,
    canonicalBytes({ ...manifest, sources }),
    { flag: "wx" },
  );
  await rename(manifestTemporary, manifestPath);
}
async function writeArtifactManifest() {
  const artifacts = [];
  for (const artifactPath of ARTIFACTS) {
    const bytes = await readFile(path.join(root, artifactPath));
    const [mediaType, role] = ARTIFACT_SPEC[artifactPath];
    artifacts.push({ bytes: bytes.length, mediaType, path: artifactPath, role, sha256: sha256(bytes) });
  }
  const manifestPath = path.join(root, "artifact-manifest.json");
  const manifestTemporary = `${manifestPath}.next`;
  await writeFile(manifestTemporary, canonicalBytes({ artifacts, hashAlgorithm: "sha256", schemaVersion: 3 }), { flag: "wx" });
  await rename(manifestTemporary, manifestPath);
}
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const canonicalRef = argument("--canonical-ref");
const sourceRevision = argument("--source-revision") ?? canonicalRef;
const contractPrUrl = argument("--contract-pr-url");
const contractMergeSha = argument("--contract-merge-sha");
const prd002PrUrl = argument("--prd002-pr-url");
const prd002MergeSha = argument("--prd002-merge-sha");
const commit = /^[a-f0-9]{40}$/u;
const pullRequest = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/u;
if (process.argv.includes("--refresh-blocked")) {
  const provenancePath = path.join(root, "runa-sdk-contract.provenance.json");
  const provenanceTemporary = `${provenancePath}.next`;
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  await writeFile(provenanceTemporary, canonicalBytes(provenance), { flag: "wx" });
  await rename(provenanceTemporary, provenancePath);
  const blockedBundle = await loadBundle(root);
  validateBundle(blockedBundle);
  if (blockedBundle.provenance.status !== "BLOCKED") {
    throw new Error("R-003-15: blocked artifact refresh requires BLOCKED provenance.");
  }
  await updateSourceManifestProvenance();
  await writeArtifactManifest();
  console.log("blocked provenance preserved; artifact manifest regenerated");
  process.exit(0);
}
if (!commit.test(canonicalRef ?? "") || !commit.test(sourceRevision ?? "") ||
    !commit.test(contractMergeSha ?? "") || !commit.test(prd002MergeSha ?? "") ||
    !pullRequest.test(contractPrUrl ?? "") || !pullRequest.test(prd002PrUrl ?? "")) {
  throw new Error("R-003-15: immutable 40-hex revisions and GitHub pull-request URLs are required.");
}
const bundle = await loadBundle(root);
validateBundle(bundle);
if (bundle.provenance.status !== "BLOCKED") throw new Error("R-003-15: provenance is not in BLOCKED state.");
const approved = {
  ...bundle.provenance,
  approval_reference: {
    contract_merge_commit_sha: contractMergeSha,
    contract_pull_request_url: contractPrUrl,
    prd002_merge_commit_sha: prd002MergeSha,
    prd002_pull_request_url: prd002PrUrl,
  },
  baseline_extractor_identity: { ...bundle.provenance.baseline_extractor_identity, git_commit_sha: canonicalRef },
  canonical_ref: canonicalRef,
  generator_identity: { ...bundle.provenance.generator_identity, git_commit_sha: canonicalRef },
  reason: null,
  source_revision: sourceRevision,
  status: "APPROVED",
};
validateBundle({ ...bundle, provenance: approved });
const approvedBytes = canonicalBytes(approved);
if (process.argv.includes("--dry-run")) {
  process.stdout.write(approvedBytes);
} else {
  const provenancePath = path.join(root, "runa-sdk-contract.provenance.json");
  const provenanceTemporary = `${provenancePath}.next`;
  await writeFile(provenanceTemporary, approvedBytes, { flag: "wx" });
  await rename(provenanceTemporary, provenancePath);
  await updateSourceManifestProvenance();
  await writeArtifactManifest();
  console.log("provenance transition: APPROVED; artifact manifest regenerated");
}
