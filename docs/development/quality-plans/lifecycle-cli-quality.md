# Unified lifecycle CLI quality plan

## Scope

Command routing, human and JSON output, lifecycle delegation, exit codes, and
read-only diagnostics.

## Threat model

CLI arguments, project files, state, reports, and executable lookup results are
untrusted. Commands validate required values, avoid shell interpolation, reuse
upgrade path protections, and emit bounded error messages without stack traces.

## Coverage matrix

| Acceptance area | Evidence |
|---|---|
| Routing and help | CLI contract tests |
| JSON envelope and errors | CLI contract tests |
| Init/validate/list | Unit and integration tests |
| Update blocked/apply delegation | CLI upgrade tests |
| Doctor read-only behavior | Diagnostic integration tests and snapshots |
| Fixed executable probes | Doctor unit tests |
| Package entry point | Clean invocation smoke test |

## Verification summary

- `npm test`: 35 passed; one symlink-creation test skipped because this Windows
  host does not permit symlink creation.
- CLI contract tests cover root and command help, JSON validation and listing,
  dry-run and write initialization, update plan/apply/blocked behavior, healthy
  and unhealthy doctor results, conditional Docker requirements, invalid input,
  and the real package bin entry point.
- `npm run verify`: passed with 58 documents and 12 extensions.
- Real JSON smoke passed for `init`, `validate`, `list`, `update --plan`, and
  `doctor` against a clean full-stack project.
- Doctor verified Node.js 22.15.0, Git 2.49.0, Docker 28.0.4, 11 compatible
  extensions, 173 unchanged managed files, the verification entry point, and
  no unfinished reports.
- `git diff --check`: passed with expected Windows line-ending notices only.

## Known limitations

- The CLI is local and not yet published as an npm package.
- Extension add/remove commands remain a later lifecycle stage.

## Document status

- Status: Verified
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related: `docs/specifications/lifecycle-cli-design.md`
