#!/bin/bash
# LeanPilot Database Restore Script
# Usage: ./restore_db.sh /path/to/backup.sql.gz

set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh /home/ubuntu/backups/leanpilot_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${POSTGRES_DB:-leanpilot}"
DB_USER="${POSTGRES_USER:-leanpilot}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: File not found: ${BACKUP_FILE}"
    exit 1
fi

echo "WARNING: This will DROP and recreate the ${DB_NAME} database!"
echo "Backup file: ${BACKUP_FILE}"
read -p "Continue? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo "[$(date)] Restoring ${DB_NAME} from ${BACKUP_FILE}..."

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "lean-os.*db"; then
    gunzip -c "${BACKUP_FILE}" | docker exec -i lean-os-db-1 psql -U "${DB_USER}" "${DB_NAME}"
else
    if [ -z "${POSTGRES_PASSWORD:-}" ]; then
        echo "ERROR: POSTGRES_PASSWORD not set. Refusing to use a default password."
        exit 1
    fi
    PGPASSWORD="${POSTGRES_PASSWORD}" gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
fi

echo "[$(date)] Restore completed successfully."
