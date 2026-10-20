// Locally cached item catalog (data/items.json, committed to the repo).
// Lets the dashboard resolve names/subtypes without extra API calls.
import { prettyCode } from "./utils.js";

let loaded = false;

/** item code -> full ItemSchema */
export const itemByCode = new Map();

/** sorted list of distinct non-empty subtypes, e.g. ["bar", "food", ...] */
export let subtypes = [];

/**
 * Reverse craft index: ingredient code -> [{ code, quantity }] of the items
 * that list it as a crafting ingredient.
 */
export const usedIn = new Map();

export async function loadItemCatalog() {
  if (loaded) return;
  const url = new URL("../data/items.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Item catalog failed to load (HTTP ${res.status})`);
  const items = await res.json();
  const subs = new Set();
  for (const it of items) {
    if (!it || !it.code) continue;
    itemByCode.set(it.code, it);
    if (it.subtype) subs.add(it.subtype);
    const ingredients = it.craft && it.craft.items;
    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (!ing || !ing.code) continue;
        if (!usedIn.has(ing.code)) usedIn.set(ing.code, []);
        usedIn.get(ing.code).push({ code: it.code, quantity: ing.quantity });
      }
    }
  }
  subtypes = [...subs].sort();
  loaded = true;
}

export function subtypeLabel(subtype) {
  return prettyCode(subtype);
}
