#!/bin/bash
# LeanPilot GitHub SSH Setup
# Run this in Git Bash: bash scripts/setup-github-ssh.sh

set -e

KEY_FILE="$HOME/.ssh/leanpilot_ed25519"

echo "=== LeanPilot GitHub SSH Setup ==="

# 1. Generate key
if [ -f "$KEY_FILE" ]; then
  echo "Key already exists at $KEY_FILE"
else
  ssh-keygen -t ed25519 -C "alberto@leanpilot.me" -f "$KEY_FILE" -N ""
  echo "Key generated!"
fi

# 2. Add to SSH config
if ! grep -q "Host github-leanpilot" "$HOME/.ssh/config" 2>/dev/null; then
  cat >> "$HOME/.ssh/config" << 'EOF'

Host github-leanpilot
  HostName github.com
  User git
  IdentityFile ~/.ssh/leanpilot_ed25519
  IdentitiesOnly yes
EOF
  echo "SSH config updated!"
fi

# 3. Show public key
echo ""
echo "=== COPY THIS PUBLIC KEY TO GITHUB ==="
echo "Go to: https://github.com/settings/keys → New SSH Key"
echo "Title: LeanPilot Dev"
echo ""
cat "$KEY_FILE.pub"
echo ""
echo "==================================="

# 4. Test connection
echo "Testing GitHub connection..."
ssh -T git@github-leanpilot 2>&1 || true

echo ""
echo "After adding the key to GitHub, run:"
echo "  cd '/c/Users/grass/Nextcloud4/Centro Studi Grassi/AI/leanpilot-v4'"
echo "  git remote add origin git@github-leanpilot:albertopepino/leanpilot-v4.git"
echo "  git push -u origin main"
