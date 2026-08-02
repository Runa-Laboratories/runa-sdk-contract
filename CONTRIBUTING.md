# Contributing

Contract changes require a reviewed source change and complete forward and
backward traceability. Do not infer defaults, statuses, fields, constraints, or
approval evidence.

Before proposing a change:

1. Run `npm run verify:workspace-sources` in the parent Runa workspace.
2. Run `npm run check`.
3. Confirm `git diff --check` and `git status --short` are clean after the
   intended files are staged.
4. Describe the PRD requirement IDs, semantic change class, snapshot version
   impact, and mutation evidence in the review.

Generated or canonical artifacts must be updated as one reviewed set. Do not
patch a downstream generated binding to bypass this repository.
