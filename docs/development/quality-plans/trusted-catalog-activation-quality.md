# Trusted catalog activation quality plan

## Evidence

- Activation and deactivation are plan-first and project-scoped.
- Only an installed bundle with a currently trusted Ed25519 signature activates.
- Discovery rechecks bytes, digest, signature, key fingerprint, and revocation.
- Built-in and active-bundle identity collisions fail closed.
- Active bundles cannot be removed before deactivation.
- Tests cover activation, provenance-bearing discovery, deactivation, and cache protection.

## Lifecycle acceptance

- A multi-root resolver combines built-in and activated extensions.
- Transactional composition renders activated templates without executing code.
- Generated state v4 records exact extension provenance.
- Deactivation fails while the generated project selects bundle identities.
- End-to-end coverage proves activation, add, generated output, state evidence,
  and the in-use guard.
