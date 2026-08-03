# Threat model

## Scope and assets

Review this template for every generated product. Protected assets include
credentials, sessions, recovery tokens, personal data, email contents,
database records, source, CI credentials, images, SBOMs, logs, and backups.

## Trust boundaries

```text
browser -> TLS proxy -> web/API -> PostgreSQL / Valkey
API -> encrypted outbox -> worker -> SMTP provider
developer -> GitHub -> CI runner -> registry -> deployment host
AI agent -> harness permissions -> generator -> generated repository
```

Internet input is untrusted. PostgreSQL, Valkey, worker health, and metrics stay
private. CI jobs are privileged supply-chain boundaries. Harness instructions
are not authorization to publish, deploy, rotate secrets, or delete production
data.

## Primary threats and controls

| Threat | Controls and required evidence |
|---|---|
| Credential theft | runtime injection, exclusions, redaction, repository secret scan and rotation drill |
| Account takeover | scrypt, opaque sessions, origin checks, rate limits, audit, integration and E2E |
| Injection/XSS | schemas, parameterized SQL, React encoding, CSP, CodeQL and posture tests |
| Dependency compromise | lockfile, dependency review, npm audit and scheduled scans |
| Malicious source change | review, minimal workflow permissions, protected branches and CodeQL |
| Container compromise | non-root, read-only FS, dropped capabilities, private networks and image scan |
| Vulnerable image | reviewed digests, CVE gate, SBOM and rebuild policy |
| CI action compromise | minimal permissions, reviewed versions and organization allowlists |
| Data loss | durable storage; backup/restore remains a required future capability |
| Telemetry leakage | allowlisted fields, recursive redaction and retention review |
| AI overreach | workspace permissions, specification-first workflow and explicit deploy authorization |

## Abuse cases

- Multiline request IDs attempt log poisoning; validation replaces them.
- A PR introduces a vulnerable dependency; dependency review blocks merge.
- A secret enters source or Docker context; scanning fails and the credential is
  rotated rather than merely removed from Git.
- A proxy rule exposes `/metrics`; posture and runtime smoke fail.
- A compromised build dependency modifies an image; SBOM and immutable image
  promotion preserve investigation evidence.

## Residual risks and review

Scanners produce false positives and cannot prove absence of flaws. GitHub
security features vary by plan. Third-party action tags are weaker than full
SHA pins; organizations should enforce an allowlist and SHA policy. Backups,
DDoS protection, signing, WAF, and cloud IAM remain outside this baseline.

Review on new endpoints, auth or data changes, providers, deployment platforms,
CI permissions/actions, incidents, or at least every six months.

## Document status

- Status: Active template
- Owner: Product security owner
- Last reviewed: 2026-08-03
- Related: `docs/architecture/ai-engineering-harness.md`
