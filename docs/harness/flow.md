# Flow

## End-to-end sequence

1. `harness-init`
- sync global core
- initialize/repair profile
- branch policy check

2. `harness-run-task`
- writes run plan
- executes implementation command
- runs mechanical validation
- runs QA
- optional one-step review/fix loop
- packages PR artifacts

3. `harness-pr-package`
- validates critical checks and emits final bundle

## Run artifacts

Every run writes to `.harness/runs/<run-id>/`:
- `plan.md`
- `commands.log`
- `qa-report.json`
- `run-state.json`
- `summary.md`
- `guardrail-report.json`
- `pr-checklist.md`


## Simulation mode

Use --simulate with harness-qa-check or harness-run-task to validate orchestration and artifact packaging when shell execution is restricted.
