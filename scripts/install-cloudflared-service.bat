@echo off
setlocal
REM Install cloudflared as a Windows service.
REM Right-click -> "Run as administrator".
REM Writes a log to install-cloudflared-service.log in this folder so the
REM window can close instantly without losing diagnostic info.

set "LOGFILE=%~dp0install-cloudflared-service.log"
echo ============================= > "%LOGFILE%"
echo Run at %DATE% %TIME%         >> "%LOGFILE%"
echo ============================= >> "%LOGFILE%"

call :main >> "%LOGFILE%" 2>&1
set "RC=%errorlevel%"

echo.
echo Log written to:
echo   %LOGFILE%
echo.
type "%LOGFILE%"
echo.
if %RC% neq 0 (
    echo *** Script finished with errors (exit code %RC%). ***
) else (
    echo *** Script finished successfully. ***
)
echo.
pause
exit /b %RC%


:main
echo [1/6] Checking for admin rights...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo NOT ELEVATED. Right-click the .bat and choose "Run as administrator".
    exit /b 1
)
echo OK - running as admin.

set "CLOUDFLARED=C:\Program Files (x86)\cloudflared\cloudflared.exe"
echo [2/6] Looking for cloudflared.exe at: %CLOUDFLARED%
if not exist "%CLOUDFLARED%" (
    echo ERROR: not found.
    exit /b 1
)
echo OK - found.

echo [3/6] Stopping any manually-launched cloudflared.exe processes...
taskkill /F /IM cloudflared.exe /T >nul 2>&1
echo Done (silently ignoring "not found" if none were running).

set "STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CloudflareTunnel.lnk"
echo [4/6] Removing old Startup shortcut if present: %STARTUP_LNK%
if exist "%STARTUP_LNK%" (
    del /f /q "%STARTUP_LNK%"
    echo Removed.
) else (
    echo Not present - already removed.
)

echo [5/6] Uninstalling any previous cloudflared service (idempotent)...
"%CLOUDFLARED%" service uninstall
echo    (exit code: %errorlevel% - anything non-zero here is fine if no service existed)

echo [6/6] Installing service + starting it...
"%CLOUDFLARED%" service install
if %errorlevel% neq 0 (
    echo ERROR: service install failed with exit code %errorlevel%.
    exit /b 1
)
echo Service registered.

sc config cloudflared start= auto >nul
echo Auto-start configured.

net start cloudflared
if %errorlevel% neq 0 (
    echo ERROR: net start cloudflared failed with exit code %errorlevel%.
    exit /b 1
)

echo.
echo All done. Service state:
sc query cloudflared | findstr "STATE"
exit /b 0
