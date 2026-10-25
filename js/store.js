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
  loading: false,
  autoRefresh: true,
  connected: false,
  /** "accounts" | "my" — which endpoint served the roster */
  via: "",
  /** SimpleItemSchema[] — full bank contents (token required) */
  bankItems: [],
  /** BankSchema | null — slots, expansions, next expansion cost, bank gold */
  bankDetails: null,
  bankFilter: { q: "", type: "" },
  /** RateLimitsDataSchema | null */
  rates: null,
  /** true while auto-refresh is paused after a 429 */
  backingOff: false,
  /** ActiveEventSchema[] — currently active events (public endpoint) */
  activeEvents: [],
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
  state.bankItems = [];
  state.bankDetails = null;
  state.bankFilter = { q: "", type: "" };
  state.rates = null;
  state.backingOff = false;
  state.activeEvents = [];
}
