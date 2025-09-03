
# Blockpanel

A private web panel for Minecraft server hosting. Runs on Docker and maybe Windows 11 atm, Linux coming soon

## Features (Backend)
- Start/stop/status servers
- Upload plugins
- Read logs
- Edit server.properties
- Create worlds and much more

## Quickstart
### Windows
 - Download the Blockpanel Setup.exe file
 - Run it locally and go trough the installer
 - Enjoy Blockpanel at port 1105 running on your PC :)

### Docker
- Clone this Github Repository
```sh
git clone https://github.com/Luckmuc/Blockpanel.git
```
- Go in the right directory
```sh
cd Blockpanel/Dockercontainer
```
- Setup your container (for newer versions, remove the - from docker-compose)
```sh
docker-compose up --build
```
- Enjoy your Blockpanel instance :)

