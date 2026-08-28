# Recovery

The receiving operator owns process, environment, provider access, and runtime
recovery. The imported GitHub repository remains canonical throughout every
path. The AIOS lead owns the current Build/Review boundary.

## Safe baseline

Both deployable shapes are stateless. The public-safe baseline is the fictional
checked-in `Offline example`. Imported plugins live only in browser memory;
admin sessions live only in one Node process. Reloading the browser retries the
canonical default and retains the Offline example on failure. Restarting Node
revokes every session.

The last Build artifacts are reproducible from the lockfile:

```sh
npm ci
npm run build
npm run build:static
```

Lead Review passed for r4. Until its Pages deployment is verified, any older
public Pages artifact is historical, not a recovery source for this revision.

## Process or artifact failure

1. Stop the Node process if it is unsafe, stale, or serving unexpected output.
2. Preserve logs that contain only the documented redacted request fields.
3. Reinstall from the reviewed lockfile with `npm ci`.
4. Run `npm run check`, `npm run docs:check`, and
   `npm run security:check`.
5. Start with `npm run start` after the build, or `npm run boot`.
6. Verify `/api/health`, Graph, one complete Library source, Usage empty truth,
   Plugins, and the account state before restoring access.

Do not recover by weakening parser bounds, exposing environment values,
enabling direct default-branch writes, or copying private source into the
static example.

## Credential or session failure

1. Remove network access if credential exposure is suspected.
2. Revoke/rotate the GitHub token at GitHub and replace the operator environment
   value; never place it in the browser or repository.
3. Replace `ATLAS_ADMIN_PASSWORD` independently.
4. Restart Node to revoke every in-memory session.
5. Confirm logged-out import omits the token and anonymous 404 remains
   existence-safe.
6. Sign in, re-import one authorized repository, and verify the returned
   effective permission.

If TLS or the access proxy failed, keep Atlas bound to loopback until that
operator-owned boundary is repaired. Use `ATLAS_COOKIE_SECURE=1` when returning
to HTTPS operation.

## Provider read failure

An invalid, unavailable, private-without-session, oversized, truncated,
rate-limited, or malformed import never replaces the active plugin. Keep using
the current plugin or the fictional Offline example while the operator corrects
access/source, waits for GitHub recovery, or uses Retry.

Do not distinguish a private repository from a missing one for an anonymous
user. Do not work around rate limits with unbounded retries or a browser token.

## Proposal partial failure

Proposal writes are not retried automatically. A denial or stale SHA before
branch creation causes no mutation. A duplicate branch stops before file or PR
writes. A later provider failure can leave an `atlas/...` branch containing no
PR or a committed update without a PR.

1. Record the proposal branch name shown by the safe error/provider state.
2. Inspect it through an authorized repository-owner account.
3. Preserve and open a PR manually, or remove the orphan through the owner's
   reviewed GitHub workflow.
4. Refresh the Atlas plugin before attempting another proposal.

Atlas intentionally does not delete remote branches during recovery. A cleanup
action could destroy recoverable work and requires separate repository-owner
authority.

## Static artifact failure

Stop serving the bad artifact, rebuild `dist/static`, run the security scan,
then run `npm run browser:proof`. Require successful root and `/Skills-Atlas/`
asset journeys with zero local API calls, only expected anonymous GitHub API
requests, and clean console/network diagnostics. Publication or rollback of a
Pages release requires a separate Review/Ship decision; never force-push or
delete repository history. If the domain is wrong, verify the Pages deployment,
`public/CNAME`, and Simply DNS target `onlinesourdough.github.io` before changing
any layer.

## Current rehearsal evidence

The r4 Build rehearsal is recorded in [proof.md](proof.md): deterministic
canonical startup/fallback/retry, a clean Node boot and health response,
admin/provider denial tests, mock-only permission/proposal UI, full/static
builds, static dual-root Chrome journeys, and security/audit checks. No real
credential, private read, provider write, remote branch, pull request,
publication, rollback, or deployment was used.

Residual recovery risks are GitHub availability, operator-selected token scope,
single-process session loss, and orphan proposal branches after partial
provider success.
