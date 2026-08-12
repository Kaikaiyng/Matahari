# MIS Parent & Student App

This is the independent mobile-first web workspace for Matahari International School Parent and Student users. It has its own login, build, tests, deployment surface, and domain boundary. It shares the Laravel API and authoritative database with the Admin Panel; it does not share the Admin frontend runtime.

## Local Development

```powershell
cd app
npm.cmd ci
npm.cmd run dev
```

The development server is fixed to port `5174`. Open `http://127.0.0.1:5174`; open Admin separately at `http://localhost:5173`. Those distinct local hosts keep their host-only session cookies separate. The App proxies same-origin browser requests under `/api` to `http://127.0.0.1:8000`. Override the backend target only in an ignored `.env.local`:

```dotenv
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
VITE_APP_ENVIRONMENT=staging
```

## Validation

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Deployment Boundary

Deploy `app/dist` on the App domain and reverse-proxy that domain's `/api` path to the shared Laravel backend. Deploy `frontend/dist` separately on the Admin domain with the same `/api` reverse-proxy pattern. This preserves browser session/CSRF behavior without exposing Laravel directly as a cross-site API.

There is no Capacitor, Firebase, native authentication, or store packaging in this workspace yet. Those remain separately approved future work.
