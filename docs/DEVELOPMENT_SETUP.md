# Development Setup

Version: 0.2
Date: 2026-06-26

This document records the current local development setup status and the steps needed to continue implementation.

## 1. Current Scaffold Status

Created:

- `frontend/` Vite + React + TypeScript app
- MIS dashboard prototype in `frontend/src/App.tsx`
- MIS logo asset in `frontend/src/assets/mis-logo.jpg`
- `backend/` Laravel app
- MVP database migrations for school finance tables
- Core Laravel models and relationships
- MIS demo seed data
- Invoice generation, payment recording, and receipt number services
- Billing feature tests
- Dashboard, invoice generation, and payment API endpoints
- Frontend dashboard live API connection with fallback data
- Backend server launcher in `tools/php/serve-backend.cmd`
- Project-local PHP configuration in `tools/php/php.ini`
- Project-local PHP launcher in `tools/php/php-local.cmd`

Frontend verified:

```powershell
cd frontend
npm.cmd run lint
npm.cmd run build
```

Backend verified:

```powershell
cd backend
..\tools\php\php-local.cmd artisan migrate:fresh --force
..\tools\php\php-local.cmd artisan migrate:fresh --seed --force
..\tools\php\php-local.cmd vendor\bin\phpunit
```

## 2. Local Tooling Observed

Available:

- PHP 8.4.21
- Node.js 24.12.0
- npm 11.6.2 through `npm.cmd`
- npx 11.6.2 through `npx.cmd`

Missing or blocked:

- `composer` command is not installed globally
- Docker is not installed or not in PATH
- PowerShell blocks `npm.ps1`, so use `npm.cmd`
- System PHP has no loaded `php.ini`; use `tools\php\php-local.cmd`

## 3. Frontend Commands

From repository root:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Production build:

```powershell
cd frontend
npm.cmd run build
```

## 4. Backend PHP Configuration

The repository includes a local PHP config for development:

```text
tools/php/php.ini
```

Use this launcher instead of plain `php`:

```powershell
tools\php\php-local.cmd
```

The local config enables:

- `curl`
- `fileinfo`
- `mbstring`
- `mysqli`
- `openssl`
- `pdo_mysql`
- `pdo_sqlite`
- `sqlite3`
- `zip`

System PHP still has no global `php.ini`, so plain `php artisan ...` may fail. Prefer the local launcher.

## 5. Composer Workaround Used

Composer was downloaded temporarily to:

```text
%TEMP%\composer.phar
```

Command used:

```powershell
$composer = Join-Path $env:TEMP 'composer.phar'
Invoke-WebRequest -Uri 'https://getcomposer.org/composer-stable.phar' -OutFile $composer
tools\php\php-local.cmd $composer --version
```

Laravel was scaffolded successfully with:

```powershell
$composer = Join-Path $env:TEMP 'composer.phar'
tools\php\php-local.cmd $composer create-project laravel/laravel backend
```

## 6. Backend Commands

Run Laravel commands through the local PHP launcher:

```powershell
cd backend
..\tools\php\php-local.cmd artisan migrate:fresh --force
```

Run tests:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
```

Start Laravel server:

```powershell
tools\php\serve-backend.cmd
```

The launcher uses the project PHP config and serves Laravel at:

```text
http://127.0.0.1:8000
```

Do not use plain `php artisan serve` on this machine unless global PHP has the same extensions enabled.

## 7. Recommended Docker Setup Later

Once Docker is installed:

- Add `docker-compose.yml`
- Add app container for Laravel
- Add frontend container for React
- Add MySQL container
- Add Nginx container
- Add backup volume and backup script

For the MVP, Docker can wait until models, seeders, and core services are ready.

## 8. Next Implementation Step

Recommended immediate next step:

1. Add CRUD APIs for students, parents, fee items, and discount assignments.
2. Add invoice list/detail and receipt list/detail APIs.
3. Add void payment and void receipt flows.
4. Add PDF generation for invoice and receipt.
