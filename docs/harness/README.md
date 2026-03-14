# Harness Engineering - Avicola ERP

This folder is the system of record for the harness implementation used in this repository.

Reference model: https://openai.com/index/harness-engineering/

## Components

- Global core source in repository: `tools/harness-core/`
- Global installed core path:
  - Windows: `%USERPROFILE%\\.agents\\harness-core`
  - Linux/macOS: `~/.agents/harness-core`
- Repo profile:
  - `.harness/profile.yaml`
  - `.harness/profile.schema.yaml`
  - `.harness/profile.example.yaml`
- Runtime scripts:
  - `scripts/harness/harness-init.{ps1,sh}`
  - `scripts/harness/harness-validate.{ps1,sh}`
  - `scripts/harness/harness-run-task.{ps1,sh}`
  - `scripts/harness/harness-qa-check.{ps1,sh}`
  - `scripts/harness/harness-pr-package.{ps1,sh}`
  - `scripts/harness/harness-maintenance.{ps1,sh}`

## Core flow

`plan -> implement -> validate -> QA -> PR package`

- `harness-run-task` orchestrates the full loop.
- `harness-validate` enforces mechanical checks and guardrails.
- `harness-qa-check` enforces lint, typecheck, test, smoke.
- `harness-pr-package` blocks packaging when critical checks fail.

## Critical constraints

- Branch policy is profile-driven. In this repo it is `main-only`.
- No deploy, no irreversible operations, no secret extraction without explicit human confirmation.
- Missing critical profile config:
  - Interactive mode: ask numbered questions and persist to `.harness/profile.yaml`.
  - Non-interactive/CI: fail with actionable error (`HARNESS_E_CFG_MISSING`).

## Document index

- [Architecture](./architecture.md)
- [Guardrails](./guardrails.md)
- [Script Contract](./script-contract.md)
- [Flow](./flow.md)
- [Troubleshooting](./troubleshooting.md)
- [Maintenance](./maintenance.md)

## Quickstart

Windows (PowerShell):
1. `powershell -ExecutionPolicy Bypass -File scripts/harness/harness-init.ps1`
2. `powershell -ExecutionPolicy Bypass -File scripts/harness/harness-validate.ps1`
3. `powershell -ExecutionPolicy Bypass -File scripts/harness/harness-run-task.ps1 --task "<task>" --implement-cmd "<command>"`

Linux/macOS:
1. `./scripts/harness/harness-init.sh`
2. `./scripts/harness/harness-validate.sh`
3. `./scripts/harness/harness-run-task.sh --task "<task>" --implement-cmd "<command>"`
