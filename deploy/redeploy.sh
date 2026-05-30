#!/usr/bin/env bash
# Run on the droplet to pull and restart the server.
# Usage: bash deploy/redeploy.sh
set -euo pipefail

APP_DIR="/var/www/trello-mcp"
cd "$APP_DIR"

echo "==> Pulling latest"
git pull --ff-only

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Restarting via PM2"
pm2 restart trello-mcp --update-env \
  || pm2 start deploy/ecosystem.config.cjs

echo "==> Done"
pm2 status trello-mcp
