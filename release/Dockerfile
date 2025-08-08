# Blockpanel All-in-One Dockerfile
# Build context: root of Blockpanel repo

FROM ubuntu:24.04

# Install dependencies
RUN apt-get update && \
    apt-get install -y python3 python3-pip nodejs npm nginx supervisor curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# --- Backend ---
WORKDIR /app/backend
COPY backend/ /app/backend/
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# --- Frontend ---
WORKDIR /app/frontend
COPY frontend/ /app/frontend/
RUN npm install && npm run build

# --- Proxy ---
WORKDIR /app/proxy
COPY proxy/ /app/proxy/

# --- Nginx config for frontend ---
RUN mkdir -p /var/www/frontend
RUN cp -r /app/frontend/dist/* /var/www/frontend/
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# --- Supervisor config ---
COPY release/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# --- Entrypoint ---
COPY release/start-all.sh /start-all.sh
RUN chmod +x /start-all.sh

EXPOSE 80 8000 25565-25575
CMD ["/start-all.sh"]
