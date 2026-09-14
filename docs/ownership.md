# Ownership

## Canonical Project

- Application owner: this independent Skill Atlas Project and repository.
- Skill-content authority: each imported GitHub repository and its owner.
- Identity/membership/repository-access authority: GitHub, checked server-side.
- Profile/source-preference authority: this deployment's D1, scoped by numeric user ID.
- Agent authorization/revocation authority: user consent and D1 active connections;
  the maintained OAuth provider's KV is protocol storage. The receiving operator
  owns both bindings, limits, backups and restore invalidation.
- Lifecycle owner before handoff: project owner through independent lead Review.
- Runtime owner after authorized handoff: receiving operator.
- Self-host package/rehearsal owner: this repository's canonical Operations guide
  and verification scripts. Temporary snapshot/state belongs to the local proof;
  independent E acceptance remains with the lead. No hosted resource is shared.

Atlas does not become a competing skill master store. Imported repositories
do not own Atlas operation.

## Responsibilities

| Responsibility                          | Source of truth                           | Owner                                        | Failure/recovery route                               |
| --------------------------------------- | ----------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Outcome and accepted scope              | [spec](spec.md)                           | Project owner / lead                         | Resolve material contract gap                        |
| Implementation and evidence             | Repository / [proof](proof.md)            | Sole Build worker, independent lead reviewer | Same lifecycle revision                              |
| Product behavior                        | [design](design.md)                       | Build maintainer                             | Browser proof and owner Review                       |
| Fictional public demo                   | Bundled example                           | Build maintainer                             | Security/content review                              |
| Imported skill source                   | GitHub repository                         | Repository owner                             | Correct source or provider access                    |
| GitHub App configuration and secrets    | Independent operator account/secret store | Receiving operator                           | Revoke/rotate, fresh login                           |
| Membership and App repository selection | GitHub                                    | Account/repository owner                     | Authorized access correction                         |
| Sessions and source preferences         | Independent D1                            | Receiving operator and scoped user           | Clear sessions; restore preferences                  |
| HTTPS, quotas, logs and backups         | Operator infrastructure                   | Receiving operator                           | [Operations](operations.md), [recovery](recovery.md) |
| Static Pages demo                       | Existing manual workflow/CNAME            | Project owner                                | Separate Review/Ship                                 |
| Worker delivery or domain cutover       | Reviewed deployment configuration         | Receiving operator / DNS owner               | Separate action-time authority                       |

## Data and credential boundary

The operator owns App client secret, encryption key and database access.
The Build maintainer neither receives nor records real credentials. A user
authorizes the App personally; an operator token never substitutes for that user.
Private source exists only in authorized request/browser memory. D1 persists
repository preferences and encrypted credentials but no skill body.

Backups contain private metadata and encrypted tokens, so operators must protect
them. Hosted and self-host deployments have separate origins, credentials and
databases. Restoring preferences requires deleting sessions/flows and fresh login.

The Offline example is original fictional content, not an export from the
historically inaccessible Skills source. Its privacy/public-history hold remains
in [security](security.md) and [proof](proof.md).

## Current delivery boundary

Same outcome `atlas-foundation-2026-09-08`, ACTIVE parent goal
`01a06c27-8cb3-7fd3-abb7-e2f803e57d98`. A/B has independent lead PASS.
This sole writer continues C locally; the lead retains browser execution,
independent Review, GitHub App account actions and all live deployment authority.

Allowed work is local source/tests/docs/dependencies, local fixtures and
read-only official research. No commit, push, real provider write,
installation, provisioning, deployment, DNS or D-phase implementation belongs
to this checkpoint. Live personal authorization remains unproven.
The retired Node preview is public-only; it is not a second self-host auth owner.

The existing Pages/CNAME route remains the static demo delivery owner until an
authorized cutover. There is no new live Pages/Worker/DNS/TLS evidence.
Usage measurement still has no accepted owner/window, so the UI claims no usage.
