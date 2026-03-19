#!/bin/bash
# LeanPilot Database Backup Script
# Run via cron: 0 2 * * * /home/ubuntu/lean-os/backend/scripts/backup_db.sh
#
# Keeps last 30 daily backups. Stores compressed SQL dumps.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
DB_NAME="${POSTGRES_DB:-leanpilot}"
DB_USER="${POSTGRES_USER:-leanpilot}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Fail explicitly if password not set (don't fall back to weak default)
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "[$(date)] ERROR: POSTGRES_PASSWORD not set. Export it before running this script."
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of ${DB_NAME}..."

# Use docker exec if running in Docker, else pg_dump directly
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "lean-os.*db"; then
    docker exec lean-os-db-1 pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
fi

# Verify backup is not empty
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "[$(date)] ERROR: Backup file is empty!"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Remove backups older than retention period
DELETED=$(find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "${DELETED}" -gt 0 ]; then
    echo "[$(date)] Cleaned up ${DELETED} old backup(s) (older than ${RETENTION_DAYS} days)"
fi

# List current backups
echo "[$(date)] Current backups:"
ls -lh "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz 2>/dev/null || echo "  (none)"

echo "[$(date)] Backup complete."
