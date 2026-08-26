# Online Sourdough Skills Atlas

The Atlas is a public-first, self-hostable map for agent skills. Its default
product surface is a clustered relationship graph with a searchable library,
persistent skill detail, demo usage shape, and deterministic Ask panel. A
five-page first-visit walkthrough explains why one shared Git source matters.

The static public edition uses a safe bundled snapshot. The complete Node
edition can instead read one operator-mounted Git checkout whose canonical
files are `skills/<slug>/SKILL.md`.

The Git repository remains the source of truth. The Atlas owns the readable
map, library, safe excerpts, deterministic search/Ask surface, and optional
activity shape. This repository is the canonical Project home for the
implementation, operation, proof, and recovery records.
The public Git remote is
[`onlinesourdough/Skills-Atlas`](https://github.com/onlinesourdough/Skills-Atlas).

## Run it

Requires Node 20.19 or newer.

```sh
npm ci
npm run dev
```

`npm run dev` starts the browser preview. To build the exact static public
artifact without an API dependency or false live-source warning:

```sh
npm run build:static
npm run preview:static
```

To run the complete self-hostable unit, build and start the production
artifact:

```sh
npm run boot
```

The process listens on `http://127.0.0.1:4173` by default. Check it with:

```sh
curl http://127.0.0.1:4173/api/health
```

Use [`.env.example`](.env.example) for the supported configuration. Set
`SKILLS_REPO_PATH` to an absolute local checkout containing
`skills/<slug>/SKILL.md`; the server reads it on the server side only. Invalid,
empty, oversized, unsafe, or unavailable sources safely return the bundled
snapshot with a visible warning. The browser never receives the configured
root path or a credential.

## What is included

- A light, graph-first Atlas shell with top-level Graph, Library, and Usage
  views plus a narrow department/source taxonomy.
- A focused five-page first-visit walkthrough with deterministic replay,
  Back/Next/Skip/Escape, progress, and a public entry action.
- A clustered selectable relation graph, three-region library with persistent
  detail/editor shape, safe excerpt, source path/version, and visibly denied
  public save action.
- Global search (`Cmd/Ctrl-K`), an Ask the Atlas control across core views,
  deterministic bundled answers, ranked demo usage/quiet skills, subordinate
  demo activity, setup permission copy, and six inspectable state fixtures.
- Responsive desktop/mobile layout, visible focus, Escape/focus restoration,
  reduced-motion behavior, offline fallback, and no horizontal overflow.
- A strict frontmatter parser and bounded local filesystem adapter for the
  canonical `skills/<slug>/SKILL.md` shape.

The public snapshot is deliberately concise and safe. Activity is demo data;
Ask does not call a model; setup does not perform OAuth; editing, telemetry,
provider access, and writes are not implemented.

## Static public release

The checked-in manual workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
builds `dist/static/` for `skills.onlinesourdough.com`; [CNAME](public/CNAME)
and `.nojekyll` are included in that artifact. Initial release commit
`5bc468625703a1f87a2a3ece431645c3aab3ac0a` is published on `main`, and
[Pages run 32969456173](https://github.com/onlinesourdough/Skills-Atlas/actions/runs/32969456173)
completed successfully for that exact commit.

GitHub reports workflow-based Pages at
`https://onlinesourdough.github.io/Skills-Atlas/`. The initially deployed
artifact uses a root base: its HTML is public, but its root-relative assets
return 404 at that repository subpath. As of 2026-08-26, public DNS has no
record for `skills.onlinesourdough.com` and the Pages API has no active CNAME.

The current unstaged correction candidate makes only static production mode use
a relative base. Fresh local browser proof serves the same `dist/static`
artifact at `/` and `/Skills-Atlas/`; both mounts load local JS, CSS, fonts, and
favicon, and the prefixed critical journey passes. This correction has not been
committed, pushed, or deployed, so the live limitation remains. No DNS change
was made. The static edition uses only bundled data. Mounted source reads and
`/api/health` require the Node edition.

## Architecture and records

- [Project-local Spec](docs/spec.md) — resolved Build contract and boundaries.
- [Technology decision](docs/technology.md) — responsibility/owner/exit
  choices for the single deployable.
- [Architecture](docs/architecture.md) — browser, API, parser, and fallback
  contracts.
- [Security and permissions](docs/security.md) — trust boundaries and bounds.
- [Operations](docs/operations.md) — build, boot, health, and source setup.
- [Ownership](docs/ownership.md), [proof](docs/proof.md), and
  [recovery](docs/recovery.md) — handoff truth and tested evidence.
- [Review](docs/review.md) — the project-local correctness/security/simplicity
  gate and residual risks.
- [Design translation](docs/design.md) — approved warm paper/brown/Geist
  inputs and receiving-project decisions.

## Project-local distribution

The Atlas is an application, not a harness plugin. A team can keep the
canonical cross-project skills separately and point an Atlas at the same
Git-backed source. The inspected Skills repository records this verified,
project-local installer route for Codex/ChatGPT, Claude Code, and Cursor:

```sh
npx skills@1.5.23 add onlinesourdough/Skills#v0.1.0 --skill clarify manage-skills route-models --agent claude-code cursor -y
npx skills@1.5.23 list --agent claude-code cursor
```

That command is documented distribution guidance, not an action performed by
this Atlas. The source repository remains the authority; the adapter paths and
rollback/update steps are described in its own release record. Model-backed
forward behavior for logged-out Claude and Cursor Agent runtimes is not claimed
by that proof.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run build:static
npm run docs:check
npm run security:check
npm run browser:proof
npm audit --omit=dev --audit-level=high
```

The complete local gate is `npm run check`; it builds both Node and static
artifacts. `npm run browser:proof` exercises both shapes in real Chrome.
Reviewable browser/runtime evidence is kept under the ignored `proof/`
directories; the acceptance record in [docs/proof.md](docs/proof.md) names the
exact run and limitations.

The authorized initial commit, public remote, and Pages deployment are recorded
in [docs/proof.md](docs/proof.md). No OAuth grant, provider/model action,
telemetry, credential, or DNS change was made. See [LICENSE](LICENSE) for the
project license.
