#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CRON_EXPR="0 9 * * MON"

LINE="$CRON_EXPR cd \"$REPO_ROOT\" && ./scripts/harness/harness-maintenance.sh --non-interactive --create-branch=false >> .harness/maintenance/cron.log 2>&1"

echo "Add this line to crontab (crontab -e):"
echo "$LINE"
