---
name: manage-skills
description: Find, review, install, update, or remove project agent skills safely. Use when a solution has a concrete specialist capability gap, when the user asks to use the skills.sh CLI, or when changing the skills available to an agent harness.
---

# Manage Skills

Add the smallest trustworthy capability without turning the project into a
collection of overlapping instructions.

## Confirm the gap

1. State the task the missing skill must perform.
2. Before external search, dynamically inventory:
   - project-local skills discovered from repository truth;
   - skills accessible through the calling or containing AIOS context,
     discovered from current context rather than hardcoded by name;
   - harness-native capabilities and personal or installed skills exposed to
     the active agent; and
   - repository instructions and ordinary agent reasoning.
3. Reuse the first sufficient capability.
4. Stop when the inventory is sufficient. Search externally only for a
   concrete capability gap that remains.

Using an AIOS skill during work must not create an AIOS runtime dependency.
Keep required Project behavior and truth local to this independently operable
repository.

## Discover candidates

Read the current [skills.sh CLI documentation](https://www.skills.sh/docs/cli)
before relying on flags. Search and list without installing:

```sh
npx skills find <need>
npx skills add <owner/repo> --list
```

Prefer an existing project or organization skill, then an official skill from
the relevant technology owner, then a reviewed community skill. Popularity and
an audit label are signals, not approval.

## Review before mutation

Inspect:

- publisher, repository, revision, license, and maintenance;
- `SKILL.md`, referenced files, scripts, commands, and network access;
- files, credentials, secrets, services, and people the skill may affect;
- harness compatibility and its project installation path;
- overlap or conflict with repository instructions and installed skills;
- verification, update, removal, and recovery paths.

Summarize the candidate, material access, and intended files. Ask for explicit
approval before installation, update, removal, or global changes.

## Change the project

Install one named skill to the project and selected harness after approval:

```sh
npx skills add <owner/repo> --skill <name> --agent <agent>
```

Prefer project scope so collaborators can review the capability. Do not use
`--all`, global scope, or non-interactive approval flags unless the user
explicitly requests that exact scope and understands its effect. Never update
skills automatically.

If the CLI does not support the chosen harness or source, follow the harness's
current official project-local installation method instead of inventing a
directory.

## Verify

1. Inspect the exact filesystem and version-control diff.
2. Confirm only the selected skill and expected harness files changed.
3. Validate frontmatter, referenced paths, and bundled scripts.
4. Confirm the harness discovers the skill.
5. Exercise one representative task without production side effects.
6. Report source, installed scope, evidence, and remaining risk.

For an update, review the upstream diff before applying it and repeat the same
verification. For removal, confirm that no repository instruction or workflow
still depends on the skill.
