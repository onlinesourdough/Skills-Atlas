---
name: choose-technology
description: Select the smallest technology after responsibilities, ownership, risks, operation, recovery, and proof are known. Use only for a new or materially changed technology decision; bypass a working stack when the change does not materially alter it, and route concrete specialist gaps to manage-skills.
---

# Choose Technology

Use this as the only project technology-selection procedure. It is a
conditional decision aid, not a default stack catalog, install manifest, or
reason to preload stack-specific skills.

## Route

1. Run `spec-project` first. The intended result, served party, ownership,
   boundaries, risks, operation, recovery, and proof must be resolved enough
   for a Build contract.
2. If a working stack already owns the responsibilities and the change does
   not materially alter technology, bypass this skill. Record the existing
   stack as the resolved decision and go directly to `build-project`.
3. For a new or materially changed technology decision, select the smallest
   capabilities after the contract is ready. Do not choose from popularity or
   from a starter's included layers.
4. If a concrete specialist implementation gap remains, route it to
   `.agents/skills/manage-skills/SKILL.md` after the technology decision. Add
   only a justified, reviewed project-local skill; do not install or invent
   React, FastAPI, Supabase, or other stack-specific skills in the Project.
5. Hand the resolved decision and its evidence to `build-project`. Build
   consumes that decision and does not preload every technology reference.

## Select the smallest fit

For each material responsibility, name its owner and choose Build, Buy, Rent,
or Self-host. Reuse a working system with a clear owner; build only
differentiating or ownership-critical capability. Choose the smallest runtime that can deliver and recover
the first complete result. Buy or rent generic capability when
reduced operation justifies the dependency and exit path. Self-host only when
license, updates, security, observability, backup, and recovery have an owner.

Use these as starting points, not requirements:

| Responsibility                              | Starting point                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Browser interface                           | TypeScript; use React for a component-based interface and Vite before a larger framework |
| Ordinary web capability                     | TypeScript when one language simplifies contracts and operation                          |
| Data, scientific, image, quant, or ML logic | Python                                                                                   |
| Visible orchestration and approvals         | An existing workflow runtime or n8n; keep substantial reusable logic in a small service  |
| Local single-owner state                    | Files or SQLite                                                                          |
| Shared relational truth                     | PostgreSQL                                                                               |
| CI                                          | The repository host's native CI                                                          |
| Static public delivery                      | GitHub Pages or an already-owned web platform                                            |
| Portable runtime                            | OCI container only when deployment or handover needs it                                  |
| Observability                               | Health checks and structured logs before a vendor platform                               |
| Infrastructure                              | Versioned configuration; IaC only when reproducibility needs it                          |

Do not add authentication, a database, queue, container platform,
observability vendor, or runtime AI because a starter includes it. Each layer
needs one demonstrated responsibility and one owner.

For a material external capability, inspect current official documentation,
pricing or plan limits, license, operational responsibilities, and exit options
when they can affect architecture, cost, ownership, or handover.

Before accepting the decision, verify that:

- each role and source of truth is explicit;
- contracts can be checked by types, schemas, validators, or tests;
- build, operation, failure, and recovery are observable;
- secrets and operational state remain outside source code; and
- the operator can maintain or replace every selected capability after
  handover.

Language popularity is not proof of fit. Existing systems and owners win.

## Conditional references

Load [the Full Stack FastAPI reference](references/full-stack-fastapi.md) only
when a new or materially changed decision might independently satisfy every
FastAPI fit gate. Do not load it for an existing working stack or a known
non-fit change. If any fit condition is missing, choose the smaller individual
capabilities instead.

The reference is an optional sourced decision aid. It never makes a stack the
default, and it does not authorize copying or vendoring upstream code.

## Return one decision

Record one explicit technology decision with:

- the responsibilities, source of truth, owner, and trust boundary;
- existing systems reused and Build, Buy, Rent, or Self-host choices;
- fit evidence and the operator burden for every added layer;
- contracts, dependencies, cost or license concerns, and failure behavior;
- verification for build, operation, denial or failure, and recovery;
- update and replacement or exit paths; and
- residual risks and any capability gap routed to `manage-skills`.

Do not return a catalog of unselected stacks. If the decision is not
independently justified, keep the existing stack or choose the smaller
capability and continue to `build-project`.
