---
name: build-project
description: Build and test complete results for a specified technical solution. Use when implementing or changing Application, Service, Automation, Integration, Library, or System behavior after outcome, ownership, boundaries, and acceptance are sufficiently clear.
---

# Project Build

Build the smallest complete artifact or behavior that can be verified through
its real interface, validator, plan, health check, or rehearsal.

If the intended behavior, boundary, or independent lifecycle is still
consequentially unclear, use `spec-project` first.

Work inside the existing lifecycle goal. Use the harness's matching persistent
goal/task state or explicit outcome contract. For an AIOS-originated worker,
keep its one bounded goal active across Build, Review feedback, permitted
revisions, and requested authorized Ship. Never open or complete a goal merely
because the lifecycle phase changed.

## Initialize without inventing a stack

Consume the Spec's resolved technology decision. A working stack goes directly
to Build when the change does not materially alter it. For a new or materially
changed decision, use the result from
[choose-technology](../choose-technology/SKILL.md); do not reopen selection or
preload optional references unless the decision cites one.

For a fresh repository:

1. Make README project-specific before implementation.
2. Create an official framework scaffold in the repository root only when the
   selected shape and stack require one.
3. Preserve repository instructions and use one package manager and lockfile
   per ecosystem.
4. Do not create fake runtime code when an Automation, Integration, or System
   only needs a workflow export, configuration, contract, infrastructure,
   architecture decision, or runbook.

Adopt existing repositories in place without overwriting working structure or
technical truth.

## Keep documentation current

Documentation is part of every implementation result. Identify the README,
runbooks, instructions, skills, contracts, commands, configuration, operation,
recovery, and proof affected by the change. Update the canonical local source
in the same result when its truth changes; do not defer it to `audit-project`.
Verify local links and skill routes, and verify documented commands,
configuration, and interfaces against the repository and the checks that prove
them. If no documentation is affected, state why and confirm the current
documentation remains true.

## Work through complete results

For each result:

1. Name the behavior and the evidence that will prove it.
2. Write one focused failing test for deterministic behavior when practical.
3. Read the expected failure.
4. Implement only enough to pass.
5. Refactor while the test remains green.
6. Run the narrow check, then the repository's full relevant checks.
7. Exercise the real interface when mocks cannot prove the result.

For a bug, reproduce it first and keep the reproduction as a regression test.
Use a validator, build, browser, workflow run, or runtime check when a unit test
would be artificial.

Treat Red-Green-Refactor as a feedback loop, not ceremony. Keep many fast tests
for deterministic rules, fewer dependency tests, and only the end-to-end tests
needed to protect critical journeys. Change that balance when risk or the
solution shape demands different evidence.

Valid complete results include:

- an Application journey or Service contract and domain behavior
- a versioned Automation workflow or Integration delivery path
- a Library interface, consumer example, and compatibility check
- infrastructure-as-code, VPS configuration, or desired-state validation
- architecture, topology, a decision record, or an executable runbook
- project-local agents and skills with observable acceptance evidence

Choose evidence by risk: unit tests for deterministic rules, contract tests for
boundaries, integration tests for dependencies, end-to-end tests for critical
journeys, validators and dry-runs for workflows or infrastructure, and health,
drift, replay, rebuild, or restore checks for operational solutions. Do not add
every test type to every result.

Continue through the required results until the whole requested outcome is
implemented and verified. Review each risky result at the useful checkpoint and
run the final repository-wide review. When an authorized implementation review
fails, fix the finding and repeat the affected checks instead of returning
routine repair work to the user.

## Create artifacts agents and humans can change

- Keep modules cohesive with small, stable interfaces and meaningful depth.
- Apply SOLID where it clarifies responsibilities and substitutable contracts.
  Do not create extension points, interfaces, or inheritance for hypothetical
  change.
- Remove duplicated knowledge, not merely similar-looking code. Prefer a small
  amount of local duplication over the wrong shared abstraction.
- Organize modules around domain or capability responsibilities rather than
  accidental framework layers.
- Keep dependency direction toward stable domain or capability logic. Put
  database, API, queue, filesystem, and vendor clients at the system edge.
- Introduce interfaces, repositories, adapters, and wrappers only for real
  contracts, trust boundaries, or substitutable dependencies. Do not create one
  for every class or call.
- Keep route, handler, component, trigger, and framework entrypoints thin.
- Keep domain rules and irreversible policy deterministic.
- Keep secrets, authorization, critical policy, and irreversible effects on a
  trusted server or worker boundary. Do not rely on client enforcement.
- Runtime-validate external input and return stable, safe errors.
- Make retried side effects idempotent and bound timeouts, retries, reads, and
  concurrency.
- Reuse existing owners and sources of truth.
- Prefer obvious local code over speculative layers and generic abstractions.
- Add no auth, database, queue, cache, container, dependency, or runtime AI
  without a responsibility that needs it.

For HTTP interfaces, use consistent resources, methods, status codes, error
shapes, pagination, authentication, authorization, and compatibility. For user
interfaces, handle loading, empty, error, keyboard, responsive, and public
metadata behavior when relevant.

Use a Repository Pattern only when persistence has behavior or variation that
forms a meaningful boundary. Prefer direct, well-contained access when an extra
repository would only pass calls through.

Prefer one cohesive deployable unit. Introduce a microservice only when it needs
independent ownership, deployment, scaling, isolation, or recovery and can own
its contract, data responsibility, observability, and failure behavior.

For infrastructure and VPS work, document desired state, access and secret
ownership, health, patching, drift, and a reproducible rebuild or tested restore
path. When a step cannot be automated safely, provide an exact, reviewable
runbook.

## Language baseline

- In TypeScript, keep strict types at boundaries, avoid silent casts, and share
  contracts without sharing framework types.
- In Python, use type hints and validated boundary models; keep framework code
  outside the calculation or domain core.
- Keep substantial Python computation behind a small Service interface instead
  of turning the frontend or workflow into a mixed-language codebase.

## Runtime baseline

Emit structured, redacted logs at meaningful boundaries. Include an execution
or request identifier, outcome, duration, and safe failure information when
useful. Never log secrets or unnecessary private payloads.

Finish Build with a working repository, updated local truth, and exact evidence
for both behavior and affected documentation. Do not stop because one result
passed if more work remains. Keep the lifecycle goal active or paused for
Review; complete it only after the full requested outcome, including
authorized Ship when requested, has passed.
