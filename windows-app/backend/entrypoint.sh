#!/bin/sh
chmod +x "$0"
mkdir -p /app/mc_servers
touch /app/mc_servers/backend.log
set -e

# Starte nur das Backend (Server-Initialisierung erfolgt über die API)
cd /app
exec uvicorn main:app --host 0.0.0.0 --port 8000
