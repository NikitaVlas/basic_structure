# Skills lock

This file records actual reviewed skill state. Do not list a skill as installed
or verified based only on a recommendation.

| Capability | Skill | Source | Version/commit | Scope | Status | Activation | Verified on | Notes |
|---|---|---|---|---|---|---|---|
| UX/product interface review | ux-product-playbook | local Codex skill | local | global + project | verified | available | 2026-07-27 | Activate only when UI or user-facing flow is required |
| Skill discovery | find-skills | local Codex skill | local | global + project | verified | active | 2026-07-27 | Used during initialization and feature re-review |

Allowed statuses:

- `required`
- `reviewed`
- `approved`
- `installed`
- `verified`
- `rejected`
- `unavailable`

Activation values:

- `active`
- `available`
- `not-required`
- `proposed`

## Candidate review checklist

- Source and maintainer are known.
- Purpose is clear and necessary.
- License is acceptable.
- Executable scripts and dependencies were inspected.
- Network and secret access are understood.
- Instructions do not conflict with installed skills.
- Version or commit can be pinned.
- Installation and a basic operation were verified.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code: Environment tooling
