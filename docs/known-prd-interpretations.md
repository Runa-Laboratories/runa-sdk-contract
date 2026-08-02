# Recorded PRD interpretation

PRD-002 Section 11 explicitly resolves `OQ-002-01` and `OQ-002-02` and leaves
only `OQ-002-06` through `OQ-002-11` unresolved. PRD-003 TC-003-03 describes
every open-question ID as unresolved, which conflicts with that accepted
baseline and with R-003-05.

The fail-closed implementation preserves all eight IDs in the independently
extracted expectation manifest, checked-in projection, and snapshot question
map. It records `OQ-002-01` and `OQ-002-02` as `resolved`; only
`OQ-002-06` through `OQ-002-11` appear in the unresolved-question map and
operation `unresolved_refs`. No unresolved record contains an asserted value.
This interpretation preserves source evidence and does not invent nonexistent
`OQ-002-03` through `OQ-002-05`.
