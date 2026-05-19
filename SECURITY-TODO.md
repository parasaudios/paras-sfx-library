# Security TODO — actions that require human input

Code-level hardening is complete (see commits 2026-05-19). These remaining
items need credentials/dashboard access that I can't do for you.

## 1. Cloudflare Turnstile (CAPTCHA on admin login) — HIGH PRIORITY

Protects the one and only attack surface (admin login) from password guessing.

### Steps

1. Cloudflare dashboard → **Turnstile** → **Add site**
   - Domain: `parasfx.com`
   - Widget mode: **Managed** (auto-picks the right challenge level)
   - Save → copy the **Site key** and **Secret key**

2. Add to `docker/.env`:
   ```
   GOTRUE_SECURITY_CAPTCHA_ENABLED=true
   GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile
   GOTRUE_SECURITY_CAPTCHA_SECRET=<paste the secret key here>
   ```

3. Add to `docker/docker-compose.yml` under the `auth:` service `environment:` block:
   ```yaml
   GOTRUE_SECURITY_CAPTCHA_ENABLED: ${GOTRUE_SECURITY_CAPTCHA_ENABLED:-false}
   GOTRUE_SECURITY_CAPTCHA_PROVIDER: ${GOTRUE_SECURITY_CAPTCHA_PROVIDER:-turnstile}
   GOTRUE_SECURITY_CAPTCHA_SECRET: ${GOTRUE_SECURITY_CAPTCHA_SECRET:-}
   ```

4. Add the site key to your frontend env (Cloudflare Pages + Vercel project settings + local `.env.local`):
   ```
   VITE_TURNSTILE_SITE_KEY=<paste the site key here>
   ```

5. Wire the widget into `src/components/Login.tsx`:
   ```tsx
   import { Turnstile } from '@marsidev/react-turnstile';
   // npm install @marsidev/react-turnstile

   const [captchaToken, setCaptchaToken] = useState<string | null>(null);
   // ... inside the form, above the submit button:
   <Turnstile
     siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
     onSuccess={setCaptchaToken}
   />

   // change the signIn call in api.tsx to accept and pass captchaToken:
   await supabase.auth.signInWithPassword({
     email, password,
     options: { captchaToken },
   });
   ```

6. Update CSP in `src/vercel.json` AND `public/_headers` to allow Turnstile:
   - Add to `script-src`: `https://challenges.cloudflare.com`
   - Add a new directive: `frame-src https://challenges.cloudflare.com`

7. Restart auth container:
   ```
   docker compose up -d auth
   ```

8. Verify: open the admin login page → Turnstile widget appears → submit without solving = rejected.

---

## 2. Cloudflare WAF rules (defense in depth) — HIGH PRIORITY

The origin tunnel-proxy already throttles login attempts per IP. CF rules add
an edge-level layer that costs the attacker bandwidth before reaching us.

### Rule 1: Rate-limit login attempts

Cloudflare dashboard → **Security** → **WAF** → **Rate limiting rules** → **Create rule**

- Name: `sfxlib-login-throttle`
- If incoming requests match:
  ```
  (http.host eq "sfxlib-api.parasfx.com" and
   http.request.uri.path eq "/auth/v1/token" and
   http.request.method eq "POST")
  ```
- When rate exceeds: **5 requests** per **1 minute** per IP
- Then: **Managed Challenge**
- Duration: **10 minutes**

### Rule 2: Long ban after many failures

- Name: `sfxlib-login-extended-ban`
- If incoming requests match:
  ```
  (http.host eq "sfxlib-api.parasfx.com" and
   http.request.uri.path eq "/auth/v1/token" and
   http.response.code in {400 401 403 422 429})
  ```
- When rate exceeds: **15 requests** per **10 minutes** per IP
- Then: **Block**
- Duration: **1 hour**

### Rule 3: Block known scanner User-Agents

- Name: `sfxlib-block-scanners`
- Expression:
  ```
  (http.host eq "sfxlib-api.parasfx.com" and
   (http.user_agent contains "sqlmap" or
    http.user_agent contains "nikto" or
    http.user_agent contains "nmap" or
    http.user_agent contains "masscan" or
    http.user_agent contains "ZmEu" or
    http.user_agent contains "Hello, World"))
  ```
- Then: **Block**

### Rule 4: Enable Bot Fight Mode

CF → **Security** → **Bots** → **Bot Fight Mode** → **On** (free tier).
Auto-filters most scrapers/scanners with low false-positive rate.

---

## 3. Real SMTP for password reset — MEDIUM PRIORITY

Currently `GOTRUE_SMTP_HOST: inbucket` means password resets land in the dev
mail UI you can't see remotely. If you lose your admin password you'd be
locked out and would need psql to fix it.

### Option A — use Cloudflare's free email worker / route + SendGrid free tier:

1. Sign up at sendgrid.com → API Keys → create restricted key (Mail Send only)
2. Add to `docker/.env`:
   ```
   GOTRUE_SMTP_HOST=smtp.sendgrid.net
   GOTRUE_SMTP_PORT=587
   GOTRUE_SMTP_USER=apikey
   GOTRUE_SMTP_PASS=<your sendgrid api key>
   GOTRUE_SMTP_ADMIN_EMAIL=admin@parasfx.com
   GOTRUE_SMTP_SENDER_NAME=Para SFX Admin
   ```
3. Replace the corresponding lines in docker-compose.yml `auth:` env.
4. `docker compose up -d auth`

### Option B — explicit "no recovery, use psql":

Leave SMTP pointing at inbucket. Document the manual recovery procedure:
```sql
-- as postgres:
UPDATE auth.users
SET encrypted_password = crypt('new-password-here', gen_salt('bf'))
WHERE email = 'admin@parasfx.com';
```

---

## 4. Enable MFA on the admin account — MEDIUM PRIORITY

Supabase GoTrue supports TOTP MFA out of the box. Once enabled it asks for a
6-digit code after the password. Worth the 30s of setup.

1. Briefly enable Studio:
   ```
   docker compose --profile admin up -d studio
   ```
2. Visit `http://127.0.0.1:54343` → Authentication → Users → your admin →
   "Send invite to enable MFA" OR use the JS SDK's `supabase.auth.mfa.enroll()`
   helper in a one-off script.
3. Scan the QR with Authy / Google Authenticator / 1Password.
4. `docker compose stop studio` when done.

---

## 5. Encrypt backups at rest — LOW PRIORITY

Currently `backup-supabase.ps1` writes plaintext SQL + tar.gz. If the laptop is
ever stolen or the `backups/` folder is sync'd to a cloud drive, the entire DB
is readable. Encrypt with `age`:

```powershell
# One-time:
winget install FiloSottile.age
age-keygen -o "$env:USERPROFILE\.age\sfxlib.key"
# Get the public key (starts with "age1..."):
type "$env:USERPROFILE\.age\sfxlib.key" | findstr public
```

Then change `backup-supabase.ps1`:
```powershell
pg_dump ... | age -r age1abc...yourkey... -o "backup.sql.age"
```

To restore:
```powershell
age -d -i "$env:USERPROFILE\.age\sfxlib.key" backup.sql.age | psql ...
```

---

## 6. File-type enforcement on storage uploads — LOW PRIORITY

If an admin JWT is ever stolen, the attacker can upload `evil.exe` and serve
it from the public sounds bucket. SQL fix:

```sql
-- Update the existing admin INSERT/UPDATE policies on storage.objects:
DROP POLICY IF EXISTS "Admin upload to sounds bucket" ON storage.objects;
CREATE POLICY "Admin upload to sounds bucket" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'sounds'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND lower(right(name, 4)) IN ('.mp3', '.wav')
  );
```
(Apply via a new migration file under `supabase/migrations/`.)

---

## Done already (don't redo)

These were implemented as part of the 2026-05-19 security pass:

- ✅ Tunnel-proxy path normalization (no more `%2e%2e` bypass)
- ✅ Tunnel-proxy blocks `/graphql/v1`, `/mcp`, `/analytics/v1`, `/rest-admin/v1`, `/functions/v1`, `/.well-known/`
- ✅ Tunnel-proxy method allowlist (TRACE/CONNECT rejected)
- ✅ Tunnel-proxy 2 MB body cap
- ✅ Tunnel-proxy per-IP login throttle (10 fails/10min → 1hr block)
- ✅ `PGRST_DB_MAX_ROWS` lowered from 20000 to 200
- ✅ Anon SELECT revoked on `suggestions` (data exposure closed)
- ✅ Studio dashboard moved behind `admin` Docker profile (stopped by default)
- ✅ HTTP security headers via `vercel.json` + `public/_headers` (CSP, HSTS, X-Frame-Options, etc.)
