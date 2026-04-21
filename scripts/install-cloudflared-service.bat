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
REM cloudflared's own uninstall sometimes says "not installed" even when sc
REM sees one - so we also force-delete via sc.exe, then clean registry.
"%CLOUDFLARED%" service uninstall >nul 2>&1
sc.exe stop Cloudflared >nul 2>&1
sc.exe delete Cloudflared >nul 2>&1
echo Done.

echo [6/7] Cleaning leftover registry keys from prior install...
REM Event log key - remnant that blocks re-install.
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\EventLog\Application\Cloudflared" /f >nul 2>&1
REM Service key - in case sc delete didn't fully remove it.
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\Cloudflared" /f >nul 2>&1
echo Done.

echo [7/7] Installing service and patching it to run the tunnel...
set "CF_CONFIG=%USERPROFILE%\.cloudflared\config.yml"
if not exist "%CF_CONFIG%" (
    echo ERROR: config.yml not found at %CF_CONFIG%
    echo         Run 'cloudflared tunnel login' + 'cloudflared tunnel create' first.
    exit /b 1
)

"%CLOUDFLARED%" service install
REM Exit code is often non-zero due to the event-log-warning cruft, ignore -
REM we check directly whether the service object exists.
sc.exe query Cloudflared >nul 2>&1
if errorlevel 1 (
    echo ERROR: 'sc query' says the service was not created.
    exit /b 1
)
echo Service object exists.

REM Replace the empty binary path with one that actually runs the tunnel.
REM The space after "binPath=" is REQUIRED - sc.exe syntax.
sc.exe config Cloudflared binPath= "\"%CLOUDFLARED%\" --config \"%CF_CONFIG%\" tunnel run parasmut-supabase"
if errorlevel 1 (
    echo ERROR: failed to set service binary path.
    exit /b 1
)
echo Binary path set.

sc.exe config Cloudflared start= auto >nul
echo Auto-start configured.

net start Cloudflared
if errorlevel 1 (
    echo ERROR: net start Cloudflared failed. Check Windows Event Log ^> Application ^> Cloudflared.
    exit /b 1
)

echo.
echo All done. Service state:
sc query cloudflared | findstr "STATE"
exit /b 0
