$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupDir = "C:\Users\camer\Para SFX Library\backups"
$containerName = "supabase_db_Para_SFX_Library"

if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir }

docker exec $containerName pg_dump -U postgres -d postgres > "$backupDir\supabase_backup_$timestamp.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup saved: supabase_backup_$timestamp.sql"
} else {
    Write-Host "Backup FAILED" -ForegroundColor Red
    exit 1
}

# Keep only last 30 backups
Get-ChildItem $backupDir -Filter "supabase_backup_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
