// Shared constants for the Artifacts dashboard.
export const API_BASE = "https://api.artifactsmmo.com";

export const TOKEN_KEY = "artifacts_api_token";
export const ACCOUNT_KEY = "artifacts_account";

// Character state refreshes on this cadence (user requested 5s).
export const REFRESH_MS = 5000;

// /my/logs is heavier, so it refreshes every Nth character tick.
export const LOGS_EVERY_N_TICKS = 3;
export const LOGS_PAGE_SIZE = 100;
export const LOGS_PER_CHARACTER = 8;

// Bank + rate limits refresh on a slower cadence.
export const SLOW_EVERY_N_TICKS = 6;
export const BANK_PAGE_SIZE = 100;
export const BANK_MAX_PAGES = 50;
