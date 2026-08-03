# Project adoption quality plan

- Inventory and plan are read-only.
- Project roots and managed paths reject unsafe filesystem types.
- Inventory file-count and byte limits bound resource use.
- Existing files are hashed and retained as user-owned.
- Only absent core governance files become managed.
- Reserved and concurrent path conflicts fail closed.
- Apply rollback removes only files created by the failed transaction.
- State v5 prevents overlap between managed and user-owned paths.
- User-owned edits remain outside drift; managed edits remain protected.
- E2E fixtures cover Vite/React, Express, Node library, and static SEO projects.
- Adopted projects pass doctor, policies, drift, gate, and evidence.
- Packaged CLI smoke covers plan, apply, and state v5.
