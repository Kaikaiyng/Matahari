@echo off
set "ROOT=%~dp0..\.."
set "PHPRC=%~dp0"
cd /d "%ROOT%\backend\public"
php -c "%~dp0php.ini" -S 127.0.0.1:8000 -t "%ROOT%\backend\public" "%ROOT%\backend\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php"
