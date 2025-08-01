#!/bin/sh
# Script to reload HAProxy with new configuration
# This allows dynamic addition of new Minecraft server ports

if [ -f "/usr/local/etc/haproxy/haproxy.cfg" ]; then
    # Test the configuration first
    haproxy -f /usr/local/etc/haproxy/haproxy.cfg -c
    if [ $? -eq 0 ]; then
        # Configuration is valid, reload
        haproxy -f /usr/local/etc/haproxy/haproxy.cfg -sf $(cat /var/run/haproxy.pid 2>/dev/null || echo "")
        echo "HAProxy configuration reloaded successfully"
        exit 0
    else
        echo "HAProxy configuration test failed"
        exit 1
    fi
else
    echo "HAProxy configuration file not found"
    exit 1
fi
