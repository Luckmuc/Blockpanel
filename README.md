
# Blockpanel

A private web panel for Minecraft server hosting. Runs on Docker and maybe Windows 11 atm, Linux coming soon

## Features (Backend)
- Start/stop/status servers
- Upload plugins
- Read logs
- Edit server.properties
- Create worlds and much more

## Quickstart
1. `docker-compose up --build`
2. Test the panel at http://localhost:1105

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

2. **Default Login**
   - Username: `admin`
   - Password: `admin`

## Security
- JWT auth for all critical endpoints
- Rate limiting recommended (optional)
- Directory traversal protection everywhere
