# Commit-pinned consumer adoption

The canonical repository is locally complete, but neither SDK consumes it yet.
That adoption requires changes outside this repository and is therefore an
explicit release blocker, not an inferred success.

## Required TypeScript changes

1. Add this repository as a Git submodule at `contracts/`, pinned by gitlink to
   an accepted commit SHA.
2. Remove copies synchronized from `../../infra/contracts` and all assumptions
   that a parent monorepo is present.
3. Update the currentness validator to provenance schema v3 and the detailed
   PRD-002 expectation manifest.
4. Invoke `contracts/tools/runa-contract-generator.mjs --language typescript`
   into an empty private generated root, then compare its detailed manifest and
   bytes with committed generated output.
5. Bind release evidence to the gitlink commit, snapshot digest, generator
   digest, and canonical artifact manifest.

## Required Python changes

Apply the same gitlink, provenance-v2, expectation, generator, clean-root,
manifest, and release-evidence rules with `--language python`. The Python SDK
must not carry a language-specific contract generator.

## CI and approval gate

Consumer CI must initialize the submodule, reject an unexpected gitlink commit,
run the canonical repository verifier, and reject `BLOCKED` provenance for a
release. Once a remote and real reviews exist, the canonical provenance update
must identify the immutable contract commit and reviewed approval object. No
local commit, branch name, mutable tag, or consumer copy substitutes for that
evidence.
