# Harness Core

Source-of-truth core templates and contracts for harness engineering.

## Structure
- `templates/`: repository profile schema and defaults
- `prompts/`: reusable prompt scaffolds for plan/implement/qa
- `checks/`: shared guardrail patterns
- `docs/`: reusable core docs for installation and sync

## Sync target
- Windows: `%USERPROFILE%\\.agents\\harness-core`
- Linux/macOS: `~/.agents/harness-core`

Sync is performed by `scripts/harness/harness-init.{ps1,sh}` and is idempotent.
