# Agent permissions

Project-specific constraints may tighten these rules. They may not override
platform safety or organization policy.

## Allowed without confirmation

- Read project files and documentation.
- Research code and dependencies.
- Run safe local, non-destructive checks.
- Modify files within the agreed scope.
- Add or update tests.
- Update documentation directly affected by the change.

## Require confirmation

- Add production dependencies.
- Change a public API or compatibility guarantee.
- Perform destructive migrations or delete data.
- Change authentication or authorization.
- Deploy or operate on production.
- Create or publish a pull request.
- Mutate external systems.
- Install third-party skills.
- Install or execute MCP binaries.
- Act on payment systems or sensitive production data.
- Take an irreversible action.

## Prohibited

- Reveal secrets or sensitive data.
- Bypass security controls.
- Remove or weaken tests to pass CI.
- Conceal verification failures.
- Expand scope without disclosure.
- Perform irreversible actions without confirmation.
- Run unreviewed remote installation scripts.

## Project overrides

Document additions or stricter rules here:

- None.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: YYYY-MM-DD
- Related code: Repository-wide

