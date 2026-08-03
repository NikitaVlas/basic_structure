# Harness policies

```text
node bin/basic-structure.mjs policy list
node bin/basic-structure.mjs policy explain production-readiness
node bin/basic-structure.mjs policy check --project ../example-saas
```

Checks return pass, fail, or skip and identify missing capabilities, regular
files, and package scripts. Exit code `4` means an applicable error-severity
policy failed. Checks inspect scripts but never execute them.

Remediation is explicit and plan-first:

```text
node bin/basic-structure.mjs policy apply production-readiness --project ../example-saas --plan
node bin/basic-structure.mjs policy apply production-readiness --project ../example-saas --apply
```

The policy's reviewed remediation preset supplies composition gaps. Existing
drift must be updated first, and file conflicts or migration gates still block
the transaction. Missing user-owned evidence is not fabricated automatically.

Built-in policies cover documentation, verification, security, production, and
AI harness readiness.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/harness-policy-engine-design.md`

