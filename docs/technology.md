# Technology decision

Decision: retain one TypeScript deployable using React 19, Vite 6, and Node's
built-in HTTP runtime. Add GitHub REST as the provider edge and focused safe
Markdown rendering dependencies; add no framework, database, OAuth service,
queue, container, or runtime AI. Recorded 2026-08-27 and confirmed for r4 on
2026-08-28.

## Responsibility choices

| Responsibility       | Choice                                                        | Owner / source of truth                             | Fit, burden, and exit                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser product      | Build: existing React + Vite                                  | This repository                                     | Existing component/build owner fits the dense responsive shell. It remains replaceable because contracts are plain JSON and GitHub stays canonical.                                                                                                         |
| Safe Markdown        | Buy: `react-markdown` + `remark-gfm`                          | Locked npm packages; source remains GitHub Markdown | Raw-HTML refusal, inert image rendering, safe URL handling, and maintained GFM parsing materially reduce renderer risk. Both are MIT licensed. Remove by replacing the bounded reader component and rerunning source-safety/browser proof.                  |
| YAML frontmatter     | Buy: `yaml`                                                   | Locked npm package; parser contract is local        | A maintained Core-schema parser with alias limits replaces ad hoc frontmatter parsing. Version 2.9.0 is ISC licensed and clears the known deep-nesting advisory. Remove by preserving the same parser failure contract and rerunning provider/source tests. |
| GitHub reads/writes  | Rent: official GitHub REST API                                | GitHub repository content and permissions           | Avoids a new content store. Public reads need no token; private/write calls use server configuration only. Failure is bounded and the Offline example preserves public use. Replace with another Git provider behind the same plugin/proposal contracts.    |
| Admin boundary       | Build: environment password + memory session cookie           | Self-host operator                                  | One local owner and no persistence justify a small fail-closed boundary. Restart revokes sessions. TLS/access proxy remains the operator's network responsibility.                                                                                          |
| Plugin state         | Build: browser memory                                         | Active browser session; GitHub remains canonical    | No database is needed for import/select. Reload retries the live default and retains an Offline example on failure. A persisted registry requires a separate owner decision.                                                                                |
| Usage & health       | Build: deterministic repository checks + empty usage contract | Loaded plugin                                       | No telemetry source is supplied, so the UI reports unconnected usage and computes only observable health. No event store is added.                                                                                                                          |
| Validation and proof | Reuse: TypeScript, Vitest, ESLint, Prettier, Playwright       | Repository scripts                                  | Existing checks own contracts and browser journeys. Deterministic transports prove writes without remote mutation.                                                                                                                                          |
| Delivery             | Reuse: Node process and relative-base static artifact         | Self-host operator / GitHub Pages                   | Node serves private capability. The public static release remains credential-free and dual-root; the pinned manual Pages workflow is the single public deployment owner.                                                                                    |

## Provider fit evidence

An authenticated checkout does not prove public visibility. On 2026-08-27,
anonymous raw requests for the authenticated `onlinesourdough/skills`
observation returned HTTP 404. At r4 Build the source is therefore still
private/unavailable: no source bytes or newly observed revision are compiled
into the browser, and unauthenticated 404 never discloses whether a repository
exists. The application now attempts the canonical repository automatically;
the success path is deterministic-fixture proven only. Failure uses the clearly
fictional, unattributed `Offline example`.

The adapter uses official GitHub repository, branches, Git trees/blobs,
contents, refs, and pull-request REST resources. GitHub's documented primary
rate limit is surfaced rather than retried indefinitely; GET retries are
bounded and writes are not automatically retried.

- [REST API for repositories](https://docs.github.com/en/rest/repos/repos)
- [REST API for branches](https://docs.github.com/en/rest/branches/branches)
- [REST API for Git trees and blobs](https://docs.github.com/en/rest/git)
- [REST API for repository contents](https://docs.github.com/en/rest/repos/contents)
- [REST API for Git refs](https://docs.github.com/en/rest/git/refs)
- [REST API for pull requests](https://docs.github.com/en/rest/pulls/pulls)
- [REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

The operator burden is one optional GitHub credential, one independent Atlas
admin password, TLS/access-proxy ownership when network-exposed, dependency
updates, and orphan proposal-branch recovery. No provider plan or paid feature
is required for public repositories. Private repository availability and token
permissions are operator/provider decisions.

## Contracts, failure, and verification

- Types/runtime validators own internal plugin payloads, manifest component
  declarations, sessions, health, provider errors, and proposals; vendor JSON
  never reaches React unchecked.
- Reads cap repository files, skill files, decoded file size, aggregate source,
  concurrency, timeout, retries, and safe error detail.
- Every private read and write requires both admin session and server token.
  Repository `push` permission is re-verified before edit is offered and before
  the first proposal mutation.
- Proposal flow observes default-branch SHA, rejects stale state, creates a
  named branch, updates one validated skill file on that branch, then opens a
  PR. Duplicate branch and partial provider failure remain visible.
- `npm run check`, docs/security checks, full and production audits, Node
  boot/health, static dual-root, deterministic provider tests, and real browser
  journeys prove build, operation, denial/failure, and recovery. Static artifact
  inspection rejects private source markers, the private observed revision,
  failed-fetch text, owner-home paths, withheld private revision, and
  credential-shaped values while allowing the canonical repository identifier
  required for anonymous startup.

## Update and exit

Dependency updates require license/changelog review, lockfile refresh, full
checks, security scan, audits, and browser proof. GitHub API version headers are
centralized at the provider edge. If GitHub is replaced, preserve the plugin and
proposal domain contracts and keep provider credentials server-side. If admin
sessions need shared or durable state, that is a material new ownership and
technology decision rather than an implicit extension of this file.

Residual risks are GitHub API/rate-limit availability, token scope chosen by
the operator, memory-session loss on restart, and orphan branches after partial
write failure. No specialist capability gap remains.
