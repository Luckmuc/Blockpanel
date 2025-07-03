#!/bin/sh
set -e

# Starte nur das Backend (Server-Initialisierung erfolgt über die API)
cd /app
exec uvicorn main:app --host 0.0.0.0 --port 8000
