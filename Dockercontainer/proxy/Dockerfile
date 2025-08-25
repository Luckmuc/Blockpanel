FROM haproxy:2.8-alpine

# Switch to root to install packages
USER root

# Install socat for stats socket and reload capabilities, and dos2unix for line ending conversion
RUN apk add --no-cache socat bash dos2unix

# Copy initial config
COPY haproxy.cfg /usr/local/etc/haproxy/haproxy.cfg

# Create directory for dynamic configs
RUN mkdir -p /etc/haproxy/dynamic

# Add script to reload HAProxy configuration
COPY reload-haproxy.sh /usr/local/bin/reload-haproxy.sh
RUN dos2unix /usr/local/bin/reload-haproxy.sh && chmod +x /usr/local/bin/reload-haproxy.sh

# Create haproxy user and group if they don't exist
RUN addgroup -g 99 -S haproxy 2>/dev/null || true
RUN adduser -u 99 -D -S -G haproxy haproxy 2>/dev/null || true

EXPOSE 25565-25575 8404

# Switch back to haproxy user
USER haproxy

CMD ["haproxy", "-f", "/usr/local/etc/haproxy/haproxy.cfg"]
