# Online Sourdough Skills Atlas

Build and operate the smallest independent Project that creates this outcome:

> Provide a public-first, self-hostable Skills Atlas that distributes Online Sourdough skills and lets teams inspect, govern, connect, and deploy their own Git-backed skill library safely.

## Shared lifecycle

Use the installed AIOS plugin (0.4.0 or later) for shared procedures:
`aios-spec-work`, `aios-build-work`, `aios-review-work` and `aios-ship-work`.
Spec owns conditional technology selection; Review owns generic repository
health audits. Resolve these skills through the harness, not copied files or
hardcoded cache paths. This repository owns its requirements, specialist
methods, checks, release facts and recovery. Keep those facts here and load
only the phase and local context needed for the change.

Work in the current task by default, including when opened directly from the
sidebar. Use `aios-orchestrate-workers` only for requested or concretely
beneficial delegation, or existing-worker recovery. Verify each selected root
and preserve one writer for overlapping changes. Repository work does not
preload personal AIOS context. Plugin availability is an authoring capability,
not a dependency of the product at runtime; if unavailable, report the method
gap and perform only work adequately covered by the local contract. Do not
recreate generic skills locally.

## Start

Read this file and [README.md](README.md), then only the canonical documents
needed for the requested change. This repository owns an independent lifecycle;
revisit that boundary only when the change affects ownership. Use the
shared AIOS Spec with the local contract when material scope, ownership, boundaries, acceptance, or
contracts remain unclear. A resolved local mechanical edit needs no new Spec
or technology decision.

Ask one question only when a missing owner decision materially changes the
Project. Keep resolved context intact and record technical inferences locally.

The Project-owned shelf and its boundary are indexed in
[Project-local skills](.agents/skills/README.md). Generic cross-project skill
discovery, installation, and updates use an optional manager installed by the
calling environment or its current harness/plugin mechanism, outside this
Project payload.

Keep one lifecycle record across Spec, Build, Review, revisions, and any
authorized Ship. The Project repository is canonical after creation.

## Atlas-specific constraints

GitHub owns imported skill content; this Project owns the Atlas application.
Follow [security](docs/security.md) for current access/proposal policy. Keep
provider reads bounded, Markdown rendering safe, errors existence-safe and logs
redacted. Preserve the fictional public fallback and Skills privacy/public-history
hold. Provider-write proof uses fixtures or interception unless separately
authorized; never automatically retry writes or delete orphan provider branches.

## Before completion

Verify the changed behavior through its real interface or validator. Select
checks from [README.md](README.md) by the affected surface and risk; substantive
application changes require the full relevant suite, including failure, denial,
duplicate, and recovery evidence. For instruction-only or mechanical edits,
validate affected instructions, links, and meaningful regressions. Update the
README when its truth changes and [proof record](docs/proof.md) with actual
evidence, distinguishing local validation from live Ship proof.

## Ownership and recovery

Record current responsibility in [docs/ownership.md](docs/ownership.md),
acceptance evidence in [docs/proof.md](docs/proof.md), and the tested recovery
path in [docs/recovery.md](docs/recovery.md). Keep secrets and private data out
of source, logs, exports, and client builds.

GitHub remains canonical for imported skills. Public/static access is read-only;
private reads require an Atlas admin session and server-only GitHub credential.
Proposals additionally require verified provider write permission and a fresh
source SHA, and use a branch plus pull request, never a default-branch write.
Preserve the Skills privacy/public-history hold in [security](docs/security.md)
and [proof](docs/proof.md); fixture success does not release that hold.
