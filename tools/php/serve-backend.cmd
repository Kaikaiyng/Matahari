@echo off
setlocal
set "ROOT=%~dp0..\.."

if not exist "%ROOT%\backend\.env" (
  echo Configure backend\.env first. See docs\postgresql.md.
  exit /b 1
)
if exist "%LOCALAPPDATA%\Matahari\PostgreSQL\data\PG_VERSION" (
  call "%ROOT%\tools\postgresql\start-local.cmd"
  if errorlevel 1 exit /b 1
)
cd /d "%ROOT%\backend"
call "%~dp0php-local.cmd" artisan serve --host=127.0.0.1 --port=8000
