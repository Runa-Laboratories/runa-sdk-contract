import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub workflows use read-minimum permissions and immutable actions", async () => {
  for (const file of [".github/workflows/ci.yml", ".github/workflows/codeql.yml"]) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/^\s*- uses:\s*([^\s]+)$/gmu)) {
      assert.match(match[1], /^[^@\s]+@[a-f0-9]{40}$/u);
    }
    assert.match(text, /timeout-minutes:\s*\d+/u);
    assert.match(text, /persist-credentials:\s*false/u);
    assert.doesNotMatch(text, /pull_request_target|contents:\s*write|id-token:\s*write/u);
  }
});

test("package has no runtime or development dependency surface", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(manifest.private, true);
  assert.equal(manifest.license, "Apache-2.0");
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies, undefined);
});
