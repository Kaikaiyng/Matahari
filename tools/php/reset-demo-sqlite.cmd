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
  php -c "%~dp0php.ini" -r "touch(getenv('DB_DATABASE'));"
  if errorlevel 1 exit /b 1
)

echo Resetting only the local demo SQLite database:
echo   %DEMO_DB%

cd /d "%ROOT%\backend"
php -c "%~dp0php.ini" artisan config:clear
if errorlevel 1 exit /b 1

php -c "%~dp0php.ini" artisan migrate:fresh --seed --force
if errorlevel 1 exit /b 1

echo Demo database is ready.
