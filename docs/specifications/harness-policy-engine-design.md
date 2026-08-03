# Harness policy engine design

## Decision

Versioned JSON policies declare applicability capabilities, required
capabilities, regular files, package scripts, severity, and a remediation
preset. The CLI supports `policy list`, `policy explain`, `policy check`, and
plan-first `policy apply`.

Evaluation is read-only and reports pass, fail, or skip with missing evidence.
Required violations return exit code `4`. Remediation delegates to the existing
preset planner and therefore retains synchronization, conflict, backup, report,
and rollback guarantees.

Policies never execute project scripts, extension code, package managers,
network requests, Git, Docker, deployments, or migration instructions.

## Acceptance criteria

1. Policy loading validates identities, severity, capabilities, and safe paths.
2. Applicability produces deterministic pass/fail/skip results.
3. Files must be regular non-symbolic-link files.
4. Script evidence is read from package metadata without execution.
5. Violations expose exact missing capabilities, files, and scripts.
6. Remediation is explicit, plan-first, and transactional.
7. JSON output and exit code `4` are stable for CI.

## Document status

- Status: Implemented
- Owner: Project maintainers
- Last reviewed: 2026-08-03

