# Recovery

The receiving operator owns Worker configuration, secrets, D1/KV backups and
provider access. GitHub remains canonical for content. The lead owns the
current local candidate's independent Review and any live action authority.

For the unshipped repository-graph delta, recover by reversing only its bounded
source patch from the lead's reviewed snapshot/manifest. Do not reset or restore
the whole dirty worktree to HEAD: it also contains the previously accepted A–G
and OAuth corrections. No database/configuration migration accompanies this
delta. Hide/denial and reload recovery have synthetic domain evidence; this is
not a live rollback rehearsal. Run full recovery/Worker checks in the lead's
clean copy while real local configuration remains protected.

A failed browser or global sign-out clears private content locally and retains
its selected operation for Retry. Global success revokes browser and agent access;
browser-only success leaves separately consented agents active. The UI reports
pending, failure and confirmed success separately. Reload still performs a fresh
server authorization check; local clearing alone is not proof of server revocation.

## Rebuild and safe fallback

```sh
npm ci
npm run check
npm run docs:check
npm run security:check
npm run proof:worker
```

The explicit public demo and static artifact contain only fictional fallback
content and tokenless public imports. They can remain available while personal
access fails closed. Do not copy private source into the demo to recover service.

Personal source bodies exist only in request/browser memory. D1 holds numeric
profiles, source preferences, a shared encrypted credential vault, hashed sessions,
agent connections, one-use consents and expiring flow/replay guards. OAuth KV
holds provider grants and tokens with opaque connection properties. Worker restart preserves D1/KV and does not revoke
sessions. Browser reload rechecks access and restores saved sources; a removed
default remains removed on later login.

## D1 backup and restore

Back up configuration identity and D1 under operator-controlled access. A SQL
backup contains private repository names and encrypted session credentials;
it is sensitive even though it contains no skill bodies. Store the encryption
key separately. Keep hosted/self-host databases and backups independent.

For the default local state, the pinned Wrangler supports:

```sh
npx wrangler d1 export DB --local --output /tmp/atlas-local-backup.sql
```

Restore into a separately configured target database, then invalidate all
restored sessions, agent connections, credentials and OAuth attempts before serving it:

```sh
npx wrangler d1 execute DB --local --file /tmp/atlas-local-backup.sql
npm run db:migrate:local
npx wrangler d1 execute DB --local --command "DELETE FROM agent_consents; DELETE FROM agent_connections; DELETE FROM sessions; DELETE FROM credentials; DELETE FROM oauth_attempts; DELETE FROM agent_refresh_uses;"
```

These restore commands are for an isolated local target, not the active database.
A live restore needs target-specific operator authority, protected backup
handling and its own delivery/recovery verification. Never restore an old
session table into an exposed service: it can resurrect logged-out cookies.
Profiles/source preferences are retained; users sign in again for fresh access.
Use a fresh/cleared OAuth KV namespace for the restored installation. Even when
stale KV is retained, cleared D1 connections deny old agent tokens immediately.
Never restore credential/connection rows again after invalidation. The local
`proof:agent` checks stale-KV denial across restart; `proof:worker` tests actual
SQL export/import and re-login. A live KV/D1 recovery remains an operator gate.

`npm run proof:worker` exercises this procedure against synthetic data in two
independent local state directories. It verifies migration replay, restart
persistence, SQL export/import, old-cookie rejection and same-profile recovery.
Actual evidence is recorded in [proof](proof.md).

The independent self-host rehearsal also uses different local D1 IDs and fresh
KV for the restored target. `scripts/selfhost-proof.mjs` records its exact configs,
state directories and native Wrangler commands in ignored
`proof/runtime/phase-e-http.json`. Both old browser cookies and the old MCP token
must fail before fresh login/consent recovers the same hidden preferences.
The snapshot driver repeats `npm ci` and reopens this occupied restored state to
check that setup did not reset preferences. D's separate retained-KV regression
continues to test immediate D1 denial even when old KV tokens still exist.

These disposable SQL/config files contain synthetic state only and stay inside
the explicitly reported proof directory. They are retained for independent lead
review. Their success is not live backup, failover or cross-OS recovery evidence.

## Access or credential incident

1. Disable personal access at the operator boundary if compromise is suspected.
2. Revoke affected GitHub authorizations/credentials under account-owner authority.
3. Use Sign out everywhere or delete affected D1 connections, sessions,
   credentials and pending consent/flows; clear matching OAuth grants under operator authority.
4. Rotate the App secret and/or encryption key as required; keep profiles/sources.
5. Rebuild and verify configured health, denied users, fresh login and private reads.

Changing origin, client ID or membership/allowlist policy invalidates old
sessions. Encryption-key rotation makes old ciphertext unreadable and requires
fresh login; clear old credentials, connections, sessions and attempts. Expired rows are pruned when
starting a login. Do not substitute a shared operator token for a user's revoked
authorization. Logout can delete its session even when GitHub is down.

The UI clears private views immediately on logout, broadcasts to sibling tabs
and rejects late responses. Membership, token or session loss locks the profile.
A failed server sign-out retains an explicit retry action; local clearing alone
is not claimed as confirmed server revocation.

## Source failure or changed access

An unavailable source loses its current authorized body when checked. A saved
preference can remain labelled Unavailable so the user can retry or remove it.
Unknown profile authorization locks all content. An import failure does not
silently replace another source or grant visibility.

Refreshing/re-importing upserts by numeric repository identity. Duplicate import
preserves hidden visibility; a rename preserves identity. Removing a source
deletes only the user's preference, never GitHub content or installed skills.
At most five minutes of previously authorized viewing can remain before a new
check; hidden/history restoration rechecks immediately.

## Migration and rollback

The old shared Node admin route is retired; see [operations](operations.md).
There is no credential/session migration from it. Do not roll back to a
shared-operator private boundary as a recovery shortcut. A code rollback that
changes schema needs a reviewed migration/restore plan. Migration 0001 is
additive. Migration 0002 deliberately invalidates C sessions and replaces their
inline credential column with a shared vault reference. Profile/preferences
survive. Reverting to C requires an explicitly reviewed schema/credential reset,
not a code-only rollback; no production downgrade is implemented or authorized.

Proposal endpoints are read-only in C. Historical branch/PR adapter tests remain
for a future accepted policy; no automatic branch deletion or provider recovery
write is part of this runtime.

Public artifact rebuild/root-prefix browser checks and a separately authorized
Pages rollback remain available for the static demo. Current Pages/DNS/TLS and
Worker delivery have no new live proof in this candidate.
