# Catalog publisher trust

```text
basic-structure trust add ./publisher-key.json --project . --plan
basic-structure trust add ./publisher-key.json --project . --apply
basic-structure trust list --project .
basic-structure trust inspect example-vendor --project .
basic-structure catalog verify ./vendor/catalog --project . --require-signature
basic-structure trust revoke example-vendor/release-2026 --project . --plan
```

Only Ed25519 keys are accepted. Verify the displayed SPKI SHA-256 fingerprint
through an independent publisher channel before `--apply`. Revocation is
explicit and retained; a revoked key can no longer validate bundles.

The signature covers `sha256:<bundleDigest>` exactly. Trust establishes key
identity, not code safety. Signed bundles remain isolated and inactive until a
separate trusted activation workflow is implemented.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03

