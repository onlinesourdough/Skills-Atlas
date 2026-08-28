# Skill Atlas

Skill Atlas is a public-first, self-hostable way to understand and operate a
Git-backed skills library. It gives non-technical teammates a graph, searchable
library, complete Markdown reader, repository health view, plugin imports, and a
permission-aware pull-request workflow while GitHub remains the source of truth.

- Release target: [skills.onlinesourdough.com](https://skills.onlinesourdough.com)
- Default skills source: [onlinesourdough/Skills](https://github.com/onlinesourdough/Skills)
- Application source: [onlinesourdough/Skills-Atlas](https://github.com/onlinesourdough/Skills-Atlas)
- [Issues](https://github.com/onlinesourdough/Skills-Atlas/issues) · [MIT license](LICENSE)

On startup, Atlas attempts a bounded anonymous read of `onlinesourdough/Skills`.
Once that repository is safely public, a successful read becomes the active,
read-only default and shows the observed GitHub revision and complete current
inventory. If GitHub is unavailable, private, offline, or rate-limited, Atlas
keeps working with a clearly labelled `Offline example`. That fictional
fallback is not live repository content.

Lead Review passed for r4. The startup success path is proven with deterministic
GitHub fixtures; the public Skills anonymous production read, Pages run and
deployment, custom domain, DNS, and TLS remain pending until their later Ship
steps verify them.

## What it includes

- **Graph** renders only loaded skills and source-backed relations. Category
  selection changes emphasis without removing topology; desktop supports
  selection and pan/zoom, with a readable mobile fallback.
- **Library** filters skills, safely renders complete Markdown, preserves full
  source, and exposes repository, path, revision, relations, and effective
  access without duplicating GitHub as a content store.
- **Usage & health** says when usage telemetry is not connected and computes
  only repository-health signals supported by loaded data.
- **Plugins** imports public GitHub repositories without a credential and shows
  source-declared skills, apps, or MCP servers plus `Read only` or `Can edit`.
- **Self-hosted proposals** are available only after an Atlas admin session and
  verified GitHub write permission. Atlas creates a branch and pull request; it
  never writes directly to the default branch.

## Local development

Node 20.19 or newer is required.

```sh
npm ci
npm run dev
```

Build and run the complete self-hosted unit:

```sh
npm run boot
curl -fsS http://127.0.0.1:4173/api/health
```

The default listener is `http://127.0.0.1:4173`. With no optional environment
configuration, Node mode remains public and read-only. See
[`.env.example`](.env.example) and [operations](docs/operations.md) for the
admin/session, private-read, TLS, and least-privilege token boundary.

## Self-hosted configuration

| Value                   | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `ATLAS_ADMIN_PASSWORD`  | Independent admin sign-in for private reads and proposals |
| `GITHUB_TOKEN`          | Server-only GitHub credential; never sent to the browser  |
| `ATLAS_COOKIE_SECURE=1` | Required when the browser reaches Atlas over HTTPS        |
| `HOST`, `PORT`          | Listener; safe defaults are `127.0.0.1` and `4173`        |

Logged-out Node imports deliberately omit the configured token, so anonymous
users cannot probe private repository existence through an operator credential.
GitHub 404 becomes the generic `Repository unavailable or private` response.
The browser never asks for or stores a GitHub token.

The Node process does not terminate TLS or provide an access proxy. A
self-hosting operator owns HTTPS, network access, environment permissions,
token scope/rotation, and process supervision. See [security](docs/security.md)
and [recovery](docs/recovery.md).

## Static release and GitHub Pages

Build the credential-free artifact with:

```sh
npm run build:static
npm run preview:static
```

`dist/static/` works at both `/` and `/Skills-Atlas/`. It includes the canonical
repository identifier needed for anonymous startup and the fictional offline
fallback, but no GitHub credential, unpublished skill body, withheld revision,
owner-local path, or write endpoint.

GitHub Pages is the single public deployment owner. The SHA-pinned manual
workflow in [pages.yml](.github/workflows/pages.yml) publishes `dist/static`,
and [`public/CNAME`](public/CNAME) declares `skills.onlinesourdough.com`. The
receiving Simply DNS CNAME target is `onlinesourdough.github.io`; this pre-Ship
finalization does not change or verify Pages or DNS.

## Verification

```sh
npm run check
npm run docs:check
npm run security:check
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run browser:proof
git diff --check
```

Browser proof uses local deterministic GitHub fixtures and intercepted proposal
responses. It exercises desktop/mobile onboarding, canonical startup, Graph,
Library, Usage, Plugins, fallback/retry, permissions, safe Markdown, GitHub
navigation, and both static URL roots without creating a remote branch or pull
request. Evidence is summarized in [proof](docs/proof.md).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Report
security concerns through [SECURITY.md](SECURITY.md), not a public issue.

`package.json` intentionally has `"private": true` to prevent accidental npm
publication. That npm safety flag does not mean the GitHub source repository is
private.
