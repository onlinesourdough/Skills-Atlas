# Security and permissions

The default posture is public, credential-free, read-only browsing. GitHub
content remains canonical. Private reads and every provider write require two
independent server-side conditions: an authenticated Atlas admin session and an
operator-supplied GitHub credential.

## Trust boundaries

- Static startup and manual imports make unauthenticated `GET` requests directly
  to the public GitHub REST API. The static UI has no credential input, bundle
  value, storage key, cookie, or write endpoint.
- Node public imports deliberately omit the configured GitHub token. This
  prevents an unauthenticated browser from probing private repositories through
  an operator's credential.
- An authenticated checkout of `onlinesourdough/Skills` was anonymously denied
  with HTTP 404 on 2026-08-27. It is treated as private/unavailable. Its source
  bodies and newly observed revision are prohibited from the public bundle;
  access is possible only through authenticated self-hosted configuration.
- `ATLAS_ADMIN_PASSWORD` and `GITHUB_TOKEN` are server environment values only.
  They are never returned, logged, placed in URLs, persisted in browser
  storage, included in client builds, or accepted by the Plugins form.
- Admin login creates a random, bounded, in-memory session identified by an
  `HttpOnly`, `SameSite=Strict` cookie. Restart revokes every session. Login,
  logout, and proposal requests enforce JSON/origin expectations and fail
  closed when admin configuration is absent.
- GitHub provider JSON and browser/API input are untrusted. Repository names,
  paths, branch/proposal identifiers, response schemas, content sizes, and
  Markdown are runtime-validated before use.
- Skill Markdown is preserved in full but rendered without raw HTML. React and
  the Markdown renderer own text escaping and safe URL handling; source is
  never executed or inserted with `dangerouslySetInnerHTML`.

## Provider reads

Reads accept only `owner/repository` identifiers and exact
`skills/<safe-slug>/SKILL.md` files. The adapter caps tree entries, accepted
skills, one file, aggregate decoded bytes, concurrent requests, timeout,
read-only retries, and response/error text. Truncated trees, malformed provider
payloads, unsafe paths, duplicate or invalid skills, unavailable/private
repositories, authentication failure, and rate limits return stable safe codes.
The active plugin is retained after an import failure.

Anonymous 404 always becomes `Repository unavailable or private`; status copy,
logs, and timing policy do not confirm repository existence. The effective
access label is based on provider repository permissions:
tokenless public reads are `Read only`; `Can edit` requires a server-token
response with verified `push: true` inside an authenticated session. Client
state alone never authorizes a write.

## Pull-request proposal policy

`POST /api/proposals` requires an authenticated admin session, configured
server token, same-origin request, validated repository/path/content/title, and
a client proposal identifier. Immediately before the first mutation, the
server re-fetches repository permission and default-branch SHA. It rejects
permission denial and stale SHA.

The only allowed sequence is:

1. create `refs/heads/atlas/<slug>-<proposal-id>` from the observed default
   branch SHA;
2. update exactly one validated `skills/<slug>/SKILL.md` on that branch, using
   the observed file blob SHA;
3. open a pull request from the proposal branch to the default branch.

The server never writes the default branch and does not automatically retry a
write. Duplicate branch, update failure, and pull-request failure are explicit.
A partial failure may leave an operator-visible orphan branch; automatic
deletion could remove recoverable work and is therefore excluded.

## HTTP, logging, and operation

Security headers deny framing, MIME sniffing, object/base embedding, and
cross-origin referrers. Node request logs contain request ID, normalized route,
status, outcome, and duration—not query strings, headers, cookies, repository
source, Markdown, passwords, or tokens. Request bodies and provider payloads
are never logged.

The default bind is `127.0.0.1`. A network-exposed operator owns TLS, access
proxying, password/token rotation, least-privilege GitHub scope, process
isolation, and environment-file permissions. A public static host owns only the
credential-free bundle.

Dependencies are lockfile-pinned and reviewed with full and production audits,
license evidence, the secret/publish-safety scan, immutable workflow-action
validation, builds, tests, and browser proof. Canonical startup success and
provider writes are fixture/mock-proven during r4 Build; no real credential,
private read, branch, PR, OAuth grant, remote publication, or deployment is
claimed. Source review keeps unpublished bodies out of bundled data. Static
artifact scans reject the withheld revision, failed-fetch text, owner-home
paths, and credential-shaped values while allowing the canonical repository
identifier required for anonymous startup.

## Residual risk

Tokenless reads inherit GitHub availability and rate limits. An operator can
grant a token broader rights than the Atlas needs; documentation requires
least privilege but cannot constrain provider-side scope. In-memory sessions
are intentionally single-process. Source content can change after a plugin read;
the proposal's observed SHA check prevents silently writing from stale default
branch state.
