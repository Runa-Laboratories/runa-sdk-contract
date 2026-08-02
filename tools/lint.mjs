#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function filesBelow(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(target));
    else output.push(target.replaceAll("\\", "/"));
  }
  return output;
}

const scripts = [...await filesBelow("tools"), ...await filesBelow("test")]
  .filter((file) => file.endsWith(".mjs")).sort();
for (const file of scripts) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file}: ${result.stderr}`);
}
for (const workflow of await filesBelow(".github/workflows")) {
  const text = await readFile(workflow, "utf8");
  for (const match of text.matchAll(/^\s*- uses:\s*([^\s]+)$/gmu)) {
    assert.match(match[1], /^[^@\s]+@[a-f0-9]{40}$/u, `${workflow}: action is not SHA-pinned`);
  }
  assert.match(text, /timeout-minutes:\s*\d+/u, `${workflow}: timeout is missing`);
}
console.log(`lint: PASS (${scripts.length} modules)`);
