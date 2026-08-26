# Project-local Spec

Status: baseline contract fulfilled through the authorized initial Ship;
dual-root static correction awaiting lead Review, 2026-08-26.

## Canonical evidence

- Upstream intent, boundary, proof, and authority: the AIOS worker Build
  contract `project Build contract, r1` supplied for this repository.
- Superseding owner revision: `project-worker-parity-r2.md`, which reopens
  Build/Review for reference-structure parity and static Pages preparation
  while preserving the original IP, source, security, and Ship boundaries.
- Visual direction and interaction proof: an approved portable
  reference-product handoff, especially its design record and proof run
  `online-sourdough-skills-atlas-r4`. The externally retained research input is
  evidence only and is not included in this repository.
- Source shape and distribution facts: the read-only canonical Online
  Sourdough Skills repository, whose payload is
  `skills/<slug>/SKILL.md`.
- Repository ownership at creation: this checkout began as a fresh independent
  Project on `main`, with an unborn HEAD and no remote. The authorized initial
  Ship later established the canonical public remote recorded in
  [proof.md](proof.md); this repository still owns implementation, operation,
  proof, and recovery.

## Resolved contract

The Atlas serves founder-led companies and small teams that need to discover,
inspect, govern, and distribute the repeatable skills used by their agents.
The public demo must work without an account, secret, provider grant, or live
telemetry. A bundled safe snapshot is the default source; a local mounted Git
checkout may be selected by the operator as a read-only server-side source.
The Git repository remains canonical and the Atlas is its readable map,
governance, discovery, and optional activity layer.

The smallest complete result is one responsive browser application with:

- a graph-dominant light product shell with slim Graph/Library/Usage tabs and a
  narrow department/read-only source taxonomy;
- a five-page first-visit public walkthrough with deterministic replay,
  keyboard focus, Back/Next/Skip/Escape, restrained progress, and a public
  completion action;
- softly clustered relation graph, three-region searchable/filterable library
  with persistent detail/editor shape, safe excerpt and read-only edit denial,
  global search, ranked/quiet demo usage, subordinate demo activity, and a
  floating deterministic bundled Ask panel;
- Sync / setup that explains least privilege and only simulates a local safe
  preview connection;
- explicit loading, empty, error, permission, success, offline, hover, active,
  focus, reduced-motion, and mobile states;
- a bounded parser and local source adapter for valid `skills/<slug>/SKILL.md`
  files, with safe fallback when the configured source is absent or invalid;
- reproducible local boot/build, health reporting, no-secret logs, docs,
  recovery, tests, and reviewable browser/runtime evidence.
- during the original Build, a static public build and manual GitHub Pages
  workflow prepared for `skills.onlinesourdough.com`; that boundary stopped
  before remote creation, publication, or DNS changes. The later authorized
  initial Ship established the canonical public remote and Pages deployment;
  DNS remains unchanged, and the Node self-host path remains complete.

## Boundaries and non-goals

The repository owns the UI, bundled demo data, parser, local filesystem
adapter, HTTP health/data surface, operation docs, and proof. It consumes the
approved design tokens/fonts and the documented canonical Skills file shape.

The browser and Node application do not implement or attempt OAuth, private
repository access, writes, provider integration, publication control,
telemetry ingestion, authentication, a database, a queue, runtime AI/model
calls, a cloud backend, or canonical-remote management. External repository,
release, Pages, custom-domain, and DNS actions remain lifecycle/Ship-owned
operations, not runtime responsibilities. Manual token and GitHub App are
described as future operator choices only; no credential path is implemented.

## Interfaces and trust boundaries

- Browser to server: `GET /api/health` and `GET /api/skills`; JSON is
  validated at the client boundary and failures fall back to bundled data.
- Server to local checkout: an optional `SKILLS_REPO_PATH` root, constrained to
  `skills/<safe-slug>/SKILL.md`; symlinks, path escape, invalid frontmatter,
  oversized files, excessive entries, and read failures are denied or safely
  reduced to fallback.
- Browser trust: all rendered source content is text; React escaping and an
  excerpt limit prevent markup execution. No secret is sent to the browser or
  written to logs.
- Deployment unit: one Node process serving the built browser assets and API;
  bundled data keeps the public route useful when the adapter is unavailable.

## Ordered results and proof points

1. Project records and design-token-based browser shell — verified by local
   links, type/build checks, and desktop/mobile browser review.
2. Deterministic atlas behavior and access states — verified by unit/contract
   tests and real interaction journeys.
3. Parser/source boundary and fallback — verified by valid, invalid,
   oversized, empty, path-escape, symlink, and fallback tests.
4. Self-host operation and recovery — verified by production start, health,
   critical journey, disposable source rebuild, and fallback rehearsal.

## Evidence state and residual risk

- RESOLVED: intended change, served party, result boundary, canonical source,
  repository ownership, security posture, and Build/Review-only authority.
- INFERRED: Node 20+ is the supported runtime, local filesystem mounting is
  the least-privilege adapter, and the public bundled snapshot is safe to
  distribute. These are reversible technical choices within Build authority.
- MISSING but non-blocking: no owner or elapsed measurement window is supplied
  for long-term adoption. Acceptance is therefore runtime/proof based and the
  outcome signal remains pending owner assignment.
- Residual risk: a local checkout can change between reads; each request reads
  a bounded snapshot and reports a safe source status, but no persistence or
  locking is claimed. Provider integrations remain intentionally future work.
