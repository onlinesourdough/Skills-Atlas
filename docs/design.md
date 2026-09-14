# Design translation

## Current repository graph — independent local Review PASS (2026-09-09)

Candidate 1 passed balanced and uneven synthetic functional journeys but failed
lead visual Review. Candidate 2 explicitly clears inherited SVG stroke from
repository/callout text. Intentional selection now fits its loaded visible direct
neighborhood beside the inspector, using screen-space name/repository callouts
and short leader lines. Hover cannot move the camera or replace the pinned
selection's relationships. Overview repository labels give way to these focused
identities while the inspector is open. Layout is not rewritten by selection.

Callout placement avoids direct endpoints and other callouts with a bounded
candidate search, capped at 40 labels. Dense or manually offscreen identities
remain available in References/Referenced by, with an explicit cue. This preserves
the complete relation list rather than shrinking all labels into unreadable text.
Collapsed overlap summaries now identify the candidate, evidence strength and
source context. Exact and weak rationales for the same member set share one
accordion; different sets remain distinct. The overlap entry uses the existing
control colors, border and spacing. Independent lead visual I1–I5 and architecture
P1–P6 Review pass, including balanced/uneven journeys and 820/390 frames.

Lead's real six-source import exposed a new I2/I3/I4 failure: category ownership
collapsed all Uncategorized skills into one color/cluster, and source labels
hid unique repository names. Candidate 2 addresses that brief and now has
independent local browser/rendered acceptance. Local health/assets delivery also
passes. On 2026-09-09, lead real personal-session UI smoke and actual overview/
selected-neighborhood visual I1–I5 passed after manual unlock at 1025×1058,
superseding the pending-unlock checkpoint. Six sources/44 skills/40 references
showed six distinct labelled groups. Six weak normalized-name overlap candidates
exposed evidence and opened the correct complete reader; graph return showed
three incoming edges/callouts with visible endpoints beside the inspector.
Zero resolved cross-repository references does not establish absence of
relationships; exact revision/file matching still applies. At the user's request,
standalone feature development stops here; further work requires a new explicit
scope. Private/native, sharp development dependency
and full H holds remain unchanged; see [proof](proof.md) for scope and identity.

Repository identity now owns clusters and a shared session-stable palette.
The first six sources receive six separated dark hues; a twelve-color palette
eventually repeats, so full identity labels remain essential. The rail wraps
the unique repository name above its complete owner/name. Graph labels are
rendered outside the world-camera transform at 13px (owner/count at 11px),
with full titles, keyboard focus and a full-text repository summary.
Labels and counts therefore remain readable while fitting many skill nodes.

At overview scale, directed curved bridges aggregate each ordered repository
pair. Zoom reveals internal references; selecting/focusing a skill limits edges
to its incident neighborhood, with dashed cross-repository arrows and evidence
in the inspector. The full list provides the same identities without panning.
Possible overlaps opens a separate bounded panel with its matching rationale,
source/revision and reader links. No overlap edges or inferred runtime calls
are added to the graph. See [Spec](spec.md) and [proof](proof.md).

The accepted 2026-09-08 handoff supersedes the historical r4 composition.
G-local received independent rendered and functional PASS on 2026-09-08 at
20:11 UTC. Final 33-frame acceptance combines 24 identical previously inspected
PNGs and direct reinspection of all nine changed frames in the final fresh copy.
The [Spec](spec.md) owns scope, UX01–UX12 and the measured comparison budget;
[proof](proof.md) records exact evidence. C-live, D-native, G-native zoom and
overall H remain OPEN; the held CDP reflow model does not prove native Codex zoom.

## Visual direction and deliberate differences

A quiet index over Git: one compact header, a readable source rail and one
working area. The accepted Remy overview, category-focus, inspector and reader
frames informed the composition. Existing Online Sourdough branding and original
MIT SVG icons remain; no reference branding, art or product copy is shipped.
Geist Sans and Mono are local and covered by the [font license](../public/fonts/LICENSE.txt).
Icons use a shared SVG wrapper and 16/20/24px dimensions.

The deliberate differences are simultaneous source checkboxes, exact GitHub
repository/shelf identities, directed relation evidence, personal GitHub App
authorization and a separately consented agent connection. This candidate is
read-only. It offers no proposal, installation, chat or telemetry grant.
Historical intercepted proposal tests remain a future-policy regression only.

## Tokens and composition

- Paper/background/surface: `#fffdf7`, `#f8f2e8`, `#fffaf1`; restrained warm
  borders. Main text `#2b1b12`, secondary informative text `#665345`, walnut
  actions `#5a3d30`, blue focus `#2b6f98`. The old quiet metadata color was
  too light. Composed text contrast passed the accepted local browser checks.
- Geist Sans for controls and reading; Geist Mono for source paths, SHA and code.
  Scanning text is 13–14px and the complete reader is 16px with generous leading.
- Desktop starts at a 52px header and 224px source rail. Unique repository names
  and full owner/name wrap in the rail; Plugins identities also wrap in full.
  Counts describe visible sources and skills, consistently across views.
- Graph reserves 352px when the 320px right inspector is open, including margins.
  Library has a compact list and a separate complete reader. Reader title/actions
  remain fixed while Markdown scrolls independently; metadata has bounded scroll.
- At 820px and below, sources use an inert-when-closed, focus-managed drawer.
  Graph offers a relationship list; list, inspector and reader are sequential.
  Back to list and Back to graph preserve the relevant navigation state.
- Usage hides the full source rail and centers a quiet reading column. Its
  source scope and repository-health signals are explicit; activity remains
  disconnected, without invented zero runs, rankings or Quiet labels.

## Graph behavior

`GraphView` owns camera, hover and inspector presentation; the domain graph
module owns deterministic placement and measured bounds. Existing coordinates
normally survive source hiding/import; new nodes occupy free repository slots
without a force simulation. Sequential imports use compact available positions.
A growing repository moves as a whole only when its envelope would overlap
another repository. Geometry updates retain the existing selected-node visibility
check. Unauthorized content is removed with its source, including overlap groups.

Initial load fits visible bounds to the measured canvas. Categories retain
all visible-source nodes and focus their category bounds; All removes category
focus, while Reset refits the current category. Intentional node, search and
relation selection fit the stable target ID and its direct visible neighborhood
beside the inspector. Hover/keyboard focus highlight direct neighbors when no
selection is pinned
without moving the camera. Pan/wheel/control zoom interrupt the 300ms camera
animation; reduced motion applies the target immediately.

Resize and source-geometry changes keep an existing selection visible beside
the inspector, even when it belongs to another category. If category fit would
obscure that node, these automatic updates use selected-node framing. Explicit
category/All/Reset actions retain their own framing intent; ordinary Read/Back
does not initiate another fit.

Node sizes do not claim usage or popularity. Labels are reduced at distant zoom;
selected/focused labels remain readable. Category names and the keyboard/list
alternative provide meaning independently of node color and dragging.
Inspector references are directed and show real file/line evidence. Ambiguous
and unresolved evidence is separate and does not create guessed graph edges.

## Reading and navigation

Read skill opens Library with the same exact selection. Back to graph preserves
camera, category and selection. Selecting a different skill in Library or through
search updates the shared target; ordinary tab navigation retains it.
Library sorts alphabetically, disambiguates repository/shelf paths, and shows
Select a skill to read when there is no authorized selection.

The reader renders the complete Markdown with raw-source and exact GitHub/SHA
controls. Code and tables scroll locally. HTML stays inert, remote images do
not load, and relative skill links resolve only within loaded authorized scope.
The stationary reader does not trap focus. Search supports Cmd/Ctrl-K, arrows,
Enter and Escape; dialogs restore focus to their trigger. Browser Back/Forward
and agent URLs use stable IDs without credentials or file bodies.

## Sources, access and account

Import first previews repository identity, shelves, count, skipped-file warnings
and revision. Preview does not save preferences. Explicit confirmation rechecks
personal access and the previewed repository/revision before saving. Cancellation,
expiry, late responses, duplicate sources and denied access have bounded states.
Removal explicitly removes an Atlas preference, not GitHub content or installation.

The real personal login, pending/denied/retry, default-source error, account and
agent-consent pages share the warm palette, local fonts and visible focus.
CSP, same-origin POST, CSRF and literal callback validation remain server-owned.
Disconnect, browser logout and global logout remain different operations.
Private-content clearing and authorization leases apply to every view.

## Render and accessibility gate

Lead executes the deterministic browser scripts on final bytes at 1440×900,
820px and 390×844, with reduced motion, keyboard and zoom/reflow evidence.
The public journey includes fit, selection, camera restoration and computed
contrast; personal/agent journeys include two synthetic profiles, native consent,
private reader, account mismatch and revocation. Screenshots are evidence for
visual inspection, not live provider, native-client or deployment acceptance.

`scripts/ui-evidence.mjs` measures visible solid-color text and composed opacity,
including SVG category fills, and rejects unsupported image/gradient backgrounds.
It is a bounded contrast check, not a complete accessibility certification.
Final keyframes and any remaining visual differences must be reviewed by the lead.
