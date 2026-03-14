# Harness Maintenance Scheduler

- Windows: run `scripts/harness/scheduler/install-maintenance-task.ps1`
- Linux/macOS: run `scripts/harness/scheduler/install-maintenance-cron.sh` and add the output line to `crontab -e`

Both schedulers run `harness-maintenance` weekly and generate cleanup PR proposals without deploying or auto-merging.
