const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveRecipe: (recipe, side) => ipcRenderer.invoke('save-recipe', recipe, side),
  loadRecipes: (side) => ipcRenderer.invoke('load-recipes', side),
});
