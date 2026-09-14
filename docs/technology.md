# Technology decision

## E reproduction — existing stack retained

No new dependency or service is selected. Native Node filesystem/process tools
create a manifest-verified source snapshot; the locked npm/TypeScript/Wrangler
toolchain owns install, build and local emulation. The existing synthetic provider
is configured only through its separate test entrypoint. Independent D1/KV restore
uses ordinary Wrangler SQL commands. The operator guide remains the installation
authority; the verification script adds no AIOS, installer or product CLI layer.

## D protocol decision — local fit passed

Selected pinned dependencies: `@modelcontextprotocol/server` 2.0.0,
`@cloudflare/workers-oauth-provider` 0.10.3 and schema dependency `zod` 4.5.4;
standard MCP client 2.0.0 is test-only. Actual npm exports/types/source confirm
`createMcpHandler` per-request Web Standard serving, default stateless 2025
compatibility, and maintained OAuth helpers for PKCE, registration, discovery,
resource binding, authorization completion and token callbacks. Application
integration passes the real Worker/KV/D1 spike and standard-client HTTP proof.

The provider derives issuer discovery from the validated request and configured
token endpoint. Explicit HTTPS origin validation remains Atlas-owned; local
loopback HTTP uses the provider's normal derived issuer behavior. D1 bounds
consent/code claims and rejects repeated refresh-token hashes, including the
provider's previous-token grace window. A lost/failed refresh may require fresh
consent; availability never permits replay or stale access. Authorization-code
replay invokes the provider's grant revocation behavior.

Actual MCP server/core LICENSE files describe Apache-2.0 new contributions,
retained MIT contributions and CC-BY-4.0 documentation, despite npm's MIT
metadata. Exact upstream notices are retained in `public/third-party`, included
in client/static artifacts and copied into the Worker output. OAuth provider
and Zod retain their MIT notices. Atlas source remains MIT; no dependency source
is modified or relicensed. KV storage and request charges belong to the operator;
bounded registration (100/hour, one-day expiry), 20 connections/account and
expiring grants constrain accumulation. D1 remains required on every agent read.

Reuse one Worker/assets/D1 unit. KV is the provider's required `OAUTH_KV`
binding, not a second profile authority; D1 guards immediate revocation.
Disable client metadata URL fetching, external token resolution, implicit flow
and token-exchange extensions. Registration remains bounded public-client DCR
with exact validated redirect choices and explicit browser consent.

Sources: [provider](https://github.com/cloudflare/workers-oauth-provider),
[MCP transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/web-standard.html),
[legacy clients](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients.html),
[authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
SDK documentation retrieval was unavailable in the web tool; published package
exports/types/source provide the concrete API evidence.

The actual SDK LICENSE describes Apache-2.0 contributions, retained MIT code and
separate documentation terms despite npm's MIT label. Preserve packaged notices;
Atlas's own source stays MIT. OAuth provider is MIT (Cloudflare 2025).
Operators own updates, binding lifecycle and invalidation after restore. KV's
[eventual consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
cannot establish immediate revocation; its [usage pricing](https://developers.cloudflare.com/kv/platform/pricing/)
adds read/write/storage operations to the existing Worker deployment. No resource
is provisioned here. Exit: disable MCP, invalidate D1 connections and retire the
OAuth KV namespace while preserving browser source choices.

## Phase C decision — 2026-09-08

Retain React/Vite and the domain/provider adapter. Build the personal policy and
profile service in one Cloudflare Worker/static-assets/D1 package, configured
independently by each operator. Consume GitHub App user OAuth with `oauth4webapi`
(MIT, maintained v3, Web Crypto/Fetch and Workers support); do not implement an
OAuth protocol or use a shared operator credential. GitHub owns identity,
membership, effective repository access and content. Atlas owns its sessions and
source preferences. D1 holds no skill master copy. No bought auth service, ORM,
queue, model or vector store is needed.

Official fit evidence, checked 2026-09-08:

- [GitHub App user flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
  documents state, S256 PKCE, callback matching and user/app access intersection.
- [Authenticated-user membership](https://docs.github.com/en/rest/orgs/members#get-an-organization-membership-for-the-authenticated-user)
  supports GitHub App user tokens with Members read permission and distinguishes
  active/pending/absent membership. Actual private lookup remains lead-unproven.
- [oauth4webapi](https://github.com/panva/oauth4webapi) provides maintained OAuth
  client primitives under [MIT](https://github.com/panva/oauth4webapi/blob/main/LICENSE.md).
  Atlas still owns secure session storage, callback binding and policy checks.
- [Workers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
  and [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
  support static assets, local bindings and scoped SQL. Use primary-consistent
  authorization reads and atomic database operations, never eventual KV auth.
- [Workers/D1 pricing](https://developers.cloudflare.com/workers/platform/pricing/)
  includes free allowances and a paid subscription starting at USD 5/month plus
  usage. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) include
  50/1,000 queries per invocation (Free/Paid) and 500 MB/10 GB databases. Imports
  and profile size stay bounded; free operation at arbitrary scale is not promised.

Use pinned Wrangler 4 and current Workers test integration with its supported
Vitest 4.1 peer version; Node 22.21.1 (`>=22.21.1 <23`) is the supported toolchain. Generate binding
types from configuration and test real local D1/runtime interfaces. Operator
burden includes separate App credentials, callback/origin, deployment policy,
encryption key, migrations, backups, quotas and recovery. Replace the OAuth client
behind its small adapter; export SQL preferences, discard sessions and require
re-login when moving runtime/storage or keys. GitHub content needs no migration.

Node shared-admin login is deprecated/disabled in C; its public read-only server
is a migration/demo aid, not a competing personal auth product. Existing Pages
remains the public demo route until separately authorized cutover.

Later MCP fit: [Cloudflare's MIT OAuth provider](https://github.com/cloudflare/workers-oauth-provider)
supports Worker-hosted OAuth/MCP with separate grant storage. It can consume the
same Atlas principal/policy without passing through GitHub tokens. Its KV storage
and grant-revocation semantics need a D-phase review against
[MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
No provider package, MCP endpoint or grant is added in C. Live login/private
membership, deployment and final browser proof remain separate acceptance gates.

## Historical A/B and r4 decision

Decision: retain one TypeScript deployable using React 19, Vite 6, and Node's
built-in HTTP runtime. Add GitHub REST as the provider edge and focused safe
Markdown rendering dependencies; add no framework, database, OAuth service,
queue, container, or runtime AI. Recorded 2026-08-27 and confirmed for r4 on
2026-08-28.

Foundation confirmation, 2026-09-08: retain this stack and runtime. The already
locked MIT packages `unified` 11.0.5 and `remark-parse` 11.0.0 are now direct
dependencies for Markdown AST relation evidence, replacing name-match regexes.
No additional package versions, service, framework or deployment unit was added.
The current anonymous Global-Skills read is verified in [proof.md](proof.md);
the private-source observations below are historical, not current visibility.

## Responsibility choices

| Responsibility       | Choice                                                        | Owner / source of truth                             | Fit, burden, and exit                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser product      | Build: existing React + Vite                                  | This repository                                     | Existing component/build owner fits the dense responsive shell. It remains replaceable because contracts are plain JSON and GitHub stays canonical.                                                                                                         |
| Safe Markdown        | Buy: `react-markdown` + `remark-gfm`                          | Locked npm packages; source remains GitHub Markdown | Raw-HTML refusal, inert image rendering, safe URL handling, and maintained GFM parsing materially reduce renderer risk. Both are MIT licensed. Remove by replacing the bounded reader component and rerunning source-safety/browser proof.                  |
| YAML frontmatter     | Buy: `yaml`                                                   | Locked npm package; parser contract is local        | A maintained Core-schema parser with alias limits replaces ad hoc frontmatter parsing. Version 2.9.0 is ISC licensed and clears the known deep-nesting advisory. Remove by preserving the same parser failure contract and rerunning provider/source tests. |
| GitHub reads/writes  | Rent: official GitHub REST API                                | GitHub repository content and permissions           | Avoids a new content store. Public reads need no token; private/write calls use server configuration only. Failure is bounded and the Offline example preserves public use. Replace with another Git provider behind the same plugin/proposal contracts.    |
| Admin boundary       | Build: environment password + memory session cookie           | Self-host operator                                  | One local owner and no persistence justify a small fail-closed boundary. Restart revokes sessions. TLS/access proxy remains the operator's network responsibility.                                                                                          |
| Plugin state         | Build: browser memory                                         | Active browser session; GitHub remains canonical    | No database is needed for import/select. Reload retries the live default and retains an Offline example on failure. A persisted registry requires a separate owner decision.                                                                                |
| Usage & health       | Build: deterministic repository checks + empty usage contract | Loaded plugin                                       | No telemetry source is supplied, so the UI reports unconnected usage and computes only observable health. No event store is added.                                                                                                                          |
| Validation and proof | Reuse: TypeScript, Vitest, ESLint, Prettier, Playwright       | Repository scripts                                  | Existing checks own contracts and browser journeys. Deterministic transports prove writes without remote mutation.                                                                                                                                          |
| Delivery             | Reuse: Node process and relative-base static artifact         | Self-host operator / GitHub Pages                   | Node serves private capability. The public static release remains credential-free and dual-root; the pinned manual Pages workflow is the single public deployment owner.                                                                                    |

## Provider fit evidence

An authenticated checkout does not prove public visibility. On 2026-08-27,
anonymous raw requests for the authenticated `onlinesourdough/skills`
observation returned HTTP 404. At r4 Build the source is therefore still
private/unavailable: no source bytes or newly observed revision are compiled
into the browser, and unauthenticated 404 never discloses whether a repository
exists. The application now attempts the canonical repository automatically;
the success path is deterministic-fixture proven only. Failure uses the clearly
fictional, unattributed `Offline example`.

The adapter uses official GitHub repository, branches, Git trees/blobs,
contents, refs, and pull-request REST resources. GitHub's documented primary
rate limit is surfaced rather than retried indefinitely; GET retries are
bounded and writes are not automatically retried.

- [REST API for repositories](https://docs.github.com/en/rest/repos/repos)
- [REST API for branches](https://docs.github.com/en/rest/branches/branches)
- [REST API for Git trees and blobs](https://docs.github.com/en/rest/git)
- [REST API for repository contents](https://docs.github.com/en/rest/repos/contents)
- [REST API for Git refs](https://docs.github.com/en/rest/git/refs)
- [REST API for pull requests](https://docs.github.com/en/rest/pulls/pulls)
- [REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

The operator burden is one optional GitHub credential, one independent Atlas
admin password, TLS/access-proxy ownership when network-exposed, dependency
updates, and orphan proposal-branch recovery. No provider plan or paid feature
is required for public repositories. Private repository availability and token
permissions are operator/provider decisions.

## Contracts, failure, and verification

- Types/runtime validators own internal plugin payloads, manifest component
  declarations, sessions, health, provider errors, and proposals; vendor JSON
  never reaches React unchecked.
- Reads cap repository files, skill files, decoded file size, aggregate source,
  concurrency, timeout, retries, and safe error detail.
- Every private read and write requires both admin session and server token.
  Repository `push` permission is re-verified before edit is offered and before
  the first proposal mutation.
- Proposal flow observes default-branch SHA, rejects stale state, creates a
  named branch, updates one validated skill file on that branch, then opens a
  PR. Duplicate branch and partial provider failure remain visible.
- `npm run check`, docs/security checks, full and production audits, Node
  boot/health, static dual-root, deterministic provider tests, and real browser
  journeys prove build, operation, denial/failure, and recovery. Static artifact
  inspection rejects private source markers, the private observed revision,
  failed-fetch text, owner-home paths, withheld private revision, and
  credential-shaped values while allowing the canonical repository identifier
  required for anonymous startup.

## Update and exit

Dependency updates require license/changelog review, lockfile refresh, full
checks, security scan, audits, and browser proof. GitHub API version headers are
centralized at the provider edge. If GitHub is replaced, preserve the plugin and
proposal domain contracts and keep provider credentials server-side. If admin
sessions need shared or durable state, that is a material new ownership and
technology decision rather than an implicit extension of this file.

Residual risks are GitHub API/rate-limit availability, token scope chosen by
the operator, memory-session loss on restart, and orphan branches after partial
write failure. No specialist capability gap remains.
