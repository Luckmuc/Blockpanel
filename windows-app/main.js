const { app, BrowserWindow, Menu, Tray, nativeImage, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const BackendManager = require('./backend-manager');
const { exec } = require('child_process');

let mainWindow;
let backendManager;
let appConfig = {};

const isDev = process.argv.includes('--dev');
const isHeadless = process.argv.includes('--headless');

// Load configuration
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      // Default config
      appConfig = {
        autoStart: false,
        networkAccess: false
      };
    }
  } catch (error) {
    console.log('Config load error, using defaults:', error);
    appConfig = {
      autoStart: false,
      networkAccess: false
    };
  }
  console.log('Loaded config:', appConfig);
}

// Use port 1105 for both frontend and backend API
const FRONTEND_PORT = 1105;
const BACKEND_PORT = 1105;

async function createWindow() {
  // If headless flag is set, only run background services and don't open a browser
  if (isHeadless) {
    console.log('Running in headless mode — no GUI will be shown.');
    await setupFrontendServer();
    // Keep process alive for background service
    return;
  }

  // Non-headless behavior: ensure backend is ready and open the user's default browser
  try {
    // Wait for backend to respond (this will throw if it doesn't become ready)
    await setupFrontendServer();
    const url = isDev ? 'http://localhost:5173' : 'http://127.0.0.1:1105/';
    console.log('Opening default browser to', url);
    // Open external browser instead of embedding the site in an Electron window
    shell.openExternal(url);
    // Create a minimal hidden window only so the app has a GUI context for tray/menu if needed
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      // Prefer a generated installer icon if available, fallback to frontend project icon
      icon: (function() {
        const gen = path.join(__dirname, '../build/generated-icon.ico');
        const alt = path.join(__dirname, '../frontend/project-icon.ico');
        try { if (fs.existsSync(gen)) return gen } catch(e) {}
        return alt;
      })(),
      show: false
    });
    // Remove menu bar completely
    mainWindow.setMenuBarVisibility(false);
    // Do not load remote content into the BrowserWindow
    mainWindow.on('closed', () => { mainWindow = null; });
    // Intercept close and hide so the process keeps running in background when user closes UI
    mainWindow.on('close', (e) => {
      if (app.isQuiting) return;
      e.preventDefault();
      mainWindow.hide();
    });
  } catch (err) {
    console.warn('Failed to open browser or wait for backend:', err);
  }
}

// Create a tray icon with simple menu to show app or quit
let tray = null;
function createTray() {
  try {
    const iconPath = path.join(__dirname, '../frontend/project-icon.ico');
    let image = null;
    if (nativeImage && nativeImage.createFromPath) {
      image = nativeImage.createFromPath(iconPath);
    }
    tray = new Tray(image || iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Öffnen', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Beenden', click: () => { app.isQuiting = true; app.quit(); } }
    ]);
    tray.setToolTip('Blockpanel');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
  } catch (e) {
    console.warn('Failed to create tray icon:', e);
  }
}

// Set or remove autostart registry entry on Windows
function setAutoStart(enabled) {
  if (process.platform !== 'win32') return Promise.resolve();
  return new Promise((resolve, reject) => {
    try {
      const exePath = process.execPath;
      // Guard: do not write registry if exe path is empty or missing
      if (!exePath || !fs.existsSync(exePath)) {
        console.warn('AutoStart: executable path not found, skipping registry/shortcut setup.');
        return resolve();
      }
      if (enabled) {
        // Add registry entry to run app in headless mode on login
      // Add registry entry to run the app on login (no --headless, user opens app normally)
      const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Blockpanel" /t REG_SZ /d "\"${exePath}\"" /f`;
        exec(regCmd, (err, stdout, stderr) => {
          if (err) {
            console.warn('Failed to add autostart registry entry:', stderr || err.message);
            // continue to try creating a startup shortcut anyway
          } else {
            console.log('Autostart registry entry added');
          }

          // Also create a shortcut in the user's Startup folder for better visibility
          try {
            const startupPath = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
            const shortcutPath = path.join(startupPath, 'Blockpanel.lnk');
            const vbsPath = path.join(startupPath, 'create_blockpanel_shortcut.vbs');
        // Create shortcut without arguments so app shows normally on login
        const vbsContent = `Set oWS = WScript.CreateObject("WScript.Shell")\nstrLink = "${shortcutPath}"\nSet oLink = oWS.CreateShortcut(strLink)\noLink.TargetPath = "${exePath}"\noLink.Arguments = ""\noLink.WorkingDirectory = "${path.dirname(exePath)}"\noLink.Save`;
            // Write VBS to startup and execute it
            fs.writeFileSync(vbsPath, vbsContent, 'utf8');
            exec(`cscript //nologo "${vbsPath}"`, (err2, so, se) => {
              try { fs.unlinkSync(vbsPath); } catch (e) { /* ignore */ }
              if (err2) {
                console.warn('Failed to create Startup shortcut via cscript:', se || err2.message);
                return resolve();
              }
              console.log('Startup shortcut created at', shortcutPath);
              return resolve();
            });
          } catch (e) {
            console.warn('Failed to create startup shortcut:', e.message || e);
            return resolve();
          }
        });
      } else {
        const regDelCmd = `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Blockpanel" /f`;
        exec(regDelCmd, (err, so, se) => {
          if (err) {
            console.warn('Failed to remove autostart registry entry (may not exist):', se || err.message);
          } else {
            console.log('Autostart registry entry removed');
          }

          // Remove startup shortcut if exists
          try {
            const startupPath = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
            const shortcutPath = path.join(startupPath, 'Blockpanel.lnk');
            try { fs.unlinkSync(shortcutPath); console.log('Startup shortcut removed', shortcutPath); } catch (e) { /* ignore */ }
            return resolve();
          } catch (e) {
            console.warn('Failed to remove startup shortcut:', e.message || e);
            return resolve();
          }
        });
      }
    } catch (e) {
      console.warn('Error setting autostart:', e.message);
      reject(e);
    }
  });
}

async function setupFrontendServer() {
  // Wait for backend to respond on localhost:1105 before returning
  const url = 'http://127.0.0.1:1105/';
  const maxMs = 20000;
  const intervalMs = 500;
  const start = Date.now();
  const http = require('http');
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        // If response is any 2xx or 3xx, consider ready
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log('Backend responded, ready to serve frontend');
          res.destroy();
          return resolve();
        }
        // If 404 but content-type is html, it might be SPA fallback; accept 200 only
        res.destroy();
        if (Date.now() - start > maxMs) return reject(new Error('Backend did not become ready in time'));
        setTimeout(tryOnce, intervalMs);
      });
      req.on('error', (err) => {
        if (Date.now() - start > maxMs) return reject(new Error('Backend did not become ready in time'));
        setTimeout(tryOnce, intervalMs);
      });
      req.setTimeout(3000, () => { req.abort(); });
    };
    tryOnce();
  });
}

function createMenu() {
  const template = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Beenden',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'forceReload', label: 'Erzwingen neu laden' },
        { role: 'toggleDevTools', label: 'Entwicklertools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom zurücksetzen' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Über Blockpanel',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Über Blockpanel',
              message: 'Blockpanel',
              detail: 'Eine moderne Minecraft Server Management Anwendung'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function setupAppData() {
  const userDataPath = app.getPath('userData');
  const appDataPath = path.join(userDataPath, 'blockpanel-data');
  
  // Create app data directory
  await fs.ensureDir(appDataPath);
  
  // Copy backend files if they don't exist
  const backendPath = path.join(appDataPath, 'backend');
  if (!await fs.pathExists(backendPath)) {
    await fs.copy(path.join(__dirname, '../backend'), backendPath, {
      filter: (src) => {
        return !src.includes('__pycache__') && !src.includes('mc_servers');
      }
    });
  }
  
  // Create mc_servers directory
  const mcServersPath = path.join(appDataPath, 'mc_servers');
  await fs.ensureDir(mcServersPath);
  
  // Create backend log directory inside mc_servers
  const backendMcServersPath = path.join(backendPath, 'mc_servers');
  await fs.ensureDir(backendMcServersPath);
  
  // Copy frontend dist to backend
  const frontendDistPath = path.join(backendPath, 'frontend_dist');
  const sourceFrontendDist = path.join(__dirname, '../frontend/dist');
  const sourceBackendFrontendDist = path.join(__dirname, '../backend/frontend_dist');
  
  // Try multiple sources for frontend dist
  let frontendSource = null;
  if (await fs.pathExists(sourceBackendFrontendDist)) {
    frontendSource = sourceBackendFrontendDist;
  } else if (await fs.pathExists(sourceFrontendDist)) {
    frontendSource = sourceFrontendDist;
  }
  
  if (frontendSource && !await fs.pathExists(frontendDistPath)) {
    await fs.copy(frontendSource, frontendDistPath);
    console.log('Frontend dist copied to backend from:', frontendSource);
  } else if (frontendSource && await fs.pathExists(frontendDistPath)) {
    // Always update frontend to ensure latest version
    await fs.remove(frontendDistPath);
    await fs.copy(frontendSource, frontendDistPath);
    console.log('Frontend dist updated in backend from:', frontendSource);
  }
  
  return { appDataPath, backendPath, mcServersPath };
}

app.whenReady().then(async () => {
  // Load configuration first
  loadConfig();
  
  try {
    // Setup app data directories
    const { appDataPath, backendPath, mcServersPath } = await setupAppData();
    
    // Ensure config.json exists next to backend so Python backend can read it
    try {
      const backendConfigPath = path.join(backendPath, 'config.json');
      await fs.writeFile(backendConfigPath, JSON.stringify(appConfig, null, 2), 'utf8');
      console.log('Wrote backend config to', backendConfigPath);
    } catch (e) {
      console.warn('Failed to write backend config.json:', e.message || e);
    }
    
    // Start backend manager
    backendManager = new BackendManager(backendPath, mcServersPath);
    
    // Pass configuration to backend manager
    backendManager.setConfig(appConfig);
    
    await backendManager.start();
    
    // Ensure autostart registry entry matches the config (Windows only)
    try {
      await setAutoStart(appConfig.autoStart === true);
    } catch (e) {
      console.warn('Autostart registry update failed:', e.message || e);
    }

    // Create main window if not headless
    if (!isHeadless) {
      await createWindow();
      createTray();
    } else {
      // Running headless: create tray so users can open UI and quit
      createTray();
      console.log('Running headless - GUI hidden, backend running in background');
    }
    
    app.on('activate', () => {
  if (!isHeadless && BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    
  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox('Startup Error', `Failed to start Blockpanel: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // In headless mode we do not quit when windows are closed because we may have none
  if (!isHeadless && process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (backendManager) {
    await backendManager.stop();
  }
  // No separate frontend server anymore - backend serves frontend
});

// Handle app protocol for deep linking (optional)
app.setAsDefaultProtocolClient('blockpanel');

// IPC handlers exposed to renderer via preload.js
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('Failed to open external URL:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-version', () => {
  return { version: app.getVersion() };
});
