# Maintenance Loop (Anti-drift)

## Goal

Detect drift and technical debt continuously and generate cleanup PR proposals.

## Command

- `scripts/harness/harness-maintenance.ps1 --non-interactive --create-branch=false`
- `scripts/harness/harness-maintenance.sh --non-interactive --create-branch=false`

## Outputs

- Drift reports: `.harness/maintenance/reports/<report-id>/`
- PR proposals: `.harness/maintenance/proposals/`

## Scheduler templates

- Windows Task Scheduler: `scripts/harness/scheduler/install-maintenance-task.ps1`
- Cron template (Linux/macOS): `scripts/harness/scheduler/install-maintenance-cron.sh`

## Safety

- No deploy actions
- No auto-merge
- No irreversible production mutations
- Guardrails remain active during maintenance runs
