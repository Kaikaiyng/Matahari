# Temporary Public Demo

Status: Current operator guide

Last reviewed: 2026-08-13

## What it does

The public-demo launcher creates a free temporary `https://...trycloudflare.com` address. The host PC must remain powered on and connected to the internet. The address normally changes after stopping and restarting.

This is demo-only infrastructure. Share the URL and seeded demo login only with intended testers. Never place production or real student data in the demo SQLite database. The current launcher exposes the Admin demo only; it does not publish the separate Community App on port `5174`.

## First use

From the repository root, create demo data once if `backend/database/database.sqlite` is missing:

```powershell
tools\php\reset-demo-sqlite.cmd
```

Double-click `tools\public-demo\start-public-demo.cmd`. First use downloads and verifies the pinned official Cloudflare executable. Windows must provide `php.exe`, `node.exe`, `npm.cmd`, and `curl.exe`. When startup succeeds, the HTTPS URL appears and is copied to the clipboard.

Cloudflare may need up to two minutes to publish a new random hostname. Keep the startup window open while it verifies the public HTTPS address.

## Normal use

1. Double-click `tools\public-demo\start-public-demo.cmd`.
2. Send the displayed URL to the small demo audience.
3. Sign in with the seeded demo username `admin` and the separately shared demo password. The login form does not prefill either credential.
4. Double-click `tools\public-demo\stop-public-demo.cmd` when the demonstration ends.

Starting and stopping does not reset `backend/database/database.sqlite`; calendar entries and other demo changes remain for the next session.

## Safety model

Only Vite Preview is tunneled. Laravel listens on `127.0.0.1:8002`, Vite Preview listens on `127.0.0.1:4175`, debug output is disabled, and MariaDB, phpMyAdmin, and database files are never exposed. The tunnel uses HTTP/2 for compatibility with networks that restrict outbound QUIC. The application login is the only access gate; anyone with the URL can reach the sign-in page.

The downloaded `cloudflared.exe` is kept under the ignored `.demo-public/` directory. Its version and SHA-256 are pinned in `tools/public-demo/PublicDemo.psm1`; checksum validation must not be bypassed.

## Troubleshooting

- Missing database: run `tools\php\reset-demo-sqlite.cmd` once. This intentionally rebuilds demo SQLite, so do not use it when you need to preserve current demo changes.
- Occupied port: stop the local service using `8002` or `4175`, then retry.
- Download, checksum, or tunnel failure: read `.demo-public/logs/`; do not bypass checksum validation.
- Slow DNS: the launcher first uses Windows DNS, then falls back to Cloudflare's `1.1.1.1` only for its public health check. Testers continue to use their normal browser DNS.
- Old URL: start again and share the newly displayed address.
- End of demo: run `stop-public-demo.cmd`; closing a browser tab does not stop the tunnel.

For ownership, safe change boundaries, and the verification/publish checklist, see the [Maintenance Guide](MAINTENANCE_GUIDE.md).
