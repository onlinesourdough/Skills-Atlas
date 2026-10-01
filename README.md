# Skills Atlas

Skill Atlas helps teammates explore Git-backed skills through a graph,
searchable library and complete Markdown reader. GitHub stays canonical.

- Release target: [skills.onlinesourdough.com](https://skills.onlinesourdough.com)
- Default skills source: [onlinesourdough/Global-Skills](https://github.com/onlinesourdough/Global-Skills)
- Application source: [onlinesourdough/Skills-Atlas](https://github.com/onlinesourdough/Skills-Atlas)
- [Issues](https://github.com/onlinesourdough/Skills-Atlas/issues) · [MIT license](LICENSE)

The personal edition uses one Worker, static assets, D1 and OAuth KV package for hosted
and self-hosted operation. Sign in with your GitHub account, then import
repositories available to both you and the GitHub App. Sources and visibility
choices belong to your numeric GitHub profile; skill bodies stay in GitHub.
Hosted policy requires active onlinesourdough membership. Self-host operators
choose an organization or numeric-user allowlist.

**Status:** local development and personal-session checks have been completed.
Production deployment, full private-access acceptance and native agent integration
remain incomplete. Development is paused at the verified local checkpoint; see
[proof and remaining work](docs/proof.md).

## Browsing and sources

- Root `skills/<slug>/SKILL.md` and `.agents/skills/<slug>/SKILL.md` are the
  only discovered shelves. Repository ID plus exact path identifies a skill.
- Source checkboxes filter Graph, Library and search together. Personal choices
  persist in D1; public demo choices last for the browser session.
- Directed relations come from source links and metadata. Reader evidence shows
  file/line and unresolved or ambiguous targets; name mentions never imply calls.
- Graph clusters and sidebar swatches identify repositories, even when every
  skill is Uncategorized. Repository labels stay at screen size; aggregate arrows
  show directed cross-repository references. Select a skill for incident edges
  and exact source/target evidence; category remains optional focus.
- Cross-repository links resolve only against visible loaded GitHub files at
  their exact observed revision (optional section fragment). Mutable branch,
  different-version, missing and ambiguous targets remain unresolved evidence.
- Possible overlaps is separate from references: identical full Markdown and
  weak normalized-name/description matches offer provenance and reader links.
  They do not establish semantic equivalence or recommend removal.
- Full source is preserved, with safe Markdown rendering and inert remote images.
- Plugins show declared skills, apps and MCP servers without connecting or
  installing them. Usage is explicitly unconnected.
- Personal access is read-only. Proposal endpoints deny writes. The earlier
  branch/PR adapter remains a tested historical capability, not an active grant.
- Imports preview shelves/count/revision before explicit confirmation. Personal
  confirmation checks access and the previewed revision again before saving.
- Graph fits the available canvas and opens a separate inspector. Read skill
  opens the complete Library reader; Back to graph preserves the view. Small
  screens use sequential list/reader navigation and a keyboard source drawer.
  The mobile drawer also provides the application source link on GitHub.

## Separate UI/UX design study

The [September 2026 design study](design/atlas-uiux-study/README.md) is a
standalone, fictional-data prototype, not an application update. It includes
the reference audit, HTML/CSS observations, onboarding and interaction examples,
and the original bounded review evidence. Run it locally without installing
dependencies:

```sh
node design/atlas-uiux-study/serve.mjs
```

Open the loopback address printed by the server. The study is not part of the
application build or Pages deployment and makes no repository or account calls.
Its snapshot is retained byte-for-byte; the original file hashes and review
limitations are in [the review](design/atlas-uiux-study/REVIEW.md).

## Agent access

The personal account's **Connect your agent** section gives this installation's
`/mcp` URL. A supporting remote MCP client discovers Atlas OAuth, registers a
bounded public client, opens GitHub login and requests explicit `atlas:read`
consent. Atlas shows the client, installation, numeric account and disclosure
that requested content goes to the chosen agent/model environment.

Five tools provide connection identity, accessible saved sources, metadata-only
search within one source, one explicit skill and its relation evidence. Reads
include stable IDs, actual SHA, provenance and ordinary browser links. Source inventories
explicitly report `complete: false` with a generic warning when any saved source
cannot be checked; omitted sources disclose no denied metadata. Opening a
link preserves account/source/skill through login; a hidden source requires an
explicit temporary view. Unknown writes and GitHub token passthrough are denied.

Browser sign out leaves consented agents active until upstream expiry (at most
eight hours). **Disconnect** immediately denies that agent; **Sign out everywhere**
revokes all browser and agent access. A failed sign-out clears local content
immediately; Retry preserves the selected browser-only or global operation.
Reconnect requires fresh consent. See
[security](docs/security.md) and [operations](docs/operations.md) for limits and
[dependency notices](public/third-party/mcp-server-2.0.0.txt) for actual MCP terms.
No real Codex connection or native conversation-to-browser result is claimed.

Local proof commands use only synthetic provider data on `127.0.0.1:8790`:
`npm run proof:agent` exercises real HTTP/standard MCP/D1/KV;
`npm run browser:agent` exercises native approval/cancel, login return, private
two-profile SDK links, stale/deleted paths and global sign-out retry. Its failure
report records the stage and sanitized CSP/console diagnostics.
The browser fixture owns a real callback listener at `127.0.0.1:4199`, binds
callbacks to the expected client's state, and refuses an occupied port. The HTTP
proof also checks that listener's rejection and replay behavior. Run these
separately from other fixture suites because they share the ports.

## Local development

Use Node 22.21.1 (supported range `>=22.21.1 <23`) and the lockfile:

```sh
npm ci
npm run build:worker:client
npm run db:migrate:local
npm run dev:worker
```

The Worker listens at `http://127.0.0.1:8787`. It fails closed until configured;
its explicit `/?demo=1` route still opens the public demo.
[Operations](docs/operations.md) covers GitHub App configuration, independent
databases, secrets, health, migration and the local-only synthetic fixture.
[Technology](docs/technology.md) records the official auth/platform fit evidence.

The old Node admin product is retired: `ATLAS_ADMIN_PASSWORD`, `GITHUB_TOKEN`
and `ATLAS_COOKIE_SECURE` cannot enable private access or proposals.
`npm run dev` remains a public UI development preview; `npm run boot` builds
and serves the deprecated public-only Node preview at port 4173.
[Migration and recovery](docs/recovery.md) explain the boundary.

## Public demo and static artifact

```sh
npm run build:static
npm run preview:static
```

The separate static artifact works at `/` and `/Skills-Atlas/`. It attempts
a bounded anonymous read of the default repository, supports opt-in public
imports, and falls back to a labelled fictional `Offline example` when offline,
unavailable or rate-limited. It has no personal session or private source.

The existing SHA-pinned manual [Pages workflow](.github/workflows/pages.yml)
publishes only `dist/static`; [public/CNAME](public/CNAME) retains the release
target. It is the public demo delivery route until a separately authorized
Worker cutover. No deployment or DNS change is part of this candidate.

## Verification

With real local credentials present, use the isolated domain/render-contract
suite: `node_modules/.bin/vitest run --config vitest.domain.config.ts`.
It uses a new empty env directory and never loads Wrangler. Type checking and
scoped lint are also safe. Full checks below belong in a clean manifest-verified
copy when the working root contains real credentials/state.

After that clean-copy build, the lead can run
`node --import tsx scripts/browser-repository-proof.mjs` for the new six-source
fixture, then the same command with `--uneven` for the 3/21/4/8/2/6 regression.
It owns port 4185 and a disposable browser, blocks remote requests,
and writes `proof/repository-graph/report.json` plus screenshots. It checks
screen-size labels, swatches, directed references, reader navigation, overlap
separation, hide/recovery and mobile flows. Revised assertions also check composed
text stroke, unobscured direct-neighbor endpoints/identities, hover/manual camera
continuity and identifying collapsed overlap summaries. Its report explicitly leaves visual
acceptance to inspection. Run it separately from performance proof on 4185;
the existing suites and performance budgets remain required.

Both browser suites use Playwright's pinned Chromium headless shell, without a
normal Chrome profile. Fresh setup requires `npx playwright install --with-deps
--only-shell chromium` (system dependency installation may require administrator
access on Linux). Local evidence uses macOS arm64 and Node 22.21.1; other supported
Playwright platforms require their own execution evidence. The minimum also
satisfies the locked ESLint and optional Linux native dependency engines.

```sh
npm run check
npm run docs:check
npm run security:check
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run proof:worker
npm run browser:proof
npm run browser:personal
git diff --check
```

`check` includes client/server/Worker types, domain and real Worker/D1 tests,
all client builds and a Worker dry-run bundle. `proof:worker` rehearses local
HTTP login, two users, denial, restart and SQL restore using synthetic data.
Both browser scripts use deterministic fixtures; the personal journey runs
the actual Worker OAuth/session/D1 path. No real provider writes occur.
Static proof resolves the document's declared icon href and explicitly loads and
decodes it in the browser at both base paths. Its report separates this asset
probe from any automatic favicon responses; it requires local delivery, a
successful response and nonzero decoded dimensions.
The lead runs browser proof when the worker sandbox cannot launch Chromium.

For G independent UI review, run these sequentially from the repository after
the full check above. Public/static proof owns ports 4175–4177, personal and
agent fixtures share 8790, agent callback owns 4199, and performance owns 4185.

```sh
npm run browser:proof
npm run browser:personal
npm run browser:agent
node scripts/browser-performance.mjs . candidate
node scripts/keyframe-manifest.mjs
```

The last command requires fresh successful browser reports and hashes the
required PNGs into `proof/runtime/phase-g-keyframes.json`. Inspect those frames
against [design](docs/design.md); capture does not constitute visual approval.
The public journey measures composed text contrast and exercises 820/390px
navigation plus a CDP model of 200% desktop zoom/reflow. That model includes
functional reader/Back checks, but native browser chrome zoom remains a separate
lead check. Performance uses the measured E workflow and the bounded budget in
[Spec](docs/spec.md#measured-e-baseline-and-g-comparison-budget).

For an exact-source self-host rehearsal outside AIOS, run
`node scripts/selfhost-snapshot.mjs`. It creates a manifest-verified copy,
installs from the lockfile with isolated configuration, exercises a different
operator allowlist/public default and independent restore, and records the
native browser command for lead execution. See the [operator guide](docs/operations.md#exact-source-self-host-rehearsal).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) and report concerns through
[SECURITY.md](SECURITY.md). [Security](docs/security.md) defines the private
content/public-history hold, session and provider boundaries.

`package.json` intentionally has `"private": true` to prevent accidental npm
publication; it does not describe GitHub repository visibility.
