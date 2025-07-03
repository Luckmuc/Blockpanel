FROM python:3.13-slim

# Install required packages including Java 21
RUN apt-get update && \
    apt-get install -y curl wget gnupg procps tmux && \
    mkdir -p /usr/share/man/man1 && \
    # Try to add Adoptium repository, fallback to Debian default if it fails
    (wget -O- https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor > /etc/apt/trusted.gpg.d/adoptium.gpg && \
     echo "deb https://packages.adoptium.net/artifactory/deb bookworm main" > /etc/apt/sources.list.d/adoptium.list && \
     apt-get update && \
     apt-get install -y temurin-21-jdk) || \
    # Fallback to default Java from Debian repo
    (apt-get install -y default-jdk) && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Create mc_servers directory with proper permissions
RUN mkdir -p /app/mc_servers && chmod 755 /app/mc_servers

CMD ["./entrypoint.sh"]
