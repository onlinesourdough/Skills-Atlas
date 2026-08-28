# Contributing

Thank you for helping make Skill Atlas clearer and safer. Start with a focused
[issue](https://github.com/onlinesourdough/Skills-Atlas/issues) for behavior,
security-boundary, dependency, or deployment changes so the expected outcome is
visible before implementation.

## Development

Use Node 20.19 or newer and the committed lockfile:

```sh
npm ci
npm run dev
```

Keep GitHub skill content canonical. Do not add credentials, private repository
content, unpublished revisions, copied proprietary assets, invented telemetry,
or direct default-branch write behavior. Provider writes must use deterministic
tests or browser interception.

Before opening a pull request, run:

```sh
npm run check
npm run docs:check
npm run security:check
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run browser:proof
git diff --check
```

Update the relevant contract and proof records when behavior, operation,
security, or recovery changes. Keep pull requests small, explain the user-facing
outcome, list exact checks, and call out residual risk. By contributing, you
agree that your contribution is licensed under the project’s [MIT license](LICENSE).

For a suspected vulnerability, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.
