# Agent instructions

## Mission

Work within approved requirements, preserve the project's architectural
integrity, and verify every change.

## Required context

Before substantial changes, read:

1. `docs/project/overview.md`;
2. `docs/project/constraints.md`;
3. `docs/architecture/overview.md`;
4. the relevant feature specification;
5. documentation for the affected module, if it exists.

Use `docs/project/requirements.md` when validating product requirements and
`docs/development/workflow.md` for the full delivery process.

## Sources of truth

| Information | Source of truth |
|---|---|
| Product goals and boundaries | `docs/project/` |
| Architectural rules | `docs/architecture/` |
| Feature behavior | Approved feature specification |
| Verification commands | `docs/development/verification.md` |
| Installed tooling | `agent/skills-lock.md` and `agent/mcp.md` |
| Current implementation | Code and tests |

If sources conflict, identify the conflict, report it, recommend which source
should be updated, and continue only when a safe resolution is available.

## Code discovery

1. Use the codebase knowledge graph first for code discovery.
2. Use inbound and outbound tracing for dependencies and impact.
3. Read only relevant snippets found through discovery.
4. Use text search for configuration, documentation, string literals, and
   unsupported files.
5. If the index may be stale, refresh it or verify conclusions against source.

If the knowledge graph is unavailable or unsuitable, record that limitation and
use the safest available discovery method.

## Workflow

For a non-trivial task:

1. Research current behavior.
2. Validate requirements and the approved specification.
3. Identify affected components and risks.
4. Produce an implementation plan.
5. Obtain approval where permissions or stop conditions require it.
6. Implement only the agreed scope.
7. Add or update appropriate tests.
8. Run required verification.
9. Review the final diff.
10. Check whether related documentation became outdated.
11. Report results, failures, skipped checks, limitations, and residual risks.

For a bug fix, reproduce the issue and add a regression test when technically
feasible before or alongside the minimal fix.

## Rules

- Do not change unrelated code.
- Do not change a public contract without an explicit requirement.
- Do not add dependencies without justification and required approval.
- Do not bypass architectural constraints.
- Do not remove or weaken tests to make CI pass.
- Do not rewrite an approved specification after implementation to conceal a
  mismatch.
- Do not hide verification failures.
- Do not include secrets in code, logs, tests, or documentation.
- Follow established project patterns.
- Treat Figma as optional unless the project enables the design module.
- Do not install skills or executable MCP tooling without review and approval.
- Update documentation only when the implemented change affects its content.

## Stop conditions

Stop and request a decision when:

- requirements conflict;
- a material product decision is missing;
- an incompatible public API change is needed;
- a destructive migration or data deletion is needed;
- authentication or authorization changes;
- payments, production, secrets, or sensitive data are affected;
- a new architectural boundary is needed;
- an action is irreversible;
- implementation and an approved specification conflict;
- permission rules require confirmation.

## Verification

Use the commands and change matrix from:

`docs/development/verification.md`

Never claim a check passed unless it was run successfully. Report checks that
were unavailable or skipped and explain why.

## Documentation freshness

After substantial work, determine whether the change affected:

- architecture or dependency rules;
- verification commands;
- documented behavior or constraints;
- a decision that requires an ADR;
- an approved feature specification;
- design artifacts, when the design module is enabled.

Permanent documents must contain a `Document status` section. Mark stale
documents `Outdated`; do not silently leave misleading information.

## Definition of Done

Use:

`docs/development/definition-of-done.md`

