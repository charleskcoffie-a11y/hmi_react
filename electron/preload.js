const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveRecipe: (recipe, side) => ipcRenderer.invoke('save-recipe', recipe, side),
  loadRecipes: (side) => ipcRenderer.invoke('load-recipes', side),
  deleteRecipe: (recipeName, side) => ipcRenderer.invoke('delete-recipe', recipeName, side),
  getNetId: () => ipcRenderer.invoke('get-net-id')
});

// Also expose under 'api' for backward compatibility
contextBridge.exposeInMainWorld('api', {
  saveRecipe: (recipe, side) => ipcRenderer.invoke('save-recipe', recipe, side),
  loadRecipes: (side) => ipcRenderer.invoke('load-recipes', side),
  deleteRecipe: (recipeName, side) => ipcRenderer.invoke('delete-recipe', recipeName, side),
});
