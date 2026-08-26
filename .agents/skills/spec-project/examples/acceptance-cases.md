# Project Spec acceptance cases

These cases exercise the public instruction contract. They are not boilerplate
for rewriting user source material; each expected response contains only the
evidence and readiness output needed for that input.

## Rough idea — BLOCKED

**Input:** “Make it easier for customers to understand their usage.” Existing
product sources show several customer roles but do not identify which role owns
the usage problem.

**Expected audit:**

- The rough idea is accepted without requesting a formal brief.
- The intended direction is RESOLVED from the request.
- The served user is MISSING and materially affects the shape of the result.
- The response asks one question only, with the best guess: “Which customer
  role should experience the first changed behavior? My best guess is existing
  account administrators because they already own usage review; the answer
  determines the relevant workflow and evidence.”
- The only gate is BLOCKED, naming the missing owner decision. It does not
  choose a stack or invent a repository.

## Rough idea — READY by construction

**Input:** “Give support agents a fast way to find and download a customer's
audit events.” The existing repository shows that the support console owns the
interface, the audit service owns event data and retention, the authenticated
API defines the access boundary, and the support operations runbook defines the
search-and-download acceptance journey, handling-time signal and measurement
owner, deployment, alerts, recovery, and local Ship scope.

**Expected audit:**

- The rough request is accepted without requesting a formal brief.
- The request and repository evidence resolve the intended delta, served party,
  acceptance evidence, outcome signal and measurement owner, repository
  boundary, data authority, trust boundary, non-goal of changing event
  retention, and local lifecycle; an internal module name is INFERRED as
  reversible technical discretion.
- The missing technical specification is constructed as a compact
  project-local Build contract that cites the request and repository sources,
  preserves those resolved decisions, and lists ordered results with a
  verification point for each.
- The only gate is READY. It does not invent a new data store, authentication
  system, or repository.

## Developed brief — REVISE

**Input:** A brief resolves every required dimension, including the measurement
and recovery owners, but links `runbooks/deploy.md`. Repository history and the
README show that `runbooks/delivery.md` is now the canonical deployment and
recovery source.

**Expected audit:**

- The developed brief remains canonical and is not rewritten.
- Its supplied dimensions are RESOLVED and cited; the stale link is
  CONFLICTING with current repository truth.
- The only gate is REVISE with the minimal target patch:
  `Replace runbooks/deploy.md with runbooks/delivery.md in Sources and
Recovery.`
- No unrelated architecture or product additions are returned.

## Near-complete specification — READY

**Input:** A specification resolves all required dimensions and links its
product source, API contract, data owner, deployment runbook, and recovery
rehearsal. One internal module name is absent but can be chosen reversibly by
the implementer.

**Expected audit:**

- Existing text is checked against the linked repository truth, not restated.
- The module name is INFERRED and labeled as low-risk technical discretion.
- The only gate is READY with a compact technical Build contract that cites the
  existing specification and lists ordered results with verification points.

## Existing-system change request — READY

**Input:** “Add idempotency to the existing payment webhook.” The repository
defines the caller contract, data authority, duplicate behavior, trust
boundary, deployment owner, alerts, rollback, and tests. The issue defines the
new replay-safe acceptance case and explicitly excludes provider migration.

**Expected audit:**

- The request is treated as a delta; the current system is not specified
  again.
- Repository facts are RESOLVED by inspecting the implementation, contract,
  tests, and runbook.
- The only gate is READY. The Build contract names the idempotency behavior,
  compatibility constraint, duplicate and recovery proof, non-goal, and
  unchanged Ship scope.

## AIOS-originated work — READY

**Input:** An AIOS lead links canonical decisions for intent, outcome, scope,
proof, measurement owner, and authority. The target repository resolves its
interfaces, data authority, trust boundary, operations, recovery, and local
Ship scope.

**Expected audit:**

- Upstream business decisions remain RESOLVED from the AIOS source and are not
  reopened or copied into a replacement brief.
- The worker audits only project-local technical truth and uses the existing
  bounded goal.
- The only gate is READY with a compact project-local Build contract. AIOS is
  not introduced as a runtime dependency.

## Conditional technology selection

**Existing working stack bypass**

**Input:** A change keeps an existing TypeScript system's responsibilities,
interfaces, owner, operation, recovery, and proof intact; the request does not
materially alter technology.

**Expected:** The project-local Spec records the existing stack as RESOLVED and
routes directly to `build-project`. `choose-technology` and its optional
references are not loaded, and no stack-specific skill is preinstalled.

**New or material technology decision**

**Input:** A new solution or change materially alters technology after its
responsibilities, ownership, boundaries, risks, operation, recovery, and proof
are resolved.

**Expected:** The workflow invokes `choose-technology` only after the contract
is ready. The decision records Build, Buy, Rent, or Self-host choices, fit
evidence, operator burden, verification and proof, update path, and exit path.
If a concrete specialist implementation gap is proven, it routes to
`manage-skills`; the Project does not preload or install React, FastAPI,
Supabase, or other stack-specific skills.

## Full Stack FastAPI reference is conditional

**Non-fit input:** A conventional browser CRUD change can remain in an existing
TypeScript system; it has no Python domain responsibility, new database
authority, or owned container operation.

**Expected:** `choose-technology` bypasses its Full Stack FastAPI reference.
Existing ownership outranks the reference, and no authentication, PostgreSQL,
Docker, or Python layer is added because a starter contains it.

**Fit input:** A new independently operated product has Python-owned specialist
domain logic, a justified React UI, PostgreSQL data authority, required
authentication and server authorization, a Docker delivery boundary, and a
named owner for deployment, secrets, monitoring, backup, restore, and updates.

**Expected:** The `choose-technology` skill may load its Full Stack FastAPI
reference after all fit conditions are RESOLVED. The Build contract still
names each added responsibility, operator burden, verification, update path,
and exit path; it does not copy upstream starter code into this repository.
