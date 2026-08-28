# Project-local Spec

Status: **REVIEW PASSED — Ship verification pending**, 2026-08-28. This is the
single delta contract for lifecycle `skills-atlas-remy-github-r3`; no duplicate
planning artifact is required.

## Canonical evidence

- Upstream outcome, acceptance, authority, and no-Ship boundary: AIOS lead r4
  contract linked to goal `01a03d16-9e41-7250-a6b8-f183d6ee439d`.
- Starting application truth: this repository on `main` at
  `5efd6ff1f43108030e541411a84ddd6c68451fcd` plus the r3.4 working-tree state
  accepted during Review.
- Canonical skill source when its public-history remediation is complete:
  `https://github.com/onlinesourdough/Skills`. The reviewed adjacent candidate
  declares a skills-only Codex plugin and five slugs: `clarify`,
  `manage-skills`, `orchestrate-workers`, `route-models`, and `shape-offer`.
  Its full private skill bodies and current revision are not Atlas Build inputs.
- Public application/source targets:
  `https://skills.onlinesourdough.com` and
  `https://github.com/onlinesourdough/Skills-Atlas`.
- Deployment owner: the existing pinned, manual GitHub Pages workflow and
  checked-in `public/CNAME`. The receiving DNS owner points the custom hostname
  at `onlinesourdough.github.io` during its later Ship step.
- Product/design truth: accepted r3.4 warm, calm, Remy-near/Notion-like shell
  and responsive evidence. r4 adds source state and one GitHub navigation
  affordance without reopening that composition.

This repository remains the independent owner of one static public application
and one optional self-hosted Node mode. GitHub owns repository content and
history; Atlas is a read-oriented human interface and permission-aware proposal
surface, never a competing content store.

## Evidence-state audit

- **RESOLVED:** initial boot should attempt an anonymous bounded read of
  `onlinesourdough/Skills`; a successful result becomes active and displays its
  provider identity, observed revision, five loaded skills, and `Read only`.
- **RESOLVED:** the source is still private or anonymously unavailable before
  Ship. Pre-Ship work must not make an authenticated adjacent read, embed its
  source/revision, or claim live success. Startup success is
  fixture/interception proven.
- **RESOLVED:** unavailable, private, rate-limited, timeout, and provider-error
  startup all fail to the same public-safe fictional content, visibly named
  `Offline example`, with one calm status and Retry action.
- **RESOLVED:** the existing React/Vite/TypeScript + Node stack, bounded GitHub
  adapter, browser-memory plugin state, and manual Pages workflow own all new
  responsibilities. No technology or dependency addition is justified.
- **RESOLVED:** public release needs concise contribution/security policy and
  README links to the site, source, Skills repository, issues, and MIT license.
  `package.json` remains `private: true` solely to prevent npm publication.
- **MISSING but non-blocking before Ship:** anonymous live-source success, exact
  release commit, Pages run, custom-domain response, DNS target, and TLS are
  Ship evidence. Pre-Ship records them as gates and does not infer them.

## Intended result

On initial product boot, Atlas automatically attempts the canonical Skills
repository through the same bounded tokenless adapter used for manual public
imports. Success replaces the fallback as the active plugin without creating a
duplicate, keeps GitHub canonical, and exposes only provider-returned source,
revision, inventory, relations, components, and read permission.

If the attempt cannot succeed, Atlas stays fully useful with the checked-in
fictional `Offline example`. One subdued, actionable status explains that live
skills are unavailable and offers Retry. The example never receives a GitHub
URL, canonical repository attribution, observed revision, or live claim.

The existing topbar gains one inline-SVG GitHub link immediately before the
honest account control. It targets the Atlas source repository, opens safely,
has an accessible name/title/focus state, and preserves the 176px desktop
rail/tab grid and mobile fit.

## Boundaries and interfaces

- Static startup → GitHub: anonymous `GET` requests only, using the existing
  bounded REST transport. No credential input, storage, cookie, or write path.
- Node public startup → `GET /api/packs/import?repository=onlinesourdough/Skills`
  without an admin cookie; the server therefore omits its configured token.
- Manual imports retain current behavior. Private reads and every proposal
  write remain server-only behind independent admin session plus server token.
- Startup plugin state stays in browser memory. Retry upserts by normalized
  provider identity and never duplicates the canonical plugin. A manual user
  selection made during an in-flight startup read is not overwritten.
- Anonymous 404 remains existence-safe: `Repository unavailable or private`.
  Rate limit, timeout, malformed/oversized source, and provider failure remain
  bounded and do not replace the active plugin.
- Rendering, full-source preservation, manifest declarations, graph topology,
  usage truth, permission labels, and branch-plus-PR policy retain r3.4 security
  contracts.
- `dist/static` contains the fictional fallback and canonical repository name
  needed to initiate the anonymous read, but no private source bodies, private
  revision, credential, failed-fetch output, or owner-local path.

## Ordered complete results and proof

1. **Startup contract:** deterministic tests prove canonical success, read-only
   normalization, failure/rate-limit fallback, retry, identity truth, and
   duplicate-free upsert.
2. **Product:** initial boot uses that contract; `Offline example` plus one calm
   Retry status handles failure; GitHub source navigation is accessible and
   responsive without changing accepted shell alignment.
3. **Release surface:** README, `CONTRIBUTING.md`, `SECURITY.md`, package metadata
   explanation, and all lifecycle records describe public source, install,
   self-hosting, security, Pages ownership, recovery, and unresolved Ship gates.
4. **Browser proof:** deterministic Node/static interception covers centered
   onboarding, five-skill default Graph/Library source/Usage/Plugins, GitHub
   navigation, fallback/error/retry, write-permission mocks, clean diagnostics,
   and exact `/` plus `/Skills-Atlas/` static assets.
5. **Repository proof:** format, lint, strict client/server types, all tests,
   both builds, docs/security checks, both audits, Node health, and
   `git diff --check` pass. No provider or Ship mutation occurs.

## Ship gates and residual risk

During Ship, the Skills repository must first be safely public with remediated
history. Ship must then prove an anonymous current read and exact five-skill
source, dispatch and verify the pinned Pages workflow, confirm
`skills.onlinesourdough.com` DNS points to `onlinesourdough.github.io`, and
verify domain HTTP/TLS plus the live default journey. None of those actions or
claims belongs to this pre-Ship finalization.

GitHub availability and anonymous rate limits remain external. Memory-only
state resets on reload. Operator token scope, single-process sessions, and
recoverable orphan proposal branches remain the documented self-hosted risks.
