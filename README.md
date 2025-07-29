
# Blockpanel

A private web panel for Minecraft server hosting. Built with Docker, FastAPI, and a modern UI.

## Features (Backend)
- Start/stop/status servers
- Upload plugins
- Read logs
- Edit server.properties
- Create worlds

## Quickstart
1. `docker-compose up --build`
2. Test the panel at http://localhost:8000/docs

# Blockpanel Backend

## Features
- FastAPI backend for Minecraft server panel
- Multi-server management (Start, Stop, Kill, Restart, Status, Properties, Logs, Plugins, Worlds, EULA, Auth)
- tmux process handling
- JWT auth, secure uploads, directory traversal protection
- Docker and docker-compose ready

## Quickstart

1. **Build & Start**
   ```sh
   docker compose up --build
   ```

2. **Test API**
   - Login: `/login` (FormData: username, password)
   - Server APIs: `/server/*`

3. **Default Login**
   - Username: `admin`
   - Password: `admin`

## Notes
- Server initialization, Purpur download, etc. is done via the API (`/server/create`).
- Plugin upload: Only `.jar` allowed, max. 10MB, secure paths.
- tmux must be installed in the container (see Dockerfile).

## Security
- JWT auth for all critical endpoints
- Rate limiting recommended (optional)
- Directory traversal protection everywhere

## Troubleshooting (Linux/WSL)

- Stelle sicher, dass alle Shell-Skripte (z.B. `entrypoint.sh`) mit Unix-Zeilenenden (LF) gespeichert sind. In VS Code unten rechts auf "LF" stellen.
- Falls Fehler wie `Exec format error` auftreten, führe im Projektordner aus:
  ```sh
  dos2unix backend/entrypoint.sh
  chmod +x backend/entrypoint.sh
  ```
- Die Dockerfiles und das Compose-File sind so angepasst, dass sie auf Linux und Windows funktionieren.

## License
MIT
