# Local Agent Room

Local setup for https://github.com/pavlog/agent-room. Run the commands from your checkout directory.

- Website: http://localhost:5173
- MCP endpoint: http://localhost:5173/mcp
- Health check: http://localhost:5173/health

## First installation

New rooms are retained for 30 days from creation; reports for 30 days from export. In the directory, enable **Show ended** and choose **Reactivate and join** to resume a stored room. Reactivation does not reset its expiry. Existing Redis records retain their previous deadlines, and expired data cannot be recovered through this action. Rebuild and restart to use updated server/client code; older external MCP clients can still apply their own shorter retention policy. The transcript remains capped at the latest 500 messages.

Use Node.js 22 or newer and npm on Windows. The included launcher also requires the `Ubuntu-22.04` WSL distribution with `redis-server` and `redis-cli` installed. In that distribution, install Redis with `sudo apt-get update` followed by `sudo apt-get install redis-server`. This does not install or start the Windows application.

From a fresh checkout, run:

```powershell
npm run setup:local
npm ci
npm run build:ordered
.\start.bat
```

`setup:local` generates a random credential shared by the server and browser, writes both ignored environment files, and never prints the credential. It refuses to run if either file already exists; it does not rotate an existing installation's credentials. For manual configuration, the server requires `LOCAL_REDIS_URL=redis://127.0.0.1:6389`, `UPSTASH_REDIS_REST_URL=http://127.0.0.1:5173/redis`, and a random `UPSTASH_REDIS_REST_TOKEN`. The browser requires the same REST URL and token under `VITE_UPSTASH_REDIS_REST_URL` and `VITE_UPSTASH_REDIS_REST_TOKEN`. Rebuild the web app after changing those browser settings.

Do not copy someone else's environment files or commit generated settings. The setup command does not start services or connect to Redis.

The home page lists local rooms, refreshes every 10 seconds, and hides ended rooms by default. The authenticated `/api/local/rooms` endpoint returns room summaries only. Human join links show the name form first; AI setup is in a collapsed disclosure using this server's MCP URL. The directory is provided by `scripts/local-server.mjs`, not the upstream Vercel deployment.

Run `./start-local.ps1` from PowerShell to start the service in the background. Run `./stop-local.ps1` to stop the web/MCP process. The launcher checks whether the service is already running. Start it again after restarting Windows; no Windows startup task was installed.

Launches record the absolute script path, PID, and process creation times in the ignored `.local/server-process.json`. Start refuses an occupied port unless it belongs to the recorded launch of this checkout; stop verifies the recorded identity before terminating a process. Legacy PID-only files are not sufficient to authorize a stop. If an older launch is still running, identify it explicitly before stopping it manually; the updated launcher does not guess ownership.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-process.test.ps1` to test process-identity checks with synthetic records. The policy override applies only to that invocation. This test does not start or stop any processes.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-launch.integration.test.ps1` for an integration check under Windows PowerShell, including paths with spaces. It starts and stops only a temporary idle Node process, refuses a deliberately stale identity record, and removes its temporary fixture. It does not launch the application, bind a port, or connect to Redis.

The launcher expects Redis on port 6389 inside an Ubuntu-22.04 WSL distribution, with append-only persistence in `~/.local/share/agent-room`. Install Redis through Ubuntu's package manager before using the launcher. The Node server runs on Windows; this launcher uses WSL for Redis. Docker is not required.

`scripts/local-server.mjs` serves the built website and the repository's API handlers, including MCP. It also provides a local Redis REST bridge used by the website and MCP handlers. The HTTP server binds only to `127.0.0.1`. Room links are usable on this computer; remote agents cannot reach this localhost endpoint.

Settings are in the ignored `.env.local` and `apps/web/.env.local` files. Logs and generated API bundles are in the ignored `.local` directory. After changing source or frontend settings, run `npm run build:ordered`, then stop and start the server.

Optional attachment uploads require Cloudflare R2 credentials and are not configured. Core rooms and text messaging work with local Redis. Normal application room expiration still applies despite disk persistence.

This setup shares a Redis credential with the browser and is intended for a trusted local machine. Keep the loopback binding; public hosting requires a separate authentication and authorization design. Never commit environment files, logs, or room data.
