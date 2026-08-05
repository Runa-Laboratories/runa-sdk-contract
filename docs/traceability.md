# Contract repository traceability

This bootstrap implements the repository-owned, central portion of PRD-003 and
the canonical-input obligations consumed by PRD-021. The repository generator
is implemented; downstream adoption and external approval gates are not.

| Requirement | Repository design | Verification evidence |
| --- | --- | --- |
| R-003-01, R-021-01 | One binding-complete checked-in snapshot at the repository root | Both language generators consume only the snapshot |
| R-003-02 | Closed structural draft 2020-12 snapshot schema | Structural weakening and descriptor mutations fail |
| R-003-03, R-003-28, R-021-03, R-021-22 | Projection derived independently from OpenAPI | Exact 14-key, method, path, success, wire, and UUID assertions |
| R-002-24, R-002-26, R-002-27 | Optional `background` create field with omitted/false synchronous compatibility and explicit `true` readiness semantics | PRD source-shape extraction, OpenAPI/snapshot agreement, optional-boolean mutation test, and downstream polling acceptance cases |
| R-003-13 | Detached source and projection digests | Provenance digest mutation fails closed |
| R-003-14, R-003-22 | Stable fact-identity and source-reference comparison | Snapshot projection and checked-in projection are independently compared with the extractor manifest |
| R-003-23, R-021-20 | Safe requirement-tagged diagnostics | Errors contain an artifact/requirement fact and never retain payloads or secrets |
| R-003-27 | Independently recorded bootstrap sources | `source-artifacts.manifest.json` and workspace-source verification |
| OQ-003-01, R-003-10 to R-003-12, R-003-18 | One Node 24 generator for both language targets | `tools/runa-contract-generator.mjs`, empty-root guard, detailed generated manifests, and deterministic double-generation tests |
| OQ-003-04, R-003-27 | Independent JCS baseline extractor | `tools/extract-prd002-expectations.mjs` imports no snapshot, projection, generator, or shared canonicalizer |
| R-003-20, R-003-26 | Complete release attestation chain | Emitter covers baseline, schema, expected manifest, projection, snapshot, provenance, manifests, generated outputs, identities, revision, and test IDs; BLOCKED provenance emits nothing |
| R-021-02, R-021-15, R-021-21 | Fail-closed consumer precondition | `npm run verify` plus hostile mutation tests |

External approval remains blocked until an actual immutable remote review is
available. Committed consumer outputs, import-boundary adapters, golden-wire
captures, and independently accepted cross-language attestations remain
downstream work.

The exact commit-pinned changes required in both consumers are listed in
[consumer-adoption.md](consumer-adoption.md).
The PRD-002/TC-003-03 question-state contradiction is documented in
[known-prd-interpretations.md](known-prd-interpretations.md).
