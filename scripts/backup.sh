#!/bin/bash
# LeanPilot Database Backup — convenience wrapper
# Delegates to backend/scripts/backup_db.sh with Docker-aware defaults.
#
# Usage: ./scripts/backup.sh
# Cron:  see scripts/backup-cron.txt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source .env if present (for POSTGRES_PASSWORD etc.)
if [ -f "${PROJECT_DIR}/backend/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "${PROJECT_DIR}/backend/.env"
    set +a
fi

exec "${PROJECT_DIR}/backend/scripts/backup_db.sh"
