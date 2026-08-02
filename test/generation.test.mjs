import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalBytes, sha256 } from "../tools/lib/canonical-json.mjs";
import { loadBundle, validateBundle } from "../tools/lib/contract-model.mjs";

const generator = path.resolve("tools/runa-contract-generator.mjs");

async function generate(language, output) {
  const result = spawnSync(process.execPath, [generator, "--language", language, "--output", output], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const manifestBytes = await readFile(path.join(output, "generated-manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.deepEqual(manifestBytes, canonicalBytes(manifest));
  assert.equal(manifest.language, language);
  assert.equal(manifest.schema_version, 1);
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(output, entry.path));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(sha256(bytes), entry.sha256);
    assert.match(bytes.toString("utf8").split("\n", 1)[0], /@generated/u);
  }
  return manifest;
}

for (const language of ["typescript", "python"]) {
  test(`R-003-12 ${language} generation is deterministic and overwrite-safe`, async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), `runa-contract-${language}-`));
    const suffix = language === "typescript"
      ? path.join("src", "internal", "contract", "generated")
      : path.join("src", "runa", "_internal", "contract", "generated");
    const first = path.join(temporary, "first", suffix);
    const second = path.join(temporary, "second", suffix);
    try {
      const left = await generate(language, first);
      const right = await generate(language, second);
      assert.deepEqual(left, right);
      assert(left.files.some((entry) => entry.path.includes("serializers")));
      assert(left.files.some((entry) => entry.path.includes("deserializers")));
      for (const name of await readdir(first)) {
        assert.deepEqual(await readFile(path.join(first, name)), await readFile(path.join(second, name)));
      }
      const refused = spawnSync(process.execPath, [generator, "--language", language, "--output", first], {
        encoding: "utf8",
      });
      assert.notEqual(refused.status, 0);
      assert.match(refused.stderr, /output root must be empty/u);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
}

test("R-003-27 baseline extractor is independent and reproducible", async () => {
  const source = await readFile("tools/extract-prd002-expectations.mjs", "utf8");
  assert.doesNotMatch(source, /from ["']\.\/lib\/|snapshot\.json|projection\.json|runa-contract-generator/u);
  const result = spawnSync(process.execPath, ["tools/extract-prd002-expectations.mjs", "--check"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("R-003-20 enforces the current provenance state", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "runa-attestation-"));
  const generated = path.join(temporary, "src", "internal", "contract", "generated");
  const output = path.join(temporary, "attestation.json");
  try {
    await generate("typescript", generated);
    const bundle = await loadBundle(path.resolve("."));
    const sourceRevision = bundle.provenance.status === "APPROVED"
      ? bundle.provenance.source_revision
      : "a".repeat(40);
    const result = spawnSync(process.execPath, ["tools/emit-release-attestation.mjs",
      "--language", "typescript", "--generated-root", generated,
      "--source-revision", sourceRevision, "--output", output], { encoding: "utf8" });
    if (bundle.provenance.status === "BLOCKED") {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /R-003-20: release attestation blocked/u);
      await assert.rejects(() => readFile(output), /ENOENT/u);
    } else {
      assert.equal(result.status, 0, result.stderr);
      const attestation = JSON.parse(await readFile(output, "utf8"));
      assert.equal(attestation.status, "PASS");
      assert.equal(attestation.source_revision, sourceRevision);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("R-003-15 validates approval transition or the immutable approved record", async () => {
  const current = await loadBundle(path.resolve("."));
  const revision = "a".repeat(40);
  const url = "https://github.com/Runa-Laboratories/runa-sdk-contract/pull/1";
  const result = spawnSync(process.execPath, ["tools/approve-provenance.mjs", "--dry-run",
    "--canonical-ref", revision, "--contract-pr-url", url, "--contract-merge-sha", revision,
    "--prd002-pr-url", url, "--prd002-merge-sha", revision], { encoding: "utf8" });
  if (current.provenance.status === "BLOCKED") {
    assert.equal(result.status, 0, result.stderr);
    const approved = JSON.parse(result.stdout);
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.canonical_ref, revision);
    current.provenance = approved;
    validateBundle(current);
  } else {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /provenance is not in BLOCKED state/u);
    assert.match(current.provenance.canonical_ref, /^[a-f0-9]{40}$/u);
    assert.match(current.provenance.approval_reference.contract_pull_request_url,
      /^https:\/\/github\.com\/Runa-Laboratories\/runa-sdk-contract\/pull\/\d+$/u);
    validateBundle(current);
  }
});
