# Harness evidence reports

`basic-structure gate evidence --project . --json` returns one read-only report
containing gate checks, policy results, generated state schema, extension
provenance, active catalog metadata, and a canonical SHA-256 digest.

The digest excludes volatile activation timestamps, so identical project and
gate evidence produces the same value. CI can retain the JSON response as an
artifact or translate individual checks into provider-specific annotations.
