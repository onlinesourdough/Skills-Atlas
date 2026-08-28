# Operations and self-host setup

## Build and boot

Use Node 20.19 or newer and install from the committed lockfile:

```sh
npm ci
npm run boot
```

`npm run boot` builds `dist/client` and `dist/server`, then starts the single
Node process. `npm run start` starts an already-built artifact. The default
listener is `http://127.0.0.1:4173`; stop it with Ctrl-C.

The no-configuration state is intentional: startup attempts an anonymous read
of `onlinesourdough/Skills`; other public imports, Graph, Library, Usage/health,
Plugins, and search work without a credential. If startup cannot reach public
source, the fictional `Offline example` remains available with Retry. Account
state is public; private reads and edits are unavailable.

## Operator configuration

Supply configuration through the process environment or an operator-owned
secret manager. [`.env.example`](../.env.example) is documentation only; the
application does not load dotenv files itself.

| Value                   | Purpose                                          | Required behavior                                      |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `ATLAS_ADMIN_PASSWORD`  | Independent self-hosted admin boundary           | Use a long unique value; never reuse the GitHub token  |
| `GITHUB_TOKEN`          | Server-only authenticated GitHub reads/proposals | Choose least privilege for only intended repositories  |
| `ATLAS_COOKIE_SECURE=1` | Adds `Secure` to the session cookie              | Required whenever the browser reaches Atlas over HTTPS |
| `HOST`                  | Listener bind                                    | Defaults to `127.0.0.1`; broaden only intentionally    |
| `PORT`                  | Listener port                                    | Defaults to `4173`; accepted range is 1024–65535       |

For a fine-grained GitHub token, private reads need repository metadata and
Contents read access. Proposals additionally need Contents read/write and Pull
requests write access. GitHub's returned repository permission still decides
whether the UI shows `Read only` or `Can edit`.

The Node process does not terminate TLS or provide an Internet access proxy.
When network-exposed, place it behind the operator's authenticated HTTPS
boundary, protect environment visibility, and set the secure-cookie flag.

## Admin and private repository journey

1. Open the account control and sign in with `ATLAS_ADMIN_PASSWORD`.
2. Open Plugins and submit `owner/repository`.
3. Node uses `GITHUB_TOKEN` only for that authenticated request.
4. Confirm repository identity, observed revision, skill count, and effective
   access in Plugins.
5. Open a skill in Library. `Propose edit` appears only when access is
   `Can edit`; otherwise the complete source remains read-only.

Anonymous imports always omit the server token. A 404 displays
`Repository unavailable or private` and does not reveal whether the repository
exists. The previously active plugin remains selected after a failed import.

## Health and logs

```sh
curl -fsS http://127.0.0.1:4173/api/health
```

Healthy output has this shape:

```json
{
  "status": "ok",
  "mode": "self-hosted",
  "adminConfigured": false,
  "githubConfigured": false,
  "sessions": "memory"
}
```

Configuration booleans may be true without exposing values. Request logs
contain request ID, normalized route, status, outcome, and duration. They omit
query strings, cookies, headers, repository identifiers, Markdown, passwords,
and tokens.

Restarting the process revokes all admin sessions. Imported plugins also live
only in the current browser session; reload retries the canonical default and
uses the Offline example if that read fails.

## Static artifact

```sh
npm ci
npm run build:static
npm run preview:static
```

`dist/static` contains the credential-free Offline example, canonical startup
identifier, and local assets. It has no session or write endpoint. Canonical
startup and manual public imports call GitHub directly without credentials. The
exact artifact is tested at both `/` and `/Skills-Atlas/` by
`npm run browser:proof`.

GitHub Pages is the single public deployment owner. The SHA-pinned workflow is
manual and publishes `dist/static`; `public/CNAME` declares
`skills.onlinesourdough.com`, and the receiving Simply DNS CNAME target is
`onlinesourdough.github.io`. Lead Review passed for r4. The Pages run and
deployment, custom domain, DNS, and TLS remain pending and unverified until
their later Ship steps. Do not infer current source truth from an older release.

## Routine verification

Before a Review or artifact handoff, run:

```sh
npm run check
npm run docs:check
npm run security:check
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run browser:proof
```

Security check requires a current `dist/static` and scans it for credentials,
owner-home paths, failed-fetch text, and the withheld observed private revision
marker. Browser proof starts isolated local servers with deterministic
anonymous-GitHub fixtures; its `Can edit` and proposal result are intercepted
and never reach GitHub.

## Provider failure operation

- Rate limited or unavailable: keep the active plugin and retry after the
  provider window; do not add unbounded retries.
- Authentication denied: sign out, rotate or correct server configuration,
  restart, and sign in again.
- Permission denied: keep the plugin read-only or correct provider-side access;
  never override the label client-side.
- Stale source: refresh/import the plugin before preparing a new proposal.
- Duplicate branch: use a new proposal action; do not force-update the existing
  branch.
- Failure after branch creation: inspect the named orphan branch in GitHub.
  Preserve or remove it through an authorized repository-owner workflow; Atlas
  does not delete it automatically.

See [recovery.md](recovery.md) for the tested restart and safe rollback paths.
