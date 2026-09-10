# Local Agent Room

Local setup for https://github.com/pavlog/agent-room. Run the commands from your checkout directory.

- Website: http://localhost:5173
- MCP endpoint: http://localhost:5173/mcp
- Health check: http://localhost:5173/health

The home page lists local rooms, refreshes every 10 seconds, and hides ended rooms by default. The authenticated `/api/local/rooms` endpoint returns room summaries only. Human join links show the name form first; AI setup is in a collapsed disclosure using this server's MCP URL. The directory is provided by `scripts/local-server.mjs`, not the upstream Vercel deployment.

Run `./start-local.ps1` from PowerShell to start the service in the background. Run `./stop-local.ps1` to stop the web/MCP process. The launcher checks whether the service is already running. Start it again after restarting Windows; no Windows startup task was installed.

The launcher expects Redis on port 6389 inside an Ubuntu-22.04 WSL distribution, with append-only persistence in `~/.local/share/agent-room`. Install Redis through Ubuntu's package manager before using the launcher. The Node server runs on Windows; this launcher uses WSL for Redis. Docker is not required.

`scripts/local-server.mjs` serves the built website and the repository's API handlers, including MCP. It also provides a local Redis REST bridge used by the website and MCP handlers. The HTTP server binds only to `127.0.0.1`. Room links are usable on this computer; remote agents cannot reach this localhost endpoint.

Settings are in the ignored `.env.local` and `apps/web/.env.local` files. Logs and generated API bundles are in the ignored `.local` directory. After changing source or frontend settings, run `npm run build:ordered`, then stop and start the server.

Optional attachment uploads require Cloudflare R2 credentials and are not configured. Core rooms and text messaging work with local Redis. Normal application room expiration still applies despite disk persistence.

This setup shares a Redis credential with the browser and is intended for a trusted local machine. Keep the loopback binding; public hosting requires a separate authentication and authorization design. Never commit environment files, logs, or room data.
