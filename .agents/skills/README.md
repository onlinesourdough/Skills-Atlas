# Project-local skills

This is the Project-owned skill shelf for Online Sourdough Skills Atlas. The
Project owns these instructions and evolves them with its independent
lifecycle.

The layout is flat: every skill entry point is a direct
`.agents/skills/<name>/SKILL.md` child. A skill may keep supporting references,
examples, or agent metadata inside its own folder, but another `SKILL.md` must
not be nested there.

The six Project-local lifecycle and technology skills are:

- [`spec-project`](spec-project/SKILL.md) — establish or audit the build-ready
  technical contract.
- [`choose-technology`](choose-technology/SKILL.md) — make a new or materially
  changed technology decision when one is justified.
- [`build-project`](build-project/SKILL.md) — implement and verify a resolved
  result.
- [`review-project`](review-project/SKILL.md) — review correctness, security,
  simplicity, ownership, operation, and proof.
- [`ship-project`](ship-project/SKILL.md) — perform authorized delivery,
  activation, verification, and recovery.
- [`audit-project`](audit-project/SKILL.md) — periodically reconcile the whole
  repository's current truth.

Generic cross-project skill discovery, installation, and updates are outside
this Project payload. When that capability is needed, use an optional manager
installed by the calling environment or the current harness/plugin mechanism;
do not copy a generic manager into this shelf.
