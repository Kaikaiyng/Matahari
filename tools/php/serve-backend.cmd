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
cd /d "%ROOT%\backend\public"
call "%~dp0php-local.cmd" -S 127.0.0.1:8000 -t "%ROOT%\backend\public" "%ROOT%\backend\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php"
