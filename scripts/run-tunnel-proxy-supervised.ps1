# Tunnel proxy supervisor.
#
# Keeps `node scripts/tunnel-proxy.mjs` alive - if the proxy exits for any
# reason, this script logs the exit code and restarts it after a short
# backoff. Designed to be launched at user logon by the .vbs in the
# Windows Startup folder (see "Auto-start setup" in CLAUDE.md).
#
# - Proxy itself writes to `tunnel-proxy.log` (handled inside the proxy)
# - Supervisor writes to `tunnel-proxy-supervisor.log` (this file)
#
# Project root is derived from this script's own location, so the script
# is portable - no hardcoded usernames or paths.

$ErrorActionPreference = 'Continue'
$projectRoot   = Split-Path -Parent $PSScriptRoot   # parent of /scripts
$supervisorLog = Join-Path $projectRoot 'tunnel-proxy-supervisor.log'
$proxyScript   = Join-Path $projectRoot 'scripts\tunnel-proxy.mjs'
$backoffSec    = 5

Set-Location $projectRoot

function Write-Log {
    param([string]$msg)
    $ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ'
    $line = '[' + $ts + '] [SUPERVISOR] ' + $msg
    $line | Out-File -FilePath $supervisorLog -Append -Encoding utf8
}

Write-Log ('Supervisor starting - proxy script: ' + $proxyScript)

while ($true) {
    Write-Log 'Launching tunnel-proxy...'
    # Quote the path explicitly - Start-Process splits unquoted args on whitespace,
    # so "C:\path with spaces\file.mjs" would otherwise become two separate args.
    $quotedScript = '"' + $proxyScript + '"'
    $proc = Start-Process -FilePath 'node' `
        -ArgumentList $quotedScript `
        -WorkingDirectory $projectRoot `
        -NoNewWindow `
        -PassThru
    $proc.WaitForExit()
    $code = $proc.ExitCode
    Write-Log ('Tunnel-proxy exited with code ' + $code + '. Restarting in ' + $backoffSec + 's...')
    Start-Sleep -Seconds $backoffSec
}
