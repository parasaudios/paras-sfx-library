@echo off
REM ============================================================================
REM Install cloudflared as a Windows Service so the tunnel
REM (sfxlib-api.parasfx.com) starts automatically with Windows.
REM
REM HOW TO RUN: right-click this file -> "Run as administrator".
REM             (a UAC prompt will appear)
REM ============================================================================

setlocal

REM ---- 1. Verify we have admin rights --------------------------------------
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: This script must be run as Administrator.
    echo        Right-click it and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo.
echo === Installing cloudflared as a Windows service ===
echo.

set "CLOUDFLARED=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not exist "%CLOUDFLARED%" (
    echo ERROR: cloudflared.exe not found at: %CLOUDFLARED%
    pause
    exit /b 1
)

REM ---- 2. Stop any running cloudflared processes (manual instances) -------
echo Stopping any running cloudflared.exe processes...
taskkill /F /IM cloudflared.exe /T >nul 2>&1

REM ---- 3. Remove the logon-Startup shortcut (we won't need it anymore) ----
set "STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CloudflareTunnel.lnk"
if exist "%STARTUP_LNK%" (
    echo Removing old Startup shortcut: %STARTUP_LNK%
    del /f /q "%STARTUP_LNK%"
)

REM ---- 4. Uninstall any existing service (idempotent) ---------------------
echo Removing any previous cloudflared service...
"%CLOUDFLARED%" service uninstall >nul 2>&1

REM ---- 5. Install the service ---------------------------------------------
echo Installing service (reads config from %USERPROFILE%\.cloudflared)...
"%CLOUDFLARED%" service install
if %errorlevel% neq 0 (
    echo.
    echo Service install failed. Check the cloudflared config at:
    echo     %USERPROFILE%\.cloudflared\config.yml
    pause
    exit /b 1
)

REM ---- 6. Make sure it starts on every boot (not just Manual) -------------
sc config cloudflared start= auto >nul

REM ---- 7. Start it now ----------------------------------------------------
echo Starting service...
net start cloudflared

echo.
echo === Done ===
echo Check state with:  sc query cloudflared
echo View logs with:    Get-EventLog -LogName Application -Source cloudflared
echo.
pause
