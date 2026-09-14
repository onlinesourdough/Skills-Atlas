# Security and permissions

The personal edition requires server-verified GitHub App user authorization.
Hosted policy requires active onlinesourdough membership; self-host policy
requires its configured organization or explicit numeric-user allowlist.
The separate public demo is credential-free and read-only. GitHub content
remains canonical; neither client state nor a shared operator token grants access.

## Identity and session boundary

- `oauth4webapi` handles GitHub App OAuth code exchange with S256 PKCE and
  state validation. Atlas additionally binds the flow to an opaque browser
  cookie, exact configured callback, ten-minute expiry and atomic one-use D1 row.
- Login invalidates the presented old session before redirect. Successful
  exchange creates a new random 256-bit Atlas session; only its SHA-256 hash
  is stored. User identity is the stable numeric GitHub ID, never a login name
  or an identity header supplied by the browser.
- Upstream user tokens and pending PKCE verifiers are AES-GCM encrypted with
  random IVs and deployment/credential/user or deployment/flow context. App credentials and encryption
  key remain Worker secrets. Neither tokens nor verifier values reach the UI,
  logs, exports of source content or client bundles. D1 backups remain sensitive.
- HTTPS cookies use `__Host-`, Secure, HttpOnly, SameSite=Lax and Path=/.
  Explicit self-host loopback HTTP development uses a distinct cookie name.
  Duplicate/invalid cookies fail closed. Origin is pinned to configuration;
  mutations require exact Origin, and authenticated mutations require CSRF.
- Session lifetime is the lesser of eight hours and upstream expiry. Refresh
  upstream GitHub refresh tokens are discarded. Re-login performs fresh identity and policy checks.
  Missing, malformed, pending, absent, expired, revoked or uncertain authorization
  fails closed. No frontend ACL substitutes for this boundary.

## Read-only agent boundary

Atlas OAuth issues separate resource-bound `atlas:read` access through the
maintained provider, with S256 PKCE, validated registered redirects, one-use
consent and explicit numeric-account disclosure. Same-origin CSRF-protected
approval is required every time. Only a validated consent document adds that
request's registered callback origin/path to CSP `form-action`; login and other
documents retain the base policy. CSP does not match query parameters, so OAuth
continues to enforce the full registered URI. No arbitrary global form destination
is added. Registration and consent both require a canonical literal host, rejecting
wildcards, delimiters and controls before CSP construction. Consent rechecks
previously stored client metadata; callback paths are encoded as source paths.
HTTPS and exact loopback HTTP hosts and ports remain supported. Public client metadata is text-only and bounded;
client metadata URLs/icons, external tokens and implicit grants are disabled.
GitHub tokens and cookies cannot authenticate MCP. Registered redirects are HTTPS
or loopback HTTP; resource and issuer identify this installation exactly.

Requests are capped at 16 KiB, source count at 20, search at one source/20 metadata
results per page, output at 256 KiB. Oversized explicit reads return an error,
not silent body truncation. Stateless JSON Streamable HTTP supports current and
2025-11-25 MCP clients; unsolicited streams/subscriptions are not exposed.
Tools never write source preferences, metadata or GitHub. Markdown and manifests
are untrusted data. Search does not return bodies or upload the whole library.

D1 is authoritative despite KV's eventual consistency. Every read/refresh checks
active connection, shared credential expiry, deployment policy and fresh GitHub
user/App access. Final response checks deny in-flight revocation or a lease over
five minutes. Disconnect deletes one D1 connection; sign out everywhere deletes
all sessions/connections/credentials/pending consent for that numeric account,
even when GitHub is unavailable. Browser logout alone preserves agents. Expired
and unreferenced credentials are pruned on login. New login never revives an old
connection. Atlas refresh is single-use via bounded hash claims; a failed or lost
refresh requires re-consent. No upstream token copies or concurrent refresh exist.

Deep links carry only installation origin, account/source/skill IDs. Login accepts
only validated internal reader or agent-consent destinations. Account mismatch
selects no fallback skill; hidden sources require explicit temporary opening and
do not update visibility. Browser logout still clears private views and history
restoration must reauthenticate. These IDs/paths are nonsecret but can be private
metadata, so URLs and imported content remain excluded from runtime logs.

## Provider access and freshness

All authenticated requests recheck GitHub identity and membership/allowlist.
Imports additionally resolve the repository with that user's GitHub App token:
effective access is the intersection of the user and App installation.
Source endpoints query by both user ID and opaque source ID before fetching
content. Cross-user requests return an unavailable result and cannot inspect
another user's source. Uninstalled and inaccessible repositories fail closed.

Source preview uses the same fresh authenticated read boundary and saves no
preferences. Confirmation rechecks access and the expected numeric repository
identity/revision before saving; a changed revision requires another preview.
Preview bodies remain only in authorized memory and expire with their read lease.
Cancellation and logout invalidate pending UI results. No provider write occurs.

Profile checks verify every saved repository. Read responses carry an
authorization lease of at most five minutes from the start of the policy check,
bounded by session expiry. The UI checks every minute while visible, drops
unavailable sources and locks all content when profile authorization is unknown.
Hidden-page and persisted-history restoration require a new check. Previously
authorized content can remain viewable until its lease expires; instant remote
revocation while offline is not claimed.

No skill body is stored in D1, localStorage, sessionStorage, a service worker
or a shared cache. D1 stores profiles, preferences, encrypted tokens, session
hashes and expiring flows. API responses are private/no-store. The browser keeps
only its own authorized snapshots in memory. Source visibility is a persistent
view preference, not authorization.

Logout clears the private UI immediately, invalidates pending client work and
broadcasts to sibling tabs. The server deletes the current session and pending
browser flows without requiring a working GitHub token. Final session/flow SQL
predicates reject delayed import or callback completion after logout. A failed
server sign-out is explicit and retryable. Restores must delete old sessions
and flows before exposure to avoid resurrecting revoked cookies.

## Bounded untrusted content

Repository names, paths, identities, payload schemas and source sizes are
runtime-validated. Reads accept only root `skills/<safe-slug>/SKILL.md` and
`.agents/skills/<safe-slug>/SKILL.md`; known symbolic links are excluded.
Numeric repository identity and exact path prevent slug/name collisions.
Manifests only describe supported components; they do not execute code,
expand shelves, connect MCP or authorize another source.

Tree entries, 100 accepted skills, 128 KiB per skill, 768 KiB aggregate source,
2 MiB provider responses, concurrency, timeout and GET retries are bounded.
The shared repository/tree/blob transport counts bytes while streaming, cancels
on overflow before retaining the excess chunk, and refuses credentialed redirects.
Server requests supply a User-Agent; anonymous browser reads retain redirect
support without credentials. Public and deprecated Node imports
are tokenless. Provider failures return safe codes without raw payloads.

Complete Markdown is rendered without raw HTML or executable source, remote
images are inert and external links use safe URL handling. Relation evidence
is capped at 512 records per skill. AST links and metadata carry source evidence;
names/code/negative prose never imply runtime calls. Unresolved targets do not
trigger provider reads.

## Writes and retired admin behavior

The Worker always returns read-only packs and denies proposal routes.
The Node preview ignores former admin/password/token configuration, returns
410 for legacy login and denies all proposals. It cannot establish a private
session. Historical proposal adapters and intercepted UI tests remain evidence
for a future explicitly accepted write policy, not a running second auth product.

Any later proposal capability must freshly verify user/provider write permission
and source SHA, then create a branch and pull request. It must never write the
default branch or automatically retry provider writes. C adds no provider grant,
MCP service or installation action.

## Privacy/public-history hold

An authenticated checkout of the former `onlinesourdough/Skills` was
anonymously denied on 2026-08-27. Those private bodies and that withheld revision
remain prohibited from source and public artifacts. On 2026-09-08 the corrected
`onlinesourdough/Global-Skills` default succeeded through the anonymous adapter;
see [proof](proof.md). This permits ordinary live public reads, not copying
the earlier private checkout or declaring its public history remediated.
The historical hold remains intact.

Synthetic private fixture markers are invented test data only. Production
Worker/client/static builds must not contain those fixtures, real credentials,
owner paths or withheld source. Fixture success cannot release the hold.

## Logs, operation and residual risk

Worker security headers deny framing, MIME sniffing and unsafe embedding.
HTML uses `strict-origin` so native login forms retain a same-origin POST Origin
while disclosing no path or query in referrers. OAuth, callback and API responses
use `no-referrer`; missing, null and foreign POST origins remain denied.
This follows the [Fetch Origin algorithm](https://fetch.spec.whatwg.org/#append-a-request-origin-header):
`no-referrer` can serialize a native POST Origin as null. The canonical browser
fixture checks actual form submission, rather than supplying an Origin header.
Request logs contain event/status/duration only.
Invocation URL logs and traces are disabled. Never enable callback-query,
cookie, header, source-ID, Markdown or token logging in adjacent infrastructure.

Operators own separate App selection/credentials, key rotation, HTTPS, D1
migrations/backups, quotas and access recovery. Each deployment's database and
config are independent. Default D1 primary reads are used for authorization.
Provider availability and rate limits remain external dependencies.

Full/production audits, source/artifact scans, runtime tests and browser proof
support local review. Live GitHub private membership/login, actual hosted
operation and final browser execution remain unproven until lead verification.
See [operations](operations.md), [recovery](recovery.md) and [proof](proof.md).

Source inventory results explicitly distinguish a complete empty list from a
partial or wholly unavailable check with `complete: false` and a generic warning.
Unavailable repository names and IDs are omitted. Failed global sign-out keeps
the global operation for Retry while clearing private browser content immediately.
