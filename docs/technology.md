# Technology decision

Decision: one TypeScript deployable using React, Vite, and Node's built-in HTTP
and filesystem modules. Recorded 2026-08-26 after the project-local Spec.

## Responsibility fit

| Responsibility         | Choice                                                          | Owner and source of truth                               | Why / exit path                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser interface      | Build: React + Vite + local Geist fonts                         | This repository; bundled snapshot and UI state          | Component boundaries keep the graph, library, detail, tour, and setup readable. Replaceable as a static client because it has no vendor contract.                                        |
| HTTP/API runtime       | Build: Node `http` server in TypeScript                         | This repository; validated request/response contracts   | One process serves assets and bounded read APIs. Built-in modules avoid framework and middleware burden. Replace with a small server framework only if an actual responsibility appears. |
| Git-backed read path   | Build: local filesystem adapter                                 | Operator-mounted checkout at `SKILLS_REPO_PATH`         | Least privilege and no credential lifecycle. The bundled source is the fallback; a future provider adapter must remain server-side and separately authorized.                            |
| Demo/search/Ask data   | Build: checked-in bundled snapshot                              | `src/data/bundled-skills.ts`                            | Deterministic, public-safe, offline-capable, and easy to review or replace. No database is needed.                                                                                       |
| Validation/tests       | Build: TypeScript strict mode, Vitest, ESLint, Prettier         | Repository scripts and tests                            | Contracts are executable; all tools are dev-only and replaceable through package-lock.                                                                                                   |
| Browser proof          | Build: Playwright against the installed Chrome channel          | `scripts/browser-proof.mjs` and ignored `proof/` output | Protects the real responsive journey without adding a production runtime dependency; replaceable by the receiving operator's browser runner.                                             |
| Observability          | Build: `/api/health` plus redacted structured request logs      | Server process output                                   | Enough for one local unit; no vendor platform or secret-bearing telemetry.                                                                                                               |
| Static public artifact | Build: relative-base Vite `static` mode + manual Pages workflow | This repository; bundled snapshot                       | Produces one `dist/static` artifact that resolves from a domain root or repository prefix without API calls or false fallback state. Any static host can replace Pages.                  |
| Portable self-host     | Build: Node process                                             | Operator following `docs/operations.md`                 | Preserves the mounted source and health path. A container adds no required capability for this handoff, so it remains excluded.                                                          |

## Material dependency evidence

The selected libraries have permissive, established licenses and are pinned in
`package-lock.json`; the runtime does not require a hosted service or account.
Vite's current Node support and React/Vite official build model are the reason
Node 20+ is the documented floor. The project should refresh dependencies by
reviewing changelogs and rerunning the full check/build/audit suite; the lock
file is the reproducible handoff boundary. No pricing or plan limit applies to
the selected runtime because it is self-hosted and provider-free.

GitHub's official Pages documentation records the custom-domain and Actions
deployment model used for preparation:

- [Using custom domains with GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [Deploying with a custom GitHub Actions workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

The public artifact is far below documented Pages size/build limits and has no
server-side capability. The authorized initial Pages deployment and current
uncommitted relative-base correction do not add a provider dependency; Pages
remains replaceable with any static host. The workflow uses the official
checkout, setup-node, configure-pages,
upload-pages-artifact, and deploy-pages actions pinned to full commit SHAs.
Each pin was resolved from its official current major tag and verified against
the public, non-archived action repository and commit before Review. To update
one, resolve that major tag again through the GitHub API, inspect the resulting
commit, replace the SHA while retaining the major-tag comment, and rerun the
security, workflow, project, audit, and browser gates. No paid plan or provider
credential is required. The initial authorized Pages action is recorded in
[proof.md](proof.md); no corrective workflow or domain action occurred in this
revision.

## Verification and failure behavior

- Build: `npm run check` includes format, lint, strict typecheck, tests, Node
  production build, and static production build.
- Browser: `npm run browser:proof` exercises both the real built Node server
  and static preview at desktop/mobile viewports and saves reviewable
  screenshots under ignored `proof/`.
- Operation: `npm run start` exposes `/api/health`; the critical public route
  remains available with no `SKILLS_REPO_PATH`.
- Denial/failure: parser tests cover invalid frontmatter, unsafe paths,
  symlinks, size/count bounds, empty sources, and fallback. The API never
  returns a raw filesystem error or token.
- Recovery: stop the process, remove or correct the disposable mounted source,
  rerun the build, and verify health/public fallback. The exact rehearsal is
  recorded in `docs/recovery.md` and `docs/proof.md`.

## Capability gap

No specialist capability gap was found. The existing project-local skills are
enough for Spec, technology choice, Build, and Review; no plugin or global
skill is installed.
