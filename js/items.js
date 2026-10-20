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
  // NOTE: fetch() resolves relative URLs against the *document*, not this
  // module — so anchor to the module's own URL to find data/items.json
  // regardless of where the page is served from.
  const url = new URL("../data/items.json", import.meta.url);
  const res = await fetch(url);
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
