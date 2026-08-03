# Signed catalog provenance and trust design

## Decision

Catalog publishers use Ed25519 public keys identified by publisher and key id.
Keys are imported plan-first after verifying a SHA-256 fingerprint of canonical
SPKI DER bytes. Project trust state records trusted and revoked keys in a
regular atomic JSON file.

`signature.json` signs the UTF-8 string `sha256:<bundleDigest>`. Verification
requires exact publisher, key id, algorithm, digest, canonical base64, a trusted
key, and a valid Ed25519 signature. Revocation always wins.

Checksums prove content integrity; signatures bind that content to a trusted
key. Neither permits code execution or identity overrides. Trust and signature
verification still do not activate a catalog in resolver operations.

## Document status

- Status: Implemented
- Owner: Project maintainers
- Last reviewed: 2026-08-03

