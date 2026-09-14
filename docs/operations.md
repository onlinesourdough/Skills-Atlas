# Operations and self-host setup

## Personal Worker package

Use Node 22.21.1 (`>=22.21.1 <23`), the lockfile and the same Worker/static-assets/D1/KV package for
hosted and self-hosted deployments. Every deployment owns a separate GitHub
App configuration, origin, secrets and D1 database. No hosted database or
operator credential is a self-host default. The checked-in database ID is a
local placeholder; it is not a provisioned resource.

```sh
npm ci
npm run build:worker:client
npm run db:migrate:local
npm run dev:worker
```

Default local listener: `http://127.0.0.1:8787`. Local migrations are safe to
repeat. Stop with Ctrl-C. Local D1 defaults to `.wrangler/state`; never commit
it. `npm run build:worker` bundles with `wrangler deploy --dry-run` and does
not provision or deploy anything.

## Configuration

Nonsecret defaults are in [wrangler.jsonc](../wrangler.jsonc). Local overrides
and the two secrets belong in an ignored `.dev.vars`; see
[.dev.vars.example](../.dev.vars.example). Production secret storage, resource
creation and delivery require the receiving operator's separate authority.

| Value                      | Meaning                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `ATLAS_ORIGIN`             | Exact browser origin; callback is this origin plus `/auth/github/callback`                         |
| `ATLAS_DEPLOYMENT`         | `hosted` or `self-hosted`                                                                          |
| `ATLAS_ALLOWED_ORG`        | Active membership required; hosted must be `onlinesourdough`                                       |
| `ATLAS_ALLOWED_USER_IDS`   | Comma-separated positive numeric GitHub IDs; self-host only, mutually exclusive with org           |
| `ATLAS_LOCAL_HTTP`         | `true` permits HTTP only on localhost/127.0.0.1, self-host only                                    |
| `ATLAS_DEFAULT_REPOSITORY` | Initially seeded source; defaults to `onlinesourdough/Global-Skills`                               |
| `GITHUB_CLIENT_ID`         | This deployment's GitHub App OAuth client ID                                                       |
| `GITHUB_CLIENT_SECRET`     | Server-only GitHub App OAuth client secret                                                         |
| `ATLAS_ENCRYPTION_KEY`     | Secret standard-base64 encoding of 32 random bytes                                                 |
| `DB`                       | Independent D1 binding; apply `migrations/` before enabling access                                 |
| `OAUTH_KV`                 | Independent Cloudflare KV namespace used by the OAuth provider, never shared between installations |

Configure the GitHub App user authorization callback exactly. App access needs
read-only Contents and Metadata, plus organization Members when using an
organization membership policy. The user and App must
both have access to an imported repository. Enable user authorization; use the
App client ID/secret, not its numeric app ID or an installation token.
GitHub identity and membership are verified server-side after exchange.
The live private-membership/login gate is still unproven; fixtures cannot
substitute for the receiving operator's action-time installation and verification.

Missing/invalid policy or secrets makes auth/API return safe 503 errors.
HTTPS uses Secure HttpOnly `__Host-` cookies; the explicit loopback exception
uses a different cookie name. Never use the local exception for a public origin.
Source selection is bounded to 20 entries; session lifetime is at most eight
hours or upstream expiry. Re-login renews access; upstream GitHub refresh tokens
are discarded. Atlas agent refresh is separate and cannot exceed that expiry.

The all-zero resource IDs in tracked config are local placeholders. A receiving
operator must supply both the actual D1 ID and an independent `OAUTH_KV` ID under
their resource-creation authority before live delivery. Local Wrangler emulates
both bindings without an account action. Migration 0002 invalidates old sessions
and OAuth attempts, then adds the shared credential vault and agent guards;
existing numeric profiles and source preferences survive. Do not restore only
the former session schema under D code. KV backups are sensitive protocol state;
recovery should use fresh/cleared KV plus D1 invalidation, never revive grants.

## Exact-source self-host rehearsal

From a repository candidate with its locked dependencies installed, run:

```sh
node scripts/selfhost-snapshot.mjs
```

This verification script creates a new temporary `atlas-selfhost-*` directory
outside AIOS. `source/` contains the current tracked/untracked distributable files,
including migrations, config examples, assets, local project documentation and
third-party notices. It excludes Git, installed dependencies, builds, Wrangler
state, generated proof, local environment files and npm user configuration.
Escaping symlinks fail the copy; safe in-repository file links are materialized.
`manifest.json` records every copied path, byte count and SHA-256. `report.json`
records the manifest hash, actual Node/npm executable and version, OS/architecture,
executed commands, local logs and results. No remote checkout substitutes for
the current candidate; the copied package has no Git or AIOS runtime dependency.

The driver permits only a bounded environment, preserves HOME/CODEX_HOME without
repurposing them, supplies isolated npm user/global config and cache plus Wrangler
configuration, and passes no ambient account credentials. It runs `npm ci`, full
checks/builds/docs/security/audits, production health, synthetic HTTP/MCP/restore,
then repeats `npm ci` and verifies occupied restored preferences still work.
Exact upstream notices are compared against source and all delivered artifacts.
Local logs/state remain in the reported temporary directory for lead review.

The separate synthetic E fixture uses an explicit numeric allowlist (`11,22`)
and the public `fixture-operator/public-skills` default. It proves allowed users
without organization membership, an unlisted denial, two-profile isolation and
MCP/browser data identity. The production entrypoint is started separately with
missing configuration (safe 503) and with synthetic local configuration (health
200, anonymous/private and fixture-control denial); it never uses the synthetic
provider. Production GitHub connectivity is not inferred from local health.

For native browser acceptance, use the exact reported snapshot directory:

```sh
node scripts/selfhost-snapshot.mjs --browser /absolute/atlas-selfhost-directory
```

This verifies its manifest, uses isolated configuration, and runs the existing
`browser:agent` journey against the E fixture's changed policy/default, followed
by the normal `browser:personal` and `browser:proof` regressions. The
source API, native consent/callback and private two-profile assertions remain
the same. Ports 8790 and 4199 must be free; all local fixture listeners close
on completion. The worker does not retry a known sandbox-blocked browser.

If only README/docs change after the application checks, the original repository
can run `node scripts/selfhost-snapshot.mjs --sync-docs /absolute/atlas-selfhost-directory`.
It refuses any runtime file difference, refreshes only canonical documentation,
regenerates the manifest and reruns docs/security checks. The report retains the
initial checked manifest hash and final synchronized manifest hash. Runtime
changes require a new snapshot and the full applicable checks.

This is a local rehearsal on the recorded machine, not an installation service,
hosting proof or proof on another OS. Preserve its exact directory until review;
later cleanup is limited to that explicitly named disposable directory. Do not
apply its synthetic config, keys, SQL or resource IDs to a real deployment.

## Operator-owned live delivery

After separate account/resource authority, prepare a deployment-specific Wrangler
configuration from the tracked template. Keep it at the package root or resolve
its main/assets/migrations paths relative to the new config location. Set the actual independent D1 and KV
IDs, HTTPS origin, `ATLAS_LOCAL_HTTP=false`, App client ID, own organization or
numeric allowlist, and public default repository. Install the GitHub App only
on the intended repositories and verify its exact callback/read permissions.
Store the App secret and a new random 32-byte encryption key through interactive
`wrangler secret put`, never command arguments or committed config.

With that target explicitly reviewed, ordinary operator commands are:

```sh
npx wrangler d1 migrations apply DB --remote --config /path/to/operator.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET --config /path/to/operator.jsonc
npx wrangler secret put ATLAS_ENCRYPTION_KEY --config /path/to/operator.jsonc
npm run build:worker:client
npx wrangler deploy --config /path/to/operator.jsonc
```

These remote commands have not been executed in local proof. The operator owns
resource creation, domain/DNS/TLS, staging, live allow/deny/private access checks,
backup and recovery verification. The local `--dry-run` build proves packaging,
not those remote actions. Use [recovery](recovery.md) before rollback or restore;
never share D1/KV or credential material across installations.

## Health and operation

```sh
curl -fsS http://127.0.0.1:8787/api/health
```

Healthy configured/migrated output:

```json
{
  "status": "ok",
  "mode": "self-hosted",
  "sessions": "d1",
  "provider": "github-app",
  "writes": false,
  "agentTokens": "oauth-kv-with-d1-revocation"
}
```

Health validates configuration, D1 credential schema and KV reachability, not GitHub connectivity or
membership. Each authorized request checks GitHub identity/policy afresh.

## Agent operation and bounded costs

Use the account's `/mcp` endpoint in a client's supported remote MCP connection
controls. No Atlas CLI, harness configuration writer or installation action is
included. Discovery is `/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource/mcp`; registration/token/consent live
under `/agent/`. Public clients need S256 PKCE and `atlas:read`. Only HTTPS or
loopback callback URLs are accepted. The chosen agent receives only explicitly
requested tool results after user consent.

Registration is limited globally to 100/hour with 24-hour client expiry, consent
to five minutes/1,000 pending rows and connections to 20/account. Access tokens
last at most five minutes; refresh grants last no longer than the upstream
credential (eight hours maximum). Every refresh rechecks D1 and GitHub; repeated
refresh hashes are denied, including provider grace-window reuse. Lost or failed
refreshes can require a new connection and consent. Expired state is pruned on
login/registration/refresh. Long-lived connections require re-consent at expiry.
These are local resource bounds, not a billing or abuse-management service.

`npm run proof:agent` uses isolated local D1/KV and the pinned standard SDK over
HTTP, including recovery invalidation with stale KV. `npm run browser:agent`
opens native consent and the exact returned reader URL using synthetic users.
Both use port 8790 and must run sequentially with `proof:worker` and
`browser:personal`. Their reports are under ignored `proof/runtime` and contain
no tokens, codes or private source bodies. Local SDK/browser proof does not
establish a native Codex connection or built-in-browser integration.
The client refreshes access every minute when visible and locks no later than
the five-minute authorization lease. Returning from a hidden page or browser
history requires a fresh check. Provider outage, expiry or uncertain policy
does not extend cached access. Per-source denial removes that source.

Worker logs contain event, status and duration only. Invocation URL logs and
traces are disabled: OAuth callback queries contain codes and source IDs are
private. Operators must preserve this policy in any upstream logs or analytics.
Health and API responses are private/no-store; no content cache is shared.

Use D1 primary reads for authorization. This implementation calls the default
D1 binding directly and does not enable replica sessions. Monitor GitHub rate
limits, Worker subrequests and D1/storage quotas. A maximum-size repository can
exceed a free Worker subrequest allowance; use the plan appropriate to the
bounded inventory, or accept an explicit failed read. No retry loop works
around quotas. See [technology](technology.md) for checked limits and costs.

## Local fixture and proof

No credentials or accounts are needed:

```sh
npm run proof:worker
npm run browser:personal
```

Both commands build the personal client and use
[wrangler.fixture.jsonc](../wrangler.fixture.jsonc), a separate local-only
entrypoint and synthetic Alice/Bob/denied users. Fixture state and reports go
under ignored `proof/runtime`; screenshots go under `proof/screenshots`.
The fixed fixture port 8790 must be free. The runner refuses an existing listener.
The fixture configuration/control routes must never be deployed. Production
entrypoints do not import them, and artifact checks reject their markers.

`proof:worker` applies/replays migrations, serves the real built UI/health,
performs HTTP OAuth/cookies, tests two profiles, restarts Worker, exports SQL,
restores into independent local D1, removes restored sessions/flows and
re-authenticates. It also tests repository loss, token revocation and logout.
Wrangler local export has no custom-persistence flag in the pinned version;
the runner generates an isolated export config beside its state.

Browser proof additionally checks full private reading, persistent hidden
sources, duplicate imports, two-tab logout, history, denied membership and
revocation through the UI. A browser run is required for independent acceptance;
a syntax check or HTTP fixture run is not browser proof.

## Retired Node admin migration

The Node preview now ignores the old admin/password/token options and environment
variables. `POST /api/session/login` returns 410; proposals always deny.
Imports are tokenless. There is no migration of operator credentials, admin
sessions or browser-only preferences into user profiles.

1. Stop the former Node private service and remove its old environment credentials.
2. Prepare a separate Worker/D1 deployment and GitHub App under operator authority.
3. Apply the migration; set exact origin, membership/allowlist and separate secrets.
4. Verify health and actual authorized/denied user logins before exposing private access.
5. Users re-import sources after personal login. Existing GitHub content is unchanged.

`npm run boot` remains a public-only migration/demo aid at port 4173.
[.env.example](../.env.example) documents only HOST/PORT for that preview.
It is not the personal self-host package.

## Public static delivery

`npm run build:static` emits credential-free `dist/static`; it works at both
root and `/Skills-Atlas/`. It performs only anonymous GitHub reads and keeps a
fictional offline fallback. The existing manual Pages workflow/CNAME remains
the demo delivery route; a Worker cutover and DNS/TLS verification require
separate Review/Ship. This candidate changes no live resource.

Run the full [README verification](../README.md#verification) before handoff.
See [recovery](recovery.md) for tested restore and credential/session recovery.
