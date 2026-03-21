---
name: Deploy Guide
description: Hetzner server deploy commands, SSH details, and deployment procedure
type: reference
---

**Server:** 178.104.71.252 (Hetzner)
**User:** root
**App path:** /home/ubuntu/lean-os
**Site URL:** https://lean.autopilot.rs
**Setup:** Docker Compose (postgres, redis, backend, frontend, nginx, worker, certbot)

## Deploy Steps (from local Windows PowerShell)

1. Build frontend locally (optional, Docker rebuilds from source):
   ```
   cd frontend ; npm run build
   ```

2. Create archive — EXCLUDES backend/.env to protect server secrets:
   ```
   tar -czf deploy.tar.gz --exclude="backend/.env" --exclude="backend/__pycache__" --exclude="frontend/node_modules" --exclude="frontend/.next" --exclude="*.pyc" backend frontend\src frontend\public frontend\package.json frontend\package-lock.json frontend\next.config.js frontend\tsconfig.json frontend\tailwind.config.ts frontend\postcss.config.js frontend\Dockerfile
   ```

3. Upload: `scp deploy.tar.gz root@178.104.71.252:/tmp/`

4. SSH: `ssh root@178.104.71.252`

5. On server:
   ```bash
   cd /home/ubuntu/lean-os
   tar -xzf /tmp/deploy.tar.gz
   bash deploy.sh
   ```

**CRITICAL:** Never include `backend/.env` in the tar — the server has its own production secrets. The tar overwrites files and will replace the production SECRET_KEY and DATABASE_URL with local dev values.

## If backend fails after deploy (SECRET_KEY error):
```bash
cd /home/ubuntu/lean-os
python3 -c 'import secrets; print(secrets.token_urlsafe(64))' | xargs -I{} sed -i 's|^SECRET_KEY=.*|SECRET_KEY={}|' backend/.env
DB_PASS=$(grep DB_PASSWORD .env | cut -d= -f2)
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql+asyncpg://leanpilot:${DB_PASS}@db:5432/leanpilot|" backend/.env
sed -i 's|^APP_URL=.*|APP_URL=https://lean.autopilot.rs|' backend/.env
sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://lean.autopilot.rs|' backend/.env
docker compose -f docker-compose.prod.yml up -d --build backend
```

## Useful server commands
- Logs: `docker compose -f docker-compose.prod.yml logs -f backend`
- Restart: `docker compose -f docker-compose.prod.yml restart`
- DB shell: `docker compose -f docker-compose.prod.yml exec db psql -U leanpilot`
- Remove stale alembic files: `docker compose -f docker-compose.prod.yml exec -T backend rm /app/alembic/versions/FILE.py`
