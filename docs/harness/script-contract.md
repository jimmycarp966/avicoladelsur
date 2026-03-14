# Script Contract

## Common flags

All commands support the same base flags:
- `--profile <path>`
- `--non-interactive`
- `--json`
- `--log-file <path>`

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

### `harness-validate`
- validates profile against required fields/schema presence
- verifies AGENTS index and harness docs
- checks guardrails and branch policy

### `harness-qa-check`
- runs `lint -> typecheck -> test -> smoke`
- writes `.harness/runs/<run-id>/qa-report.json`

### `harness-run-task`
- orchestrates full flow `plan -> implement -> validate -> QA -> PR package`
- supports one bounded review/fix loop through `--fix-cmd`

### `harness-pr-package`
- creates summary/checklist/guardrail report
- blocks when critical checks fail

### `harness-maintenance`
- scans drift/debt signals
- writes weekly drift reports
- creates cleanup branch proposal

Optional dry-run flag:
- `--simulate` (marks command execution as simulated and returns success for orchestration tests in restricted environments)
