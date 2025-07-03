#!/bin/sh
set -e

# Set default MC_SERVERS_DIR if not provided
export MC_SERVERS_DIR=${MC_SERVERS_DIR:-/app/mc_servers}

# Ensure the mc_servers directory exists
mkdir -p "$MC_SERVERS_DIR"

# Start the backend
cd /app
exec uvicorn main:app --host 0.0.0.0 --port 8000
