# Runa SDK Contract

Canonical, auditable contract artifacts shared by the Runa SDK implementations.

This repository is the local bootstrap of the repository named by PRD-003 as
`Runa-Laboratories/runa-sdk-contract`. It contains the accepted OpenAPI source,
the SDK projection, the exact snapshot schema, the snapshot, a baseline
expectation, detached provenance, and fail-closed verification tools. It does
not publish a package, call the Runa API, generate public SDK behavior, or
resolve an undocumented contract fact.

## Status

Artifact validation is operational. The detached provenance deliberately
remains `BLOCKED` because no GitHub remote, immutable reviewed pull request, or
approval commit exists yet. A passing local check proves artifact integrity; it
does not claim release approval or satisfy the external approval gate.

## Quick start

Requires Node.js 24 or later.

```sh
npm ci
npm run check
```

Expected final lines include:

```text
contract verification: PASS (13 SDK operations; provenance BLOCKED)
workspace source verification: PASS
```

The workspace-source command is intentionally separate because SDK consumers
and GitHub CI receive this repository without its parent workspace:

```sh
npm run verify:workspace-sources
```

## Artifact model

| Artifact | Role |
| --- | --- |
| `runa-api.openapi.json` | Accepted OpenAPI source artifact. |
| `runa-api.openapi.sha256` | SHA-256 of canonical JSON semantics for the OpenAPI artifact. |
| `runa-sdk-contract.prd002-projection.json` | Binding-relevant PRD-002 projection with stable fact identities and source references. |
| `runa-sdk-contract.snapshot.json` | Sole machine-readable binding snapshot. |
| `runa-sdk-contract.snapshot.schema.json` | Closed structural JSON Schema for the binding-complete snapshot. |
| `runa-sdk-contract.prd002-expected-manifest.json` | Independently extracted fact and open-question catalog. |
| `runa-sdk-contract.provenance.json` | Detached provenance and approval state. |
| `runa-sdk-contract.provenance.schema.json` | Closed interoperable schema for detached provenance v3. |
| `artifact-manifest.json` | Exact-byte SHA-256 inventory of repository contract inputs. |
| `source-artifacts.manifest.json` | Immutable hashes of the workspace inputs used for bootstrap. |

The verifier independently derives the SDK projection from OpenAPI, checks the
13 exact operation keys, methods, paths, success selectors, schema projection,
wire policy, canonical JSON bytes, exact snapshot schema, provenance digests,
and artifact manifest. Mutation tests prove those checks fail closed.

`tools/extract-prd002-expectations.mjs` reads only the byte-pinned PRD-002
baseline and has its own JCS implementation. `tools/runa-contract-generator.mjs`
is the sole Node 24 generator entry point for TypeScript and Python operation
metadata, private wire types, serializers, and deserializers. It accepts only
the language's exact empty generated root and emits a detailed digest manifest.

## Trust and update procedure

1. Update the accepted infrastructure contract through its owning review.
2. Update the PRD-backed snapshot set as one change.
3. Regenerate canonical JSON bytes and both manifests.
4. Run `npm run verify:workspace-sources` from the Runa workspace.
5. Run `npm run check` twice and require a clean diff.
6. Review the semantic change class and snapshot version under PRD-003.
7. Only after a real remote review exists, replace the blocked provenance with
   immutable approval evidence. Never invent or self-approve those fields.

After the reviewed pull request is merged, `tools/approve-provenance.mjs`
performs the explicit `BLOCKED` to `APPROVED` transition from supplied immutable
commit IDs and pull-request URLs; it never reads or infers `HEAD`. It also
regenerates the artifact manifest. `tools/emit-release-attestation.mjs` remains
fail-closed until that transition and then covers the complete R-003-20 digest
chain.

```sh
node tools/approve-provenance.mjs \
  --canonical-ref <40-hex-M1> \
  --contract-pr-url https://github.com/Runa-Laboratories/runa-sdk-contract/pull/1 \
  --contract-merge-sha <40-hex-M1> \
  --prd002-pr-url https://github.com/Runa-Laboratories/runa-sdk-contract/pull/1 \
  --prd002-merge-sha <40-hex-M1>
```

The command accepts an optional explicit `--source-revision`; otherwise it uses
the supplied canonical ref. It validates the values supplied by release
engineering and never shells out to Git or derives them from the current
checkout.

Consumers should pin this repository as a Git submodule at `contracts/` to an
accepted commit SHA and verify the artifact manifest before generation.
The exact consumer changes still required are documented in
[docs/consumer-adoption.md](docs/consumer-adoption.md).

## Scope and traceability

The implemented verification boundary and requirement mapping are documented
in [docs/traceability.md](docs/traceability.md). Generated TypeScript bindings,
public SDK models, transport, credentials, retries, and release publication are
owned by downstream repositories and remain out of scope here.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contract changes must preserve exact
source attribution, remain deterministic, and include a failing mutation test
for every new validator.

## License

Licensed under the [Apache License 2.0](LICENSE).
