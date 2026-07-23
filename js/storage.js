import { STORAGE } from "./constants.js";
import { createWorkspace, hydrateWorkspace, serializeWorkspace } from "./workspace.js";
import { debounce } from "./utils.js";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(STORAGE.dbName, STORAGE.dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORAGE.workspaceStore)) db.createObjectStore(STORAGE.workspaceStore, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORAGE.metaStore)) db.createObjectStore(STORAGE.metaStore);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await fn(store);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
    });
    return result;
  } finally {
    db.close();
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function initializeStorage() {
  const db = await openDatabase();
  db.close();
  return { indexedDb: "available", dbName: STORAGE.dbName, version: STORAGE.dbVersion };
}

export async function loadWorkspace() {
  const activeId = await withStore(STORAGE.metaStore, "readonly", (store) => requestResult(store.get(STORAGE.activeWorkspaceKey))).catch(() => null);
  if (!activeId) return createWorkspace();
  const stored = await withStore(STORAGE.workspaceStore, "readonly", (store) => requestResult(store.get(activeId)));
  if (!stored) return createWorkspace();
  return hydrateWorkspace(stored);
}

export async function saveWorkspace(workspace) {
  const serialized = serializeWorkspace(workspace);
  await withStore(STORAGE.workspaceStore, "readwrite", (store) => requestResult(store.put(serialized)));
  await withStore(STORAGE.metaStore, "readwrite", (store) => requestResult(store.put(serialized.id, STORAGE.activeWorkspaceKey)));
  return serialized;
}

export const saveWorkspaceDebounced = debounce((workspace, onError) => {
  saveWorkspace(workspace).catch((error) => {
    if (onError) onError(error);
  });
}, 350);

export async function resetStoredWorkspace() {
  await withStore(STORAGE.workspaceStore, "readwrite", (store) => requestResult(store.clear()));
  await withStore(STORAGE.metaStore, "readwrite", (store) => requestResult(store.delete(STORAGE.activeWorkspaceKey)));
}

export async function saveTemporaryWorkspace(workspace) {
  await saveWorkspace(workspace);
  return loadWorkspace();
}

export function loadThemePreference() {
  return localStorage.getItem(STORAGE.themePreferenceKey);
}

export function saveThemePreference(theme) {
  if (theme) localStorage.setItem(STORAGE.themePreferenceKey, theme);
  else localStorage.removeItem(STORAGE.themePreferenceKey);
}

export function getOpenRouterApiKey() {
  return localStorage.getItem(STORAGE.openRouterApiKey) || "";
}

export function setOpenRouterApiKey(value) {
  if (value) localStorage.setItem(STORAGE.openRouterApiKey, value);
  else localStorage.removeItem(STORAGE.openRouterApiKey);
}

export function loadAiModelCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.aiModelCache) || "null");
  } catch {
    return null;
  }
}

export function saveAiModelCache(cache) {
  localStorage.setItem(STORAGE.aiModelCache, JSON.stringify(cache));
}
