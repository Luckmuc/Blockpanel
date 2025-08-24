Windows App for Blockpanel

This folder contains the Electron-based Windows desktop wrapper for Blockpanel.

Quick tasks

- Install dependencies for the windows app and frontend/backend:
  - Open PowerShell in this folder and run:

```powershell
.\build.bat
```

- Development run (requires frontend dev server):
  - From project root start the frontend dev server (frontend):

```powershell
cd ..\frontend
npm install
npm run dev
```

  - Then start the Electron app in dev mode from `windows-app`:

```powershell
cd ..\windows-app
npm install
npm run dev
```

- Build a distributable installer (requires electron-builder):
  - From `windows-app` folder run:

```powershell
npm install
npm run build
```

Notes

- The Electron main process exposes two IPC handlers consumed by `preload.js`: `open-external` and `get-version`.
- The packaged app bundles the backend into the installer as extra resources and copies it to the user's app data on first run.

Bundling Python (optional)

- To make the installer work for non-developers without Python installed, you can bundle the official "Embeddable" Python distribution for Windows.
- Download the embeddable zip for the desired Python 3.x from https://www.python.org/downloads/windows/ (look for "Embeddable zip file").
- Place the downloaded `python-3.x-embed-amd64.zip` in `windows-app/build/` and rename it to `python.zip` before running the packer.
- The NSIS include `build/installer.nsh` will attempt to extract `python.zip` into the installation folder under `python/`.
- At runtime the app will prefer a bundled python executable inside the app resources (or the installed `python` subfolder). If none is present it'll fall back to system Python (`py`, `python`, `python3`).

How to include embeddable Python in the installer

1. Download the embeddable zip (e.g. `python-3.11.6-embed-amd64.zip`).
2. Move and rename it to `windows-app/build/python.zip`.
3. Build the installer with `npm run build` (from `windows-app` folder). The NSIS script will try to extract it at install time.

Security & size notes

- Bundling Python increases installer size significantly. If size matters, consider downloading Python at install time from python.org instead of bundling.
- Bundling the embeddable distribution is simplest and does not require modifying system PATH; it's extracted to the app installation folder only.

Autostart

- If the user enables Autostart during install, the installer will add an autostart entry (registry + Startup shortcut) that runs the installed Blockpanel executable on login. The app will be started normally (no automatic `--headless` flag) so it behaves like when the user launches it.

- The app still supports a headless mode (`--headless`) for advanced deployments; this is not automatically added to Autostart by default.

Troubleshooting

- If Python isn't found, install Python 3 and make sure `py` or `python` is on PATH.
- If npm install fails, ensure Node.js is installed and you have network access.
