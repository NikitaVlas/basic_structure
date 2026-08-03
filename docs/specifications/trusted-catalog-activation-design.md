# Trusted catalog activation design

Trusted activation is project-scoped and plan-first. A bundle must first be
installed in the immutable local cache and signed by an Ed25519 key whose
publisher entry is currently trusted by the project.

`catalog activate` never trusts an earlier verification result. It verifies the
cached directory again, records its digest, signing key, fingerprint, claimed
extension identities, and activation time in
`.basic-structure/catalogs/active.json`. Registry writes use a temporary file
and atomic rename. Active bundles cannot be removed before deactivation.

Every discovery read verifies the cached bytes, signature, live trust-store
status, and recorded provenance again. Revocation, cache tampering, missing
content, or changed identity claims therefore fail closed. Built-in identities
cannot be shadowed, and two active bundles cannot claim the same qualified
extension identity.

## Lifecycle boundary

Activated extensions participate in project-scoped discovery and transactional
composition through the same multi-root resolver. Generated state schema v4
records immutable publisher, catalog, digest, key, fingerprint, and trust
provenance. Update revalidates that provenance before rendering desired files,
and the existing upgrade rollback protects configuration, state, and generated
files. A catalog cannot be deactivated while its extensions remain selected.

Bundles are data-only: activation does not execute scripts, install packages,
follow symbolic links, or access the network.
