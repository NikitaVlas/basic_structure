# Skills lock

This file records actual reviewed skill state. Do not list a skill as installed
or verified based only on a recommendation.

| Capability | Skill | Source | Version/commit | Scope | Status | Activation | Verified on | Notes |
|---|---|---|---|---|---|---|---|
| Full-stack security | fullstack-guardian | Jeffallan/claude-skills | v0.4.15 / e8be415bc94d8d6ebddc2fb50e5d03c6e27d4319 | global + project | verified | active | 2026-07-27 | Approved by user; layered frontend/backend security workflow |
| Skill discovery | find-skills | local Codex skill | local | global + project | verified | active | 2026-07-27 | Used during initialization and feature re-review |
| E2E testing | Project-native browser testing | Project stack | Project-defined | project | required | proposed | 2026-07-27 | Select after stack discovery; former candidate unavailable |

Security and testing are mandatory project capabilities. Their concrete skills
must be selected through `find-skills` during initialization and recorded here
only after review and approval. The versioned UX playbook in `docs/design/`
is the project source of truth; no global UX skill is required.

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

## External skill compatibility gate

An external skill must not be marked `verified` until the review records its
pinned source, Codex compatibility, installation result, and a minimal
smoke-test result. If the source targets another agent platform, keep it
`proposed` or `blocked` and use project-native tooling instead.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code: Environment tooling
