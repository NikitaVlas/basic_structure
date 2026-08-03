# Security hardening design

## Harness policy

The harness requires evidence proportional to the changed trust boundary.
Runtime changes require tests and dependency audit. Public API/auth changes also
require CodeQL and E2E. Deployment changes require image/config scans, SBOMs,
runtime posture checks, and rollback documentation.

## Severity and exceptions

- Critical: block merge/release and begin immediate triage.
- High: block new dependency/image changes unless a security owner approves a
  time-bounded exception.
- Medium: record and remediate in the security backlog.
- Low/unknown: monitor and reassess when exposure changes.

An exception identifies scanner/finding, component/version, justification,
compensating controls, owner, approval, issue, and expiry within 30 days. Ignore
files may contain documented vulnerability IDs but never secret findings.

## CI architecture

- Dependency review blocks moderate-or-higher vulnerable additions on PRs.
- CodeQL analyzes JavaScript/TypeScript on PRs, main, and schedule.
- Trivy scans repository secrets and misconfiguration without secret ignores.
- Production images are scanned for fixed high/critical vulnerabilities and
  misconfiguration, and exported as CycloneDX SBOM artifacts.
- Publishing, signing, and attestations require separate release authorization.

The baseline uses `github/codeql-action@v4`,
`actions/dependency-review-action@v4`, and remediated
`aquasecurity/trivy-action@v0.36.0` with explicit Trivy `v0.70.0`. Because the
Trivy ecosystem suffered a 2026 supply-chain compromise, upgrades require
official-advisory review and preferably organization-enforced full-SHA pinning.

## Acceptance criteria

- Workflows use least privilege and no deployment secrets.
- Secret scanning fails closed without ignore support.
- Dependency review and CodeQL configurations are generated.
- Both images are scanned and produce CycloneDX SBOMs.
- Local posture verifies headers, private services/metrics, non-root users,
  health checks, capability drops, and read-only filesystems.
- Response documentation covers triage, rotation, SLA, exceptions, disclosure,
  and verification.
- Generator, template, generated tests, E2E, deployment smoke, and audit remain green.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Threat model: `docs/security/threat-model.md`
