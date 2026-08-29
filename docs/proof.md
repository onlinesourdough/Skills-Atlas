# Pre-Ship proof

- Lifecycle: `skills-atlas-remy-github-r3`, contract revision r4.
- Baseline: `main` at `5efd6ff1f43108030e541411a84ddd6c68451fcd`
  plus the accepted r3.4 work.
- Lead Review: **PASS**, independently verified on 2026-08-28.
- Pre-Ship evidence captured on 2026-08-28 used no workflow dispatch, Pages/DNS
  change, deployment, credential operation, authenticated adjacent read,
  provider branch, or pull request.

## Project skill boundary evidence

The 2026-08-29 unstaged Build keeps the application and Ship boundaries
unchanged while making the Project-owned skill shelf explicit:

- `.agents/skills` contains `README.md` plus exactly the six direct
  Project-local lifecycle and technology skill folders: `spec-project`,
  `choose-technology`, `build-project`, `review-project`, `ship-project`, and
  `audit-project`.
- Every direct folder matches its lowercase kebab-case frontmatter `name`; no
  nested `SKILL.md` or copied Project-local generic manager remains.
- Tracked stale-route scans find no retired routing slug or removed
  local-manager path. The only remaining `manage-skills` mentions identify the
  canonical Global Skill in the source inventory and deterministic fixture.
- `npm run check`, `npm run docs:check`, `npm run security:check`, and
  `git diff --check` pass. Deterministic browser proof also passes with four
  canonical fixture skills and an empty `failures` array.

No staging, Git history mutation, provider action, publication, deployment, or
other repository was used.

## Publication boundary

An authenticated checkout of `onlinesourdough/Skills` was anonymously denied
with HTTP 404 before r4. The repository is still treated as private or otherwise
unavailable before Ship. Atlas contains the canonical identifier and the
reviewed four-slug canonical Global Skill inventory (`clarify`, `manage-skills`,
`orchestrate-workers`, `shape-offer`) needed to prove startup behavior, but no
private skill body or observed private revision.

The successful default-load path uses deterministic GitHub fixtures only. A
real anonymous current read is a Ship gate after source history is remediated
and the Skills repository is safely public.

## r4 result

- Initial static and Node boot attempt `onlinesourdough/Skills` through the
  existing bounded anonymous adapter. Valid provider identity, repository URL,
  observed revision, four loaded skills, and `Read only` access become active.
- Provider failure retains the fictional `Offline example` with one calm status
  and Retry. Retry plus a later manual import upserts the canonical plugin
  without duplication.
- `.codex-plugin/plugin.json` accepts safe declared `skills`, `apps`, and
  `mcpServers` paths, including the reviewed `./skills/` trailing-slash form.
  Missing declarations are not invented.
- The topbar GitHub icon links safely and accessibly to
  `https://github.com/onlinesourdough/Skills-Atlas` without changing the proven
  176px header/rail grid or mobile fit.
- The accepted centered onboarding, topology-preserving Graph, calm Library,
  honest Usage/health, Plugins, safe full-Markdown reader, admin/session
  boundary, and branch-plus-pull-request proposal policy remain intact.
- README, contribution/security policy, package metadata, architecture,
  operation, recovery, and Pages/DNS ownership now describe the public release
  target and the pending Ship boundary.

## Automated evidence

```text
npm run check
  PASS format, lint, strict client/server types
  PASS 6 test files / 38 tests
  PASS Node client/server and static production builds

npm run docs:check
  PASS documentation local links

npm run security:check
  PASS source/static secret, owner-path, failed-fetch, and withheld-revision scan
  PASS immutable workflow action refs

npm audit --audit-level=high
  PASS 0 vulnerabilities

npm audit --omit=dev --audit-level=high
  PASS 0 vulnerabilities

npm run browser:proof
  PASS canonical anonymous fixtures, Offline example fallback/retry,
       source/revision/access truth, GitHub navigation, desktop/mobile journeys,
       mock-only proposal UI, safe Markdown, and dual-root static assets

git diff --check
  PASS
```

The 38 deterministic tests cover source parsing, safe manifest declarations,
canonical startup success/failure/rate-limit/deduplication, direction-independent
graph relations, category emphasis, anonymous and authenticated provider reads,
existence-safe 404, permissions, bounds, timeout/retry, session denial/expiry,
stale SHA, duplicate branch, and exact branch/file/pull-request orchestration.
Provider writes are mocks only.

## Browser evidence

`proof/runtime/browser-proof.json` has an empty `failures` array. It records
1440×900 and 390×844 viewports, four canonical fixture skills, header alignment,
centered onboarding, Graph/Library/Usage/Plugins journeys, fallback then retry,
one canonical plugin after re-import, safe source navigation, intercepted edit
permission/proposal state, clean page/console/network diagnostics, and static
root plus `/Skills-Atlas/` assets. Static pages make no local API calls; their
only external requests are intercepted anonymous GitHub API reads.

Fresh ignored screenshots under `proof/screenshots/`:

- Onboarding: `r4-desktop-onboarding-start.png`,
  `r4-desktop-onboarding-finish.png`, `r4-mobile-onboarding.png`.
- Graph: `r4-desktop-graph-loaded-default.png`,
  `r4-desktop-graph-category-emphasis.png`,
  `r4-desktop-graph-selection.png`, `r4-mobile-graph-loaded-default.png`.
- Library: `r4-desktop-library-rendered.png`,
  `r4-desktop-library-source.png`, `r4-desktop-library-empty.png`,
  `r4-mobile-library-read.png`.
- Usage: `r4-desktop-usage-health.png`, `r4-mobile-usage-health.png`.
- Plugins/fallback: `r4-desktop-plugins-loaded-and-error.png`,
  `r4-desktop-offline-fallback.png`, `r4-desktop-fallback-recovered.png`,
  `r4-mobile-plugins-error.png`, `r4-desktop-plugins-can-edit.png`.
- Permission/proposal: `r4-desktop-edit-permission.png`,
  `r4-mobile-edit-permission.png`, `r4-desktop-proposal-success.png`.
- Static: `r4-static-root.png`, `r4-static-prefixed.png`.

## Runtime and unresolved Ship evidence

The exact production Node build boots at `http://127.0.0.1:4173`; `/` returns
HTTP 200 and `/api/health` reports self-hosted mode, memory sessions, and no
optional admin/GitHub configuration when run without environment values.

Still pending and unverified: safe public history for the Skills repository, a
real anonymous live default read, successful pinned Pages run and deployment,
live `skills.onlinesourdough.com`, Simply DNS CNAME verification to
`onlinesourdough.github.io`, and HTTP/TLS proof. These remain checks for their
later Ship steps.
