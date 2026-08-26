# Project Review

Result: PASS · dual-root static correction candidate · 2026-08-26

## Scope and comparison point

Reviewed the actual unstaged diff from published baseline commit
`5bc468625703a1f87a2a3ece431645c3aab3ac0a` against the lead's reproduced
repository-subpath failure, the r2 product contract, the authorized initial
Ship evidence, and the current Build-only correction boundary. The comparison
includes the preserved four post-Ship records, Vite mode selection, the exact
static production artifact, browser-proof behavior, architecture, technology,
operation, proof, and recovery.

The repository remains one independently owned, stateless Project. This
revision made no staged change, commit, push, workflow dispatch, Pages-setting
change, deployment, DNS change, credential action, or other external mutation.

## Findings

- Critical: none.
- Required: none after revision.
- Improvement: assign a long-term outcome-measurement owner and window before
  measuring adoption. No telemetry was added to compensate for that upstream
  ownership gap.

The Required finding in this revision was reproduced before the fix: the
initial static build used `/`, so repository-prefixed HTML requested JS, CSS,
fonts, and favicon from the organization root and failed. Static production
mode now uses `./`; the regular Node client remains `/`. The existing
browser-proof owner mounts the same `dist/static` directory at root and
`/Skills-Atlas/` and keeps the failure executable as a regression.

The four prior lifecycle findings—mounted-category visibility, shared parser/
client bounds, immutable workflow action pins, and public-documentation
redaction—remain closed and unchanged.

Review also found pre-Ship state language left in security, ownership, and the
Spec after the deliberately four-file post-Ship documentation handoff. Those
records now distinguish the historical creation boundary, authorized initial
release, and current unshipped correction without changing responsibility or
authority.

Lead revision r9 found one remaining Required documentation-truth
contradiction: the Spec still presented its original no-remote/no-publication
Build boundary as current and treated deployment, publication, and the
canonical remote as unowned. The Spec now preserves that boundary as history,
records the authorized initial Ship, and assigns external release actions to
the lifecycle/Ship path rather than the browser or Node runtime. No product,
runtime, workflow, dependency, or proof behavior changed. The finding is
closed before retaining project-local PASS.

## Gate evidence

- Intent/correctness: PASS. The change is limited to static asset resolution
  and its proof. Node mode, runtime UI/data, server behavior, workflow, and
  dependencies are unchanged.
- Evidence: PASS. The prefixed regression failed red against the shipped base
  with CSS/JS/favicon 404s, console/request failures, no font success, and no
  onboarding shell. After the correction, `npm run browser:proof` passes Node
  desktop/mobile plus root and prefixed static mounts with an empty failure
  list. The prefixed mount completes all five onboarding pages, Graph,
  Library/detail/edit denial, Usage demo truth, and deterministic Ask. Root and
  prefix each record document, JS, CSS, all three fonts, and favicon at 200,
  zero API requests, and zero page/console/request/response failures.
- Project checks: PASS. `npm run check` passes formatting, lint, strict
  client/server types, 3 test files with 16 tests, Node build, and static build.
  Full and production dependency audits report zero vulnerabilities.
- Documentation/security: PASS. README, operations, proof, recovery,
  architecture, technology, security, ownership, Spec, and this review
  distinguish the initial live limitation from the uncommitted correction.
  Local links and the secret/publish-safety/immutable-action scan pass.
- Simplicity/architecture/technology: PASS. One mode-dependent Vite base and
  one extended existing proof runner solve the gap without a framework,
  dependency, workflow branch, provider, or runtime compatibility layer. The
  same built files are tested twice rather than producing host-specific
  artifacts.
- Operation/recovery: PASS. The initial commit remains the published recovery
  anchor. A correction requires a separately reviewed normal commit/push and
  one authorized Pages rerun; Pages can still be disabled without repository
  deletion. No rollback or external recovery action was needed in Build.

## Evidence and limitations

Fresh structured evidence is `proof/runtime/browser-proof.json`; ignored
screenshots include `r3-static-root.png` and `r3-static-prefixed.png`. The
corrected artifact is locally proven only. The public Pages URL still serves
the initial root-base artifact, custom-domain DNS remains absent, and no live
corrective deployment or custom-domain journey is claimed.

No live provider/private-source behavior, write path, telemetry, adoption
window, runtime model, corrective workflow run, Pages mutation, custom-domain
verification, or DNS action was available or authorized.

**PASS** — smallest next action: AIOS lead Review and publish-safety review of
this exact unstaged correction candidate. Corrective Ship remains paused until
authority is explicitly reissued.
