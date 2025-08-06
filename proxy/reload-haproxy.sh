#!/bin/sh
# Script to reload HAProxy with new configuration
# This allows dynamic addition of new Minecraft server ports

CONFIG_FILE="/usr/local/etc/haproxy/haproxy.cfg"
PID_FILE="/var/run/haproxy.pid"

if [ -f "$CONFIG_FILE" ]; then
    # Test the configuration first
    haproxy -f "$CONFIG_FILE" -c
    if [ $? -eq 0 ]; then
        # Configuration is valid, reload
        if [ -f "$PID_FILE" ]; then
            # Graceful reload with existing PID
            haproxy -f "$CONFIG_FILE" -sf $(cat "$PID_FILE")
        else
            # Start fresh if no PID file exists
            haproxy -f "$CONFIG_FILE" -D -p "$PID_FILE"
        fi
        echo "HAProxy configuration reloaded successfully"
        exit 0
    else
        echo "HAProxy configuration test failed"
        exit 1
    fi
else
    echo "HAProxy configuration file not found at $CONFIG_FILE"
    exit 1
fi
