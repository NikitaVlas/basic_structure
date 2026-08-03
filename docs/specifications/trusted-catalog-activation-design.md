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

## Current activation boundary

Activated extensions participate in project-scoped `search`, `inspect`, and
capability recommendation and expose explicit provenance. Applying their
templates through composition remains disabled until the lifecycle resolver,
upgrade planner, generated state, and rollback engine all share the same
multi-root catalog contract. This prevents discovery from being mistaken for
permission to write third-party files.

Bundles are data-only: activation does not execute scripts, install packages,
follow symbolic links, or access the network.
