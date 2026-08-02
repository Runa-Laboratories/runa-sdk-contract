#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadBundle,
  validateBundle,
  validateCanonicalArtifacts,
  validateManifest,
} from "./lib/contract-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await loadBundle(root);
await validateCanonicalArtifacts(root);
await validateManifest(root, bundle.manifest);
const report = validateBundle(bundle);
console.log(JSON.stringify(report, null, 2));
console.log(`contract verification: PASS (${report.operationKeys.length} SDK operations; provenance ${report.provenanceStatus})`);
