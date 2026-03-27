# Script Contract

## Common flags

Base flags used across the harness commands:
- `--profile <path>`
- `--json`
- `--log-file <path>`

Common automation / non-interactive flags:
- `--non-interactive`
- `--run-id <id>`
- `--run-dir <path>`
- `--simulate`

Human confirmation flags used by QA / orchestration flows:
- `--human-confirm-deploy`
- `--human-confirm-irreversible`
- `--human-confirm-secrets`

## Error codes

- `HARNESS_E_CFG_MISSING`: critical config or schema/profile missing
- `HARNESS_E_BRANCH_PROTECTED`: blocked by branch policy
- `HARNESS_E_GUARDRAIL`: dangerous command blocked
- `HARNESS_E_QA_FAILED`: QA sequence failed

## Branch policy modes

- `main-only`: current branch must match `repo.default_branch`
- `ask-before-create`: if branch is blocked by `branches.protected`, ask to create one
- `auto-create`: if branch is blocked by `branches.protected`, auto-create one
- `fail`: if branch is blocked by `branches.protected`, fail

## Commands

### `harness-init`
- syncs global core
- resolves missing critical profile config
- in interactive mode asks numbered questions and persists answers
- enforces branch policy from profile
- extra flags:
  - `--schema <path>`
  - `--example <path>`
  - `--core-target <path>`

### `harness-validate`
- validates profile against required fields/schema presence
- verifies AGENTS index and harness docs
- checks guardrails and branch policy
- extra flags:
  - `--skip-branch-check`

### `harness-qa-check`
- runs `lint -> typecheck -> test -> smoke`
- writes `.harness/runs/<run-id>/qa-report.json`
- extra flags:
  - `--run-id <id>`
  - `--run-dir <path>`
  - `--human-confirm-deploy`
  - `--human-confirm-irreversible`
  - `--human-confirm-secrets`
  - `--simulate`

### `harness-run-task`
- orchestrates full flow `plan -> implement -> validate -> QA -> PR package`
- supports one bounded review/fix loop through `--fix-cmd`
- required task flags:
  - `--task "<task>"`
  - `--implement-cmd "<command>"`
- optional flags:
  - `--fix-cmd "<command>"`
  - `--schema <path>`
  - `--run-id <id>`
  - `--run-dir <path>`
  - `--human-confirm-deploy`
  - `--human-confirm-irreversible`
  - `--human-confirm-secrets`
  - `--simulate`

### `harness-pr-package`
- creates summary/checklist/guardrail report
- blocks when critical checks fail
- extra flags:
  - `--run-id <id>`
  - `--run-dir <path>`
  - `--no-require-pass`

### `harness-maintenance`
- scans drift/debt signals
- writes weekly drift reports
- creates cleanup branch proposal
- extra flags:
  - `--create-branch`

Optional dry-run flag:
- `--simulate` (marks command execution as simulated and returns success for orchestration tests in restricted environments)
