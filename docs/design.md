# Design translation

The r4 receiving design is a calm, warm-neutral repository control surface,
structurally near the retained Remy evidence without copying its brand,
proprietary assets, prose, or private data. The Agentic Design System and
Notion observations contribute hierarchy through typography and whitespace,
soft selected rows, minimal dividers, one readable content column, and one
functional elevated layer. This repository owns the result; external design
evidence is not a runtime dependency.

## Visual idea

**A quiet index over Git.** The interface should feel like a clear internal
library: compact enough to scan, open enough to understand, and explicit about
repository/access truth. GitHub stays behind the surface until a person needs
source or pull-request detail.

## Tokens

- Background `#f8f2e8`, surface `#fffaf1`, paper `#fffdf7`, soft surface
  `#f1eadf`, border `#e5d7c6`, strong border `#d4bd9f`.
- Text `#2b1b12`, muted `#806c5c`, quiet `#a28d7b`; terracotta accent
  `#b86f36`, walnut action `#5a3d30`, focus blue `#2b6f98`.
- Restrained graph/category accents accompany labels; color is never the only
  signal.
- Geist Sans carries product, headings, labels, and controls. Geist Mono is
  limited to source paths, revisions, code, and keyboard shortcuts. Geist Pixel
  is not used.
- Body 13–14px/1.5, labels 10–12px, product headings 18–24px. No
  marketing-scale headline appears inside the shell.
- Controls use 6–9px radii. Selected rows use a soft warm background. Borders
  appear only where they clarify a structural edge or input. Shadows belong to
  dialogs and the graph selection layer.

## Composition

- The 52px desktop header is a three-column grid. Its `Skill Atlas` cell is
  exactly the 176px taxonomy-rail width; Graph/Library/Usage begin at the exact
  main-canvas x coordinate. Search is quiet; a restrained accessible GitHub
  source link sits immediately before the honest far-right account control,
  and the redundant skill count is absent.
- Desktop uses the fixed taxonomy rail for categories and `Plugins`. The rail
  is a navigation/filter edge, not a second source-status dashboard.
- Graph owns the canvas. Only imported skills and declared relations render.
  Category selection retains every category, node, and edge while emphasizing
  the selected category and muting the rest. `All skills` restores full
  emphasis. Zoom/pan/reset and a small selection layer remain functional.
- Library uses a borderless Notion-like skill list with soft hover and one soft
  selected row. Repository, path, access, branch, and revision collapse into a
  subdued source line/details disclosure. Relations and rendered/full-source
  tabs remain quiet. Complete Markdown reads in one comfortably bounded column;
  verified editing preserves and proposes the full source.
- Usage is a centered 720px reading column. Honest unconnected usage comes
  first; bounded repository-health rows follow. There are no vanity cards,
  badges, or invented activity.
- Plugins is the only import/select/access surface. A compact guide explains
  that a plugin is a Git-backed collection containing skills and possibly
  declared apps or MCP servers; Atlas shows only declarations present in
  `.codex-plugin/plugin.json`. Skill count, source-backed extension labels,
  active state, revision, and `Read only`/`Can edit` remain available without
  equal-weight metadata boxes.
- Startup calmly attempts `onlinesourdough/Skills`. Provider success becomes
  the active read-only plugin with its actual revision and inventory. Failure
  leaves one small status with Retry and the visibly unattributed
  `Offline example`, labelled `Built-in fictional demo · available offline ·
not repository data`. The fallback uses only original public-safe content.
- Account state opens one small elevated dialog. It never claims a GitHub
  identity: static is `Public`; Node can be signed out or authenticated admin.
- Onboarding is a true viewport-fixed pre-product layer. At 1440×900, one
  approximately 560px elevated paper card is centered on the warm-neutral
  canvas with generous whitespace. Skip, original atlas-dot mark, causal copy,
  useful diagrams, progress dots, back/next, and final `Explore Atlas` /
  `Import repository` actions all live inside the card. The application shell
  is not shown behind it. At 390×844 the 360px card remains centered and every
  control stays in the viewport.
- At 820px the rail becomes an inert-when-closed drawer, tabs remain reachable,
  Library stacks, Graph becomes a relationship list, and all screens avoid
  horizontal overflow.

## Components and states

Global search opens with Cmd/Ctrl-K, searches the active plugin, supports empty
results, Escape, focus restoration, and skill navigation. Plugins handles
loading, invalid input, unavailable/private, rate limit, oversized/invalid,
provider failure, success, source declarations, and active selection. Library
handles complete Markdown, no selection, read-only, verified-write, validation,
stale source, duplicate branch, proposal success, and provider failure. Usage
distinguishes unconnected from connected data; this revision ships the honest
unconnected state.

All interactive meaning is available without hover. Focus is clearly blue;
dialogs trap and restore focus; reduced motion removes transitions; mobile
drawers are inert while closed. Markdown headings, lists, tables, code, links,
and quotes remain readable, while raw HTML and remote images do not execute.

## Do / do not

Do keep repository and permission facts close to actions, use source-backed
content, let whitespace separate regions, and make failure recovery obvious.
Do not display `OS` as decoration, repeat metadata labels, build walls of
equal-weight cards, add decorative badges/gradients, invent component
declarations or usage, expose setup/fixtures, restore Ask the Atlas, filter
graph topology through category selection, or attribute authenticated
repository facts to the Offline example.
