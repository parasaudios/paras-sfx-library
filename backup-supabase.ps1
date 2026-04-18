$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupDir = "C:\Users\camer\Para SFX Library\backups"
$storageBackupDir = "$backupDir\storage"
$containerName = "supabase_db_Para_SFX_Library"
$storageContainerName = "supabase_storage_Para_SFX_Library"

if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir }
if (!(Test-Path $storageBackupDir)) { New-Item -ItemType Directory -Path $storageBackupDir }

# ── 1. Database backup ──────────────────────────────────────
Write-Host "Backing up database..." -ForegroundColor Cyan
docker exec $containerName pg_dump -U postgres -d postgres > "$backupDir\supabase_backup_$timestamp.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  DB backup saved: supabase_backup_$timestamp.sql" -ForegroundColor Green
} else {
    Write-Host "  DB backup FAILED" -ForegroundColor Red
    exit 1
}

# ── 2. Storage volume backup ────────────────────────────────
# Exports the entire /var/lib/storage directory as a tar archive
Write-Host "Backing up storage volume..." -ForegroundColor Cyan
$storageFile = "$storageBackupDir\storage_backup_$timestamp.tar.gz"
docker run --rm `
    -v supabase_storage_Para_SFX_Library:/source:ro `
    -v "${storageBackupDir}:/backup" `
    alpine tar czf "/backup/storage_backup_$timestamp.tar.gz" -C /source .

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $storageFile).Length / 1MB
    Write-Host "  Storage backup saved: storage_backup_$timestamp.tar.gz ($([math]::Round($size, 1)) MB)" -ForegroundColor Green
} else {
    Write-Host "  Storage backup FAILED" -ForegroundColor Red
    exit 1
}

# ── Retention: keep last 30 of each ─────────────────────────
Get-ChildItem $backupDir -Filter "supabase_backup_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
Get-ChildItem $storageBackupDir -Filter "storage_backup_*.tar.gz" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force

Write-Host "`nBackup complete." -ForegroundColor Green
