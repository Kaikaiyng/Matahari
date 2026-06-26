@echo off
set "PHPRC=%~dp0"
php -c "%~dp0php.ini" %*
