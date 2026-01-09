// Add at the top
const { ipcMain } = require('electron');
const fs = require('fs');


const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const { startServer } = require('./backend/plc-server');

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
  } catch (e) {
    console.warn('[electron] Unable to build cache delete list:', e.message || e);
  }

  toDelete.forEach((p) => {
    try {
      if (p && fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log('[electron] Removed old cache:', p);
      }
    } catch (e) {
      console.warn('[electron] Failed to remove cache path', p, e.message || e);
    }
  });
}

let backendServer;

function createWindow() {
  const isDev = !app.isPackaged;
  const previewEnv = process.env.PREVIEW_1024;
  const isPreview = isDev || (previewEnv && /^(1|true|yes)$/i.test(previewEnv));

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    useContentSize: true,
    fullscreen: !isPreview,
    resizable: isPreview,
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
  if (isPreview) {
    try { win.setAspectRatio(1024 / 768); } catch (e) {}
    try { win.setMinimumSize(1024, 768); } catch (e) {}
    try { win.center(); } catch (e) {}
  }

    // Use process.resourcesPath in production, app.getAppPath() in development
    const isPackaged = app.isPackaged;
    const buildPath = isPackaged
      ? path.join(process.resourcesPath, 'app', 'build', 'index.html')
      : path.join(app.getAppPath(), '..', 'build', 'index.html');

    win.loadURL(
      url.format({
        pathname: buildPath,
        protocol: 'file:',
        slashes: true,
      })
    ).catch((err) => {
      console.error('Failed to load index.html:', err);
    });
  win.setMenuBarVisibility(false);

  // Ensure the window becomes visible and focused when ready
  win.once('ready-to-show', () => {
    try {
      if (isPreview) {
        win.setAlwaysOnTop(true, 'screen-saver');
      }
      win.show();
      win.focus();
      if (isPreview) {
        setTimeout(() => {
          try { win.setAlwaysOnTop(false); } catch (e) {}
        }, 1200);
      }
    } catch (e) {}
  });

  // Only open DevTools in preview/development mode
  if (isPreview) {
    try { win.webContents.openDevTools({ mode: 'undocked' }); } catch (e) {}
  }

  console.log(`[electron] Preview mode: ${isPreview ? 'ON (1024x768 windowed)' : 'OFF (fullscreen)'}`);
}

// IPC handler to get saved Net ID from renderer
ipcMain.handle('get-net-id', async () => {
  // This will be called by the renderer to provide the saved Net ID
  return null; // Renderer provides the value
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
