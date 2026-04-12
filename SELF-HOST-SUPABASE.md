# Self-Hosting Supabase Locally — Setup Guide

This document explains the self-hosted Supabase infrastructure set up on this Windows machine and how to create a new separate Supabase instance for this project.

---

## Architecture Overview

The system runs Supabase locally via Docker containers on this Windows machine. A Cloudflare Tunnel exposes the local Supabase API to the internet with a stable URL, allowing Cloudflare Pages-hosted frontends to connect to the local database.

```
[User Browser]
      |
      v
[Cloudflare Pages CDN]  (frontend: *.pages.dev)
      |
      v  (API calls)
[Cloudflare Tunnel]  (*.parasfx.com subdomain)
      |
      v  (routes to localhost)
[Local Supabase in Docker]  (PostgreSQL + Auth + Storage + Edge Functions + REST API)
```

### Why Self-Host?
- No monthly Supabase cloud costs
- Full ownership and control of all data
- Unlimited database size (limited only by local disk)
- No API rate limits from Supabase cloud

### Tradeoffs
- If this machine goes offline, all backends go down (frontends still load from Cloudflare CDN but can't fetch data)
- You are responsible for backups, updates, and uptime
- Each Supabase instance runs ~12 Docker containers

---

## What's Already Running (Para Patreon Project)

| Component | Details |
|---|---|
| Project directory | `C:\Users\camer\Para Patreon\Patreoninspiredpage` |
| Supabase API port | `localhost:54321` |
| Supabase Studio | `localhost:54323` |
| Supabase DB port | `localhost:54322` |
| Tunnel URL | `https://patreon-api.parasfx.com` |
| Frontend | `https://parasmut.pages.dev` |
| Tunnel name | `parasmut-supabase` |
| Tunnel ID | `9f554fa6-d192-4357-942e-e07442778480` |
| Docker containers | `supabase_*_Patreoninspiredpage` |
| Backup script | `C:\Users\camer\Para Patreon\backup-supabase.ps1` |
| Backup schedule | Daily at 3 AM, 30-day retention |
| Tunnel auto-start | Startup folder shortcut |

---

## How to Create a New Separate Supabase Instance for This Project

### Prerequisites (Already Installed)
- Docker Desktop (with WSL2 backend) — must be running
- Node.js LTS
- cloudflared (`C:\Program Files (x86)\cloudflared\cloudflared.exe`)
- Cloudflare account with `parasfx.com` domain

### Step 1: Initialize Supabase in this project

```bash
cd "C:\Users\camer\Para SFX Library"
npx supabase init
```

This creates a `supabase/` directory with `config.toml`. If one already exists, skip this step.

### Step 2: Configure unique ports

**CRITICAL:** Each Supabase instance needs unique ports. Edit `supabase/config.toml` and change the ports to avoid conflicts with existing instances.

Set these port ranges for this project:

```toml
[api]
port = 54341

[db]
port = 54342

[studio]
port = 54343

[inbucket]
port = 54344

[analytics]
port = 54345
```

The exact numbers don't matter as long as they don't conflict. Port allocation across projects:
- Para Patreon: 54321-54329
- Masterlist: 54331-54339
- Para SFX Library (this project): 54341-54349

### Step 3: Start the Supabase instance

```bash
cd "C:\Users\camer\Para SFX Library"
npx supabase start
```

This pulls Docker images (cached if already downloaded) and starts ~12 containers. On first run it may take a few minutes. When done, it prints:

```
API URL: http://localhost:54341
GraphQL URL: http://localhost:54341/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54342/postgres
Studio URL: http://localhost:54343
Inbucket URL: http://localhost:54344
anon key: eyJhb...  <-- SAVE THIS
service_role key: eyJhb...  <-- SAVE THIS
```

**Save the `anon key` and `service_role key`** — you'll need them.

### Step 4: Run migrations

If your project has migrations in `supabase/migrations/`:

```bash
cd "C:\Users\camer\Para SFX Library"
npx supabase db reset
```

This drops and recreates the database, running all migrations in order.

### Step 5: Create a Cloudflare Tunnel route

Add a new ingress rule to the shared tunnel config:

Edit `C:\Users\camer\.cloudflared\config.yml` to add a new hostname:

```yaml
tunnel: 9f554fa6-d192-4357-942e-e07442778480
credentials-file: C:\Users\camer\.cloudflared\9f554fa6-d192-4357-942e-e07442778480.json

ingress:
  - hostname: patreon-api.parasfx.com
    service: http://localhost:54321
  - hostname: masterlist-api.parasfx.com
    service: http://localhost:54331
  - hostname: sfxlib-api.parasfx.com            # <-- ADD THIS
    service: http://localhost:54341              # <-- matches your API port
  - service: http_status:404
```

**Important:** The `- service: http_status:404` catch-all MUST remain as the last rule.

Then register the DNS route:

```bash
cloudflared tunnel route dns parasmut-supabase sfxlib-api.parasfx.com
```

Restart the tunnel (kill the running cloudflared process and relaunch, or reboot):

```bash
# Find and kill existing tunnel
taskkill /IM cloudflared.exe /F

# Restart
cd C:\Users\camer\.cloudflared
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run parasmut-supabase
```

### Step 6: Update the frontend to use the tunnel URL

In your Vite-based frontend, the Supabase client needs to point to the tunnel URL in production.

**Option A: Environment variables (recommended)**

Create/update your Supabase client to read from env vars:

```typescript
// src/lib/supabaseClient.ts (or wherever your client is)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54341';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-local-anon-key-here';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

For local development, create `.env.local`:
```
VITE_SUPABASE_URL=http://localhost:54341
VITE_SUPABASE_ANON_KEY=<your anon key from Step 3>
```

**Option B: If the project uses edge functions (Hono server)**

Also update `apiBase.ts` or equivalent to derive the edge function URL:

```typescript
const tunnelBase = import.meta.env.VITE_SUPABASE_URL;
const API_BASE = tunnelBase
  ? `${tunnelBase}/functions/v1/<your-edge-function-name>`
  : '/functions/v1/<your-edge-function-name>';
```

### Step 7: Set Cloudflare Pages environment variables

In the Cloudflare dashboard:

1. Go to **Pages** -> your project -> **Settings** -> **Variables and Secrets**
2. Add for Production:
   - `VITE_SUPABASE_URL` = `https://sfxlib-api.parasfx.com`
   - `VITE_SUPABASE_ANON_KEY` = `<your anon key from Step 3>`
3. Trigger a redeploy (push a commit or retry deployment)

### Step 8: Update CORS on the backend

If your project has a Hono server or edge functions, add your Pages domain to the CORS allowed origins:

```typescript
const ALLOWED_ORIGINS = [
  'https://your-project.pages.dev',
  'http://localhost:3000',
  'http://localhost:5173',
];
```

### Step 9: Set up automated backups

Create `C:\Users\camer\Para SFX Library\backup-supabase.ps1`:

```powershell
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupDir = "C:\Users\camer\Para SFX Library\backups"
$containerName = "supabase_db_Para SFX Library"  # Check actual name with: docker ps --format '{{.Names}}' | findstr SFX

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
```

Schedule it in Windows Task Scheduler:
1. Open Task Scheduler
2. Create Basic Task -> name it "Supabase Backup - SFX Library"
3. Trigger: Daily at a time offset from other backups (e.g., 4:00 AM)
4. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "C:\Users\camer\Para SFX Library\backup-supabase.ps1"`

### Step 10: Verify everything works

```bash
# Check containers are running
docker ps --format '{{.Names}} | {{.Status}}' | findstr SFX

# Test tunnel
curl https://sfxlib-api.parasfx.com/rest/v1/ -H "apikey: <your-anon-key>"

# Open Studio
start http://localhost:54343
```

---

## Managing the Instances

### Start/Stop

```bash
# Start this project's Supabase
cd "C:\Users\camer\Para SFX Library" && npx supabase start

# Stop this project's Supabase
cd "C:\Users\camer\Para SFX Library" && npx supabase stop

# Check all running containers
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Docker auto-restart
Docker Desktop is set to start on Windows login. Supabase containers have `restart=always`, so they come back up automatically after a reboot.

### Tunnel auto-start
A startup shortcut at `C:\Users\camer\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\CloudflareTunnel.lnk` launches cloudflared on login. One tunnel process handles ALL project routes (defined in `config.yml`).

### Studio URLs
- Para Patreon: http://localhost:54323
- Masterlist: http://localhost:54333
- Para SFX Library (this project): http://localhost:54343

---

## Port Allocation Reference

| Project | API | DB | Studio | Inbucket | Analytics |
|---|---|---|---|---|---|
| Para Patreon | 54321 | 54322 | 54323 | 54324 | 54325 |
| Masterlist | 54331 | 54332 | 54333 | 54334 | 54335 |
| Para SFX Library | 54341 | 54342 | 54343 | 54344 | 54345 |

## Tunnel Hostname Reference

| Project | Tunnel Hostname | Routes To |
|---|---|---|
| Para Patreon | `patreon-api.parasfx.com` | `localhost:54321` |
| Masterlist | `masterlist-api.parasfx.com` | `localhost:54331` |
| Para SFX Library | `sfxlib-api.parasfx.com` | `localhost:54341` |

---

## Troubleshooting

**Containers not starting:** Make sure Docker Desktop is running. Check `docker ps` for conflicts.

**Port conflicts:** If `supabase start` fails with port errors, check `netstat -ano | findstr 5433` and kill the conflicting process, or change ports in `config.toml`.

**Tunnel not connecting:** Check `cloudflared` is running (`tasklist | findstr cloudflared`). Verify `config.yml` syntax. Restart with `cloudflared tunnel run parasmut-supabase`.

**530 errors from Cloudflare:** The tunnel can't reach the local service. Check the Supabase containers are running and the port in `config.yml` matches `config.toml`.

**CORS errors in browser:** Add your Pages domain to the CORS allowed origins in your server code.

**Database is empty after restart:** Supabase containers use Docker volumes for persistence. If volumes were deleted, run `npx supabase db reset` to re-apply migrations.
