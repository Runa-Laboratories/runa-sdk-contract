# PRD-002: Runa REST Contract Baseline

| Field | Value |
| --- | --- |
| Status | Ready for implementation |
| Owner | Runa SDK maintainers |
| Area | Shared: TypeScript and Python SDK contract layer |
| Last updated | 2026-07-30 |
| Depends on | PRD-001; external prerequisite `prds/infra/PRD-001-programmatic-api-authentication.md` |
| Downstream consumers | PRD-003 through PRD-099 where they consume the Runa REST contract |

## Normative language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in RFC 2119 and RFC 8174 when, and only when, they appear in uppercase. In EARS sentences, **SHALL** and **SHALL NOT** carry MUST-level force. Each normative requirement has one identifier, one force, one goal trace, and at least one acceptance test.

## 1. Problem statement and context

The Runa SDKs need one literal, shared understanding of the deployed `https://api.runacode.io/v1` contract. Without it, the TypeScript and Python bindings can disagree about a route, field spelling, optional field, session state, creation status, or the exceptional semantics of an open URL and trial limits. That creates avoidable cross-language incompatibility and can turn an SDK-side guess into a false promise about the service.

`prds/_CONTEXT.md` is the source of truth for this baseline. PRD-001 already fixes the Runa-only product boundary and the exact permitted method/path allowlist. This PRD does not reopen either decision. It records the request and successful-response shapes, the documented status facts, and the external service semantics that both SDK contract layers must treat as given. The backend, not either SDK, owns authorization decisions, lifecycle validity, quota accounting, and trial-limit enforcement.

### 1.1 Contract conventions

- **Base origin** means `https://api.runacode.io`. The route tables below are relative to that origin.
- **Contract layer** means the shared wire-operation definitions and conformance fixtures consumed by language bindings. It is not a backend implementation and does not decide public SDK names, transport policy, retry policy, or error classes.
- **Documented** means explicitly stated in `prds/_CONTEXT.md` or established by the deployed route implementation in `infra/edge/src/api.ts` and its session-ID storage schema. A field shown with `?` is explicitly optional. Any type, validation rule, header, or behavior not stated by those sources is deliberately unspecified in this PRD and is listed in Section 11.
- **Session object** means exactly the wire object in Section 6.2. Its fields use the documented wire names; it deliberately contains no backend runtime identifier.
- **Success shape** describes the JSON body returned for successful completion. Section 6.1 states the source-backed HTTP status code for every successful operation.
- **External limit** means a service-side rule that an SDK may represent or surface but MUST NOT enforce locally.

## 2. Goals and explicit non-goals

### 2.1 Goals

| Goal ID | Measurable goal |
| --- | --- |
| G-002-01 | Define all 13 PRD-001 Section 6.1 SDK-profile operations with 100% method, path, path-parameter, request-shape, success-shape, media/encoding, and exact-status coverage. |
| G-002-02 | Prove, using shared fixtures, that TypeScript and Python bindings preserve 100% of documented wire field names, optionality, enum values, object variants, and literal success bodies. |
| G-002-03 | Prove that 100% of open-URL and service-limit conformance cases preserve the documented external semantics without SDK-side pre-enforcement or invented recovery behavior. |
| G-002-04 | Keep undocumented behavior explicit: every source-silent detail is either absent from this baseline or recorded as an open question, with zero invented protocol defaults. |

### 2.2 Explicit non-goals

This PRD does not define or authorize:

- Any method/path pair outside the PRD-001 SDK profile. Console-only routes and fields are not added to the SDK merely because the control plane exposes them.
- Backend implementation, backend changes, API-key management endpoints, authentication resolution or precedence, credential storage, or credential validation policy.
- Error taxonomy, language-specific exceptions, parsing/mapping of failures, retry classification, timeout policy, redirect policy, transport implementation, or observability mechanics.
- Language-specific public API names, rich-handle behavior, local lookup conveniences, domain-model naming, scalar coercion, unknown-field behavior, or serializer/generator architecture.
- SDK-side enforcement, reservation, prediction, or circumvention of service trial limits.
- A claim about scalar semantics, ordering, pagination, or lifecycle transitions beyond the source-backed types and validation bounds explicitly recorded here.
- Any provider identity, endpoint, or concept outside the Runa surface fixed by PRD-001.

## 3. Success metrics

| Class | Metric | Target | Evidence |
| --- | --- | --- | --- |
| North star | Shared REST-contract conformance | 13/13 SDK-profile operations pass their route, body, success-body, media/encoding, and exact-status cases in both language suites | Versioned shared fixture manifest and test reports |
| Leading | Contract literal coverage | 100% of documented fields, optional markers, enums, variants, fixed values, and URL semantics appear in at least one fixture | Contract coverage review |
| Leading | Undocumented-detail discipline | 0 invented status, field type, header, validation, pagination, or lifecycle assertions | PRD review and fixture audit |
| Guardrail | Service-limit ownership | 0 local rejections caused solely by the 1-session, 2-vCPU, or 4096-MiB limits | Boundary tests with capture transport |
| Guardrail | Sensitive one-time URL retention in shared fixtures | 0 real URL tokens retained | Synthetic-token fixture inspection |
| Lagging | Cross-language contract disagreements found after release | 0 attributable to a discrepancy in this baseline | Support and release incident review |

## 4. Users, personas, and jobs to be done

| User/persona | Job to be done | Outcome |
| --- | --- | --- |
| SDK contract engineer | Bind the deployed Runa REST surface once for two languages | A literal operation definition with no route or schema guesswork |
| TypeScript or Python SDK implementer | Implement an allowed operation | A precise request body and successful response shape, with source-silent details clearly excluded |
| SDK test engineer | Build stable conformance fixtures | Identical observable service-contract cases across both SDKs |
| SDK consumer | Use session, record, and account capabilities predictably | The same documented Runa behavior regardless of language |

## 5. User stories and story map

| Activity | User story | Contract outcome |
| --- | --- | --- |
| Identify caller | As an SDK consumer using a Runa API key, I need requests to carry the documented bearer form | The contract records the exact Authorization header assumption |
| Manage sessions | As an SDK consumer, I need to create, list, act on, execute in, checkpoint, delete, and open sessions | Each allowed session operation has one literal wire definition |
| Inspect account | As an SDK consumer, I need workspace and usage information without treating estimates as a balance | The `me` variants and estimate semantics remain explicit |
| Inspect audit trail | As an SDK consumer, I need audit records in the documented collection form | The record object and collection response are fixed |
| Respect service boundaries | As an SDK consumer, I need service limits and short-lived open access represented honestly | Limits remain backend-owned and the open URL remains single-use for 60 seconds |

## 6. Functional requirements

### 6.1 Exact operation baseline

The following are the complete permitted operations inherited from PRD-001 Section 6.1. `:id` is a required path parameter named `id` and uses the Section 6.2 session-ID rule. A dash body means no request body is documented. The listed successful status codes are source-backed by the deployed route implementation.

| Operation key | Method | Path | Path parameters | Request body shape | Successful response shape | Documented success-status behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `sessions.get` | `GET` | `/v1/sessions/:id` | `id` | no body | Section 6.2 session object | **200** |
| `me.get` | `GET` | `/v1/me` | None | — | Section 6.4 `Me` object | **200** |
| `sessions.list` | `GET` | `/v1/sessions` | None | — | Array of Section 6.2 session objects | **200** |
| `sessions.create` | `POST` | `/v1/sessions` | None | `{name, agent?, vcpus?, memory_mib?, allowed_hosts?, runtime_port?}` | Section 6.2 session object | **201** |
| `sessions.pause` | `POST` | `/v1/sessions/:id/pause` | `id` | — | Section 6.2 session object | **200** |
| `sessions.resume` | `POST` | `/v1/sessions/:id/resume` | `id` | — | Section 6.2 session object | **200** |
| `sessions.stop` | `POST` | `/v1/sessions/:id/stop` | `id` | — | Section 6.2 session object | **200** |
| `sessions.start` | `POST` | `/v1/sessions/:id/start` | `id` | — | Section 6.2 session object | **200** |
| `sessions.exec` | `POST` | `/v1/sessions/:id/exec` | `id` | `{command, args?, cwd?, timeout_secs?}` | `{exit_code, stdout, stderr, duration_ms, stdout_truncated, stderr_truncated}` | **200** |
| `sessions.checkpoint` | `POST` | `/v1/sessions/:id/checkpoint` | `id` | `{name}` | `{ok:true}` | **200** |
| `sessions.delete` | `DELETE` | `/v1/sessions/:id` | `id` | — | `{ok:true}` | **200** |
| `sessions.open` | `POST` | `/v1/sessions/:id/open` | `id` | — | `{url}`; see Section 6.5 | **200** |
| `records.list` | `GET` | `/v1/records` | None | — | Array of Section 6.6 record objects | **200** |

#### 6.1.1 Complete HTTP/JSON binding

Every SDK-profile request sends `Accept: application/json`. A request with a documented body sends `Content-Type: application/json; charset=utf-8` and the UTF-8 encoding of exactly one JSON value; a request without a documented body sends neither `Content-Type` nor body bytes. Every successful or error response consumed by the SDK is `application/json` encoded as UTF-8. The SDK reads at most 8 MiB of response body and rejects a larger, non-JSON, non-UTF-8, or schema-invalid response as malformed. Redirects are never successful responses and are never followed. A `:id` is the exact lower-case UUID string from Section 6.2 substituted as one unchanged path segment.

The v1 SDK create operation is synchronous: it sends only the six documented create fields in Section 6.1, never sends the console-only `terminal`, `background`, `api_key`, `token_saving`, or `capture_tool_io` fields, and expects the HTTP 201 response to contain the completed session observation. The SDK performs no readiness poll after create.

Source-backed request types and bounds are: create `name: string` with length 1 through 80, optional `agent` in `claude-code | codex | openclaw`, optional integer `vcpus` from 1 through 8, optional integer `memory_mib` from 512 through 16384, optional `allowed_hosts: string[]` with at most 128 non-empty strings, and optional integer `runtime_port` from 1 through 65535; exec `command: string` with minimum length 1, optional `args: string[]`, optional `cwd: string`, and optional `timeout_secs: integer` in the inclusive range 1 through 600; checkpoint `name: string` with length 1 through 80. Unknown request members, explicit `null`, wrong scalar types, fractional integers, and out-of-bound values are prohibited.

Source-backed response types are: exec `exit_code: integer`, `stdout: string`, `stderr: string`, `duration_ms: non-negative integer`, `stdout_truncated: boolean`, and `stderr_truncated: boolean`; acknowledgement `ok: true`; open `url` matching the Section 6.5 capability pattern; record `id` and `session_id` as lower-case UUID strings, `kind` and `summary` as strings, `detail` as the sole opaque JSON value, and `created_at` as an ISO-8601 date-time string; `Me.id` as a lower-case UUID string, `email` as a string, an assigned workspace with literal `assigned:true` and required typed `usage`, or an unassigned workspace with literal `assigned:false` and a non-negative integer `waitlist_position`. Every response container is closed except nested `workspace.usage`, which is deliberately open: its three known members remain required and typed, while safe unmodeled siblings are ignored and not exposed.

### 6.2 Session object

Every successful session response and every array element returned by `sessions.list` has this documented shape:

```text
{id, user_id, slug, name, agent?, vcpus, memory_mib, status,
 running_seconds, created_at, updated_at, url}
```

`id` and `user_id` are lower-case UUID strings; `slug` matches the accepted lower-case DNS-label pattern; `name` is a string; `url` matches the accepted HTTPS runtime-origin pattern; `vcpus`, `memory_mib`, and `running_seconds` are non-negative JSON integers; and `created_at` and `updated_at` are ISO-8601 date-time strings. `agent` is the only field documented as optional; if present, it is one of `claude-code`, `codex`, or `openclaw`. `status` is one of `creating`, `running`, `paused`, `suspended`, `stopped`, `deleted`, or `error`. The session container is closed.

`id` is a JSON string containing the lower-case canonical textual form of a UUID (`8-4-4-4-12` hexadecimal characters). For a `:id` route, the contract substitutes that returned string unchanged as exactly one path segment; its UUID characters require no percent-encoding. Session-ID equality is exact, case-sensitive string equality. The contract SHALL NOT coerce, trim, case-fold, Unicode-normalize, or otherwise transform an ID before path substitution, `sessions.get`, or refresh comparison. No backend runtime identifier appears in the session object.

### 6.3 Authentication and documented status facts

All SDK-profile `/v1/*` requests require an `Authorization` header with a Bearer credential. For programmatic SDK access, the header form is:

```http
Authorization: Bearer runa_sk_<random>
```

The source documents the following HTTP-status facts:

- `me.get`, `sessions.list`, `sessions.get`, all four session lifecycle operations, `sessions.exec`, `sessions.checkpoint`, `sessions.delete`, `sessions.open`, and `records.list` succeed with HTTP **200** and their Section 6.1 success shape.
- `sessions.create` succeeds with HTTP **201** and a session object.
- A request exceeding a trial cap is rejected by the service with HTTP **409** or **422** and a readable message.
- Errors use a JSON body of the form `{ "error": "message" }` plus an HTTP status.

The contract records these wire facts only. The handling, classification, presentation, and retryability of non-success responses are owned by downstream PRDs.

### 6.4 `me` object and estimated usage

`me.get` returns:

```text
{
  id,
  email,
  workspace: {assigned: true, usage: {est_spend_usd, est_remaining_usd, note}}
             | {assigned: false, waitlist_position}
}
```

The assigned branch requires literal `true`; `usage` requires numeric `est_spend_usd`, numeric `est_remaining_usd`, and string `note`. The unassigned branch requires literal `false` and a non-negative integer `waitlist_position`. The `Me` and outer `workspace` containers are closed. Nested `usage` alone is open: safe unmodeled siblings are ignored and not exposed. `est_spend_usd` and `est_remaining_usd` are estimates, not an exact balance. The service is the source of those values; the contract does not define their units beyond the documented names, rounding, update cadence, or billing behavior.

### 6.5 `sessions.open` one-time URL

On successful `sessions.open`, `url` is a Runa URL in this form:

```text
https://<slug>.runacode.cloud/__runa/auth?t=…
```

The returned URL is single-use and valid for 60 seconds. This is an external service semantic: the contract does not define a refresh route, reuse behavior, expiry response status, or the mechanism by which the service tracks use.

### 6.6 Record object

Every array element returned by `records.list` has this documented shape:

```text
{id, session_id, kind, summary, detail, created_at}
```

The scalar types are fixed in Section 6.1.1. Ordering, pagination, filtering, and the vocabulary/semantics of `kind` remain unspecified.

### 6.7 Backend-owned trial limits

The service enforces these trial caps: at most **1 active session**, at most **2 vCPU**, and at most **4096 MiB**. An over-limit request results in the documented 409-or-422 service rejection described in Section 6.3. The SDK contract may expose requested and returned values, but it does not enforce, reserve, calculate, or predict these limits.

### 6.8 Normative functional requirements

| ID | Force | EARS requirement | Trace |
| --- | --- | --- | --- |
| R-002-01 | MUST | The shared SDK contract layer SHALL define exactly the 13 operation keys, methods, paths, and path-parameter placements in Section 6.1 and SHALL define no additional SDK remote operation; it SHALL treat the profile as a subset of the larger control plane. | G-002-01, G-002-04 |
| R-002-02 | MUST | WHEN a programmatic Runa API key is used for an allowed `/v1/*` operation, the shared SDK contract layer SHALL represent its authorization assumption as `Authorization: Bearer <runa_sk_…>` and SHALL require `prds/infra/PRD-001-programmatic-api-authentication.md` before live SDK release; console JWT authentication remains a separate coexisting mechanism. | G-002-01 |
| R-002-03 | MUST | WHEN an allowed operation has a documented request body, the shared SDK contract layer SHALL preserve exactly the field names and optional markers in Section 6.1 and SHALL not add a field, default, or validation rule not documented there. | G-002-01, G-002-04 |
| R-002-04 | MUST | WHEN a successful response is documented as a session, the shared SDK contract layer SHALL represent exactly the Section 6.2 fields, the optional `agent` field, the three documented `agent` values, the seven documented `status` values, and no backend runtime identifier. | G-002-02, G-002-04 |
| R-002-05 | MUST | WHEN `sessions.create` completes successfully, the shared SDK contract layer SHALL require HTTP 201 with a Section 6.2 session object. | G-002-01, G-002-02 |
| R-002-06 | MUST | WHEN `sessions.list` completes successfully, the shared SDK contract layer SHALL represent the response as an array of Section 6.2 session objects and SHALL not infer pagination, ordering, or filtering semantics. | G-002-01, G-002-04 |
| R-002-07 | MUST | WHEN any of `sessions.pause`, `sessions.resume`, `sessions.stop`, or `sessions.start` completes successfully, the shared SDK contract layer SHALL represent the response as a Section 6.2 session object. | G-002-01, G-002-02 |
| R-002-08 | MUST | WHEN `sessions.exec` completes successfully, the shared SDK contract layer SHALL represent exactly `{exit_code, stdout, stderr, duration_ms, stdout_truncated, stderr_truncated}`. | G-002-01, G-002-02 |
| R-002-09 | MUST | WHEN `sessions.checkpoint` or `sessions.delete` completes successfully, the shared SDK contract layer SHALL represent the response as the literal object `{ok:true}`. | G-002-01, G-002-02 |
| R-002-10 | MUST | WHEN `sessions.open` completes successfully, the shared SDK contract layer SHALL represent a `{url}` response whose documented external semantics are one use and a 60-second validity period. | G-002-03 |
| R-002-11 | MUST | WHEN `records.list` completes successfully, the shared SDK contract layer SHALL represent the response as an array of objects with exactly `id`, `session_id`, `kind`, `summary`, `detail`, and `created_at` as the documented fields. | G-002-01, G-002-02 |
| R-002-12 | MUST | WHEN `me.get` completes successfully, the shared SDK contract layer SHALL represent `id`, `email`, and exactly one documented `workspace` variant from Section 6.4, and SHALL preserve `est_spend_usd` and `est_remaining_usd` as estimates rather than an exact balance. | G-002-01, G-002-02 |
| R-002-13 | MUST | WHEN the service returns a non-success response, the shared SDK contract layer SHALL recognize the documented `{error: message}` body form and SHALL retain only the documented status facts in Section 6.3; error taxonomy and response handling remain outside this PRD. | G-002-01, G-002-04 |
| R-002-14 | MUST | WHEN a create request exceeds the service trial limits, the SDK contract layer SHALL treat at most one active session, at most two vCPU, and at most 4096 MiB as backend-owned external constraints that may yield HTTP 409 or 422, and SHALL NOT enforce, reserve, calculate, or predict them locally. | G-002-03 |
| R-002-15 | MUST | WHEN the source contract remains silent about a validation rule, ordering, pagination, lifecycle transition, command-failure meaning, or protocol detail not closed by Sections 6.1.1 through 6.6, the shared SDK contract layer SHALL not invent that detail and SHALL retain it as an explicit open question until accepted evidence resolves it. | G-002-04 |
| R-002-16 | MUST | WHEN a proposed change alters a Section 6.1 route, documented wire field, optional marker, enum value, object variant, literal success body, documented status fact, open-URL semantic, or limit semantic, the shared SDK contract layer SHALL block adoption until an accepted revision to this baseline supplies the changed external contract. | G-002-02, G-002-04 |
| R-002-20 | MUST | WHEN a Section 6.1 operation completes with its documented success body, the shared SDK contract layer SHALL require HTTP 201 for `sessions.create` and HTTP 200 for every other Section 6.1 operation. | G-002-01, G-002-02 |
| R-002-21 | MUST | WHEN a session ID is substituted into `:id` or compared for a local session lookup or refresh, the shared SDK contract layer SHALL apply the Section 6.2 lower-case UUID, single-path-segment, and exact-equality rule. | G-002-01, G-002-02 |
| R-002-22 | MUST | WHEN `sessions.get` completes successfully, the shared SDK contract layer SHALL require HTTP 200 with one Section 6.2 session object whose `id` equals the exact requested lower-case UUID string. | G-002-01, G-002-02 |
| R-002-23 | MUST | WHEN an SDK-profile request is prepared or a response is consumed, the binding SHALL apply Section 6.1.1 JSON, UTF-8, `Accept`, conditional `Content-Type`, 8-MiB response-cap, no-redirect, exact-status, and exact-path rules without an inferred alternative. | G-002-01, G-002-04 |
| R-002-24 | MUST | WHEN `sessions.create` is invoked through an SDK, it SHALL be synchronous, SHALL send only the six documented create members, SHALL NOT send any console-only create member, and SHALL perform no readiness polling. | G-002-01, G-002-04 |
| R-002-25 | MUST | WHEN a documented request or response is encoded or decoded, the contract layer SHALL enforce the source-backed scalar, array, boolean, UUID, timestamp, JSON-value, and `timeout_secs` types and bounds in Sections 6.1.1 and 6.2 through 6.6. | G-002-01, G-002-02 |

## 7. Non-functional and verification requirements

| ID | Force | EARS requirement | Trace |
| --- | --- | --- | --- |
| R-002-17 | MUST | WHEN shared contract fixtures are executed for either SDK, the conformance suite SHALL assert the exact method, normalized path, Section 6.2 path-parameter substitution, documented request field set, successful response body shape, and exact documented success status for every Section 6.1 operation. | G-002-01, G-002-02 |
| R-002-18 | MUST | WHEN a conformance fixture represents a 60-second single-use open URL or a `runa_sk_` bearer credential, the fixture suite SHALL use synthetic values and SHALL not retain a usable credential or open-URL token. | G-002-03 |
| R-002-19 | MUST | WHEN TypeScript and Python contract results are compared, the comparison SHALL fail on any difference in documented wire name, optionality, enum value, object variant, fixed success body, or estimate designation. | G-002-02 |

## 8. Scope and out-of-scope boundary

| In scope | Out of scope |
| --- | --- |
| Exact allowed `/v1` method/path and path-parameter baseline | New remote operations or a direct session-get route |
| Documented request and successful-response shapes | Language-facing public API and domain mapping |
| Session, `me`, record, execution, checkpoint, deletion, and open wire objects | Error classes, taxonomy, failure mapping, retries, or transport behavior |
| `runa_sk_` bearer header assumption | Key discovery, validation, storage, revocation, or auth precedence |
| Documented status facts and service error envelope | Undocumented success status defaults or error-code catalog |
| External open-URL, estimate, and trial-limit semantics | SDK-side URL-use controls, local limit enforcement, or billing calculations |
| Explicit source-silent questions | Schema-generation/provenance process, owned by PRD-003 |

## 9. Assumptions, constraints, and dependencies

### 9.1 Assumptions

- `prds/_CONTEXT.md` accurately describes the deployed Runa REST contract at acceptance time.
- PRD-001 Section 6.1 remains the complete capability allowlist for this baseline.
- A programmatic Runa API key has the documented `runa_sk_` prefix and is accepted in the Bearer form on `/v1/*` by the service.
- The service, not the SDK, issues and consumes session-open URLs and applies trial limits.

### 9.2 Constraints

- The only origin represented by this external baseline is `https://api.runacode.io`.
- The contract is buffered REST as inherited from PRD-001; this PRD introduces no streaming behavior.
- The Runa-only and English-only laws from PRD-001 apply to all downstream work using this baseline.
- Source silence is not authority to use a conventional HTTP or JSON default.

### 9.3 Dependencies

| Dependency | Type | Needed for | Owner/status |
| --- | --- | --- | --- |
| PRD-001, especially Section 6.1 | Accepted product boundary | Exact operation allowlist | Accepted dependency |
| `prds/_CONTEXT.md`, `infra/edge/src/api.ts`, and the session-ID storage schema | Ground-truth sources | Wire shapes, success statuses, and session-ID semantics | Available |
| Deployed `https://api.runacode.io` service | External contract | Conformance verification | Existing service |
| PRD-003 | Downstream refinement | Schema provenance, canonical snapshot, and drift process | Not owned here |
| PRD-005, PRD-006 through PRD-013 | Downstream refinement | Domain mapping, configuration, errors, transport, resilience, lifecycle, collections, security | Not owned here |

## 10. Risks, mitigations, and pre-mortem

| Risk ID | Failure mode | Probability | Impact | Mitigation / test | Owner |
| --- | --- | --- | --- | --- | --- |
| RK-002-01 | A binding accepts an incorrect successful status or rejects the source-backed status for an operation. | Medium | High | Assert 201 for create and 200 for every other operation in TC-002-17. | Contract owners |
| RK-002-02 | One language turns a missing `agent` into a required value or changes a wire name. | Medium | High | Golden fixtures and cross-language literal comparison under TC-002-04 and TC-002-17. | Language maintainers |
| RK-002-03 | An SDK blocks a valid request based on stale local quota knowledge. | Medium | High | Assert no client-side cap rejection in TC-002-15. | Session owners |
| RK-002-04 | An open URL is mistaken for reusable or long-lived access. | Medium | Critical | Assert the one-use, 60-second contract in TC-002-12; downstream security work owns operational handling. | Open-operation owners |
| RK-002-05 | Estimated usage is displayed or modeled as a settled account balance. | Medium | High | Require estimate designation in TC-002-13. | Account-resource owners |
| RK-002-06 | Source-silent protocol details become divergent language defaults. | High | High | Maintain the Section 11 question register and fail invented-detail mutation tests. | Shared contract owners |

**Pre-mortem:** The likely failure is not a malformed route; it is a source-backed rule omitted by one binding or a plausible convention silently added by one binding—an incorrect successful status, altered session ID, timestamp type, pagination rule, or quota check. That convention then leaks into public behavior and becomes expensive to reverse. The defense is literal fixtures for what is known and an explicit stop sign for everything else.

## 11. Decision register and remaining open questions

This register retains resolved IDs for traceability and lists the questions that remain source-silent. A resolved entry is governed by the accepted projection and must be implemented exactly. An unresolved entry is not permission to infer behavior; an accepted Runa source-contract update must answer it before this baseline changes.

| ID | Open question | Current required treatment | Downstream owner when resolved |
| --- | --- | --- | --- |
| OQ-002-01 | **Resolved:** the accepted projection fixes scalar JSON types, requiredness, non-nullability, formats, patterns, collection limits, and numeric/string bounds for every projected field. | Validate every Section 6.1.1 fact exactly; reject wrong types, explicit `null`, invalid formats/patterns, and invalid bounds before exposure or dispatch. Only `Record.detail` is opaque. | Closed by PRD-INFRA-004/OpenAPI/PRD-003/PRD-005 |
| OQ-002-02 | **Resolved:** assigned workspaces require literal `assigned:true` plus required typed `usage`; unassigned workspaces require literal `assigned:false` plus non-negative integer `waitlist_position`. Outer containers are closed and nested `usage` alone is open. | Enforce the two exact variants, validate known usage members, ignore and do not expose safe unmodeled nested-usage siblings, and reject every other workspace shape. | Closed by PRD-INFRA-004/OpenAPI/PRD-003/PRD-005 |
| OQ-002-06 | Are session and record lists paginated, ordered, filtered, bounded, or eventually consistent? | Represent only the documented arrays; do not imply collection semantics. | PRD-003, PRD-011 |
| OQ-002-07 | Which session status transitions are valid, what counts as an active session, and what does each action do in an invalid state? | Preserve only the seven values and backend ownership; do not infer a state machine. | PRD-003, PRD-010 |
| OQ-002-08 | What are execution semantics for command parsing, output truncation thresholds, and non-zero exits beyond the source-backed field types and `timeout_secs` bound? | Preserve the typed request and success fields; do not infer shell parsing, truncation thresholds, or failure meaning. | PRD-003, PRD-007, operation PRDs |
| OQ-002-09 | What precisely happens after the open URL is consumed or expires, and what response represents either condition? | Preserve one use and 60 seconds only; do not define reuse, refresh, or expiry behavior. | PRD-003, PRD-013, open-operation PRDs |
| OQ-002-10 | What exact message requirements, additional failure statuses, and error-field validation apply beyond `{error: message}` and the documented 409/422 limit outcome? | Do not create an error taxonomy or retry policy. | PRD-007, PRD-009 |
| OQ-002-11 | What key-character grammar and maximum length apply beyond the documented `runa_sk_` prefix and Bearer form? | Defer grammar and lifecycle to `prds/infra/PRD-001-programmatic-api-authentication.md`; block live SDK auth until that prerequisite is implemented while allowing console JWT auth to coexist. | Programmatic-authentication owner, PRD-006, PRD-013 |

## 12. Milestones and acceptance criteria

### 12.1 Milestones

| Milestone | Exit condition |
| --- | --- |
| M-002-01 Baseline accepted | The 13-operation SDK-profile table, complete HTTP/JSON binding, typed schema shapes, exact status facts, semantics, and remaining open-question register are approved. |
| M-002-02 Shared fixtures accepted | Synthetic conformance fixtures cover every normative requirement and both language adapters consume the same literals. |
| M-002-03 Downstream handoff | PRD-003 and PRD-004 can consume the accepted baseline without redefining routes or wire shapes. |

### 12.2 Given-When-Then acceptance criteria

| Test ID | Given | When | Then | Requirements |
| --- | --- | --- | --- | --- |
| TC-002-01 | A capture transport for each SDK and a synthetic lower-case UUID session ID | Each of the 13 operation keys is invoked once with synthetic inputs | The captured method, normalized path, and path parameter placement exactly match one corresponding Section 6.1 row, with no SDK call to a console-only route; every `:id` path contains the unchanged UUID as one segment | R-002-01, R-002-17, R-002-21 |
| TC-002-15 | Binding-complete fixtures for all 13 operations, exact 200/201 responses, malformed media/UTF-8/JSON/schema inputs, a redirect, and an 8-MiB boundary pair | Each request and response traverses the shared binding | Exact statuses decode; required `Accept` and conditional `Content-Type` are present; body bytes are UTF-8 JSON; redirect, oversized, malformed, and wrong-status responses normalize as malformed/non-success without being followed | R-002-20, R-002-23, R-002-25 |
| TC-002-16 | A synchronous SDK create fixture and mutations adding each console-only create member or an automatic poll | `sessions.create` completes | Only the six SDK fields are sent, HTTP 201 returns once, and every console-only field or poll mutation fails | R-002-24 |
| TC-002-02 | A programmatic key fixture with a synthetic `runa_sk_` value | An allowed `/v1` operation is prepared | The contract binding supplies the exact documented Bearer-header form without exposing a usable fixture secret | R-002-02, R-002-18 |
| TC-002-03 | Create, exec, and checkpoint request captures | Their contract serializers receive all documented fields, then each optional field is omitted in turn | The captures use exactly the field spellings and optionality in Section 6.1 and do not add undocumented defaults | R-002-03, R-002-17 |
| TC-002-04 | A session fixture with each documented status and each permitted-or-omitted `agent` value | Both language bindings decode the fixture | Each preserves all documented session field names, accepts the documented enum values and omitted `agent`, and exposes no backend runtime identifier | R-002-04, R-002-19 |
| TC-002-05 | A 201 response containing a session object for `sessions.create` | Both bindings process the response | Each recognizes the documented creation status and session shape | R-002-05, R-002-17, R-002-19 |
| TC-002-06 | An array containing two documented session objects | `sessions.list` is processed | Each binding represents an array of session objects and asserts neither pagination nor ordering | R-002-06, R-002-19 |
| TC-002-07 | One session fixture returned from each lifecycle action | Pause, resume, stop, and start responses are processed | Each action is bound to its exact route and yields the documented session shape | R-002-07, R-002-17, R-002-19 |
| TC-002-08 | A successful exec fixture with all six documented fields | `sessions.exec` is processed | Each binding represents exactly `exit_code`, `stdout`, `stderr`, `duration_ms`, `stdout_truncated`, and `stderr_truncated` | R-002-08, R-002-19 |
| TC-002-09 | Successful checkpoint and delete fixtures containing `{ok:true}` | Each operation is processed | Each binding preserves the literal success object | R-002-09, R-002-19 |
| TC-002-10 | A records fixture with one object containing all six documented fields | `records.list` is processed | Each binding represents an array of exactly the documented record fields without a fabricated `kind` enum or collection rule | R-002-11, R-002-19 |
| TC-002-11 | One assigned-workspace fixture and one `{assigned:false, waitlist_position}` fixture | `me.get` is processed in both bindings | Each binding preserves the documented variant and marks `est_spend_usd` and `est_remaining_usd` as estimates, not an exact balance | R-002-12, R-002-19 |
| TC-002-12 | A synthetic open response whose URL has the documented Runa shape | `sessions.open` is processed and service semantics are inspected through a fake clock/service fixture | The contract exposes `{url}` as single-use and valid for 60 seconds, without defining any reuse, refresh, or expiry status behavior | R-002-10, R-002-18 |
| TC-002-13 | A create fixture returns 409 and another returns 422, each with `{error: message}`, after an over-limit request | Both bindings pass the fixture through their contract layer | The documented error body and service-owned limit outcome are available to downstream error handling; no local cap decision is made | R-002-13, R-002-14 |
| TC-002-14 | A mutation asserts an undocumented scalar type, pagination rule, or lifecycle transition | The baseline/fixture review runs | The mutation fails because the assertion is absent from the documented baseline and present in the Section 11 question register | R-002-15 |
| TC-002-19 | Requests for a second active session, more than 2 vCPU, or more than 4096 MiB are constructed against a capture transport | The SDK contract layer prepares the requests | It makes no local limit rejection, reservation, calculation, or prediction; any rejection is represented as a backend response | R-002-14 |
| TC-002-20 | A proposed change adds a route, changes a wire literal, or redefines the one-time URL or limit semantics | Contract review runs without an accepted PRD-002 revision | The change is rejected before either language adopts it | R-002-16 |
| TC-002-17 | Thirteen successful response fixtures, one for each Section 6.1 operation | Both bindings process each fixture | `sessions.create` is successful only with 201; each other operation is successful only with 200; a different status is not represented as a documented success | R-002-17, R-002-20 |
| TC-002-18 | A listed session whose `id` is `123e4567-e89b-12d3-a456-426614174000`, plus case-, whitespace-, and Unicode-normalization-different candidate strings | The contract substitutes the ID into every `:id` route and performs a local session lookup or refresh comparison | Every captured path contains that unchanged UUID as one unescaped segment, and only the byte-identical string matches; no candidate is coerced, trimmed, case-folded, or normalized | R-002-17, R-002-21 |

## 13. Instrumentation and analytics plan

This PRD introduces no end-user telemetry. Build and test evidence records the fixture identifier, SDK language, operation key, captured method/path, observed success status, ID-comparison assertion result, and baseline revision. It records neither actual bearer credentials nor usable open-URL tokens. Error message content is not aggregated by this PRD; downstream error and observability PRDs own any such design.

## 14. Rollout, release, and rollback plan

### 14.1 Rollout

1. Accept this baseline after PRD-001.
2. Use it as the fixed input to the canonical contract/provenance work in PRD-003 and the public API blueprint in PRD-004.
3. Add synthetic shared fixtures before language-specific operation work begins.
4. Require both language contract suites to pass the Section 12 cases before dependent PRDs are accepted.

### 14.2 Rollback

This PRD does not deploy or alter the service. If a downstream binding contradicts this baseline, revert or correct that binding and rerun shared conformance. If the deployed Runa contract changes, do not silently adapt either SDK: record the new source evidence, revise this PRD, and then update downstream contract artifacts through their owned change processes.

## 15. Definition of Ready

Implementation planning may begin only when every item is true:

- [ ] The problem statement cites `prds/_CONTEXT.md` and inherits, rather than re-derives, PRD-001's boundary and allowlist.
- [ ] Goals are measurable and non-goals exclude downstream error, auth, transport, retry, domain-mapping, and security design.
- [ ] Every normative requirement has a unique ID, EARS sentence, RFC 2119/8174 force, goal trace, and acceptance test.
- [ ] All 13 SDK-profile operations have one method, path, path-parameter, request shape, success shape, complete binding, and exact-status entry.
- [ ] Session states, `agent` values, session-ID type/equality/encoding, `me` variants, estimates, one-time open semantics, error envelope, and service limits are captured literally.
- [ ] Every source-silent protocol detail is an explicit Section 11 question rather than an invented default.
- [ ] Dependencies introduce no cycle; PRD-001 is the sole accepted predecessor.
- [ ] The riskiest assumption—plausible but undocumented conventions becoming SDK behavior—has a test plan.
- [ ] The quality rubric has no zero and totals at least 14/18.

### 15.1 Quality rubric self-check

| Dimension | Score (0-2) | Evidence |
| --- | ---: | --- |
| Unambiguous | 2 | Exact route table, field spellings, enums, literals, and documented-status boundary |
| Complete | 2 | Template A sections, all operations, risks, open questions, tests, DoR, DoD, and traceability |
| Consistent | 2 | Inherits PRD-001 Section 6.1 and records only available source-contract facts |
| Verifiable | 2 | Synthetic request/response fixtures and route captures for every operation |
| Feasible | 2 | Requires only shared fixtures and language adapters; no backend change |
| Traceable | 2 | Every requirement links to goals, tests, design elements, and tasks in Section 17 |
| Problem-first | 2 | Section 1 defines the cross-language contract failure before requirements |
| Non-goals present | 2 | Sections 2.2 and 8 constrain adjacent PRD scope |
| Metrics | 2 | Section 3 includes north-star, leading, guardrail, and lagging metrics |
| **Total** | **18/18** | Ready threshold is 14/18 with no zero |

## 16. Definition of Done

- [ ] Every MUST requirement has a passing conformance test in both SDK language suites.
- [ ] All 13 operation fixtures assert the exact allowed method/path, documented request fields/types, complete HTTP/JSON binding, documented successful response shape, and exact success status.
- [ ] `sessions.create` verifies HTTP 201; every other operation verifies HTTP 200.
- [ ] Session-ID fixtures verify the lower-case UUID type, unchanged single-segment path substitution, and exact equality with no coercion or normalization.
- [ ] Session fixtures cover all seven status values, all three `agent` values, and omitted `agent`, without a backend runtime identifier.
- [ ] `me` fixtures cover both workspace variants and prove estimated values are not an exact balance.
- [ ] Open fixtures verify only the documented Runa URL shape, one use, and 60-second validity using synthetic tokens.
- [ ] Limit fixtures prove the service owns the one-session, 2-vCPU, and 4096-MiB caps and that the contract layer does not pre-enforce them.
- [ ] Error-envelope fixtures cover `{error: message}` and 409/422 as the documented limit statuses without creating an error taxonomy.
- [ ] The Section 11 open-question register has been reviewed; no undocumented default appears in a contract fixture, language binding, or downstream handoff.
- [ ] Forward and backward traceability is complete from goal through requirement, design, task, and test.
- [ ] No scope from PRD-003 or later PRDs has been absorbed into this baseline.

## 17. Appendix: traceability matrix and decision record

### 17.1 Traceability matrix

| Goal ID | Requirement ID | Force | Design element | Implementation task | Test | Status/Fit |
| --- | --- | --- | --- | --- | --- | --- |
| G-002-01, G-002-04 | R-002-01 | MUST | D-002-01 Operation manifest | T-002-01 Encode exact route set | TC-002-01 | Planned / 1.0 |
| G-002-01 | R-002-02 | MUST | D-002-02 Bearer assumption | T-002-02 Bind synthetic authorization fixture | TC-002-02 | Planned / 1.0 |
| G-002-01, G-002-04 | R-002-03 | MUST | D-002-03 Request-shape manifest | T-002-03 Encode create/exec/checkpoint bodies | TC-002-03 | Planned / 1.0 |
| G-002-02, G-002-04 | R-002-04 | MUST | D-002-04 Session schema | T-002-04 Bind session fields, enum values, and optionality | TC-002-04 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-05 | MUST | D-002-05 Creation response contract | T-002-05 Assert 201 plus session | TC-002-05 | Planned / 1.0 |
| G-002-01, G-002-04 | R-002-06 | MUST | D-002-06 Session collection contract | T-002-06 Bind raw array only | TC-002-06 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-07 | MUST | D-002-07 Lifecycle action contract | T-002-07 Bind four action/session pairs | TC-002-07 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-08 | MUST | D-002-08 Exec result schema | T-002-08 Bind six-field result | TC-002-08 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-09 | MUST | D-002-09 Literal-ok contract | T-002-09 Bind checkpoint/delete successes | TC-002-09 | Planned / 1.0 |
| G-002-03 | R-002-10 | MUST | D-002-10 Open response semantics | T-002-10 Bind synthetic single-use URL fixture | TC-002-12 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-11 | MUST | D-002-11 Record collection schema | T-002-11 Bind record array | TC-002-10 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-12 | MUST | D-002-12 Me variant schema | T-002-12 Bind workspace variants and estimates | TC-002-11 | Planned / 1.0 |
| G-002-01, G-002-04 | R-002-13 | MUST | D-002-13 Documented error envelope | T-002-13 Preserve wire facts for downstream handling | TC-002-13 | Planned / 1.0 |
| G-002-03 | R-002-14 | MUST | D-002-14 External-limit boundary | T-002-14 Exclude local limit enforcement | TC-002-13, TC-002-19 | Planned / 1.0 |
| G-002-04 | R-002-15 | MUST | D-002-15 Open-question register | T-002-15 Audit no invented defaults | TC-002-14 | Planned / 1.0 |
| G-002-02, G-002-04 | R-002-16 | MUST | D-002-16 Contract change gate | T-002-16 Require baseline revision | TC-002-20 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-17 | MUST | D-002-17 Shared conformance harness | T-002-17 Capture every operation, status, and ID substitution | TC-002-01 through TC-002-11, TC-002-17, TC-002-18 | Planned / 1.0 |
| G-002-03 | R-002-18 | MUST | D-002-18 Synthetic-secret fixture policy | T-002-18 Redact fixture values | TC-002-02, TC-002-12 | Planned / 1.0 |
| G-002-02 | R-002-19 | MUST | D-002-19 Cross-language literal comparator | T-002-19 Compare adapter observations | TC-002-04 through TC-002-11 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-20 | MUST | D-002-20 Success-status manifest | T-002-20 Assert the 200/201 matrix | TC-002-17 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-21 | MUST | D-002-21 Session-ID contract | T-002-21 Preserve UUID substitution and exact equality | TC-002-01, TC-002-18 | Planned / 1.0 |
| G-002-01, G-002-02 | R-002-22 | MUST | D-002-22 Direct-session binding | T-002-22 Bind exact-ID GET and equality check | TC-002-01, TC-002-18 | Planned / 1.0 |
| G-002-01, G-002-04 | R-002-23, R-002-25 | MUST | D-002-23 Complete HTTP/type binding | T-002-23 Enforce media, UTF-8, headers, cap, redirects, statuses, paths, and types | TC-002-15 | Planned / 1.0 |
| G-002-01, G-002-04 | R-002-24 | MUST | D-002-24 Synchronous SDK create | T-002-24 Restrict fields and prohibit polling | TC-002-16 | Planned / 1.0 |

### 17.2 ADR-002: Literal external-contract baseline

| Field | Decision |
| --- | --- |
| Context | The two SDKs require a shared contract before either can map it into idiomatic domain APIs, transports, errors, or security behavior. The available source is intentionally concise and does not define every conventional protocol detail. |
| Decision | Treat the documented Runa REST facts as a literal external baseline and an explicit 13-operation SDK profile of the larger control plane. Model its typed fields, JSON/UTF-8 binding, conditional headers, 8-MiB response cap, no-redirect rule, exact 200/201 matrix, session-ID substitution/equality, synchronous create boundary, error envelope, `runacode.cloud` open semantics, estimates, and backend-owned limits; record only genuinely unresolved details as open questions. |
| Status | Proposed with this PRD |
| Driver | Runa SDK maintainers |
| Approver | Runa SDK technical owner |
| Contributors | TypeScript, Python, API, quality, and security owners |
| Consequences | Downstream PRDs inherit one stable wire baseline but must not convert source silence into behavior. A future service-contract change requires an accepted update here before either SDK adopts it. |
