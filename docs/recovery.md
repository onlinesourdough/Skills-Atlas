# Recovery

## Recovery owner

The receiving operator owns the local process, mounted checkout, rebuild, and
fallback decision. The AIOS lead owns the Build/Review handoff boundary. No
secret or private repository data belongs in this record.

## Current path

Both deployable shapes are stateless apart from the Node operator's selected
Git checkout. The last known good artifacts are `dist/static` from
`npm run build:static` and the Node output from `npm run build`, both using the
locked dependencies. The published reviewed baseline is commit
`5bc468625703a1f87a2a3ece431645c3aab3ac0a` in
[`onlinesourdough/Skills-Atlas`](https://github.com/onlinesourdough/Skills-Atlas),
delivered by successful Pages run `32969456173`. If the mounted source fails
validation, the server automatically uses the bundled snapshot; this is the
first Node recovery path and keeps browsing available.

The current relative-base correction candidate is uncommitted and undeployed,
so it does not replace that recovery anchor. Until a separately reviewed and
authorized corrective release succeeds, the live Pages site remains the
initial root-base deployment with the documented repository-subpath asset
failure.

1. Identify whether the failure is the Node artifact, the mounted checkout, or
   a source warning from `/api/health`.
2. Stop the process with Ctrl-C if the artifact itself is unsafe or stale.
3. For a source failure, remove the bad configuration from the operator
   environment or correct the checkout's `skills/<slug>/SKILL.md` files. Do
   not bypass parser or symlink checks.
4. Rebuild from the lockfile with `npm ci && npm run build`, then run
   `npm start`.
5. Verify `/api/health`, the Start here route, one library/detail journey, and
   visible fallback/error messaging.
6. Record the result in [proof.md](proof.md) and return to operation only with
   owner authority.

For a static artifact failure, do not add an API or bypass the bundled source.
Stop the static preview or disable the Pages site, run
`npm ci && npm run check && npm run browser:proof`, rebuild `dist/static`, and
verify first-visit onboarding plus Graph → Library → Usage → Ask locally.

## GitHub Pages correction and disable path

Never force-push or delete the public repository. For a bad release:

1. Revert the bad reviewed commit with a new commit, or prepare a narrowly
   corrective commit from the last reviewed good revision.
2. Run the full project and browser gates, obtain Review/Ship authority, and
   normal-push `main`.
3. Dispatch `.github/workflows/pages.yml` once for the corrected commit.
4. Verify local `HEAD`, `origin/main`, and GitHub `main` equality; inspect the
   workflow jobs, Pages API, deployment status, uploaded artifact, and public
   Graph → Library → Usage → Ask journey. For the dual-root correction, verify
   the same uploaded artifact at the repository subpath and eventual custom
   domain root.

If the public site must be withdrawn before a corrected artifact is ready,
disable Pages through the repository Settings UI or, with explicit owner
authority:

```sh
gh api --method DELETE repos/onlinesourdough/Skills-Atlas/pages
```

That removes the Pages site, not the Git repository. Re-enable it later with
workflow build type and rerun the reviewed workflow; do not delete the
repository or rewrite history. The unresolved Simply DNS record and custom
domain remain separate owner-controlled recovery inputs. This Ship did not
change them.

## Rehearsal

- Last recovery rehearsal: 2026-08-26 r2 recovery Review. The locked production
  build was started through `npm run boot`; bundled health, the public route,
  and read-only denial were checked. The documented canonical Skills checkout
  was then mounted read-only and returned three records.
- Result and evidence: a configured root without `skills/` returned the
  eight-skill bundled snapshot with `fallback: true` and no source-root
  disclosure. Stopping that process and restarting without the bad
  configuration restored `fallback: false` health and the public route.
  Invalid/empty/oversized/symlinked source cases remain covered by
  `server/source.test.ts`.
- Pages recovery review: corrective/revert commit plus a normal push and one
  workflow rerun is available; Pages can be disabled without deleting the
  public repository. No destructive rollback was needed during the successful
  initial deployment.
- Remaining risk: the mounted Git checkout's own backup, commit policy, and
  signature verification remain operator responsibilities. Public outcome
  remains pending Simply DNS and GitHub custom-domain activation.
