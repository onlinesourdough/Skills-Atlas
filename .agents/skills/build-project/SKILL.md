---
name: build-project
description: Implement and verify an accepted Project change in the existing repository. Use when behavior or artifact acceptance is clear; resolve material contract gaps through Spec and retain the same lifecycle through Review and authorized Ship.
---

# Project Build

Build the smallest complete artifact or behavior that can be verified through
its real interface or validator. If intended behavior, trust boundary, or
independent ownership is consequentially unclear, use `spec-project` first.

Work inside the existing lifecycle goal or explicit outcome contract. For an
AIOS-originated worker, keep its one bounded goal across Build, Review feedback,
permitted revisions, and requested authorized Ship. A phase change does not
create or complete a goal.

## Use the accepted repository and decision

Retain the working stack and structure. For a new or materially changed
technology decision, consume
[choose-technology](../choose-technology/SKILL.md); do not reopen resolved
selection or preload optional references.

This Project owns the Atlas application, not imported skill content or a
generic skill manager. Follow the boundary in the
[project-local skills index](../README.md). Configuration, contracts, runbooks,
and contributor instructions can be complete results without invented runtime
code.

## Implement and prove the delta

Choose evidence from the accepted contract and the affected surface. Reproduce
a bug before fixing it when possible, and keep a meaningful regression for
behavior that could recur. Use a validator or direct interface check when a
unit test would merely mirror wording or implementation. Small mechanical
changes do not require a test-first recipe or unrelated application journeys.

For substantive behavior changes, verify success and relevant denial, invalid
input, partial failure, duplicate, concurrency, and recovery paths. Use the
repository checks in [README](../../../README.md); exercise the real interface
where mocks cannot establish the claim. Provider-write proof uses deterministic
tests or interception, never a real branch or PR without separate authority.

Preserve the Atlas boundaries in [security](../../../docs/security.md):

- GitHub owns imported content; browser plugin state is not a competing store.
- Static and anonymous Node reads omit credentials. Private reads require an
  admin session and a server-only GitHub credential.
- Proposals require server-side origin/session/input checks, freshly verified
  provider permission and source SHA, then branch/file/pull-request writes.
  Never write the default branch or automatically retry writes.
- Keep bounded provider reads, safe Markdown rendering, existence-safe errors,
  redacted logs, and the public-safe fictional fallback.
- Keep the Skills privacy/public-history hold intact. No authenticated adjacent
  source, private bodies, or withheld revisions may enter source, proof, logs,
  or static artifacts.

When operation changes, preserve the responsible operator and verify the
affected disable, restart, rollback, or reconciliation path from
[recovery](../../../docs/recovery.md). Do not delete orphan provider branches
as an automatic repair.

## Update truth and continue through Review

Update affected canonical documentation in the same result; do not defer it to
a later holistic audit. Verify changed routes and documented commands. Record
actual checks and limits in [proof](../../../docs/proof.md), distinguishing
fixture evidence from live behavior. Unchanged documents need no repeated
no-change declarations.

Continue until the requested outcome is implemented and verified. Use
[review-project](../review-project/SKILL.md) at useful risk checkpoints and for
the final change. Fix in-scope Required and Critical findings and rerun affected
checks within the same goal. Return to the lead when its Review is required;
do not claim that self-review is independent approval. Complete the bounded
goal only when its full requested outcome and evidence are satisfied, including
authorized Ship when requested.
