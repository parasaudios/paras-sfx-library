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
    echo *** Script finished with errors. Exit code: %RC% ***
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

echo [5/7] Uninstalling any previous cloudflared service...
"%CLOUDFLARED%" service uninstall
echo Done.

echo [6/7] Cleaning leftover event-log registry key...
REM A previous install leaves HKLM\SYSTEM\CurrentControlSet\Services\EventLog\Application\Cloudflared
REM which makes the next 'service install' abort with a non-zero exit code.
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\EventLog\Application\Cloudflared" /f >nul 2>&1
echo Done.

echo [7/7] Installing service + starting it...
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
