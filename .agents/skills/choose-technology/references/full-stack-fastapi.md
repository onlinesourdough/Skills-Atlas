# Full Stack FastAPI reference

Use this reference only when `choose-technology` has found a new or materially
changed decision whose fit might be independently satisfied. It is an optional
sourced option, not a default stack. Do not copy or vendor the upstream
template into the Project repository.

## Official sources

- [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template)
- [FastAPI project generation](https://fastapi.tiangolo.com/project-generation/)

Review the current upstream revision and official sources when a real project
selects this option.

## Fit conditions

All are required:

- Python materially benefits owned domain logic or already has an owner;
- a component-based React interface is needed;
- PostgreSQL is justified as shared relational authority;
- authentication and server-enforced authorization are required;
- Docker is justified for reproducible build, deployment, or handover; and
- an operated deployment has a named owner for application, data, secrets,
  updates, monitoring, backup, and recovery.

If any condition is missing or supplied only by the starter, choose a smaller
stack. Existing ownership and a working system outrank this reference.

## Responsibilities added

The selection adds a Python/FastAPI backend, React interface and API contract,
PostgreSQL schema and recovery, authentication and authorization, Docker
artifacts, and operated deployment. Keep domain logic separate from framework
delivery and keep trust decisions on the server boundary.

## Operator burden

The operator owns two dependency ecosystems, container images, PostgreSQL,
secrets, security updates, deployment configuration, monitoring, backups, and
recovery exercises. Reject the option when that work has no owner.

## Verification

Require backend domain/API tests including denial, frontend build and critical
browser journey, migration compatibility, container build/startup, deployment
health and failure visibility, secret isolation, an exercised restore, and
application rollback or forward recovery.

## Update path

Compare the selected project with a named upstream revision. Apply only changes
whose responsibilities still fit, then repeat build, contract, migration,
security, and recovery checks. Never update automatically.

## Exit path

Keep application code, contracts, schema and exports, deployment configuration,
and recovery instructions under project ownership. Preserve the public contract
and data authority while replacing each responsibility explicitly.
