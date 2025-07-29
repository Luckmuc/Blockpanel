FROM python:3.13-slim

# Installiere Java 21 (Temurin), curl, wget, gpg, procps, tmux
RUN apt-get update && \
    apt-get install -y curl wget gnupg procps tmux dos2unix && \
    mkdir -p /usr/share/man/man1 && \
    wget -O- https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor > /etc/apt/trusted.gpg.d/adoptium.gpg && \
    echo "deb https://packages.adoptium.net/artifactory/deb bookworm main" > /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y temurin-21-jdk && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY entrypoint.sh ./
RUN dos2unix entrypoint.sh && chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]
