// Locally cached item catalog (data/items.json, committed to the repo).
// Lets the dashboard resolve names/subtypes without extra API calls.
import { prettyCode } from "./utils.js";

let loaded = false;

/** item code -> full ItemSchema */
export const itemByCode = new Map();

/** sorted list of distinct non-empty subtypes, e.g. ["bar", "food", ...] */
export let subtypes = [];

export async function loadItemCatalog() {
  if (loaded) return;
  const res = await fetch("../data/items.json");
  if (!res.ok) throw new Error(`Item catalog failed to load (HTTP ${res.status})`);
  const items = await res.json();
  const subs = new Set();
  for (const it of items) {
    if (!it || !it.code) continue;
    itemByCode.set(it.code, it);
    if (it.subtype) subs.add(it.subtype);
  }
  subtypes = [...subs].sort();
  loaded = true;
}

export function subtypeLabel(subtype) {
  return prettyCode(subtype);
}
