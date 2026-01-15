// Add at the top
const { ipcMain } = require('electron');
const fs = require('fs');


const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const { startServer } = require('./backend/plc-server');

// Config file path for storing Net ID
const CONFIG_DIR = path.join(app.getPath('appData'), 'CNC Dual head');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('[electron] Failed to load config:', err.message);
  }
  return {};
}

function saveConfig(config) {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[electron] Config saved:', CONFIG_FILE);
  } catch (err) {
    console.error('[electron] Failed to save config:', err.message);
  }
}

function clearOldAppData() {
  const toDelete = new Set();
  try {
    toDelete.add(app.getPath('userData'));
    toDelete.add(path.join(app.getPath('appData'), 'CNC Dual head'));
    toDelete.add(path.join(app.getPath('appData'), 'hmi-electron'));
    // LOCALAPPDATA mirrors appData on Windows; guard env presence
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      toDelete.add(path.join(localAppData, 'CNC Dual head'));
      toDelete.add(path.join(localAppData, 'hmi-electron'));
      toDelete.add(path.join(localAppData, 'Programs', 'CNC Dual head'));
    }
    // Also clear browser cache and session data
    toDelete.add(path.join(app.getPath('appData'), 'hmi-electron', 'Cache'));
    toDelete.add(path.join(app.getPath('appData'), 'hmi-electron', 'Code Cache'));
    toDelete.add(path.join(app.getPath('appData'), 'CNC Dual head', 'Cache'));
    toDelete.add(path.join(app.getPath('appData'), 'CNC Dual head', 'Code Cache'));
  } catch (e) {
    console.warn('[electron] Unable to build cache delete list:', e.message || e);
  }

  let deletedCount = 0;
  toDelete.forEach((p) => {
    try {
      if (p && fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log('[electron] Removed old cache:', p);
        deletedCount++;
      }
    } catch (e) {
      console.warn('[electron] Failed to remove cache path', p, e.message || e);
    }
  });
  
  console.log(`[electron] Cache cleanup complete: ${deletedCount} directories removed`);
}

let backendServer;

function createWindow() {
  // Fullscreen app with no window controls
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    useContentSize: true,
    fullscreen: true,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 1.0,
    },
  });

  // Set window constraints for 1024x768
  try { win.setAspectRatio(1024 / 768); } catch (e) {}
  try { win.setMinimumSize(1024, 768); } catch (e) {}
  try { win.center(); } catch (e) {}

  // Load from localhost:3003 in development
  const DEV_SERVER = 'http://localhost:3003';
  
  // Function to load from build files
  const loadFromBuild = () => {
    const isPackaged = app.isPackaged;
    const buildPath = isPackaged
      ? path.join(process.resourcesPath, 'app', 'build', 'index.html')
      : path.join(__dirname, 'build', 'index.html');

    console.log('[electron] Loading from build:', buildPath);
    win.loadFile(buildPath).catch((err) => {
      console.error('Failed to load index.html:', err);
    });
  };
  
  // Try dev server first, fallback to build
  win.loadURL(DEV_SERVER).catch((err) => {
    console.log('[electron] Dev server not available, loading from build folder');
    loadFromBuild();
  });

  win.setMenuBarVisibility(false);

  // Ensure the window becomes visible and focused when ready
  win.once('ready-to-show', () => {
    try {
      win.show();
      win.focus();
    } catch (e) {}
  });

  // DevTools disabled for production
  // try { win.webContents.openDevTools({ mode: 'undocked' }); } catch (e) {}

  console.log(`[electron] Running in 1024x768 preview mode (windowed)`);
}

// IPC handler to get saved Net ID from config
ipcMain.handle('get-net-id', async () => {
  const config = loadConfig();
  return config.amsNetId || null;
});

// IPC handler to save Net ID to config
ipcMain.handle('save-net-id', async (event, netId) => {
  const config = loadConfig();
  config.amsNetId = netId;
  saveConfig(config);
  return { success: true, netId };
});

app.whenReady().then(async () => {
  try {
    clearOldAppData();
    backendServer = await startServer();
  } catch (err) {
    console.error('Failed to start PLC backend:', err.message);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (backendServer && backendServer.stop) {
    await backendServer.stop();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for recipe save/load
// Store recipes under the per-user data directory to ensure write access in production
const recipesDir = path.join(app.getPath('userData'), 'recipes');

ipcMain.handle('save-recipe', async (event, recipe, side) => {
  try {
    if (!fs.existsSync(recipesDir)) {
      fs.mkdirSync(recipesDir);
    }
    const fileName = `${side}_${recipe.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    const filePath = path.join(recipesDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-recipes', async (event, side) => {
  try {
    if (!fs.existsSync(recipesDir)) return [];
    const files = fs.readdirSync(recipesDir).filter(f => f.startsWith(side));
    return files.map(f => {
      const content = fs.readFileSync(path.join(recipesDir, f));
      return JSON.parse(content);
    });
  } catch (err) {
    return [];
  }
});
