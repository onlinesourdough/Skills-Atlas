# Online Sourdough Skills Atlas

Build and operate the smallest independent Project that creates this outcome:

> Provide a public-first, self-hostable Skills Atlas that distributes Online Sourdough skills and lets teams inspect, govern, connect, and deploy their own Git-backed skill library safely.

## Start

Read this file, [README.md](README.md), and the canonical context for the
Project. Confirm that this repository owns an independent lifecycle. Run the
project-local Spec before implementation when scope, ownership, boundaries,
proof, or contracts are not already clear.

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
| A concrete specialist capability gap                     | `.agents/skills/manage-skills/SKILL.md`     |

Keep one lifecycle record across Spec, Build, Review, revisions, and any
authorized Ship. The Project repository is canonical after creation.

## Before completion

Verify behavior through the real interface or validator. Run the relevant
format, lint, type, test, build, contract, and security checks. Check failure,
denial, duplicate, and recovery behavior as relevant. Keep the README and
[proof record](docs/proof.md) current with actual evidence.

## Ownership and recovery

Record current responsibility in [docs/ownership.md](docs/ownership.md),
acceptance evidence in [docs/proof.md](docs/proof.md), and the tested recovery
path in [docs/recovery.md](docs/recovery.md). Keep secrets and private data out
of source, logs, exports, and client builds.
