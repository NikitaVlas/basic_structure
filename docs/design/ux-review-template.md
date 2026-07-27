# UX review: [feature or surface]

Use this document before UI implementation and again after implementation.
Complete the selected mode, pattern mapping, findings, and validation plan.

## Metadata

- Status: Draft / Ready for Review / Approved / In Progress / Verified / Completed
- Surface or feature:
- Review mode: marketing / product UI / admin-operational UI / onboarding / forms / accessibility review
- Primary user:
- Job-to-be-done:
- Reviewer:
- Date:
- Related specification:
- Related implementation:

## Mode selection

Select one primary mode and add secondary modes only when justified.

| Mode | Use when | Minimum review focus |
|---|---|---|
| `marketing` | Landing, positioning, conversion or public content | Promise, hierarchy, evidence, CTA, ethical persuasion, mobile |
| `product UI` | Authenticated product surfaces and core workflows | Task completion, navigation, states, feedback, permissions |
| `admin-operational UI` | Queues, dashboards, moderation and staff tools | Density, prioritization, bulk work, recovery, permissions, keyboard |
| `onboarding` | First-run setup or activation | Time to first value, progressive disclosure, education, recovery |
| `forms` | Data entry, registration, checkout or configuration | Necessary fields, validation, defaults, errors, save/cancel |
| `accessibility review` | Dedicated accessibility audit or high-risk interaction | Semantics, keyboard, focus, labels, contrast, announcements, zoom |

## UX framing

- Primary task:
- Desired outcome:
- Success metric:
- User anxiety or failure risk:
- What must be visible immediately:
- Primary action:
- Secondary actions:

## Flow and hierarchy

```text
Entry → step → step → successful outcome → feedback / recovery
```

- Information hierarchy:
- First successful action:
- Navigation model:
- Progressive disclosure decision:
- Mobile/responsive behavior:

## Selected UX Core patterns

Use three to seven patterns only when they map to the task. Every selected
pattern must point to an exact card heading in `ux-core-pattern-cards.md` and,
when applicable, the original KeepSimple source article.

| Pattern | Exact pattern-card heading | Source article | Classification | Why it applies |
|---|---|---|---|---|
| [name] | `[exact heading]` | [URL or Not applicable] | source-backed / adapted / hypothesis | [task connection] |

Evidence rule:

- `source-backed` requires a source article or established project evidence;
- `adapted` means the principle is translated to this product and still needs validation;
- `hypothesis` means the expected effect is unvalidated and must not be presented as fact.

Do not select a pattern only because it sounds relevant. If no exact card maps
to the task, record `No pattern selected` and explain why.

## States and accessibility

- Loading:
- Empty:
- Error:
- Success:
- Pending/disabled:
- Recovery, undo or safe exit:
- Permission or privacy state:
- Keyboard flow:
- Focus behavior:
- Labels and semantic structure:
- Contrast and non-color communication:
- Zoom, reduced motion and responsive behavior:

## Findings

Each finding must have a priority and a validation method.

| ID | Priority | User/task | Issue | Principle or card | Evidence / hypothesis | Ethical risk | Recommendation | Expected impact | Validation method | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| UX-001 | P1 / P2 / P3 | [task] | [issue] | [principle/card] | evidence / hypothesis | [risk or None] | [change] | [impact] | [test] | Open |

Priority:

- `P1` blocks comprehension, task completion, safety, accessibility or recovery;
- `P2` materially increases friction or error likelihood;
- `P3` is a useful refinement with limited task impact.

Evidence must identify its basis: observation, user research, analytics,
existing behavior, source-backed principle, implementation inspection, or an
explicit hypothesis. “Best practice” alone is not evidence.

## Before implementation gate

- [ ] Mode is selected and justified.
- [ ] Primary user, task, outcome and success metric are defined.
- [ ] Information hierarchy and first successful action are defined.
- [ ] Selected patterns link to exact pattern cards.
- [ ] Every recommendation is classified as source-backed, adapted or hypothesis.
- [ ] P1 findings are resolved or explicitly accepted as risks.
- [ ] Accessibility and meaningful states are specified.

## After implementation audit

Record implementation evidence, not intentions.

- Implementation reviewed:
- Viewports checked:
- Keyboard path checked:
- Screen reader/semantic checks:
- Contrast/focus checks:
- Loading/empty/error/success checks:
- Findings closed:
- Findings deferred and why:
- Residual risks:

## Validation results

| Validation | Method | Result | Evidence link or note | Follow-up |
|---|---|---|---|---|
| [method] | [how checked] | Pass / Fail / Inconclusive | [evidence] | [action] |

## Review decision

- Decision: Approved / Changes required / Verified with risks
- Decision owner:
- Date:
- Remaining risks:

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code:

