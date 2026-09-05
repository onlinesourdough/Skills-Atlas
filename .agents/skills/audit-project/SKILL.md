---
name: audit-project
description: >-
  Audit accumulated drift across this Project's documentation, behavior,
  ownership, security, operation, and recovery. Use for an explicit holistic
  health check or evidence of cross-cutting drift, not routine fixes, focused
  checks, or per-change review.
---

# Project Audit

Use this periodic holistic backstop after many iterations, at a milestone or
handoff, or when drift is suspected. It is not a fifth lifecycle phase and is
not mandatory after every trivial change. Audit the evolved project's current
outcome and canonical truth, never parity with the original seed.

## Audit

Start with README, project instructions, and the requested audit boundary.
Inspect the code, skills, interfaces, configuration, workflows, tests, and
runbooks needed to compare claims with evidence. A whole-project audit covers
each dimension below; a scoped audit names its coverage and remaining gaps.
Establish the current outcome, owner, boundaries, and canonical sources before
judging any document.

Check, as relevant to the solution:

- README and runbook truth: flag stale or missing outcome, status, ownership,
  commands, configuration, interfaces, operation, recovery, or canonical links.
- Documentation routes: find broken local links; instructions and skill routes
  must point to existing, applicable files with valid frontmatter and metadata.
- Actual behavior: documented commands, configuration, interfaces, workflows,
  and checks match the current repository and runtime evidence.
- Execution state and proof: temporary task notes or generated state are not
  stale; documented proof reflects checks actually run and their results.
- Boundaries and risk: ownership, data authority, trust boundaries, secrets,
  authorization, private data, and external effects remain explicit and safe.
- Operations and recovery: health, failure visibility, disable, rollback,
  replay, restore, rebuild, or reconciliation are proportional and owned.

Start read-only. Compare documents with the current Project, not with a
seed snapshot or expected file list. If a discrepancy is safe, reversible,
local, and unambiguous, repair only the documentation or routing. Examples are
fixing a broken relative link, adding an omitted route to an existing skill, or
correcting an obvious command path. Re-read repaired routes and verify them.

When available, run the repository's relevant documented safe, non-mutating
validation commands. Record each exact command and its exact result. If a
relevant check is unavailable or unsafe to run, disclose it as an evidence gap.
Do not infer authority for consequential operations from an audit request.

An audit alone does not authorize deletion or changes to runtime code,
configuration, contracts, security meaning, ownership, or operational behavior.
When the request also authorizes bounded fixes, continue those through Build
and Review in the same lifecycle; do not ask again for already-authorized work.
Ask for one owner decision only when an unresolved semantic conflict, authority
gap, or unclear canonical truth materially changes the result. Record its
location and evidence; do not guess.

## Return

Return exactly one status: **Healthy**, **Repaired**, or **Needs decision**.
Include concise evidence with paths, the checks or read-only observations, any
repair made, and any unavailable evidence. Use **Healthy** when current truth
is coherent, **Repaired** only for safe local documentation or routing repairs,
and **Needs decision** when an owner decision is required.
