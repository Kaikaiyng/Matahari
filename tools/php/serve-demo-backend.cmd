@echo off
setlocal

set "ROOT=%~dp0..\.."
set "DEMO_DB=%ROOT%\backend\database\database.sqlite"

set "APP_ENV=local"
set "APP_DEBUG=false"
set "DB_CONNECTION=sqlite"
set "DB_DATABASE=%DEMO_DB%"
set "SESSION_DRIVER=file"
set "CACHE_STORE=file"
set "QUEUE_CONNECTION=sync"

if not exist "%DEMO_DB%" (
  echo Demo database not found. Run tools\php\reset-demo-sqlite.cmd first.
  exit /b 1
)

cd /d "%ROOT%\backend\public"
php -c "%~dp0php.ini" -S 127.0.0.1:8000 -t "%ROOT%\backend\public" "%ROOT%\backend\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php"
