@echo off
REM ============================================================================
REM DEPRECATED — Kong config is now mounted via docker-compose volume.
REM
REM The file docker/kong.yml is mounted read-only into the Kong container.
REM To update Kong config: edit docker/kong.yml, then run:
REM   cd docker && docker compose restart kong
REM
REM This script is kept for reference only.
REM ============================================================================

echo [INFO] Kong config is now managed via docker-compose volume mount.
echo [INFO] Edit docker/kong.yml and restart: cd docker ^&^& docker compose restart kong
