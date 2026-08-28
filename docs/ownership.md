# Ownership

## Canonical Project

- Name: Skill Atlas
- Outcome: provide a public-first, self-hostable interface that helps teams
  understand and safely improve Git-backed skill libraries.
- Application source of truth: this repository.
- Skill-content source of truth: each imported GitHub repository.
- Lifecycle owner before handoff: project owner at the authorized Ship gate.
- Runtime owner after an authorized handoff: receiving operator.

The Project owns one independent application lifecycle. An imported repository
does not own Atlas operation, and Atlas does not become a competing source for
its skills.

## Responsibilities

| Responsibility                                | Source of truth                                            | Owner                   | Failure or escalation route                               |
| --------------------------------------------- | ---------------------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| Outcome and boundaries                        | [spec.md](spec.md)                                         | Project owner role      | AIOS lead before lifecycle/authority change               |
| Implementation and tests                      | This repository                                            | Build maintainer        | [review.md](review.md) gate                               |
| Product/design behavior                       | [design.md](design.md)                                     | Build maintainer        | Browser proof and owner Review                            |
| Public-safe Offline example                   | `src/data/bundled-skills.ts`                               | Build maintainer        | Content/security Review before change                     |
| Imported skill content                        | Imported GitHub repository                                 | Repository owner        | Provider access or source correction                      |
| GitHub availability/API behavior              | GitHub                                                     | Receiving operator      | Retain active plugin; inspect provider status/rate limits |
| Admin password/token scope and rotation       | Operator environment                                       | Receiving operator      | Revoke/rotate, restart, and reauthenticate                |
| TLS and network access boundary               | Operator infrastructure                                    | Receiving operator      | Access proxy/TLS incident process                         |
| In-memory sessions and browser plugin state   | Running Node/browser session                               | Receiving operator/user | Restart/reload and re-import                              |
| Proposal branch/PR review and orphan branches | Imported repository                                        | Repository owner        | GitHub review or authorized cleanup                       |
| Build, health, logs, and recovery             | [operations.md](operations.md), [recovery.md](recovery.md) | Receiving operator      | Stop/rebuild/restart; retain source truth                 |
| Static release and GitHub Pages               | `dist/static`, manual workflow, `public/CNAME`             | Project owner role      | Separate Review/Ship authorization                        |
| Simply DNS CNAME                              | `skills.onlinesourdough.com` → `onlinesourdough.github.io` | Receiving DNS owner     | Ship verification or DNS rollback                         |

## Credential and data boundary

The receiving operator owns `ATLAS_ADMIN_PASSWORD`, `GITHUB_TOKEN`, environment
permissions, and least-privilege repository selection. The Build maintainer
does not receive or record them. Private repository source may exist in process
memory and the authenticated browser view only after an authorized self-hosted
read; it must not be copied into the checked-in Offline example, proof records, static
artifact, or logs.

The `Offline example` is original fictional product content. It is not exported
from, attributed to, or inferred from the anonymously unavailable canonical
repository.

## Delivery boundary

Lead Review passed for r4. The project owner owns source publication and the
later Pages deployment/run, custom-domain, DNS, and TLS verification, which
remain pending and unverified until their Ship steps.

Long-term adoption measurement still has no named owner or window. The product
therefore makes no usage claim; acceptance is behavior/security evidence in
[proof.md](proof.md).
