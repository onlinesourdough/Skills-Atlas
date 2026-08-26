# Recovery

## Recovery owner

The receiving operator owns the local process, mounted checkout, rebuild, and
fallback decision. The AIOS lead owns the Build/Review handoff boundary. No
secret or private repository data belongs in this record.

## Current path

Both deployable shapes are stateless apart from the Node operator's selected
Git checkout. The last known good artifacts are `dist/static` from
`npm run build:static` and the Node output from `npm run build`, both using the
locked dependencies. If the mounted source fails validation, the server
automatically uses the bundled snapshot; this is the first recovery path and
keeps public browsing available.

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
Stop the static preview or future Pages release, run
`npm ci && npm run check && npm run browser:proof`, rebuild `dist/static`, and
verify first-visit onboarding plus Graph → Library → Usage → Ask locally. A
future published rollback must use the receiving repository's reviewed prior
revision and requires Ship authority; this Build has no remote deployment to
roll back.

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
- Remaining risk: the mounted Git checkout's own backup, commit policy, and
  signature verification remain operator responsibilities.
