// Data orchestration: account resolution, roster + log fetching, refresh loop.
import { REFRESH_MS, LOGS_PAGE_SIZE, LOGS_MAX_PAGES, BANK_PAGE_SIZE, BANK_MAX_PAGES } from "./config.js";
import { state, setLogs } from "./store.js";
import {
  getAccountDetails,
  getAccountCharacters,
  getMyCharacters,
  getLogs,
  getRateLimits,
  getBankItemsPage,
} from "./api.js";

let refreshTimer = null;
let tickCount = 0;

/**
 * Resolve the account username. Prefers an explicit username; otherwise asks
 * /my/details to derive it from the token.
 * Returns { account, details } where details may be null.
 */
export async function resolveAccount(token, accountInput) {
  if (token && !accountInput) {
    const details = await getAccountDetails(token);
    if (!details.username) throw new Error("Could not resolve your account username from that token.");
    return { account: details.username, details };
  }
  if (token) {
    try {
      const details = await getAccountDetails(token);
      return { account: accountInput, details };
    } catch {
      return { account: accountInput, details: null };
    }
  }
  return { account: accountInput, details: null };
}

/**
 * Load the roster, preferring the requested GET /accounts/{account}/characters
 * endpoint and falling back to the authenticated GET /my/characters.
 * Returns { list, via }.
 */
export async function fetchCharacters(account, token) {
  try {
    const list = await getAccountCharacters(account);
    return { list, via: "accounts" };
  } catch (err) {
    if (token) {
      const list = await getMyCharacters(token);
      return { list, via: "my" };
    }
    throw err;
  }
}

/** Page through /my/logs (token required) and group them per character in state. */
export async function refreshLogs() {
  if (!state.token) return;
  const all = [];
  for (let page = 1; page <= LOGS_MAX_PAGES; page++) {
    const body = await getLogs(state.token, page, LOGS_PAGE_SIZE);
    const logs = (body && body.data) || [];
    all.push(...logs);
    const pages = body && body.pages;
    if (logs.length < LOGS_PAGE_SIZE || (pages && page >= pages)) break;
  }
  setLogs(all);
}

/** Fetch /my/rates (token required) and stash the scopes in state. Silent on failure. */
export async function fetchRates() {
  if (!state.token) return;
  try {
    const body = await getRateLimits(state.token);
    state.rates = (body && body.data) || null;
  } catch {
    /* rates are informational — never break the dashboard */
  }
}

/** Page through /my/bank/items (token required) and stash everything in state. */
export async function fetchAllBankItems() {
  if (!state.token) return;
  const all = [];
  for (let page = 1; page <= BANK_MAX_PAGES; page++) {
    const body = await getBankItemsPage(state.token, page, BANK_PAGE_SIZE);
    const items = (body && body.data) || [];
    all.push(...items);
    const pages = body && body.pages;
    if (items.length < BANK_PAGE_SIZE || (pages && page >= pages)) break;
  }
  state.bankItems = all;
}

export function startAutoRefresh(onTick) {
  stopAutoRefresh();
  tickCount = 0;
  if (!state.autoRefresh || !state.connected) return;
  refreshTimer = setInterval(() => {
    tickCount += 1;
    if (!state.loading) onTick(tickCount);
  }, REFRESH_MS);
}

export function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
