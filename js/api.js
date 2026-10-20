// Thin client for the Artifacts API (https://api.artifactsmmo.com/openapi.json).
import { API_BASE } from "./config.js";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch(path, token) {
  const headers = { Accept: "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + path, { headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      (body && body.error && body.error.message) ||
      (body && body.detail) ||
      `Request failed (HTTP ${res.status})`;
    throw new ApiError(msg, res.status, body && body.error ? body.error.code : res.status);
  }
  return body;
}

const dataOf = (body) => (body && body.data) || {};

/** GET / — server status, season, online counts. */
export const getServerStatus = () => apiFetch("/").then(dataOf);

/** GET /my/details — account details for a token (resolves the username). */
export const getAccountDetails = (token) => apiFetch("/my/details", token).then(dataOf);

/** GET /accounts/{account}/characters — public roster for an account. */
export const getAccountCharacters = (account) =>
  apiFetch(`/accounts/${encodeURIComponent(account)}/characters`).then((b) => (b && b.data) || []);

/** GET /my/characters — authenticated roster (fallback). */
export const getMyCharacters = (token) =>
  apiFetch("/my/characters", token).then((b) => (b && b.data) || []);

/** GET /maps/id/{map_id} — resolve a map id to its details. */
export const getMapById = (mapId) =>
  apiFetch(`/maps/id/${encodeURIComponent(mapId)}`).then(dataOf);

/** GET /maps/{layer}/{x}/{y} — fallback map lookup by position. */
export const getMapAt = (layer, x, y) =>
  apiFetch(`/maps/${encodeURIComponent(layer)}/${x}/${y}`).then(dataOf);

/**
 * GET /my/logs — history of the last 5000 actions of all characters.
 * Requires a token. Returns { data: LogSchema[], page, size, pages, total }.
 */
export const getLogs = (token, page = 1, size = 100) =>
  apiFetch(`/my/logs?page=${page}&size=${size}`, token);

/** GET /my/rates — account rate limits (JWT auth). */
export const getRateLimits = (token) => apiFetch("/my/rates", token);

/** GET /my/bank/items — one page of bank contents (JWT auth). */
export const getBankItemsPage = (token, page = 1, size = 100) =>
  apiFetch(`/my/bank/items?page=${page}&size=${size}`, token);

/**
 * GET /accounts/{account}/achievements — public; includes per-objective
 * progress and completed_at. Returns the raw paged body.
 */
export const getAccountAchievementsPage = (account, page = 1, size = 100) =>
  apiFetch(`/accounts/${encodeURIComponent(account)}/achievements?page=${page}&size=${size}`);

/**
 * GET /leaderboard/accounts — public server leaderboard.
 * sort: "achievements_points" | "gold". Returns the raw paged body.
 */
export const getAccountsLeaderboardPage = (sort, page = 1, size = 100) =>
  apiFetch(`/leaderboard/accounts?sort=${encodeURIComponent(sort)}&page=${page}&size=${size}`);
