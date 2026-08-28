# Project Review

Lead Review passed on 2026-08-28 for contract r4 after independent diff,
automated, browser, and visual verification. Remaining release verification is
tracked below.

## Review scope

Reviewed the full working-tree delta from
`5efd6ff1f43108030e541411a84ddd6c68451fcd`, preserving accepted r3.4 product
work and adding release-ready canonical startup, offline recovery, source
navigation, open-source files, deployment truth, deterministic proof, and
current lifecycle records.

During the 2026-08-28 Review, the pre-existing `.playwright-cli/` remained
untracked and unstaged, and no adjacent repository mutation, credential use,
authenticated adjacent read, real provider write, workflow dispatch, Pages
deployment, or domain/DNS action occurred.

## Findings

- Critical: none open.
- Required: none open in worker evidence.
- Improvement: the static client emits Vite’s approximately 500 kB chunk
  warning. Its gzip size remains about 155 kB; route splitting is a future
  measured-performance option, not a release correctness blocker.

Closed in r4:

1. Startup now attempts `onlinesourdough/Skills` through the anonymous adapter,
   validates canonical identity/URL, normalizes access to read-only, activates
   the five-skill result, and upserts without duplication.
2. Unavailable/private and rate-limit failures retain a clearly unattributed
   `Offline example`; one calm status offers Retry and never claims repository
   truth.
3. The canonical manifest form `skills: "./skills/"` is accepted without
   weakening safe relative-path validation.
4. The topbar has one accessible, safe-new-tab GitHub source link before the
   honest account control; desktop grid and mobile fit remain proven.
5. README, `CONTRIBUTING.md`, `SECURITY.md`, package metadata, lifecycle docs,
   and recovery now state source, issues, MIT license, self-hosting, GitHub
   Pages ownership, `public/CNAME`, Simply DNS target, and Build/Ship boundary.
6. Static publication scanning allows the canonical identifier required for
   startup while still rejecting credential shapes, owner paths, failed-fetch
   text, and the withheld observed revision.

Previously closed and preserved: safe full-Markdown rendering, existence-safe
anonymous 404, server-only credentials, admin/session boundaries, permission
and stale-SHA rechecks, branch-plus-pull-request-only writes,
direction-independent Graph edges, category emphasis without filtering,
hash/history synchronization, honest usage, source-declared components, and
the accepted responsive visual system.

## Worker evidence gates

- Correctness: 6 files / 38 tests plus real-browser journeys cover startup,
  fallback/retry/deduplication, provider bounds and failures, sessions,
  permissions, proposals, Graph, Library, Usage, Plugins, and static roots.
- Security/privacy: no private source body or observed private revision is
  bundled; anonymous Node startup omits the configured token; static mode has no
  local API/write path; provider writes are deterministic mocks only.
- Simplicity: the resolved React/Vite/TypeScript + Node stack, official GitHub
  REST API, browser-memory plugins, and memory sessions remain sufficient. No
  dependency, framework, database, OAuth service, queue, runtime model, or new
  hosting layer was added.
- Operation/recovery: GitHub Pages is the single public deployment owner;
  self-hosted Node, failed startup, restart/session loss, stale source, and
  orphan proposal branch recovery are documented and tested proportionately.

## Evidence and residual gates

The exact command results, browser observations, and screenshots are recorded
in [proof.md](proof.md). Pre-Ship evidence is green for
`npm run check`, docs/security checks, both audits, `npm run browser:proof`, and
`git diff --check`.

Still pending and unverified: safely public Skills history, real anonymous
current source proof, successful pinned Pages workflow and deployment,
domain/DNS target, and HTTP/TLS verification. GitHub availability and rate
limits, operator token scope, memory-session loss, and recoverable orphan
branches remain residual runtime risks.

**Lead Review r4: PASS. Remaining release checks are tracked above.**
