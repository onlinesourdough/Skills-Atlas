# Ownership

## Canonical Project

- Name: Online Sourdough Skills Atlas
- Outcome: Provide a public-first, self-hostable Skills Atlas that distributes Online Sourdough skills and lets teams inspect, govern, connect, and deploy their own Git-backed skill library safely.
- Technical source of truth: this repository
- Lifecycle owner: Project owner role, represented by the AIOS lead during
  Build/Review and by the receiving operator after an authorized handoff

## Responsibilities

Record one owner for each material responsibility, data source, external
dependency, trust boundary, and operational decision. Link to the authoritative
contract rather than copying it into this record.

| Responsibility   | Source of truth                                             | Owner              | Failure or escalation route                      |
| ---------------- | ----------------------------------------------------------- | ------------------ | ------------------------------------------------ |
| Project outcome  | [README.md](../README.md)                                   | Project owner role | AIOS lead before a lifecycle decision            |
| Implementation   | This repository                                             | Build maintainer   | Project owner role; review gate                  |
| Operation        | [operations.md](operations.md)                              | Receiving operator | Health failure or source warning                 |
| Recovery         | [recovery.md](recovery.md)                                  | Receiving operator | Stop, rebuild, fallback rehearsal                |
| Bundled data     | [src/data/bundled-skills.ts](../src/data/bundled-skills.ts) | Build maintainer   | Review any content/source change                 |
| Mounted Git data | Operator-selected `SKILLS_REPO_PATH`                        | Receiving operator | Source adapter warning; use bundled fallback     |
| Design direction | [design.md](design.md) and approved handoff                 | Project owner role | Review visual/accessibility drift                |
| Static artifact  | `dist/static` contract and manual Pages workflow            | Build maintainer   | Rebuild/review; publish only with Ship authority |
| Public release   | Canonical remote, Pages environment, custom domain, and DNS | Project owner role | AIOS lead/owner Ship gate                        |

## Boundary

The Project is canonical after creation. Context providers and adjacent
repositories may be referenced as inputs, but they do not own this Project's
runtime truth.

No person-specific measurement owner was supplied in the upstream Build
contract. Long-term adoption measurement is therefore pending an owner
decision; acceptance evidence for this Build is owned by the AIOS lead's
Review gate and recorded in [proof.md](proof.md).

The authorized initial and corrective Ships established the canonical public
remote and current Pages release recorded in [proof.md](proof.md). The Project
owner role owns that release state, custom-domain verification, and DNS. The
current post-Ship record edits are an unstaged evidence handoff only; they do
not mutate the published release without a later owner-authorized Ship.
