# UX / Product Playbook

Reusable guidance for designing clear, useful, ethical interfaces and product experiences.

The full KeepSimple UX Core catalog is indexed in `docs/design/ux-core-catalog.md`. When a task involves behavior, decision-making, persuasion, onboarding, forms, conversion, content, or team workflows, select relevant patterns from that catalog and consult the original English article before making a strong claim.

Use `docs/design/ux-core-application-matrix.md` to choose an initial set of patterns and `docs/design/ux-preflight-checklist.md` before completing UI work.
Use `docs/design/ux-core-pattern-cards.md` for concise meaning, UI application, and ethical risk of each pattern.
Use `docs/design/ux-review-template.md` as the required artifact for pre-implementation UX definition and post-implementation audit.

## Core principle

Keep the product simple for the user, not merely simple in implementation. Every screen should clarify where the user is, what they can do, why it matters, and what happens next.

## Product framing

Before building UI, define the primary user, job-to-be-done, desired outcome, primary action, success metric, user anxiety, and what must be visible immediately.

## Interface rules

- Use one clear hierarchy and one primary CTA per meaningful view.
- Prefer plain language, concrete labels, and verbs over abstract copy.
- Show loading, success, empty, error, and recovery states.
- Reduce choices that do not represent meaningful user intent.
- Preserve user control: undo, back, cancel, edit, and safe recovery.
- Reveal complexity progressively.
- Make important content accessible without hover, color alone, or hidden gestures.

## Cognitive-science checklist

- Recognition over recall: expose options, examples, and current state.
- Hick's law: group or sequence complex choices.
- Fitts's law: make frequent and high-value targets easy to activate.
- Progressive disclosure: show the next useful level of detail.
- Von Restorff effect: reserve emphasis for the most important action.
- Defaults: use safe, reversible, user-beneficial defaults.
- Social proof: provide relevant evidence with context.
- Peak-end rule: make completion and final feedback useful.

## Ethical guardrails

Use behavioral principles to reduce friction and improve comprehension, never to trick users. Reject hidden fees, fake urgency, fake scarcity, confirmshaming, forced continuity, difficult cancellation, misleading defaults, and fabricated social proof.

## Page workflow

1. Write the page promise in one sentence.
2. Define the primary task and primary CTA.
3. Sketch information hierarchy before visual style.
4. Design the first successful action.
5. Add trust, evidence, examples, and objections near the decision.
6. Cover all system, mobile, and accessibility states.
7. Test whether a first-time user understands the page in five seconds.
8. Remove anything that does not improve understanding, trust, or action.

## Review modes

Select the mode that matches the surface before choosing patterns:

- `marketing`: promise, hierarchy, evidence, CTA and ethical persuasion;
- `product UI`: task completion, navigation, states, feedback and permissions;
- `admin-operational UI`: density, prioritization, bulk work, recovery, permissions and keyboard;
- `onboarding`: first value, progressive disclosure, education and recovery;
- `forms`: necessary fields, validation, defaults, errors and safe exit;
- `accessibility review`: semantics, keyboard, focus, labels, contrast, announcements and zoom.

The review mode is recorded in `ux-review-template.md`. A surface may have one
primary mode and justified secondary modes.

## Content and articles

Turn research into practical value through concise principles, before/after UI patterns, decision-time checklists, progressive depth, and related reading. Distinguish evidence, interpretation, and opinion. Do not copy long passages; summarize the idea and explain its product implication.

## UX audit output

For each finding, report the user/task, issue, relevant principle, ethical risk, recommendation, expected impact, and validation method. Prioritize comprehension and task completion before decorative polish.

When relevant, name the UX Core pattern(s) involved and distinguish whether the recommendation is a direct source-backed application, an adaptation to the current product, or an unvalidated hypothesis.

Every selected pattern must link to an exact heading in
`ux-core-pattern-cards.md`. Every finding must include `P1`, `P2` or `P3`, an
evidence or hypothesis label, and a validation method. Run the audit twice:
before implementation to define the UX contract, and after implementation to
check the actual interface and record residual risks.

## Definition of done

- Purpose is clear to a first-time user within five seconds.
- Primary action is obvious and works on mobile.
- Meaningful states are covered.
- Copy is specific, concise, and consistent.
- Keyboard access, contrast, focus, labels, and semantic structure are considered.
- The interface does not rely on manipulation or accidental commitment.
- Analytics or qualitative feedback can verify the intended outcome.
- The UX pre-flight checklist has been reviewed.
- Selected UX Core pattern cards are documented when behavioral principles are relevant.
- A review mode is selected.
- Every selected pattern links to an exact pattern card.
- Every finding has priority, evidence/hypothesis classification and validation method.
- A post-implementation audit is recorded.
