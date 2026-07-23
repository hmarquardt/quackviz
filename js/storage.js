import { createWorkspace, state } from "./state.js";

const DB_NAME = "quackviz";
const STORE = "workspaces";
const KEY = "active";
const SETTINGS_KEY = "quackviz.settings";
const OPENROUTER_KEY = "quackviz.openrouter.key";

function openStore(mode = "readonly") {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(STORE, mode);
      resolve({ db: request.result, tx, store: tx.objectStore(STORE) });
    };
  });
}

export async function loadWorkspace() {
  try {
    const { db, store } = await openStore();
    const value = await new Promise((resolve, reject) => {
      const req = store.get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    state.diagnostics.indexedDb = "available";
    state.workspace = value || createWorkspace();
  } catch (error) {
    state.diagnostics.indexedDb = `error: ${error.message}`;
    state.workspace = createWorkspace();
  }
  state.profiles = Object.fromEntries((state.workspace.dataSources || []).filter((source) => source.profile).map((source) => [source.tableName, source.profile]));
  state.tables = (state.workspace.dataSources || []).map((source) => ({ name: source.tableName, rowCount: source.rowCount, columns: source.columns }));
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  state.workspace.settings = { ...state.workspace.settings, ...settings };
  return state.workspace;
}

export async function saveWorkspace() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.workspace.settings || {}));
  const { db, tx, store } = await openStore("readwrite");
  await new Promise((resolve, reject) => {
    const req = store.put(state.workspace, KEY);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function getApiKey() {
  return localStorage.getItem(OPENROUTER_KEY) || "";
}

export function setApiKey(value) {
  if (value) localStorage.setItem(OPENROUTER_KEY, value);
  else localStorage.removeItem(OPENROUTER_KEY);
}

export async function resetStoredWorkspace() {
  const { db, tx, store } = await openStore("readwrite");
  store.delete(KEY);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
