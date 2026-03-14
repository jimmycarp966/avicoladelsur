# Troubleshooting

## `HARNESS_E_CFG_MISSING`
Cause:
- `.harness/profile.yaml` missing or incomplete
- `.harness/profile.schema.yaml` missing

Fix:
1. Run interactive init:
   - `./scripts/harness/harness-init.sh`
   - or `powershell -ExecutionPolicy Bypass -File scripts/harness/harness-init.ps1`
2. Fill missing fields and rerun `harness-validate`.

## `HARNESS_E_BRANCH_PROTECTED`
Cause:
- current branch violates configured branch policy

Fix:
1. Check `branches.mode` and `repo.default_branch` in `.harness/profile.yaml`
2. If mode is `main-only`, switch to main:
   - `git checkout main`
3. Rerun harness command.

## `HARNESS_E_GUARDRAIL`
Cause:
- command matches blocked deploy/destructive/secrets patterns

Fix:
1. remove dangerous command from automation or task
2. if truly necessary, rerun with explicit human confirmation flags

## `HARNESS_E_QA_FAILED`
Cause:
- one or more QA commands failed

Fix:
1. inspect `.harness/runs/<run-id>/qa-report.json`
2. fix failing checks
3. rerun `harness-qa-check` and `harness-pr-package`
