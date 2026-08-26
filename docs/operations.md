# Operations and self-host setup

## Local and production boot

Install from the committed lockfile, then use the browser-only preview or the
complete Node unit:

```sh
npm ci
npm run dev

# complete self-hostable artifact
npm run boot
```

`npm run boot` runs the reproducible client/server build and then starts the
single process. `npm run start` starts an already-built `dist/` directory.
The default address is `http://127.0.0.1:4173`; stop it with Ctrl-C.

For a networked local deployment, set `HOST` to an intentional bind address
and keep the process behind the operator's normal access/TLS boundary. The
application does not provide authentication or TLS itself.

## Static public artifact

Build and review the provider-free public edition with:

```sh
npm ci
npm run build:static
npm run preview:static
```

The artifact is `dist/static/`. It contains the bundled snapshot, local fonts,
`CNAME` for `skills.onlinesourdough.com`, and `.nojekyll`. Static mode does not
request `/api/skills`, display a false live-source error, accept a mounted
checkout, or expose `/api/health`.

The prepared [Pages workflow](../.github/workflows/pages.yml) is manual-only.
It runs the full local gate, rebuilds the static artifact, and uses GitHub's
official Pages artifact/deploy actions. It has not been run. Creating the
`onlinesourdough/Skills-Atlas` remote, enabling Pages, approving the workflow,
verifying the custom domain, and changing DNS all require a later authorized
Ship.

## Source configuration

Copy [`.env.example`](../.env.example) to an operator-owned environment (do
not commit the copy). `SKILLS_REPO_PATH` is optional and must point to the
checkout root, not directly to `skills/`. The expected shape is:

```text
checkout/
└── skills/
    └── a-safe-slug/
        └── SKILL.md
```

The source file begins with `---`, contains exactly `name` and `description`
frontmatter fields, and has a non-empty Markdown body. The server reads the
source on request. Missing configuration uses the bundled snapshot; a
configured source that is empty, invalid, too large, unsafe, or unavailable
also uses the bundled snapshot and exposes a safe warning in the UI.

## Health and failure visibility

```sh
curl -fsS http://127.0.0.1:4173/api/health
```

Healthy output has the shape `{"status":"ok","source":"bundled|local","skills":N,"fallback":false|true}`.
The health route remains 200 when a configured source falls back: `fallback`
and the browser warning make the degraded but usable state visible. Request
logs are structured and redacted.

## Rebuild and handoff

Run `npm run check` before an artifact handoff. It produces both the regular
client/server build and the static public build. The server-backed local source
and health endpoint require the Node process.
There is no database or persistent application state to back up. The mounted
Git checkout is an operator-owned input and must be backed up by its own Git
remote or filesystem policy.

## Distribution boundary

The Atlas does not install skills into agent harnesses. For supported
project-local distribution, follow the canonical Skills repository's pinned
installer/recovery record and verify the source revision separately. Keep
Atlas application operation and skill payload distribution as two explicit
owner decisions.
