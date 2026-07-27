# SPEC-XXXX: Feature name

## Metadata

- Status: Draft
- Owner:
- Created:
- Updated:
- Related requirements:
- Related issues:
- Related ADR:
- Figma:

## Problem

What problem are we solving?

## Goal

What observable outcome should be achieved?

## Non-goals

What is explicitly outside this scope?

## Current behavior

How does the system behave now? Include evidence.

## Expected behavior

How should it behave after the change?

## Actors and permissions

Who uses the feature, and what permissions are required?

## Scenarios

### Successful scenario

Given ...
When ...
Then ...

### Alternative scenario

Given ...
When ...
Then ...

### Failure scenario

Given ...
When ...
Then ...

## Functional requirements

- SPEC-FR-001:

## Business rules

- BR-001:

## Inputs and outputs

Describe inputs, responses, events, and state changes.

## Validation

Describe input constraints and expected errors.

## Data changes

Describe entities, fields, indexes, migrations, retention, and rollback.

## API or contract changes

Describe endpoints, events, commands, and schemas.

## UI behavior

Describe screens, states, navigation, responsiveness, accessibility, and
feedback. Use `Not applicable` for non-UI work.

## Security

Describe access, sensitive data, rate limits, auditing, and abuse cases.
Add security acceptance criteria and the threat-model assumptions that must be
verified before completion.

## Failure behavior

Describe database, network, dependency, timeout, and partial-failure behavior.

## Edge cases

- EC-001:

## Compatibility

State backward-compatibility and migration expectations.

## Observability

Describe required logs, metrics, traces, and events.

## Acceptance criteria

- [ ] AC-001:

## Test scenarios

### Unit

- Covers:
- Acceptance criteria:
- Negative cases:

### Integration

- Boundaries covered:
- Failure cases:

### Contract

- API/schema compatibility:
- Authorization and error responses:

### E2E

- Critical journeys:
- User roles and permission paths:

### Visual

- Responsive states:
- Visual regression scope:

### Manual

- Security review:
- Accessibility review:
- Residual risks:

### Coverage matrix

| Requirement / acceptance criterion | Test level | Test reference | Status |
|---|---|---|---|
| AC-001 | Unit / Integration / Contract / E2E / Visual / N/A | TBD | TBD |

## Constraints

What must not change?

## Skill impact review

Complete this section after code research and before implementation approval.

- New capabilities:
- Existing skills affected:
- New skills required:
- UI or user-facing flow: Not applicable / Required
- UX/product review required: No / Yes
- Frontend implementation skill required: No / Yes
- Figma or visual design skill required: No / Yes
- Skill review recorded in: `agent/skill-review.md`
- UX review recorded in: `docs/design/ux-review-template.md` when UI or user-facing flow exists
- Approval required for new skills: No / Yes

If this feature introduces a UI or user-facing flow, activate the relevant
UX/product and frontend skills before implementation. If it does not, mark the
UI/UX fields as `Not applicable` or `No` and do not activate those skills.

For UI work, complete `docs/design/ux-review-template.md` before implementation
and complete its after-implementation audit before marking the feature Verified.

## Open questions

- [ ] Question:

## Implementation plan

Complete after code research and specification approval.

## Verification results

Link the completed feature-specific quality plan from
`docs/development/quality-plans/` and summarize passed checks, coverage gaps,
security findings, UX findings, and residual risks.

Record commands, outcomes, skipped checks, and manual evidence.

## Known limitations

List accepted limitations and follow-up work.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code:
