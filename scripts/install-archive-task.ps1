# Register a daily Windows Task Scheduler job to rebuild the SFX library
# archives at 3 AM. No admin required (per-user task).
#
# Run once after cloning the repo:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-archive-task.ps1

$ErrorActionPreference = 'Stop'
$taskName = 'ParaSFX-BuildArchives'
$script   = Join-Path $PSScriptRoot 'build-archives.ps1'

if (-not (Test-Path $script)) {
  Write-Host "ERROR: build-archives.ps1 not found at $script" -ForegroundColor Red
  exit 1
}

# Idempotent: tear down any existing registration first
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Write-Host "Removing existing task..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# The path has spaces ('Para SFX Library'), so wrap in escaped quotes for the
# powershell.exe argument list. Argument quoting is the tricky bit.
$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument

# Trigger: every day at 3 AM
$trigger = New-ScheduledTaskTrigger -Daily -At 3am

# Settings: allow on battery, run when missed (e.g. PC was off at 3 AM),
# allow long-running with no time limit, restart up to 3 times if it errors
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -User $env:USERNAME `
    -Description 'Daily rebuild of paras-sfx-library mp3/wav archives + manifest.txt + metadata.json' | Out-Null

Write-Host ''
Write-Host "[OK] Daily archive build registered." -ForegroundColor Green
Write-Host "    Task name : $taskName"
Write-Host '    Schedule  : Daily at 03:00 (catches up via StartWhenAvailable if missed)'
Write-Host "    Script    : $script"
Write-Host '    Logs      : scripts/build-archives.log'
Write-Host ''
Write-Host 'To run on demand right now:'
Write-Host "    Start-ScheduledTask -TaskName $taskName"
Write-Host 'To check status:'
Write-Host "    Get-ScheduledTaskInfo -TaskName $taskName"
Write-Host 'To uninstall:'
Write-Host "    Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false"
