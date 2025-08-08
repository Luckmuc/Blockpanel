#!/bin/bash
set -e

# Start supervisor (which starts backend, frontend/nginx, and proxy)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
