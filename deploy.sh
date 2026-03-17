#!/bin/bash
# LeanPilot Production Deploy Script
# Run from /home/ubuntu/lean-os
set -e

echo "=== LeanPilot Deploy ==="

# 0. Check required files
if [ ! -f ".env" ]; then
  echo "ERROR: .env file missing. Create it with: echo 'DB_PASSWORD=YourSecurePassword' > .env"
  exit 1
fi
if [ ! -f "backend/.env" ]; then
  echo "ERROR: backend/.env missing. Copy from backend/.env.example and fill in values."
  exit 1
fi

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
