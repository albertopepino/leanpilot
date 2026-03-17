#!/bin/bash
# LeanPilot — One-command setup
# Usage: chmod +x setup.sh && ./setup.sh

set -e

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║        LeanPilot Setup v1.0           ║"
echo "  ║   Lean Manufacturing OS for SMEs      ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose v2 is required. Update Docker: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env

    # Generate secret key
    SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || openssl rand -base64 48)
    sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET}|" .env

    # Generate DB password
    DB_PW=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))" 2>/dev/null || openssl rand -base64 18)
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PW}|" .env

    # Generate admin password
    ADMIN_PW=$(python3 -c "import secrets; print(secrets.token_urlsafe(12))" 2>/dev/null || openssl rand -base64 9)
    sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PW}|" .env

    echo "Generated .env with secure random keys"
else
    echo ".env already exists, skipping generation"
fi

# Source the env
source .env

# Create backend .env
mkdir -p backend
cat > backend/.env <<EOF
DATABASE_URL=postgresql+asyncpg://leanpilot:${DB_PASSWORD}@db:5432/leanpilot
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
APP_URL=${APP_URL:-http://localhost:3000}
CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:3000}
OPENAI_API_KEY=${OPENAI_API_KEY}
AI_MODULE_ENABLED=true
AI_MODEL=${AI_MODEL:-gpt-4o}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL:-noreply@leanpilot.io}
REDIS_URL=redis://redis:6379/0
EOF

echo ""
echo "Starting LeanPilot..."
echo ""

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Wait for backend to be healthy
echo "Waiting for services to start..."
for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" 2>/dev/null; then
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

# Seed database
echo "Seeding database..."
docker compose -f docker-compose.prod.yml exec -T backend python seed_db.py

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║          LeanPilot is ready!                  ║"
echo "  ╠═══════════════════════════════════════════════╣"
echo "  ║  URL:      ${APP_URL:-http://localhost:3000}  "
echo "  ║  Email:    ${ADMIN_EMAIL:-admin@leanpilot.io} "
echo "  ║  Password: ${ADMIN_PASSWORD}                  "
echo "  ╠═══════════════════════════════════════════════╣"
echo "  ║  Save these credentials securely!             ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""
