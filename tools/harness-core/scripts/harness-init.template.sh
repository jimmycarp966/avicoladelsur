#!/usr/bin/env bash
set -euo pipefail

# Template wrapper. Repositories should point this to their local runtime script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../scripts/harness/bin/harness-init.mjs" "$@"
