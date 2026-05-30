// PM2 process config — runs the MCP server in remote mode.
// Usage:
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup   ← persist across reboots
//
// Env vars NOT listed here (credentials, MCP_AUTH_TOKEN) should live in
// /etc/trello-mcp.env and be loaded by the systemd/PM2 env_file approach,
// or set directly in the droplet's environment before pm2 start.

module.exports = {
  apps: [
    {
      name:        "trello-mcp",
      script:      "dist/index.js",
      cwd:         "/var/www/trello-mcp",   // path on remote-mcp-server.neogrouplimited.com
      instances:   1,
      autorestart: true,
      watch:       false,
      max_memory_restart: "300M",

      env: {
        NODE_ENV:   "production",
        TRANSPORT:  "remote",
        PORT:       "3001",
        BIND_HOST:  "127.0.0.1",   // Nginx terminates TLS; Node only listens on loopback
        // Set these in the droplet shell or a secrets manager — NOT here:
        // TRELLO_API_KEY:   "...",
        // TRELLO_TOKEN:     "...",
        // MCP_AUTH_TOKEN:   "...",
      },

      // Logging
      out_file:   "/var/log/trello-mcp/out.log",
      error_file: "/var/log/trello-mcp/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
