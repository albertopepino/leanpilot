#!/bin/bash
# ============================================================
# LeanPilot — Fresh EC2 Instance Setup Script
# Run this ONCE on a new Ubuntu 22.04 EC2 instance
# ============================================================
set -e

echo "=== LeanPilot Fresh Instance Setup ==="
echo "Step 1: System updates..."
sudo apt-get update && sudo apt-get upgrade -y

echo "Step 2: Install Docker..."
# Install Docker via official method
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add ubuntu user to docker group (no sudo needed for docker)
sudo usermod -aG docker ubuntu

echo "Step 3: Create project directory..."
mkdir -p /home/ubuntu/lean-os

echo ""
echo "=== Setup Complete ==="
echo ""
echo "NEXT STEPS:"
echo "  1. Log out and back in (for docker group to take effect):"
echo "     exit"
echo "     ssh -i your-key.pem ubuntu@lean.autopilot.rs"
echo ""
echo "  2. Upload project files via WinSCP to /home/ubuntu/lean-os/"
echo "     Upload: frontend/, backend/, docker-compose.prod.yml, .env,"
echo "             nginx.conf, deploy.sh"
echo "     SKIP: node_modules/, __pycache__/, .git/"
echo ""
echo "  3. Run the deploy:"
echo "     cd /home/ubuntu/lean-os"
echo "     chmod +x deploy.sh"
echo "     ./deploy.sh"
echo ""
echo "  4. Get SSL certificate (after DNS propagation):"
echo "     docker compose -f docker-compose.prod.yml run --rm certbot certonly \\"
echo "       --webroot -w /var/www/certbot -d lean.autopilot.rs"
echo ""
