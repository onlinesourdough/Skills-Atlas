# Online Sourdough Skills Atlas

Build and operate the smallest independent Project that creates this outcome:

> Provide a public-first, self-hostable Skills Atlas that distributes Online Sourdough skills and lets teams inspect, govern, connect, and deploy their own Git-backed skill library safely.

## Start

Read this file and [README.md](README.md), then only the canonical documents
needed for the requested change. This repository owns an independent lifecycle;
revisit that boundary only when the change affects ownership. Use the
project-local Spec when material scope, ownership, boundaries, acceptance, or
contracts remain unclear. A resolved local mechanical edit needs no new Spec
or technology decision.

Ask one question only when a missing owner decision materially changes the
Project. Keep resolved context intact and record technical inferences locally.

## Route

| Work                                                     | Skill                                       |
| -------------------------------------------------------- | ------------------------------------------- |
| Technical scope, boundaries, proof, or contracts         | `.agents/skills/spec-project/SKILL.md`      |
| New or materially changed technology decision            | `.agents/skills/choose-technology/SKILL.md` |
| Implementation                                           | `.agents/skills/build-project/SKILL.md`     |
| Correctness, security, simplicity, and proof review      | `.agents/skills/review-project/SKILL.md`    |
| Authorized delivery, deployment, activation, or recovery | `.agents/skills/ship-project/SKILL.md`      |
| Periodic whole-repository health check                   | `.agents/skills/audit-project/SKILL.md`     |

The Project-owned shelf and its boundary are indexed in
[Project-local skills](.agents/skills/README.md). Generic cross-project skill
discovery, installation, and updates use an optional manager installed by the
calling environment or its current harness/plugin mechanism, outside this
Project payload.

Keep one lifecycle record across Spec, Build, Review, revisions, and any
authorized Ship. The Project repository is canonical after creation.

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
