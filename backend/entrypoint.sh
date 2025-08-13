#!/bin/sh
chmod +x "$0"
mkdir -p /app/mc_servers
touch /app/mc_servers/backend.log
set -e

# Starte beide Services im Hintergrund
cd /app

# Starte Express-Service für Head-API
node mc-head-service.js &

# Starte FastAPI-Backend
exec uvicorn main:app --host 0.0.0.0 --port 8000
