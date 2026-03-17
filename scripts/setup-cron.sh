#!/bin/bash
# LeanPilot Production Cron Setup
# Run once on the server: sudo bash scripts/setup-cron.sh
#
# Sets up:
#   1. Daily database backups at 2:00 AM
#   2. Certbot SSL renewal check twice daily (at 3:00 AM and 3:00 PM)

set -euo pipefail

LEAN_DIR="/home/ubuntu/lean-os"
LOG_DIR="/var/log/leanpilot"

# Create log directory
mkdir -p "${LOG_DIR}"
mkdir -p /home/ubuntu/backups

# Write crontab entries
CRON_FILE="/tmp/leanpilot_cron"
cat > "${CRON_FILE}" << 'CRON'
# LeanPilot — Daily database backup at 2:00 AM
0 2 * * * /home/ubuntu/lean-os/backend/scripts/backup_db.sh >> /var/log/leanpilot/backup.log 2>&1

# LeanPilot — Certbot SSL renewal check (twice daily, recommended by Let's Encrypt)
0 3,15 * * * certbot renew --quiet --deploy-hook "docker restart lean-os-nginx-1" >> /var/log/leanpilot/certbot.log 2>&1

# LeanPilot — Cleanup old logs monthly (keep 90 days)
0 4 1 * * find /var/log/leanpilot -name "*.log" -mtime +90 -delete 2>/dev/null
CRON

# Install crontab (merge with existing if any)
crontab -l 2>/dev/null | grep -v "leanpilot\|lean-os\|certbot" > /tmp/existing_cron || true
cat /tmp/existing_cron "${CRON_FILE}" | crontab -
rm -f /tmp/existing_cron "${CRON_FILE}"

echo "Cron jobs installed:"
crontab -l | grep -E "leanpilot|lean-os|certbot"

echo ""
echo "Log locations:"
echo "  Backups:  ${LOG_DIR}/backup.log"
echo "  Certbot:  ${LOG_DIR}/certbot.log"
echo ""
echo "Backup location: /home/ubuntu/backups/"
echo ""
echo "Done! Verify with: crontab -l"
