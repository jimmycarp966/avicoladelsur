# Architecture

## Layer split

1. Global core
- Repository source: `tools/harness-core`
- Installed path: `%USERPROFILE%\\.agents\\harness-core` (Windows) or `~/.agents/harness-core` (Linux/macOS)
- Synced by `harness-init` (idempotent)

2. Repo layer
- Profile and schema: `.harness/profile*.yaml`
- Operational docs: `docs/harness/*`
- Runtime scripts: `scripts/harness/*`

## Runtime model

- Node modules in `scripts/harness/bin` implement behavior.
- Shell wrappers (`.sh` and `.ps1`) provide platform entrypoints.
- Shared logic in `scripts/harness/lib`:
  - profile loading/validation/persistence
  - command execution and logging
  - guardrail detection
  - mechanical validation

## Data outputs

- Run artifacts: `.harness/runs/<run-id>/`
- Maintenance artifacts:
  - Reports: `.harness/maintenance/reports/<report-id>/`
  - PR proposals: `.harness/maintenance/proposals/`

## Idempotency

- Core sync can be rerun safely.
- Profile init updates only missing values.
- Packaging rewrites deterministic artifacts in run directory.
