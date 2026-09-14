# Architecture

One TypeScript codebase serves a personal edition and a separate public demo.
React/Vite and the domain parser/graph/reader remain shared. The personal
hosted/self-host package is one Worker with static assets, D1 and OAuth KV; deployments
have independent origins, credentials, policy and databases.

```text
personal browser ── same-origin Worker routes
                       ├─ OAuth client ── GitHub App user authorization
                       ├─ policy/service ── GitHub user + membership + repository checks
                       ├─ D1 ── numeric profile, preferences, opaque session hash,
                       │         encrypted upstream token, expiring OAuth attempts
                       └─ bounded read adapter ── GitHub branch/tree/blob snapshot

explicit public demo ── tokenless GitHub reads
                       └─ fictional Offline example when unavailable
```

The old Node admin runtime is retired. Node now offers only a tokenless public
preview and denial responses for former login/proposal routes. It shares no
credentials or sessions with the personal package.

## Personal service boundary

`worker/index.ts` validates deployment origin, routes requests and applies
private/no-store security headers. `worker/security.ts` owns configuration,
cookie/CSRF validation, lease limits and credential encryption.
`worker/github.ts` adapts the maintained OAuth client and GitHub identity,
membership and repository API. It uses only a user App token and bounded GETs;
the production endpoint has no fixture/provider-selection environment option.

`worker/service.ts` applies one policy for browser and read-only MCP
caller. Numeric user ID scopes `worker/store.ts` prepared D1 operations.

`worker/agents.ts` composes the maintained OAuth provider and MCP Web Standard
transport at `/mcp`. D1 owns encrypted upstream credential records, browser
session references, consent and active agent references. KV contains provider
grants/tokens and encrypted connection-ID properties, never GitHub tokens or
skill bodies. Browser logout and agent disconnect have separate lifetimes.
No upstream refresh token is retained or rotated. Atlas refresh is bounded by
the shared credential expiry and rechecks upstream policy. Mutation-free
`readAuthorizedSource` is common to both principals; only the browser wrapper
updates canonical source metadata. A final D1/lease check follows materialized
MCP results, denying in-flight revoked content before it leaves the Worker.

Login uses state, PKCE, browser binding, one-use expiry and opaque session
rotation. Server checks run on every authorized request. Final SQL predicates
prevent a revoked session or consumed/cancelled login flow from completing a
delayed mutation. Default D1 calls use primary reads; no replica/KV auth cache
is introduced.

Routes:

- `POST /auth/github/login`; `GET /auth/github/callback`
- `GET /api/health`; anonymous `GET /api/session` for login configuration
- Authorized `GET /api/profile` or `/api/session`
- `POST /api/sources/preview` reads without saving; `POST /api/sources`
  confirms with an optional expected repository/revision for existing API clients
- Scoped `GET/PATCH/DELETE /api/sources/:id`
- `DELETE /api/session` for same-origin/CSRF logout
- `GET /api/usage` with explicit disconnected truth
- `/api/proposals` denies; legacy `/api/session/login` returns 410

D1 stores no skill master copy. Source choices persist by numeric user/repository
identity. Removing a source affects only a preference. The default is seeded
once per profile and is not re-added after removal. Duplicate import preserves
visibility. Upstream refresh tokens are discarded; re-login renews authorization.

## Browser and domain contracts

`PersonalAtlas` owns profile/source requests and validation, CSRF memory,
authorization leases, logout and late-response invalidation. The shared
`App` consumes a small personal workspace interface while preserving the A/B
graph, reader and navigation behavior. A public/static App instead owns its
browser-session source set and never calls personal APIs.

The personal UI refreshes access every minute while visible and locks at the
five-minute lease or earlier session expiry. Hidden-page/history restoration
requires a fresh check. All private child views unmount on logout/access loss;
sibling tabs receive logout and delayed requests cannot repopulate cleared state.
`src/domain/personal.ts` validates wire profiles/sources and reconciles only
authorized cached snapshots. No skill content is written to browser storage.

`src/types.ts` defines the shared skill/pack shapes.
`src/domain/contracts.ts` validates unknown JSON, stable repository/path identity
and duplicates; relation evidence is recomputed from complete Markdown.
`skill-parser.ts` validates bounded YAML, safe slugs, required fields and
nonempty Markdown while preserving source bytes.

The shell owns Graph, Library, Usage, Plugins, search and onboarding. Hash-backed
navigation honors initial routes and Back/Forward without resetting source
filters or graph camera. Below 820px the taxonomy rail becomes an inert drawer.
Native dialogs support Escape, focus trapping and restoration.

`GraphView` owns measured canvas/camera, transient hover and the right inspector.
`src/domain/graph.ts` owns deterministic positions, collision spacing and fit
bounds without React or a new graph dependency. The graph remains mounted while
reading so its camera survives tab navigation. At 820px and below, the source
drawer and sequential list/reader/inspector replace squeezed columns.
Preview state is temporary and expires with its authorization lease; personal
confirmation rechecks the previewed revision before saving preferences.

Library uses `react-markdown` and `remark-gfm`: raw HTML is skipped, remote
images are inert, URLs are sanitized and external links use noreferrer/noopener.
Full source retains every byte. No dangerouslySetInnerHTML path exists.

Graph nodes use stable numeric repository ID plus exact case-sensitive path.
Directed edges derive from Markdown AST links and existing relation metadata,
with source file/line and resolved/unresolved/ambiguous status. Names, code and
negative prose do not imply calls. No external target is auto-fetched.
Category selection changes emphasis and fits category bounds; source visibility changes the visible
topology. Layout uses loaded identities to preserve positions; camera survives
Library navigation. Usage remains unconnected and health is source-derived.

## Bounded repository reads

The shared adapter validates a repository, reads identity/default branch,
observes its commit/tree SHA, accepts only root `skills/<slug>/SKILL.md` and
`.agents/skills/<slug>/SKILL.md`, and reads bounded blobs with limited concurrency.
It optionally inspects bounded root `.codex-plugin/plugin.json` declarations
for skills/apps/MCP, without executing or connecting anything.

Public reads are tokenless. Personal reads require freshly verified user/App
repository access and always return read-only packs. Limits cover tree entries,
skill count, file/aggregate/response bytes, timeouts and retries.
Worker credential-bearing requests refuse redirects. Failure is existence-safe.

## Artifacts, testing and exclusions

`vite build --mode worker` emits `dist/worker-client`; Wrangler dry-run emits
`dist/worker`. The same package serves hosted/self-host configurations.
Static mode emits relative-base `dist/static`, compatible with root and
`/Skills-Atlas/`. Default Vite/TypeScript builds retain `dist/client` and
`dist/server` for the deprecated public Node preview.

Domain code has no React dependency; Worker and Node edges import domain logic.
Only Worker modules import OAuth and D1 boundaries. Client artifacts contain no
credentials or synthetic private fixtures. Local tests use real Worker/D1 with
an injected synthetic provider; a separate loopback fixture entrypoint powers
HTTP restart/restore and browser proofs. It is not reachable in production.

No MCP implementation, installed skill deployment, user write grant, queue,
vector search, billing, telemetry pipeline or hosted rollout is part of C.
The historical proposal adapter remains fixture-tested for later policy work.
See [technology](technology.md), [security](security.md) and [proof](proof.md).
