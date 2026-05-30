#!/usr/bin/env bash
# One-time setup for the Digital Ocean droplet.
# Run as root: bash deploy/setup-droplet.sh
set -euo pipefail

DOMAIN="remote-mcp-server.neogrouplimited.com"
APP_DIR="/var/www/trello-mcp"
LOG_DIR="/var/log/trello-mcp"

echo "==> Installing Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> Installing PM2, Nginx, Certbot"
npm install -g pm2
apt-get install -y nginx certbot python3-certbot-nginx ufw

echo "==> Firewall: allow SSH, HTTP, HTTPS"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Creating app and log directories"
mkdir -p "$APP_DIR" "$LOG_DIR"

echo "==> Adding WebSocket upgrade map to Nginx http block"
if ! grep -q "connection_upgrade" /etc/nginx/nginx.conf; then
  sed -i '/http {/a\\tmap $http_upgrade $connection_upgrade {\n\t\tdefault upgrade;\n\t\t'"''"' close;\n\t}' /etc/nginx/nginx.conf
fi

echo "==> Installing Nginx site config"
cp "$(dirname "$0")/nginx.conf" "/etc/nginx/sites-available/trello-mcp"
ln -sf /etc/nginx/sites-available/trello-mcp /etc/nginx/sites-enabled/trello-mcp
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "==> Obtaining SSL certificate for $DOMAIN"
systemctl start nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
  --register-unsafely-without-email
systemctl reload nginx

echo ""
echo "========================================="
echo "  Setup complete. Manual steps remaining:"
echo "========================================="
echo ""
echo "1. Clone the repo into $APP_DIR:"
echo "   git clone <your-repo-url> $APP_DIR"
echo ""
echo "2. Install and build:"
echo "   cd $APP_DIR && npm ci && npm run build"
echo ""
echo "3. Write secrets to /etc/trello-mcp.env (mode 600):"
echo "   cat > /etc/trello-mcp.env <<EOF"
echo "   TRELLO_API_KEY=your_api_key"
echo "   TRELLO_TOKEN=your_token"
echo "   MCP_AUTH_TOKEN=\$(openssl rand -hex 32)"
echo "   EOF"
echo "   chmod 600 /etc/trello-mcp.env"
echo "   echo 'Save MCP_AUTH_TOKEN — you need it to connect AI clients'"
echo ""
echo "4. Load secrets and start:"
echo "   set -a && source /etc/trello-mcp.env && set +a"
echo "   cd $APP_DIR"
echo "   pm2 start deploy/ecosystem.config.cjs"
echo "   pm2 save && pm2 startup"
echo ""
echo "5. Verify:"
echo "   curl https://$DOMAIN/health"
echo ""
echo "6. Connect from the Anthropic API:"
echo "   mcp_servers=[{"
echo "     'type': 'url',"
echo "     'url': 'https://$DOMAIN/sse',"
echo "     'name': 'trello-mcp',"
echo "     'authorization_token': '<your MCP_AUTH_TOKEN>'"
echo "   }]"
