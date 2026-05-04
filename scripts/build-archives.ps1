# Build pre-baked archive zips for the entire SFX library.
#
# Produces (in the storage container's `archives` bucket):
#   - paras-sfx-library-mp3.zip          one zip of every mp3
#   - paras-sfx-library-wav.zip          one zip of every wav (much larger)
#   - paras-sfx-library-manifest.txt     newline-separated public URLs
#                                        (for power users with wget/aria2c)
#   - paras-sfx-library-metadata.json    {built_at, files, sizes, urls}
#
# Atomic-replacement guarantee:
#   - Each archive is written into a NEW version-uuid first
#   - Verified with `unzip -t`
#   - Only THEN swap the storage.objects pointer to the new version
#   - And only THEN delete the previous version's file on disk
#   - If anything fails mid-build, the existing archive keeps serving
#
# Run daily via Windows Task Scheduler. Safe to re-run anytime.
# Output: writes a per-run log to scripts/build-archives.log.

$ErrorActionPreference = 'Stop'
$logFile       = Join-Path $PSScriptRoot 'build-archives.log'
$dbContainer   = 'supabase_db_Para_SFX_Library'
$storContainer = 'supabase_storage_Para_SFX_Library'
$publicBaseUrl = 'https://sfxlib-api.parasfx.com'
$bucket        = 'archives'
$archiveDir    = '/var/lib/storage/stub/stub/archives'
$buildTmpDir   = '/tmp/archive-build'

function Log {
  param([string]$msg)
  $ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
  "[$ts] $msg" | Tee-Object -FilePath $logFile -Append | Write-Host
}

function PsqlExec {
  param([string]$sql)
  $null = $sql | & docker exec -i $dbContainer psql -U postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'psql exec failed' }
}

function PsqlScalar {
  param([string]$sql)
  $r = & docker exec $dbContainer psql -U postgres -t -A -c $sql
  if ($LASTEXITCODE -ne 0) { throw "psql scalar failed: $sql" }
  return ($r -join "`n").Trim()
}

function NewUuid { [guid]::NewGuid().ToString().ToLower() }

function SafeArchiveName {
  param([string]$title, [string]$ext)
  $name = $title -replace '[<>:"/\\|?*\x00-\x1f]', '_'
  $name = $name.Trim()
  if (-not $name) { $name = 'untitled' }
  return "$name.$ext"
}

function SetXattr {
  param([string]$path, [string]$contentType, [string]$cacheControl)
  & docker exec $storContainer setfattr -n user.supabase.content-type -v $contentType $path | Out-Null
  & docker exec $storContainer setfattr -n user.supabase.cache-control -v $cacheControl $path | Out-Null
}

# Build the storage.objects metadata jsonb correctly via ConvertTo-Json
# so we don't have to hand-escape quotes.
function BuildObjectMeta {
  param([long]$size, [string]$mimetype, [string]$cacheControl, [string]$etag)
  $obj = [ordered]@{
    size           = $size
    mimetype       = $mimetype
    cacheControl   = $cacheControl
    lastModified   = (Get-Date).ToUniversalTime().ToString('o')
    contentLength  = $size
    httpStatusCode = 200
    eTag           = '"' + $etag + '"'
  }
  return ($obj | ConvertTo-Json -Compress)
}

function UpsertStorageObject {
  param([string]$objName, [string]$version, [string]$metaJson)
  # Look up old version (if any) BEFORE replacing
  $oldVer = PsqlScalar "SELECT version FROM storage.objects WHERE bucket_id='$bucket' AND name='$objName' LIMIT 1;"

  $newId = NewUuid
  # JSON uses double quotes only, so escaping single-quotes for SQL is a no-op
  # in practice but kept for safety.
  $escMeta = $metaJson -replace "'", "''"
  $escName = $objName -replace "'", "''"
  $sql = "INSERT INTO storage.objects (id, bucket_id, name, version, metadata) " +
         "VALUES ('$newId', '$bucket', '$escName', '$version', '$escMeta'::jsonb) " +
         "ON CONFLICT (bucket_id, name) DO UPDATE " +
         "SET version = EXCLUDED.version, metadata = EXCLUDED.metadata, updated_at = now();"

  $sql | & docker exec -i $dbContainer psql -U postgres -v ON_ERROR_STOP=1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Upsert failed for $objName" }
  return $oldVer
}

# -- 1. Pull manifest from DB ------------------------------------------
Log '=== Build started ==='
Log 'Querying DB for sound list...'

$query = @'
SELECT
  s.title,
  s.mp3_path,
  s.wav_path,
  s.has_wav,
  COALESCE(so_mp3.version, so_mp3.id::text) AS mp3_version,
  COALESCE(so_wav.version, so_wav.id::text) AS wav_version
FROM public.sounds s
LEFT JOIN storage.objects so_mp3
  ON so_mp3.bucket_id = 'sounds' AND so_mp3.name = s.mp3_path
LEFT JOIN storage.objects so_wav
  ON so_wav.bucket_id = 'sounds' AND so_wav.name = s.wav_path
WHERE s.deleted_at IS NULL
ORDER BY s.title;
'@

$tsv = & docker exec -i $dbContainer psql -U postgres -t -A -F "`t" -c $query
if ($LASTEXITCODE -ne 0) { throw 'DB query failed' }
$rows = $tsv -split "`n" | Where-Object { $_ -and $_ -notmatch '^\s*$' }
Log "  $($rows.Count) active sounds"

$mp3Entries = @()
$wavEntries = @()
$manifestUrls = @()
$dupMp3 = @{}
$dupWav = @{}

foreach ($line in $rows) {
  $f = $line -split "`t"
  $title       = $f[0]
  $mp3Path     = $f[1]
  $wavPath     = $f[2]
  $hasWav      = ($f[3] -eq 't')
  $mp3Version  = $f[4]
  $wavVersion  = $f[5]

  if ($mp3Path -and $mp3Version) {
    $name = SafeArchiveName $title 'mp3'
    $n = 2
    while ($dupMp3.ContainsKey($name)) {
      $name = SafeArchiveName "$title ($n)" 'mp3'
      $n++
    }
    $dupMp3[$name] = $true
    $mp3Entries += "/var/lib/storage/stub/stub/sounds/$mp3Path/$mp3Version`t$name"
    $manifestUrls += "$publicBaseUrl/storage/v1/object/public/sounds/$mp3Path"
  }
  if ($hasWav -and $wavPath -and $wavVersion) {
    $name = SafeArchiveName $title 'wav'
    $n = 2
    while ($dupWav.ContainsKey($name)) {
      $name = SafeArchiveName "$title ($n)" 'wav'
      $n++
    }
    $dupWav[$name] = $true
    $wavEntries += "/var/lib/storage/stub/stub/sounds/$wavPath/$wavVersion`t$name"
    $manifestUrls += "$publicBaseUrl/storage/v1/object/public/sounds/$wavPath"
  }
}
Log "  -> $($mp3Entries.Count) mp3 entries, $($wavEntries.Count) wav entries"

# -- 2. Prep build dir + tools in container ----------------------------
& docker exec $storContainer sh -c "rm -rf $buildTmpDir ; mkdir -p $buildTmpDir" | Out-Null
& docker cp (Join-Path $PSScriptRoot 'build-archives.py') "${storContainer}:$buildTmpDir/build-archives.py" | Out-Null
& docker exec $storContainer sh -c 'command -v unzip >/dev/null || apk add --no-cache unzip >/dev/null 2>&1' | Out-Null
& docker exec $storContainer sh -c 'command -v setfattr >/dev/null || apk add --no-cache attr >/dev/null 2>&1' | Out-Null

# -- 3. Build one archive ---------------------------------------------
function BuildArchive {
  param([string]$format, [string[]]$entries, [string]$archiveName)

  if (-not $entries -or $entries.Count -eq 0) {
    Log "[$format] No entries - skipping."
    return $null
  }
  Log "[$format] Building zip with $($entries.Count) files..."
  $zipPath = "$buildTmpDir/$archiveName"

  # Capture stdout into a variable so it doesn't leak into the function's
  # implicit return stream (would otherwise corrupt the metadata.json).
  $pyOut = $entries -join "`n" | & docker exec -i $storContainer python3 "$buildTmpDir/build-archives.py" $zipPath
  if ($LASTEXITCODE -ne 0) { throw "[$format] Python builder failed: $pyOut" }
  Log "[$format] Python: $pyOut"

  # Use Python's zipfile.testzip() (handles ZIP64 cleanly; Alpine's unzip
  # bails with "short read" on multi-GB archives).
  Log "[$format] Verifying integrity (zipfile.testzip)..."
  $verifyOut = & docker exec $storContainer python3 -c "import zipfile, sys; z=zipfile.ZipFile(sys.argv[1]); bad=z.testzip(); n=len(z.namelist()); print('OK' if bad is None else 'BAD:'+bad, n)" $zipPath
  if ($LASTEXITCODE -ne 0 -or -not ("$verifyOut".StartsWith('OK '))) {
    throw "[$format] Zip integrity check failed: $verifyOut"
  }
  $verifiedCount = [int](("$verifyOut" -split ' ')[1])
  Log "[$format] Verified: $verifiedCount entries, no corrupt data."

  $zipSize = [long]((& docker exec $storContainer stat -c%s $zipPath) | Out-String).Trim()
  $zipMB = [math]::Round($zipSize / 1MB, 1)
  Log "[$format] Built + verified: $zipMB MB"

  # Atomic install: NEW version into archives bucket
  $newVersion = NewUuid
  $destDir    = "$archiveDir/$archiveName"
  & docker exec $storContainer sh -c "mkdir -p '$destDir' ; mv '$zipPath' '$destDir/$newVersion'"
  if ($LASTEXITCODE -ne 0) { throw "[$format] Install move failed" }

  SetXattr "$destDir/$newVersion" 'application/zip' 'public, max-age=3600'

  $metaJson = BuildObjectMeta $zipSize 'application/zip' 'public, max-age=3600' $newVersion
  $oldVersion = UpsertStorageObject $archiveName $newVersion $metaJson
  Log "[$format] storage.objects pointer flipped to new version $newVersion"

  if ($oldVersion -and $oldVersion -ne $newVersion) {
    & docker exec $storContainer sh -c "rm -f '$destDir/$oldVersion'"
    Log "[$format] Cleaned up old version $oldVersion"
  }

  return [ordered]@{
    archive_name = $archiveName
    bytes        = $zipSize
    files        = $entries.Count
    version      = $newVersion
    url          = "$publicBaseUrl/storage/v1/object/public/$bucket/$archiveName"
  }
}

$mp3Result = BuildArchive 'mp3' $mp3Entries 'paras-sfx-library-mp3.zip'
$wavResult = BuildArchive 'wav' $wavEntries 'paras-sfx-library-wav.zip'

# -- 4. manifest.txt ---------------------------------------------------
Log 'Building manifest.txt...'
$manifestArchive = 'paras-sfx-library-manifest.txt'
$manifestTmp = "$buildTmpDir/$manifestArchive"
$manifestUrls -join "`n" | & docker exec -i $storContainer sh -c "cat > '$manifestTmp'"
$manifestSize = [long]((& docker exec $storContainer stat -c%s $manifestTmp) | Out-String).Trim()

$manifestVersion = NewUuid
$manifestDest    = "$archiveDir/$manifestArchive"
& docker exec $storContainer sh -c "mkdir -p '$manifestDest' ; mv '$manifestTmp' '$manifestDest/$manifestVersion'"
SetXattr "$manifestDest/$manifestVersion" 'text/plain; charset=utf-8' 'public, max-age=3600'
$manMetaJson = BuildObjectMeta $manifestSize 'text/plain; charset=utf-8' 'public, max-age=3600' $manifestVersion
$oldManVer = UpsertStorageObject $manifestArchive $manifestVersion $manMetaJson
if ($oldManVer -and $oldManVer -ne $manifestVersion) {
  & docker exec $storContainer sh -c "rm -f '$manifestDest/$oldManVer'"
}
Log "manifest.txt: $($manifestUrls.Count) URLs, $manifestSize bytes"

# -- 5. metadata.json (build summary) ---------------------------------
$archivesList = @()
if ($mp3Result) { $archivesList += $mp3Result }
if ($wavResult) { $archivesList += $wavResult }

$summary = [ordered]@{
  built_at     = (Get-Date).ToUniversalTime().ToString('o')
  total_sounds = $rows.Count
  archives     = $archivesList
  manifest     = [ordered]@{
    archive_name = $manifestArchive
    url          = "$publicBaseUrl/storage/v1/object/public/$bucket/$manifestArchive"
    urls         = $manifestUrls.Count
    bytes        = $manifestSize
  }
}
$summaryJson = $summary | ConvertTo-Json -Depth 6 -Compress
$summarySize = [System.Text.Encoding]::UTF8.GetByteCount($summaryJson)

$metaArchive = 'paras-sfx-library-metadata.json'
$metaTmp     = "$buildTmpDir/$metaArchive"
$summaryJson | & docker exec -i $storContainer sh -c "cat > '$metaTmp'"

$metaVersion = NewUuid
$metaDest    = "$archiveDir/$metaArchive"
& docker exec $storContainer sh -c "mkdir -p '$metaDest' ; mv '$metaTmp' '$metaDest/$metaVersion'"
SetXattr "$metaDest/$metaVersion" 'application/json' 'public, max-age=300'
$metaMetaJson = BuildObjectMeta $summarySize 'application/json' 'public, max-age=300' $metaVersion
$oldMetaVer   = UpsertStorageObject $metaArchive $metaVersion $metaMetaJson
if ($oldMetaVer -and $oldMetaVer -ne $metaVersion) {
  & docker exec $storContainer sh -c "rm -f '$metaDest/$oldMetaVer'"
}

# -- Final ------------------------------------------------------------
& docker exec $storContainer sh -c "rm -rf '$buildTmpDir'" | Out-Null
Log '=== Build complete ==='
if ($mp3Result) { Log ("  mp3 archive: " + $mp3Result.bytes + " bytes (" + $mp3Result.files + " files)") }
if ($wavResult) { Log ("  wav archive: " + $wavResult.bytes + " bytes (" + $wavResult.files + " files)") }
Log "  manifest: $($manifestUrls.Count) URLs"
Log "  metadata: $summarySize bytes"
