---
name: review-project
description: Review a concrete Project change or pull request against its accepted outcome, correctness, trust boundaries, operation, and evidence before merge or Ship. Report findings for review-only requests; repair in-scope findings when implementation is authorized.
---

# Project Review

Review the actual change against the intended behavior and repository
responsibility, not an imaginary ideal architecture.

Treat Review as a gate inside the active lifecycle goal, not a new goal. For an
AIOS-originated worker, pause its bounded goal while the AIOS lead reviews and
resume that same goal for any required revision or authorized Ship.

## Inspect

1. Establish the comparison point and intended outcome.
2. Read the diff and affected code, instructions, contracts, and tests; expand
   to configuration, architecture, runbooks, and runtime evidence where the
   change touches those responsibilities.
3. Run or inspect the checks that can actually prove the change.
4. Review correctness and failure paths before style.

Review these gates:

- **Intent:** the change implements the agreed outcome without scope creep.
- **Correctness:** success, denial, invalid input, partial failure, duplicates,
  concurrency, and recovery behave as relevant.
- **Evidence:** tests observe public behavior; mocked or static evidence is not
  claimed as runtime proof.
- **Documentation truth:** affected canonical documentation and proof match
  the change; links and documented checks agree with the repository. Do not
  require a no-change statement for each unrelated document.
- **Simplicity:** names are clear, modules are cohesive, interfaces are small,
  and abstractions earn their cost.
- **Architecture:** dependencies point toward stable domain or capability
  logic; framework and vendor clients stay at the edges; client code does not
  own server trust; repositories, adapters, and interfaces represent real
  boundaries instead of ceremony.
- **Ownership:** responsibilities, data authority, and framework boundaries are
  not duplicated or blurred; project truth has one canonical owner.
- **Lifecycle:** the repository still merits independent ownership, and it does
  not duplicate a smaller existing owner without justification.
- **Technology:** each added layer owns a required capability and follows the
  resolved decision from [choose-technology](../choose-technology/SKILL.md) or
  the existing working stack. Check fit evidence, operator burden,
  verification and proof, update path, and exit path. Load the conditional
  FastAPI reference only when the change actually selects it. Material bought
  or self-hosted capabilities were checked against current official plans,
  limits, license, operations, and exit options.
- **Security:** trust, authorization, secrets, private data, dependencies, and
  external side effects are handled proportionally.
- **Operation:** important failure is visible and rollback, replay, disable,
  restore, rebuild, or reconciliation is real and has been exercised when the
  risk requires it.

## Simplify the changed area

Preserve behavior while removing unnecessary indirection, speculative
generality, duplicate branches, pass-through wrappers, dead code, and comments
that restate the code. Prefer fewer concepts, not merely fewer lines.

Do not merge coincidentally similar code until it represents one stable concept
with one owner. Challenge microservices, containers, interfaces, repositories,
and generic extension points that have no current responsibility.

Stay inside the changed responsibility. Deleting public interfaces, data, or
compatibility behavior requires authority covering that removal; ask only if it
is missing or ownership is uncertain.

## Return

Lead with findings by severity and exact location:

- **Critical:** likely wrong, insecure, destructive, or unrecoverable.
- **Required:** material quality, boundary, test, or operational gap.
- **Improvement:** worthwhile simplification or maintainability improvement.

End with **PASS** or **FAIL**, checks performed, documentation evidence,
evidence that was unavailable, and the smallest next action. A Critical or
Required finding fails the gate. `audit-project` is a later holistic backstop
for accumulated drift; it does not replace this per-change documentation gate.
For a review-only request, report findings without changing the solution. When
Review is part of an authorized implementation, fix in-scope Critical and
Required findings through Build inside the same goal, rerun the affected
evidence, and repeat Review until it passes or a real stop condition in
`AGENTS.md` is reached. Review PASS does not complete a goal while requested
Ship or final evidence remains. For an AIOS-originated worker, return PASS to
that same worker so it can complete its bounded goal when no Ship remains or
resume it for authorized Ship.
