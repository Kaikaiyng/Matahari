# Temporary Public Demo Design

**Date:** 2026-07-20
**Status:** Approved through the temporary-demo design discussion.

## Objective

Provide a free, temporary HTTPS address that lets a small invited audience use the Matahari demo from any network while the host Windows PC remains online. The workflow must be simple enough to start and stop by double-clicking files, must keep the existing SQLite demo data between sessions, and must never expose MariaDB, phpMyAdmin, or a raw Laravel port to the internet.

## Product decisions

- Use a Cloudflare Quick Tunnel. It does not require a Cloudflare account and creates a random `*.trycloudflare.com` address for the lifetime of the tunnel process.
- A changing address after every restart is acceptable.
- Use Matahari's existing application login as the only access gate. Anyone who receives the URL may reach the sign-in page, but protected application data and actions require authentication.
- Preserve `backend/database/database.sqlite` between starts and stops. The public-demo launcher must never reset, migrate fresh, seed, replace, or delete this database.
- If the SQLite database does not exist, startup fails with a clear instruction to create/reset the local demo database separately.
- Starting at Windows boot, a stable domain, production hosting, and Cloudflare Access are not part of this feature.

## Architecture and data flow

The public demo exposes one origin only:

```text
Remote browser
    -> HTTPS Quick Tunnel URL
    -> Vite Preview on 127.0.0.1:4175
       -> built frontend files
       -> /api proxy to Laravel on 127.0.0.1:8002
          -> persistent SQLite demo database
```

- Build the frontend with `VITE_API_BASE_URL=/api`, so a remote browser never attempts to call its own loopback address.
- Add Vite Preview configuration for the fixed loopback host and port, strict port selection, the `/api` proxy, and the generated `trycloudflare.com` host.
- Run Laravel on `127.0.0.1:8002` with process-scoped environment overrides for SQLite, `APP_DEBUG=false`, and file-backed session/cache behavior. Do not rewrite the developer's backend environment file.
- Run Vite Preview on `127.0.0.1:4175`. Only this preview service is connected to the Cloudflare tunnel.
- The fixed non-default ports isolate public-demo processes from the usual development servers. If either port is occupied, startup stops with a useful error instead of selecting an unexpected port.
- Same-origin `/api` proxying avoids cross-origin browser configuration and keeps the Laravel service private.

## Components

### User-facing launchers

Provide two double-clickable Windows command files at a clearly named location under `tools/`:

- `start-public-demo.cmd` invokes the PowerShell launcher and keeps its output readable. On success it displays the HTTPS address and copies it to the clipboard.
- `stop-public-demo.cmd` invokes the PowerShell shutdown routine and confirms that the task-owned processes have stopped. It does not alter the SQLite database.

The PowerShell implementation owns validation, process startup, health checks, tunnel URL discovery, logging, rollback, and shutdown. The command files remain thin entry points.

### Cloudflare bootstrap

- Keep `cloudflared.exe` in the task-owned ignored runtime area rather than requiring a machine-wide install.
- On first use, download a reviewed pinned Windows `cloudflared` release from Cloudflare's official release source and validate it against the pinned SHA-256 value before execution.
- A failed download or checksum mismatch aborts startup and explains the failure. It must never execute an unverified binary.
- Updating the pinned Cloudflare version or checksum is an explicit repository change, not an automatic silent upgrade.

### Runtime state

Use an ignored `.demo-public/` directory for the downloaded tunnel executable, logs, PID/state records, and the discovered public URL.

- Record only PIDs created by the current launcher.
- Before stopping a recorded PID, verify that the live process still matches the recorded executable or command line. Never kill a process solely because it uses the expected port.
- Detect stale state from a prior interrupted run and remove only task-owned stale records.
- Keep enough logs to diagnose startup failure without logging passwords, session tokens, or database contents.

## Startup and shutdown behavior

Startup performs these steps in order:

1. Verify the repository paths, PHP runtime, Node dependencies, frontend build tools, and persistent SQLite database.
2. Verify or bootstrap the pinned `cloudflared` executable.
3. Confirm ports `8002` and `4175` are available.
4. Build the frontend with the relative `/api` base.
5. Start Laravel and confirm its local health response.
6. Start Vite Preview and confirm the frontend and proxied API respond locally.
7. Start the Quick Tunnel, extract its generated HTTPS URL from structured output or logs, and confirm the public endpoint responds.
8. Save task-owned process state, show the URL, and copy it to the clipboard.

If any step fails, the launcher stops every process it started during that attempt, preserves the SQLite database, writes a diagnostic log, and exits with a clear message.

Shutdown validates and stops only the recorded tunnel, preview, and Laravel processes. It removes active runtime state while preserving the SQLite database and diagnostic logs. Once the tunnel stops, its temporary URL is no longer considered valid.

## Authentication and safety

- The generated URL is temporary and intended only for a small demo audience. It is not a production deployment and has no availability guarantee.
- Laravel and Vite bind to loopback addresses only. No database, phpMyAdmin, MariaDB, or direct Laravel listener is made public.
- Run public-demo Laravel with debug output disabled so exceptions, SQL details, paths, and stack traces are not returned to remote visitors.
- Protect the two existing legacy API routes that currently bypass login--`GET /api/dashboard/school` and `POST /api/invoices/generate-monthly`--using the same authentication middleware as the rest of the protected API.
- Preserve the routes' existing behavior for authenticated roles unless current authorization rules intentionally restrict an action.
- The launcher prints a reminder that the URL should be shared only with intended testers and that the stop launcher should be used when the demonstration ends.

## Error handling

- Missing prerequisites, missing database, occupied ports, build failure, unhealthy local services, failed tunnel download, checksum mismatch, tunnel timeout, and public health-check failure each produce a specific actionable message.
- Startup has a bounded wait for every service; it never waits indefinitely for a URL or health response.
- Failure cleanup is idempotent, so running the stop launcher after a partial or failed start remains safe.
- A repeated start detects an already-running healthy demo and displays its existing URL instead of launching duplicate processes.

## Verification strategy

### Automated checks

- Backend feature tests prove both legacy API routes reject unauthenticated requests and retain their expected authenticated behavior.
- The public-demo frontend build uses `/api`, and a build check confirms its generated assets do not contain the loopback API base URL.
- Existing backend tests, frontend tests, lint, type checking, and production build remain green.
- Script-oriented checks cover prerequisite failures, missing database behavior, stale state, PID ownership validation, occupied ports, and failure rollback without resetting SQLite.

### Local integration checks

- Build and serve the frontend using the public-demo configuration.
- Verify sign-in, Dashboard, Calendar, and same-origin API requests through Vite Preview.
- Verify creating, editing, and deleting a calendar entry, including delete confirmation.
- Create a uniquely named calendar entry, stop and restart the demo processes, confirm the entry is still present in SQLite, and delete the test entry after verification.

### Public smoke test

- Launch a real Quick Tunnel and open the generated HTTPS address.
- Verify the sign-in screen and a representative authenticated Dashboard and Calendar workflow without CORS or mixed-content errors.
- Stop the demo and confirm the local task-owned ports are closed and the recorded temporary URL is no longer usable as an active demo.

## Documentation

Update the development/demo documentation with:

- first-use and normal start/stop instructions;
- the location and persistence behavior of the SQLite demo database;
- the random-URL and host-PC-online requirements;
- the existing-login-only access model;
- explicit warnings that this is temporary demo infrastructure and must not use production data.

## Out of scope

- A stable or custom domain.
- A Cloudflare account, Cloudflare Access policy, or an additional tunnel password.
- Automatic startup when Windows boots.
- Production hosting, deployment, monitoring, SLA, or scaling.
- Exposing MariaDB, phpMyAdmin, SQLite files, or Laravel directly.
- Automatically resetting or reseeding demo data during public-demo startup or shutdown.
- Changing unrelated application features or authorization rules.
