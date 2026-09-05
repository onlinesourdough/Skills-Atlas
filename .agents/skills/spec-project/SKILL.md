---
name: spec-project
description: Establish or audit this Project's build-ready technical contract when material scope, ownership, boundaries, acceptance, or implementation order is unresolved. Preserve accepted context; resolved mechanical edits do not need a new Spec.
---

# Project Spec

Audit the available truth for build readiness and, when no usable technical
specification exists, construct the smallest build-ready contract from the
available evidence. Preserve useful source material; do not turn every request
into a new Product Brief or rewrite facts that are already clear.

## Keep one lifecycle goal

For substantive implementation, reuse the current task's matching goal or
create one containing the outcome, constraints, verification, and requested
Ship scope. Use the harness's native persistent goal/task state or the same
contract in the current session. Spec, Build, Review, REVISE loops, and
authorized Ship are states in this goal, not separate goals. Do not complete
it at a phase boundary or narrow it to match partial progress.

## Set the audit depth from the starting mode

Accept source material at any maturity:

- **Rough idea:** establish the few decisions needed to define the first
  complete result; do not demand a polished brief. When authoritative context
  and repository evidence resolve the material dimensions, construct the
  missing compact Build contract and label any low-risk inferences.
- **Developed brief:** preserve its structure and resolved decisions, then
  identify only material gaps or conflicts.
- **Near-complete specification:** verify claims against canonical sources and
  return only corrections that affect readiness.
- **Existing-system change request:** treat the repository, current interfaces,
  operations, and recovery behavior as primary evidence; specify the delta,
  not the whole system again.

Maturity controls audit effort, not the readiness standard. Do not reward
document length or lower the bar for a concise source that resolves the needed
dimensions.

Standalone work audits both business and project-local technical readiness.
For AIOS-originated work, accept resolved AIOS intent, outcome, scope, proof,
and authority as upstream truth. Cite the upstream source, preserve those
decisions, and audit only project-local technical truth against this
repository's instructions, README, relevant project skills, current code,
interfaces, operations, and recovery. Do not duplicate discovery, reopen
resolved business decisions, or create another goal.

## Inspect before asking

Read the request, canonical source material, repository instructions, current
code and interfaces relevant to the delta. Inspect ownership, operating evidence,
and recovery paths when those dimensions are affected or unresolved.
Link to canonical sources instead of copying them. Resolve facts through
inspection; never ask an owner to restate discoverable repository or source
truth.

For every required dimension, record one evidence state:

- **RESOLVED:** stated by an authoritative source or verified in the
  repository; cite the source.
- **INFERRED:** the best interpretation supported by evidence but not an owner
  decision; state the inference and why it is safe or needs confirmation.
- **MISSING:** no adequate evidence exists; name what is absent and whether it
  materially changes the solution.
- **CONFLICTING:** authoritative sources disagree; cite both and identify who
  can resolve the conflict.

Reuse a cited contract for unchanged dimensions instead of restating its audit.

An inference may enter a READY Build contract only when it is reversible,
low-risk, and inside the implementer's ordinary technical authority. Never
infer product direction, external authority, trust policy, irreversible
effects, or an outcome measurement owner.

## Audit the required dimensions

| Dimension                       | Evidence needed                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Intended change and constraints | The observable delta, invariant, deadline, compatibility need, or other constraint that shapes it                       |
| Served party                    | The user, caller, or operator whose behavior or responsibility changes                                                  |
| Proof                           | Observable acceptance evidence, the outcome signal, and the person or system that owns measurement                      |
| Result boundary                 | The smallest complete result and explicit non-goals                                                                     |
| Canonical truth                 | Source links, existing systems, current repository behavior, and ownership of each material fact                        |
| Repository gate                 | The smallest valid owner and why independent context, development, operation, or handover is justified                  |
| Authority and risk              | Decision authority, Ship authority, consequential effects, security and trust boundaries, and private or regulated data |
| Contracts and data              | Dependencies, interfaces, compatibility, data authority, and failure behavior                                           |
| Lifecycle                       | Deployment unit, operational owner, failure visibility, recovery path, and requested Ship scope                         |

Choose solution shape and technology only after these dimensions expose the
responsibilities. One repository needs one clear primary responsibility;
prefer one cohesive deployable unit unless ownership, deployment, scaling,
isolation, or recovery must be independent.

## Ask only for owner decisions

When one unresolved owner decision materially changes the solution:

1. State the current best interpretation and evidence briefly.
2. Ask exactly one question, including the best guess and why the answer
   changes the result.
3. Wait before asking another question.

Do not send a questionnaire. Do not ask for facts that inspection can resolve.
If implementation can safely choose a reversible technical detail, classify it
as INFERRED and keep moving.

## Route technology decisions only when earned

Do not choose a new stack during this audit when a working stack already owns
the responsibilities and the change does not materially alter technology.
Record that existing stack as RESOLVED and continue directly to
`build-project`.

For a new or materially changed technology decision, use
[choose-technology](../choose-technology/SKILL.md) only after the required
dimensions are resolved. It is the only project technology-selection
procedure. Its Full Stack FastAPI reference is loaded only when every fit gate
might be independently satisfied. A concrete specialist implementation gap
follows the external capability boundary in the
[project-local skills index](../README.md): use an optional manager installed
by the calling environment or its current harness/plugin mechanism, outside
this Project payload. Do not preload or install stack-specific skills in this
Project.

## Return one readiness gate

Return exactly one gate. Include the evidence-state audit only to the detail
needed to support that gate.

### READY

Use READY when no material MISSING or CONFLICTING item prevents Build. Include
a compact technical Build contract:

- canonical sources and accepted starting mode
- intended delta, constraints, served user/caller/operator, and repository
  ownership justification
- acceptance evidence, outcome signal, and measurement owner
- smallest complete result and non-goals
- primary shape; existing technology decision or the new or materially changed
  decision that must route through `choose-technology`
- Build, Buy, Rent, and Self-host choices for material responsibilities; what
  the repository owns, consumes, and excludes
- interfaces, dependencies, data authority, trust boundaries, deployment unit,
  operation, recovery, and Ship scope
- ordered complete results with one verification point each
- labeled low-risk inferences and material residual risks

When the input is rough and no technical specification exists, this compact
Build contract is the constructed project-local specification. Cite the rough
input and canonical evidence, preserve resolved decisions, and do not ask for a
formal specification merely because the source is incomplete.

For an implementation request, continue into `build-project` inside the same
goal. Before Build in a fresh repository, replace seed guidance with a
project-specific README. Preserve a useful README in an adopted repository.

### REVISE

Use REVISE when the source is sound but needs a small, non-blocking addition or
correction before it can become the Build contract. Return only the minimal
text to add, remove, or replace, with its target location and evidence. Do not
return a rewritten brief or specification. When authorized and unambiguous,
apply the patch, re-audit, and continue instead of handing routine editing back
to the user.

### BLOCKED

Use BLOCKED when Build cannot proceed because of one material missing or
conflicting owner decision, authority, access dependency, or required proof.
Name the exact blocker, cite the evidence, identify the owner who can resolve
it, and ask at most the one decision question described above. Do not hide
several questions under one gate.

For a planning-only request, stop after the gate. When validating this skill or
resolving an ambiguous readiness case, use
[examples/acceptance-cases.md](examples/acceptance-cases.md), which covers input
maturity, AIOS preservation, and conditional technology selection.
