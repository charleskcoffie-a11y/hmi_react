// Recipe persistence for Electron builds
// Uses IPC to communicate with main process for file-based storage
// Falls back to localStorage for browser builds

const STORAGE_PREFIX = 'hmi_recipes_';
const memoryStore = {};

const isElectron = () => {
  return typeof window !== 'undefined' && typeof window.electron !== 'undefined';
};

const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;
const keyFor = (side) => `${STORAGE_PREFIX}${side || 'default'}`;

const readStore = (side) => {
  const key = keyFor(side);
  if (hasStorage()) {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to read recipes from storage:', err);
    }
  }
  return memoryStore[key] || [];
};

const writeStore = (side, recipes) => {
  const safeRecipes = Array.isArray(recipes) ? recipes : [];
  const key = keyFor(side);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(key, JSON.stringify(safeRecipes));
    } catch (err) {
      console.warn('Failed to persist recipes to storage:', err);
    }
  }
  memoryStore[key] = safeRecipes;
};

export const loadRecipesFromFolder = async (side) => {
  if (isElectron() && window.electron && window.electron.loadRecipes) {
    try {
      const recipes = await window.electron.loadRecipes(side);
      console.log(`[recipeService] Loaded ${recipes.length} recipes for ${side} from file system`);
      writeStore(side, recipes); // Also cache in memory
      return recipes;
    } catch (err) {
      console.warn('[recipeService] Failed to load recipes from file system, falling back to storage:', err);
      return readStore(side);
    }
  }
  // Browser build: use localStorage
  return readStore(side);
};

export const saveRecipeToFile = async (recipe, side) => {
  if (!recipe || !side || !recipe.name) return;
  
  if (isElectron() && window.electron && window.electron.saveRecipe) {
    try {
      const result = await window.electron.saveRecipe(recipe, side);
      if (result.success) {
        console.log(`[recipeService] Saved recipe "${recipe.name}" for ${side} to file system`);
        // Also update local cache
        const recipes = readStore(side);
        const idx = recipes.findIndex((r) => r.name === recipe.name);
        if (idx >= 0) {
          recipes[idx] = recipe;
        } else {
          recipes.push(recipe);
        }
        writeStore(side, recipes);
        return;
      }
    } catch (err) {
      console.warn('[recipeService] Failed to save recipe to file system, falling back to storage:', err);
    }
  }
  
  // Browser build or Electron fallback: use localStorage
  const recipes = readStore(side);
  const idx = recipes.findIndex((r) => r.name === recipe.name);
  if (idx >= 0) {
    recipes[idx] = recipe;
  } else {
    recipes.push(recipe);
  }
  writeStore(side, recipes);
};

export const deleteRecipeFile = async (recipeName, side) => {
  if (!recipeName || !side) return;
  const recipes = readStore(side).filter((r) => r.name !== recipeName);
  writeStore(side, recipes);
  
  // Note: File deletion from frontend is not exposed via IPC in current implementation
  // Files will be cleaned up when recipes are overwritten or app is reinstalled
};
