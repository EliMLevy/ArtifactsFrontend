// Locally cached NPC catalog (data/npcs.json, committed to the repo).
let loaded = false;

/** npc code -> full NPC schema ({ name, code, description, type, items }) */
export const npcByCode = new Map();

/**
 * Reverse trade index: item code -> [{ npc, currency, buy_price, sell_price }].
 * buy_price: what the player pays the NPC (NPC sells the item).
 * sell_price: what the NPC pays the player (NPC buys the item).
 * Prices are in units of `currency` (an item code, or "gold").
 */
export const itemTrades = new Map();

/**
 * Reverse currency index: currency code -> [{ npc, item, currency, buy_price, sell_price }].
 * Lets a currency item (e.g. wool) show the NPCs that accept it — wool's
 * dialog lists the Tailor under "Bought by NPCs".
 */
export const currencyTrades = new Map();

export async function loadNpcCatalog() {
  if (loaded) return;
  const url = new URL("../data/npcs.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NPC catalog failed to load (HTTP ${res.status})`);
  const npcs = await res.json();
  for (const n of npcs) {
    if (!n || !n.code) continue;
    npcByCode.set(n.code, n);
    for (const t of n.items || []) {
      if (!t || !t.code) continue;
      if (!itemTrades.has(t.code)) itemTrades.set(t.code, []);
      itemTrades.get(t.code).push({ npc: n.code, currency: t.currency, buy_price: t.buy_price, sell_price: t.sell_price });
      if (t.currency && t.currency !== "gold") {
        if (!currencyTrades.has(t.currency)) currencyTrades.set(t.currency, []);
        currencyTrades.get(t.currency).push({ npc: n.code, item: t.code, currency: t.currency, buy_price: t.buy_price, sell_price: t.sell_price });
      }
    }
  }
  loaded = true;
}
