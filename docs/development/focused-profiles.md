# Focused project profiles

- `backend-service` provides a minimal Node.js API service.
- `frontend-app` provides a framework-neutral browser application.
- `node-library` provides an ESM package with exports and tests.
- `background-worker` adds an operational contract for reliable jobs.
- `container-runtime` adds vendor-neutral container hardening guidance.

Each profile has a matching preset and verification entrypoint. The adapters
remain composable and avoid selecting a queue vendor or container platform.
