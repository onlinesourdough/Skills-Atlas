---
name: ship-project
description: Prepare, release, deploy, activate, and verify a technical solution with a real recovery path. Use after review when publishing an Application, Service, Automation, Integration, Library, or System change, or when changing CI, environments, secrets, migrations, deployment, rollback, replay, or operational ownership.
---

# Project Ship

Ship only reviewed work. A green build is not a deployment result.

Resume the active lifecycle goal after Review PASS; do not create a Ship goal.
For AIOS-originated work, resume the same project-worker goal and return final
evidence to the AIOS lead.

## Establish the release unit

Identify:

- exact commit and immutable artifact
- target environment and deployment owner
- required checks and authority
- configuration and secret ownership
- external service plan, quota, license, and billing owner when material
- migration and compatibility order
- critical journey and failure signal
- rollback, replay, disable, restore, or reconciliation path
- operational owner
- outcome signal, measurement owner, and next measurement point
- recovery point and recovery time expectations when state or continuity makes
  them material

Ask before a production release, external publication, workflow activation,
destructive migration, or other consequential action unless the user already
gave specific authority.

## Keep delivery proportional

- Install from the lockfile and run the repository's real checks.
- Use CI to make required build, test, validation, and security evidence
  repeatable. Automate deployment only when authority, verification, and
  recovery are equally explicit.
- Give CI and runtime credentials least privilege.
- Keep secrets out of code, logs, artifacts, and untrusted change execution.
- Pin third-party workflow actions to reviewed immutable versions.
- Confirm that the selected external plans and quotas support the release, and
  assign usage or billing alerts when an overage can interrupt service or
  materially change cost.
- Add environments, artifacts, migrations, and automation only when the
  solution actually has them.

## Release and verify

1. Build the exact artifact from the reviewed commit.
2. Apply configuration and compatible state changes in the documented order.
3. Deploy or publish without activating when the platform allows separation.
4. Read the actual platform result.
5. Verify expected version, health, critical journey, interfaces, assets, logs,
   failure visibility, and recovery in the target environment.
6. Activate only after the gate passes.
7. Stop, disable, roll back, or recover when verification fails.

Shape-specific proof:

- **Application:** real browser journey, assets, server boundaries, and
  rollback or reproducible redeploy.
- **Service:** health, caller contract, dependency failure, and previous
  artifact or forward recovery.
- **Automation:** safe run, published version, credentials, retries, replay,
  error channel, activation owner, and kill switch.
- **Integration:** both ends, delivery acknowledgement, timeout, retry, and
  reconciliation.
- **Library:** immutable package or artifact, clean consumer install, public
  interface, compatibility, and previous-version recovery.
- **System:** reviewed technical truth, desired state, drift signal, ownership,
  incident route, and a validated rebuild or restore; no fake runtime
  deployment.

A backup is recovery evidence only after its restore path has been tested.
Document retention and access ownership. Keep secrets out of repositories,
artifacts, and ordinary backups.

## Report three independent results

- **Delivery — PASS or FAIL:** the reviewed artifact was built and deployed,
  published, or applied correctly.
- **Recovery — PASS, FAIL, or NOT APPLICABLE:** rollback, restore, rebuild,
  replay, or reconciliation was verified for the solution's risk.
- **Outcome — PASS, FAIL, or PENDING:** the agreed business or operational
  signal was measured. Tests can prove behavior and delivery, not an outcome
  whose measurement window has not elapsed.

Do not call a solution production-ready when required recovery evidence is
missing. Report the commit, artifact, environment, platform result, smoke
evidence, all three statuses, and any remaining operational risk. Complete the
project goal only after its delivery, recovery, outcome obligations, and
handoff pass; the owning lead completes its goal after all final evidence.
