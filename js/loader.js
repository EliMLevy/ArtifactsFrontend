// Data orchestration: account resolution, roster + log fetching, refresh loop.
import { REFRESH_MS, LOGS_PAGE_SIZE } from "./config.js";
import { state, setLogs } from "./store.js";
import {
  getAccountDetails,
  getAccountCharacters,
  getMyCharacters,
  getMapById,
  getMapAt,
  getLogs,
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

/** Fetch /my/logs (token required) and group them per character in state. */
export async function refreshLogs() {
  if (!state.token) return;
  const body = await getLogs(state.token, 1, LOGS_PAGE_SIZE);
  const logs = (body && body.data) || [];
  setLogs(logs);
}

/** Resolve map names for every distinct map_id on the roster (cached). */
export async function warmMapCache() {
  const byId = {};
  for (const c of state.characters) {
    if (c.map_id != null && !(c.map_id in state.mapCache)) byId[c.map_id] = c;
  }
  await Promise.all(
    Object.keys(byId).map(async (id) => {
      const c = byId[id];
      state.mapCache[id] = null; // mark as loading
      try {
        const m = await getMapById(c.map_id);
        state.mapCache[id] = m && m.name ? m.name : null;
      } catch {
        try {
          if (c.layer && c.x != null && c.y != null) {
            const m = await getMapAt(c.layer, c.x, c.y);
            state.mapCache[id] = m && m.name ? m.name : null;
          } else {
            state.mapCache[id] = null;
          }
        } catch {
          state.mapCache[id] = null;
        }
      }
    })
  );
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
