# Proof

## Intended outcome

Provide a public-first, self-hostable Skills Atlas that distributes Online
Sourdough skills and lets teams inspect, govern, connect, and deploy their own
Git-backed skill library safely. The Build contract is recorded in
[spec.md](spec.md).

## r2 acceptance evidence

Evidence was refreshed on 2026-08-26 against the preserved r2 candidate. The
ignored `proof/` directory contains disposable screenshots and runtime JSON;
this record keeps the reproducible commands and observations. The current
project-local gate is [review.md](review.md).

- [x] Product shell: the light r2 shell exposes the five-step onboarding,
      Graph/Library/Usage tabs, department/source rail, selectable clustered
      graph, three-region Library with persistent detail/editor denial, ranked
      demo Usage and Quiet skills, subordinate activity, global search, setup,
      six state fixtures, and floating deterministic Ask.
- [x] Mounted-library correctness: custom adapter categories are included in
      graph and category controls; parser slug/description limits now match the
      client snapshot contract. Focused tests read the failures before the
      narrow revision and pass afterward. A disposable `team-helper` checkout
      returned `source: local` with one `Team practice` record; real Chrome
      observed that category and node in Graph, the taxonomy rail, and Library.
- [x] Invalid/denied behavior: 16 deterministic tests cover parser/source,
      contract-adjacent bounds, search, and Ask behavior, including invalid or
      duplicate frontmatter, empty body/source, unsafe slug/path/symlink,
      oversized file, excessive entries, and fallback. The real detail UI
      keeps Save to Git disabled, and the Node API returns a stable 405 for a
      mutating request.
- [x] Node runtime and recovery: `npm run boot` served `/`, `/api/skills`, and
      `/api/health`; bundled health reported 8 skills and `fallback: false`.
      The documented read-only Skills checkout returned 3 local records. A
      configured root without `skills/` returned the bundled 8 with
      `fallback: true`, a bounded `missing-skills-directory` warning, and no
      root disclosure. Restarting without that configuration restored normal
      bundled health and the public route.
- [x] Static Pages behavior: `npm run build:static` produced `dist/static` with
      `CNAME`, `.nojekyll`, and bundled assets. Fresh browser proof observed
      zero `/api/` requests and no false live-source warning. The manual Pages
      workflow remains preparation only and was not run.
- [x] Documentation and security: local links, formatting, secret checks, full
      dependency audit, production dependency audit, and immutable workflow
      action validation pass. No secret marker appeared in the client DOM or
      runtime responses.

## Immutable workflow evidence

The official current major-tag refs were resolved read-only through the GitHub
API and each resulting commit was verified in its public, non-archived action
repository before pinning:

- `actions/checkout@11d5960a326750d5838078e36cf38b85af677262` (`v4`)
- `actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b` (`v5`)
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (`v4`)
- `actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa`
  (`v3`)
- `actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`
  (`v4`)

The existing security validator now rejects mutable third-party `uses:` refs.
It first reported the five moving major tags and passed after the full-SHA
revision. Independent workflow text validation found exactly five expected
pins with major-tag comments, and the YAML parsed successfully.

## Publish-candidate redaction evidence

The public-repository review found four owner-home absolute paths and direct
reference-product identification in [design.md](design.md) and
[spec.md](spec.md). The narrow revision replaced them with stable,
repository-neutral provenance wording while retaining the external-evidence,
no-copy, no-affiliation, and canonical skill-source boundaries. No external
research artifact is presented as shipped or required by this repository.

The security validator now also rejects owner-home path exposure. A separate
bounded scan of every non-ignored publish-candidate path and text file found no
known external reference or media-host identifier, no matching identifier in a
filename, and no research image, recording, or document-media file. The
baseline scan identified four path occurrences and four reference-identifier
occurrences; the post-redaction scans and security gate pass.

## Fresh browser evidence

`npm run browser:proof` passed in the installed Chrome channel at 1440×1000 and
390×844. It exercised all five onboarding pages and deterministic step links;
Graph node and taxonomy selection; Library empty recovery, detail, and public
edit denial; Usage ranking, Quiet skills, and non-live activity; Ask; setup;
global search; dialog Escape/focus restoration; closed/open mobile drawer
`aria-hidden`/`inert` behavior; reverse-tab exclusion; reduced motion;
horizontal overflow; local fonts/assets; browser console/page failures; and
client secret markers.

The structured result is `proof/runtime/browser-proof.json` with an empty
`failures` array. Fresh screenshots are:

- `r2-desktop-graph.png`, `r2-desktop-tour-first.png`,
  `r2-desktop-tour-final.png`, `r2-desktop-library-edit.png`,
  `r2-desktop-usage.png`, `r2-desktop-ask.png`, and
  `r2-desktop-setup.png`;
- `r2-mobile-tour.png`, `r2-mobile-graph.png`, and
  `r2-mobile-library-edit.png`;
- `r2-static-public.png` for the bundled Pages-shaped artifact.

Only `r2-desktop-graph.png` and `r2-mobile-library-edit.png` were loaded for the
minimal visual spot-check. The research reference images remain external
evidence and are not shipped.

## Exact checks

```text
npm ci                              PASS (fresh locked install; dependencies unchanged afterward)
npm run check                       PASS (format, lint, strict types, 3 files / 16 tests, Node + static builds)
npm run docs:check                  PASS
npm run security:check              PASS (secret/publish-safety scan + immutable action refs)
publish-candidate redaction scan    PASS (paths, identifiers, filenames, media)
workflow YAML/text validation       PASS (5 exact full-SHA pins + major comments)
npm run browser:proof               PASS (Node/static desktop/mobile real-browser journeys)
npm run boot                        PASS (build/start/health/read/stop)
npm audit --audit-level=high        PASS (0 vulnerabilities)
npm audit --omit=dev --audit-level=high PASS (0 vulnerabilities)
```

## Unavailable proof and measurement

No live provider, private repository, OAuth grant, token, write, telemetry,
runtime model, Git remote, commit, Pages environment, deployment, publication,
custom-domain verification, or DNS action was available or authorized. These
are explicit Build/Review boundaries, not claimed runtime evidence.

- Outcome signal: public critical-journey completion and successful local
  health/source read during an owner-selected adoption window.
- Measurement owner and window: pending owner assignment; this Build enables
  no telemetry and claims no customer adoption.
