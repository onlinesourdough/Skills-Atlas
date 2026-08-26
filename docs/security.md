# Security and permissions

The default security posture is public read-only browsing with a checked-in
fallback. A private operator may mount one checkout, but source access stays
on the server.

## Trust boundaries

- Browser input is untrusted and is used only for local filtering, deterministic
  answers, and view state.
- Markdown from a mounted checkout is untrusted text. It is parsed with a
  small frontmatter grammar and rendered through React text nodes; it is not
  inserted as HTML or executed as code.
- `SKILLS_REPO_PATH` is server configuration. It is never included in an API
  response, browser bundle, error message, or structured log.
- The public setup provider choice is explanatory copy only. No credential is
  accepted, stored, transmitted, or logged.
- Static mode skips `/api/skills` at compile time. Its bundled source is normal
  behavior, so a static host cannot accidentally trigger a private source read
  or leak a configured server path.

## Bounds and denial

The adapter enforces a maximum of 100 directory entries and 128 KiB per
`SKILL.md`, checks every path stays beneath the configured root, rejects root,
directory, and file symlinks, and applies a 1.5 second read timeout. The HTTP
request boundary has a four second timeout. Slugs are limited to 80 characters
and descriptions to 320 characters so a server-accepted local snapshot also
meets the browser contract. Invalid frontmatter, mismatched names, duplicate
fields, empty bodies, unsafe slugs, and malformed files fail the complete local
snapshot and use the bundled fallback.

The HTTP surface accepts reads only. Public edit controls are disabled in the
browser and there is no server mutation path to bypass that presentation.

## Logging and deployment

Logs contain a request ID, route, status, and duration only. They do not log
query strings, source roots, file contents, headers, or credentials. The
default host is `127.0.0.1`; an operator choosing a network bind owns the
network boundary and should place the process behind its normal TLS/access
controls.

Dependency review is performed with the lockfile, `npm audit --omit=dev`, and
the project secret scan. Refreshes must rerun tests, build, docs, security,
and the browser proof before handoff.

The prepared Pages workflow is manual-only, grants `contents: read`,
`pages: write`, and `id-token: write`, and contains no secret input. The
authorized initial Ship ran it once from the public canonical repository. The
current correction Build does not dispatch it. Before any corrective Ship, the
owner must re-review the immutable workflow action commits,
branch/environment protections, domain verification, repository visibility,
and exact candidate commit. `npm run security:check` rejects mutable
third-party `uses:` references; each current full-SHA pin keeps a trailing
major-tag comment for the documented re-resolution path.

## Residual risk

The adapter trusts the operator-selected local checkout and does not verify
Git signatures or commit policy. It reads a bounded point-in-time directory
view and intentionally has no persistence or locking. A future provider
adapter would require a separate authorization and security review; it must
not be inferred from this read-only implementation.
