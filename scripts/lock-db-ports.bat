@echo off
REM ============================================================================
REM Block direct network access to Supabase internal ports.
REM These ports are bound to 0.0.0.0 by Docker, meaning any machine on
REM the local network could connect directly to the database, bypassing
REM Kong gateway security.
REM
REM RUN AS ADMINISTRATOR
REM ============================================================================

echo [FIREWALL] Blocking external access to Supabase internal ports...

REM PostgreSQL (direct DB access — most critical)
netsh advfirewall firewall delete rule name="Block Supabase DB 54342" >nul 2>&1
netsh advfirewall firewall add rule name="Block Supabase DB 54342" dir=in action=block protocol=TCP localport=54342 remoteip=any
echo [OK] Port 54342 (PostgreSQL) blocked

REM Studio (admin UI)
netsh advfirewall firewall delete rule name="Block Supabase Studio 54343" >nul 2>&1
netsh advfirewall firewall add rule name="Block Supabase Studio 54343" dir=in action=block protocol=TCP localport=54343 remoteip=any
echo [OK] Port 54343 (Studio) blocked

REM Inbucket (email testing)
netsh advfirewall firewall delete rule name="Block Supabase Inbucket 54344" >nul 2>&1
netsh advfirewall firewall add rule name="Block Supabase Inbucket 54344" dir=in action=block protocol=TCP localport=54344 remoteip=any
echo [OK] Port 54344 (Inbucket) blocked

REM Analytics
netsh advfirewall firewall delete rule name="Block Supabase Analytics 54345" >nul 2>&1
netsh advfirewall firewall add rule name="Block Supabase Analytics 54345" dir=in action=block protocol=TCP localport=54345 remoteip=any
echo [OK] Port 54345 (Analytics) blocked

REM Shadow DB
netsh advfirewall firewall delete rule name="Block Supabase Shadow 54340" >nul 2>&1
netsh advfirewall firewall add rule name="Block Supabase Shadow 54340" dir=in action=block protocol=TCP localport=54340 remoteip=any
echo [OK] Port 54340 (Shadow DB) blocked

REM Pooler
netsh advfirewall firewall delete rule name="Block Supabase Pooler 54349" >nul 2>&1
netsh advfirewall firewall add rule name="Block Supabase Pooler 54349" dir=in action=block protocol=TCP localport=54349 remoteip=any
echo [OK] Port 54349 (Pooler) blocked

REM Allow localhost access (so the proxy, Studio, and CLI still work)
netsh advfirewall firewall delete rule name="Allow Supabase Localhost" >nul 2>&1
netsh advfirewall firewall add rule name="Allow Supabase Localhost" dir=in action=allow protocol=TCP localport=54340-54349 remoteip=127.0.0.1
echo [OK] Localhost access allowed for all Supabase ports

echo.
echo [DONE] All Supabase internal ports are now blocked from external access.
echo        Localhost (127.0.0.1) access is preserved.
echo        Only the tunnel proxy (port 54350) should be exposed via Cloudflare Tunnel.
