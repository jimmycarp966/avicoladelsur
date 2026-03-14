# Guardrails

## Non-negotiable rules

1. Branch policy is enforced.
- Policy comes from `profile.branches.mode`.
- This repo uses `main-only`.
- `harness-validate` fails with `HARNESS_E_BRANCH_PROTECTED` when branch policy is violated.

2. Dangerous operations require explicit human confirmation.
- Deploy patterns (for example `vercel`, `kubectl apply`, `terraform apply`, `supabase db push`).
- Irreversible patterns (for example `rm -rf`, `git reset --hard`, `drop table`).
- Secret extraction patterns (for example `.env` reads, `printenv`).

3. Automation cannot bypass guardrails.
- QA commands are scanned during validation.
- `harness-run-task` blocks unsafe `--implement-cmd` and `--fix-cmd`.

## Confirmation flags

Use explicit flags only with human approval:
- `--human-confirm-deploy=true`
- `--human-confirm-irreversible=true`
- `--human-confirm-secrets=true`

Without those flags, blocked commands return `HARNESS_E_GUARDRAIL`.
