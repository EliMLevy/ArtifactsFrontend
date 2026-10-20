// Central dashboard state + browser persistence.
import { TOKEN_KEY, ACCOUNT_KEY } from "./config.js";

export const state = {
  token: "",
  account: "",
  characters: [],
  /** character name -> LogSchema[] (newest first) */
  logsByCharacter: {},
  /** true once /my/logs has been fetched successfully (needs a token) */
  logsAvailable: false,
  /** map_id -> map name (null while loading / on failure) */
  mapCache: {},
  loading: false,
  autoRefresh: true,
  connected: false,
  /** "accounts" | "my" — which endpoint served the roster */
  via: "",
};

export function readStore(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function writeStore(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable: the page still works for the session */
  }
}

export function saveCredentials(token, account) {
  writeStore(TOKEN_KEY, token);
  writeStore(ACCOUNT_KEY, account);
}

export function clearCredentials() {
  writeStore(TOKEN_KEY, "");
  writeStore(ACCOUNT_KEY, "");
}

/** Group raw logs by character name, newest first. */
export function setLogs(logs) {
  const byChar = {};
  for (const log of logs || []) {
    if (!log || !log.character) continue;
    (byChar[log.character] = byChar[log.character] || []).push(log);
  }
  for (const name of Object.keys(byChar)) {
    byChar[name].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  state.logsByCharacter = byChar;
  state.logsAvailable = true;
}

export function resetConnectionState() {
  state.token = "";
  state.account = "";
  state.characters = [];
  state.logsByCharacter = {};
  state.logsAvailable = false;
  state.connected = false;
  state.via = "";
}
