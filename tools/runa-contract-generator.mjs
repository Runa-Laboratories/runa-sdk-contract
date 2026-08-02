#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle, validateBundle } from "./lib/contract-model.mjs";

const GENERATOR_VERSION = "0.2.0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ownPath = fileURLToPath(import.meta.url);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Kept independent of the baseline extractor's implementation.
function generatorJcs(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite generator number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(generatorJcs).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${generatorJcs(value[key])}`).join(",")}}`;
  }
  throw new TypeError(`unsupported generator value: ${typeof value}`);
}

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const language = argument("--language");
const outputArgument = argument("--output");
if (!new Set(["typescript", "python"]).has(language) || outputArgument === undefined) {
  throw new Error("Usage: runa-contract-generator --language <typescript|python> --output <empty-generated-root>");
}
const output = path.resolve(outputArgument);
const bundle = await loadBundle(root);
validateBundle(bundle);
const snapshotBytes = await readFile(path.join(root, "runa-sdk-contract.snapshot.json"));
const snapshotSha256 = sha256(snapshotBytes);
const generatorSha256 = sha256(await readFile(ownPath));
const header = {
  contract_id: "runa-sdk-contract",
  generator_path: "tools/runa-contract-generator.mjs",
  generator_sha256: generatorSha256,
  generator_version: GENERATOR_VERSION,
  snapshot_path: "runa-sdk-contract.snapshot.json",
  snapshot_sha256: snapshotSha256,
  snapshot_version: bundle.snapshot.snapshot_version,
};
const expectedRoot = bundle.snapshot.generator_configuration.generated_roots[language].replaceAll("/", path.sep);
if (!output.endsWith(expectedRoot.slice(0, -1))) {
  throw new Error(`R-003-12: output must end in ${bundle.snapshot.generator_configuration.generated_roots[language]}`);
}
const operationRows = bundle.snapshot.operations.map((operation) => ({
    hasRequestBody: operation.request.body_presence === "required",
    method: operation.method,
    operationKey: operation.operation_key,
    pathParameters: operation.path_parameters.map((item) => item.name),
    pathTemplate: operation.path_template,
    successStatus: operation.success.selector.status,
  }));
const metadata = Object.fromEntries(operationRows.map((item) => [item.operationKey, item]));
const wireSchemas = bundle.snapshot.components.schemas;

const files = language === "typescript" ? {
  "index.ts": `// @generated ${generatorJcs(header)}\nexport { GENERATED_OPERATIONS } from "./operation-metadata.js";\nexport type { GeneratedWireValue } from "./wire-types.js";\nexport { serializeGeneratedRequest } from "./serializers.js";\nexport { deserializeGeneratedResponse } from "./deserializers.js";\n`,
  "operation-metadata.ts": `// @generated ${generatorJcs(header)}\nexport const GENERATED_OPERATIONS = ${JSON.stringify(metadata, null, 2)} as const;\n`,
  "wire-types.ts": `// @generated ${generatorJcs(header)}\nexport type GeneratedWireValue = null | boolean | number | string | GeneratedWireValue[] | { readonly [key: string]: GeneratedWireValue };\nexport const GENERATED_WIRE_SCHEMAS = ${JSON.stringify(wireSchemas, null, 2)} as const;\n`,
  "serializers.ts": `// @generated ${generatorJcs(header)}\nimport type { GeneratedWireValue } from "./wire-types.js";\n\nexport function serializeGeneratedRequest(value: GeneratedWireValue): string {\n  return JSON.stringify(value);\n}\n`,
  "deserializers.ts": `// @generated ${generatorJcs(header)}\nimport type { GeneratedWireValue } from "./wire-types.js";\n\nexport function deserializeGeneratedResponse(text: string): GeneratedWireValue {\n  return JSON.parse(text) as GeneratedWireValue;\n}\n`,
} : {
  "__init__.py": `# @generated ${generatorJcs(header)}\nfrom .deserializers import deserialize_generated_response\nfrom .operation_metadata import GENERATED_OPERATIONS\nfrom .serializers import serialize_generated_request\nfrom .wire_types import GENERATED_WIRE_SCHEMAS, GeneratedWireValue\n\n__all__ = ("GENERATED_OPERATIONS", "GENERATED_WIRE_SCHEMAS", "GeneratedWireValue", "deserialize_generated_response", "serialize_generated_request")\n`,
  "operation_metadata.py": `# @generated ${generatorJcs(header)}\nimport json as _json\n\nGENERATED_OPERATIONS = _json.loads(${JSON.stringify(JSON.stringify(metadata))})\n`,
  "wire_types.py": `# @generated ${generatorJcs(header)}\nimport json as _json\nfrom typing import TypeAlias\n\nGeneratedWireValue: TypeAlias = None | bool | int | float | str | list["GeneratedWireValue"] | dict[str, "GeneratedWireValue"]\nGENERATED_WIRE_SCHEMAS = _json.loads(${JSON.stringify(JSON.stringify(wireSchemas))})\n`,
  "serializers.py": `# @generated ${generatorJcs(header)}\nimport json as _json\nfrom .wire_types import GeneratedWireValue\n\ndef serialize_generated_request(value: GeneratedWireValue) -> str:\n    return _json.dumps(value, ensure_ascii=False, separators=(",", ":"))\n`,
  "deserializers.py": `# @generated ${generatorJcs(header)}\nimport json as _json\nfrom .wire_types import GeneratedWireValue\n\ndef deserialize_generated_response(text: str) -> GeneratedWireValue:\n    return _json.loads(text)\n`,
};

await mkdir(output, { recursive: true });
const existing = await readdir(output);
if (existing.length !== 0) {
  throw new Error("R-003-12: output root must be empty; protected or handwritten paths are never replaced.");
}
const manifestEntries = [];
for (const [name, content] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
  const bytes = Buffer.from(content, "utf8");
  await writeFile(path.join(output, name), bytes, { flag: "wx" });
  manifestEntries.push({ bytes: bytes.length, path: name, sha256: sha256(bytes) });
}
const manifest = generatorJcs({
  files: manifestEntries,
  generator: {
    path: "tools/runa-contract-generator.mjs",
    sha256: generatorSha256,
    version: GENERATOR_VERSION,
  },
  language,
  schema_version: 1,
  snapshot: {
    path: "runa-sdk-contract.snapshot.json",
    sha256: snapshotSha256,
    version: bundle.snapshot.snapshot_version,
  },
});
await writeFile(path.join(output, "generated-manifest.json"), manifest, { flag: "wx" });
console.log(`contract generation: PASS (${language}; ${manifestEntries.length} files)`);
