# Trusted catalog activation quality plan

## Evidence

- Activation and deactivation are plan-first and project-scoped.
- Only an installed bundle with a currently trusted Ed25519 signature activates.
- Discovery rechecks bytes, digest, signature, key fingerprint, and revocation.
- Built-in and active-bundle identity collisions fail closed.
- Active bundles cannot be removed before deactivation.
- Tests cover activation, provenance-bearing discovery, deactivation, and cache protection.

## Deferred acceptance boundary

Third-party template application stays disabled until the multi-root lifecycle
resolver and generated-state provenance land together with rollback coverage.
