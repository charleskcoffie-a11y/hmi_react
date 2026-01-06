// Lightweight recipe persistence for browser/Electron builds
// Uses localStorage when available; falls back to in-memory store.

const STORAGE_PREFIX = 'hmi_recipes_';
const memoryStore = {};

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

export const loadRecipesFromFolder = (side) => {
  return readStore(side);
};

export const saveRecipeToFile = (recipe, side) => {
  if (!recipe || !side || !recipe.name) return;
  const recipes = readStore(side);
  const idx = recipes.findIndex((r) => r.name === recipe.name);
  if (idx >= 0) {
    recipes[idx] = recipe;
  } else {
    recipes.push(recipe);
  }
  writeStore(side, recipes);
};

export const deleteRecipeFile = (recipeName, side) => {
  if (!recipeName || !side) return;
  const recipes = readStore(side).filter((r) => r.name !== recipeName);
  writeStore(side, recipes);
};
