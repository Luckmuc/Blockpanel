# Blockpanel

Ein privates Web-Panel für Minecraft-Server-Hoster. Mit Docker, FastAPI und moderner UI.

## Features (Backend)
- Server starten/stoppen/status
- Plugins hochladen
- Logs lesen
- server.properties editieren
- Welten erstellen

## Schnellstart
1. `docker-compose up --build`
2. Panel unter http://localhost:8000/docs testen

# Blockpanel Backend

## Features
- FastAPI-Backend für Minecraft-Server-Panel
- Multi-Server-Management (Start, Stop, Kill, Restart, Status, Properties, Logs, Plugins, Welten, EULA, Auth)
- tmux-Prozess-Handling
- JWT-Auth, sichere Uploads, Directory-Traversal-Schutz
- Docker- und docker-compose-fähig

## Quickstart

1. **Build & Start**
   ```sh
   docker compose up --build
   ```

2. **API testen**
   - Login: `/login` (FormData: username, password)
   - Server-APIs: `/server/*`

3. **Standard-Login**
   - Benutzername: `admin`
   - Passwort: `admin`

## Hinweise
- Server-Initialisierung, Purpur-Download etc. erfolgt über die API (`/server/create`).
- Plugins-Upload: Nur `.jar` erlaubt, max. 10MB, sichere Pfade.
- tmux muss im Container installiert sein (siehe Dockerfile).

## Security
- JWT-Auth für alle kritischen Endpunkte
- Rate-Limiting empfohlen (optional)
- Directory-Traversal-Schutz überall

## Lizenz
MIT
