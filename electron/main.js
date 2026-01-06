// Add at the top
const { ipcMain } = require('electron');
const fs = require('fs');


const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

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
  // Only open DevTools in development mode
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for recipe save/load
const recipesDir = path.join(app.getAppPath(), '..', 'recipes');

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
