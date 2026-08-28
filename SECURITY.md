# Security policy

Please report suspected vulnerabilities through GitHub’s private vulnerability
reporting for
[onlinesourdough/Skills-Atlas](https://github.com/onlinesourdough/Skills-Atlas/security/advisories/new).
Do not include credentials, private skill content, unpublished revisions, or
other sensitive data in a public issue.

Include the affected surface, reproduction steps, impact, and any safe evidence
needed to understand the report. We do not publish a guaranteed response or fix
window; the repository owner will assess reports according to severity and
available evidence.

Security-sensitive areas include the self-hosted admin/session boundary,
server-only GitHub credentials, repository/path/Markdown validation, anonymous
existence-safe errors, permission and stale-SHA checks, branch-plus-pull-request
writes, safe Markdown rendering, static artifact privacy, and GitHub Pages
supply-chain configuration.

Only the current repository state is covered. Self-hosting operators remain
responsible for TLS, access proxying, environment permissions, least-privilege
GitHub token scope, rotation, and process updates. See
[docs/security.md](docs/security.md) for the full trust model.
