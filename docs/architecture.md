# Architecture

The Atlas is one TypeScript codebase with two prepared artifacts. The static
public edition is a React/Vite bundle that always uses the safe bundled
snapshot. The complete self-host edition adds a small Node HTTP server; the
server owns filesystem access and the source trust boundary.

```text
browser
  ├─ static mode: bundled snapshot only
  ├─ Node mode: GET /api/skills ─┐
  └─ Node operator: /api/health  │
                            v
                     Node read API
                            │
                 bounded local adapter
                            │
          SKILLS_REPO_PATH/skills/<slug>/SKILL.md
                            │
                  parser + safe excerpt
                            │
                 fallback on any source error
```

## Browser contract

`src/types.ts` defines the data shared by the browser and server. The browser
validates unknown JSON with `parseSnapshotPayload` before replacing its bundled
state. It renders source content as text, so React escaping remains the final
display boundary. Navigation is a single-page view switch with hash markers;
the server does not need a router or a database.

The public UI is the r2 graph-first product shell: a slim Graph/Library/Usage tab
bar, narrow department/source taxonomy, clustered relation canvas, persistent
library detail/editor pane, centered demo usage surface, global search, and a
floating deterministic Ask panel. Setup and state fixtures remain inside the
same shell. Tour, search, and Ask use native `dialog` elements plus an explicit
focus loop and Escape restoration. The closed mobile taxonomy uses both
`aria-hidden` and native `inert`.

The five bundled departments remain the public graph layout. If a mounted
checkout contains a skill outside those departments, its bounded adapter
category is added to Graph and Library controls rather than silently omitted.

Vite mode `static` is a compile-time boundary. It skips `/api/skills` entirely,
uses the bundled snapshot as normal public behavior, and writes `dist/static`.
The regular client writes `dist/client`, validates `/api/skills`, and safely
falls back when the Node source is unavailable. The browser proof starts both
artifacts and checks that the static edition performs zero API requests.

## Server contract

- `GET /api/skills` returns `{ kind, source, repository, skills, warning? }`.
- `GET /api/health` returns `{ status, source, skills, fallback }`.
- Other `/api/*` routes return a stable safe error. Mutating methods are
  rejected; there is no write endpoint.
- Static assets are served only from the production client directory. Unsafe
  or missing asset paths do not reveal filesystem details.

The API reloads the configured local source for each read. A local source is
accepted only when its root and `skills/` directory are real directories, skill
entries are safe slugs, `SKILL.md` is a regular file, and the parser accepts
the exact bounded `name`/`description` frontmatter shape. One bad entry fails the
source read and activates the bundled snapshot; no partial unreviewed source
is presented.

## Dependency direction

The parser and search/answer rules are deterministic domain code. Data and
filesystem adapters sit at the edge. React components consume typed domain
results. The Node server does not import browser components, and the browser
does not access the filesystem.

## Delivery boundary

The manually dispatched Pages workflow builds and uploads only `dist/static`.
`public/CNAME` records the prepared custom domain and `.nojekyll` disables
Jekyll processing. The workflow, remote, Pages environment, custom-domain
verification, and DNS remain inactive until an authorized Ship.

## Deliberate exclusions

There is no authentication, provider token, OAuth flow, database, queue,
runtime model, telemetry pipeline, Git write, cloud service, or container. Each
would introduce an owner and recovery obligation without being needed for the
first complete public/self-hosted read path.
