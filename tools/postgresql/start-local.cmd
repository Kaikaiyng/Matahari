@echo off
setlocal
set "MATAHARI_PG_ROOT=%LOCALAPPDATA%\Matahari\PostgreSQL"
set "MATAHARI_PG_CTL=%MATAHARI_PG_ROOT%\runtime\bin\pg_ctl.exe"
if not exist "%MATAHARI_PG_CTL%" goto missing
if not exist "%MATAHARI_PG_ROOT%\data\PG_VERSION" goto missing
"%MATAHARI_PG_CTL%" -D "%MATAHARI_PG_ROOT%\data" status >nul 2>&1
if not errorlevel 1 (
  echo Matahari PostgreSQL is already running.
  exit /b 0
)
"%MATAHARI_PG_CTL%" -D "%MATAHARI_PG_ROOT%\data" -l "%MATAHARI_PG_ROOT%\server.log" -w start
exit /b %ERRORLEVEL%

:missing
echo Matahari PostgreSQL is not initialized. Follow docs\postgresql.md.
echo This launcher never creates or resets data.
exit /b 1
