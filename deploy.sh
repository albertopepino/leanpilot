#!/bin/bash
# LeanPilot Production Deploy Script
# Run from /home/ubuntu/lean-os
set -e

echo "=== LeanPilot Deploy ==="

# 0. Preserve existing secrets before any file overwrites
EXISTING_SECRET_KEY=""
EXISTING_DB_PASSWORD=""

if [ -f "backend/.env" ]; then
  EXISTING_SECRET_KEY=$(grep -s '^SECRET_KEY=' backend/.env | cut -d'=' -f2- || true)
  EXISTING_DB_PASSWORD=$(grep -s '^DB_PASSWORD=' backend/.env | cut -d'=' -f2- || true)
fi
# Also check root .env
if [ -f ".env" ]; then
  [ -z "$EXISTING_DB_PASSWORD" ] && EXISTING_DB_PASSWORD=$(grep -s '^DB_PASSWORD=' .env | cut -d'=' -f2- || true)
  [ -z "$EXISTING_SECRET_KEY" ] && EXISTING_SECRET_KEY=$(grep -s '^SECRET_KEY=' .env | cut -d'=' -f2- || true)
fi

echo ">>> Preserved existing secrets: SECRET_KEY=$([ -n "$EXISTING_SECRET_KEY" ] && echo 'YES' || echo 'NO'), DB_PASSWORD=$([ -n "$EXISTING_DB_PASSWORD" ] && echo 'YES' || echo 'NO')"

# 0b. Check required files
if [ ! -f ".env" ]; then
  echo "ERROR: .env file missing. Create it with: echo 'DB_PASSWORD=YourSecurePassword' > .env"
  exit 1
fi
if [ ! -f "backend/.env" ]; then
  echo "ERROR: backend/.env missing. Copy from backend/.env.example and fill in values."
  exit 1
fi

# 0c. Restore secrets into .env files (generate new ones only if none existed)
if [ -z "$EXISTING_SECRET_KEY" ]; then
  EXISTING_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || openssl rand -base64 48)
  echo ">>> Generated new SECRET_KEY"
fi
if [ -z "$EXISTING_DB_PASSWORD" ]; then
  EXISTING_DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || openssl rand -base64 24)
  echo ">>> Generated new DB_PASSWORD"
fi

# Write secrets back into backend/.env (preserve or inject)
if grep -q '^SECRET_KEY=' backend/.env 2>/dev/null; then
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${EXISTING_SECRET_KEY}|" backend/.env
else
  echo "SECRET_KEY=${EXISTING_SECRET_KEY}" >> backend/.env
fi
if grep -q '^DB_PASSWORD=' backend/.env 2>/dev/null; then
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${EXISTING_DB_PASSWORD}|" backend/.env
else
  echo "DB_PASSWORD=${EXISTING_DB_PASSWORD}" >> backend/.env
fi

# Write DB_PASSWORD into root .env
if grep -q '^DB_PASSWORD=' .env 2>/dev/null; then
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${EXISTING_DB_PASSWORD}|" .env
else
  echo "DB_PASSWORD=${EXISTING_DB_PASSWORD}" >> .env
fi

echo ">>> Secrets restored into .env files"

# 1. Stop existing containers (if any)
echo ">>> Stopping existing containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# 2. Build and start all services
echo ">>> Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 3. Wait for backend to be healthy (poll instead of sleep)
echo ">>> Waiting for backend to be healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost/api/health > /dev/null 2>&1; then
    echo "    Backend is healthy!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "    WARNING: Backend not healthy after 60s. Check logs:"
    echo "    docker compose -f docker-compose.prod.yml logs backend"
  fi
  sleep 2
done

# 4. Run database migrations
echo ">>> Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
echo "    Migrations complete!"

# 4. Show container status
echo ""
echo ">>> Container status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Deploy complete ==="
echo "Site: http://lean.autopilot.rs"
echo ""
echo "Useful commands:"
echo "  Logs:      docker compose -f docker-compose.prod.yml logs -f backend"
echo "  Restart:   docker compose -f docker-compose.prod.yml restart"
echo "  SSL cert:  docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot -w /var/www/certbot -d lean.autopilot.rs"
echo ""
