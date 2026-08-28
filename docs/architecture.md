# Architecture

Skill Atlas is one TypeScript codebase with two artifacts. The static artifact
is a credential-free React/Vite application. The self-hosted artifact adds one
Node HTTP process that serves the same UI and owns admin sessions, private
provider reads, and pull-request proposals.

```text
credential-free browser
  ├─ startup tokenless GETs ───────── onlinesourdough/Skills
  ├─ manual tokenless GETs ────────── submitted public repository
  └─ checked-in fictional Offline example when GitHub is unavailable

self-hosted browser
  └─ same-origin Node API
       ├─ public import ─────────────── GitHub GETs without token
       ├─ admin session + private read ─ GitHub GETs with server token
       └─ admin session + proposal ───── permission/SHA recheck
                                            │
                                            ├─ create proposal branch
                                            ├─ update one SKILL.md on branch
                                            └─ open pull request
```

GitHub repository content is canonical. On startup, the normalized canonical
default is upserted and activated only after a successful anonymous read. A
manual user selection made while that read is in flight is not overwritten.
Unavailable, private, rate-limited, timeout, and provider failures retain the
unattributed `Offline example` plus one retry surface. Imported plugins are
browser-memory views over an observed repository revision; there is no
competing content database.

## Browser and domain contracts

`src/types.ts` defines skill, internal `AtlasPack`, plugin-component, session,
health, and proposal shapes.
`src/domain/contracts.ts` validates unknown server/provider-derived JSON before
React uses it. `src/domain/skill-parser.ts` validates safe slugs, bounded YAML
frontmatter, required fields, optional category/relations, source size, and a
non-empty Markdown body while preserving the complete source string.

The shell owns Graph, Library, Usage, Plugins, global search, account state, and
onboarding. Navigation is a hash-backed in-page state switch: valid hashes are
authoritative on initial load, same-document changes, and browser history;
invalid hashes normalize to the Graph fallback. The taxonomy rail becomes an
inert off-canvas drawer below 820px. Native dialogs use a bounded focus trap,
Escape close, and focus restoration.

Library rendering uses `react-markdown` and `remark-gfm`. Raw HTML is skipped,
remote images become inert text placeholders, normal URL sanitization remains
active, and external links open with `noreferrer noopener`. The separate Full
source tab retains every source byte; no `dangerouslySetInnerHTML` path exists.

Graph nodes are exactly the active plugin's skills. Every explicit source
reference to another loaded slug is normalized as an undirected slug pair, so
one-way and reciprocal declarations render once regardless of lexical order.
Desktop uses a real SVG with selection and pan/zoom; mobile replaces it with a
readable relationship list. Category selection computes emphasis only; it
never changes the loaded category, node, or normalized-edge sets. Usage is
deliberately unconnected and health is derived from accepted files, category
metadata, and relations only.

## GitHub read adapter

The provider edge uses official GitHub REST repository, branch, recursive tree,
and blob resources. A read:

1. validates `owner/repository`;
2. reads repository identity, default branch, and effective `push` permission;
3. observes the default-branch commit/tree SHA;
4. accepts only blob paths matching `skills/<safe-slug>/SKILL.md`;
5. reads and parses each bounded file with limited concurrency;
6. optionally reads bounded `.codex-plugin/plugin.json` declarations for safe
   `skills`, `apps`, and `mcpServers` paths, including normalized trailing
   slashes, while ignoring unsupported fields;
7. returns a sorted plugin with full Markdown, declared components, and
   `Read only` or `Can edit`.

Tree entries, skill count, per-file bytes, aggregate bytes, response bytes,
timeout, and GET retries are bounded. Writes are never automatically retried.
Provider 404 is collapsed to an existence-safe unavailable/private error.

The public static browser automatically uses the same domain adapter with
tokenless fetch for `onlinesourdough/Skills`. The Node startup request uses the
public import endpoint without an admin cookie, so the endpoint omits any
configured token. Authenticated manual imports may add the server token only
for a valid admin session.

## Admin and proposal boundary

`server/session.ts` stores only SHA-256 password comparison material and random
session tokens in process memory. The cookie is `HttpOnly`, `SameSite=Strict`,
bounded to eight hours, and optionally `Secure`. Restart revokes all sessions.

The Node server exposes:

- `GET /api/health`
- `GET /api/session`
- `POST /api/session/login`
- `DELETE /api/session`
- `GET /api/packs/import?repository=owner/repository`
- `POST /api/proposals`
- `GET /api/usage` with an explicit unconnected response

A proposal requires same origin, admin session, configured token, validated
request, freshly verified push permission, and unchanged default-branch SHA.
It then creates `refs/heads/atlas/<slug>-<proposal-id>` from that SHA, updates
exactly the selected skill on that branch using its observed blob SHA, and
opens a pull request to the default branch. The client cannot choose a direct
write branch.

## Artifact and dependency direction

`vite build` writes `dist/client`; TypeScript writes `dist/server`. The Node
process serves only regular files inside `dist/client` and rejects unsafe asset
paths. Static mode writes `dist/static`, makes no local API request, calls only
the anonymous GitHub API for startup/import, and uses relative asset URLs so
the exact files work at `/` and `/Skills-Atlas/`.

Domain code has no React or Node dependency. React consumes validated domain
objects. The Node edge imports domain/provider orchestration but no UI. The
static client contains no server environment value.

## Deliberate exclusions

There is no OAuth flow, multi-tenant identity/role system, database, queue,
runtime model, vector search, billing, background worker, automatic branch
cleanup, direct default-branch write, or hosted telemetry pipeline. Each would
require a new owner, operation, recovery, and proof decision.
