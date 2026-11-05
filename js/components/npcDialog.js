// NPC detail dialog content (pure HTML; tile clicks are wired in app.js).
import { npcByCode } from "../npcs.js";
import { itemByCode } from "../items.js";
import { esc, num, prettyCode } from "../utils.js";

/** Display name of a trade currency (an item code, or "gold"). */
export function currencyName(currency) {
  if (!currency) return "";
  if (currency === "gold") return "Gold";
  const info = itemByCode.get(currency);
  return (info && info.name) || prettyCode(currency);
}

/** Small icon for a trade currency. */
export function currencyIconHTML(currency) {
  if (!currency) return "";
  if (currency === "gold") return `<span class="cur-gold" title="Gold">🪙</span>`;
  return (
    `<img class="cur-icon" src="https://artifactsmmo.com/images/items/${encodeURIComponent(currency)}.png" ` +
    `alt="" loading="lazy" title="${esc(currencyName(currency))}" onerror="this.remove()">`
  );
}

/**
 * Trade tile: the item's icon with its price and currency.
 * Title reads e.g. "Cloth — 3 × Wool".
 */
function tradeTileHTML(code, price, currency) {
  const info = itemByCode.get(code);
  const name = (info && info.name) || prettyCode(code);
  const deal = price != null ? `${num(price)} × ${currencyName(currency)}` : "";
  const title = deal ? `${name} — ${deal}` : name;
  return (
    `<div class="item-tile" data-code="${esc(code)}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    (price != null ? `<div class="item-qty mono">${num(price)} ${currencyIconHTML(currency)}</div>` : "") +
    `</div>`
  );
}

/** Full detail HTML for the NPC dialog, from the cached catalog entry. */
export function npcDialogHTML(code) {
  const n = npcByCode.get(code);
  const name = (n && n.name) || prettyCode(code);
  const tags = [];
  if (n && n.type) tags.push(`<span class="tag">${esc(prettyCode(n.type))}</span>`);
  const items = n && Array.isArray(n.items) ? n.items : [];
  const sells = items.filter((t) => t.buy_price != null); // NPC sells to you
  const buys = items.filter((t) => t.sell_price != null); // NPC buys from you
  const sellsHtml = sells.length
    ? `<div class="dialog-sec"><h4>Sells</h4><div class="dialog-tiles">` +
      sells.map((t) => tradeTileHTML(t.code, t.buy_price, t.currency)).join("") +
      `</div></div>`
    : "";
  const buysHtml = buys.length
    ? `<div class="dialog-sec"><h4>Buys</h4><div class="dialog-tiles">` +
      buys.map((t) => tradeTileHTML(t.code, t.sell_price, t.currency)).join("") +
      `</div></div>`
    : "";
  const jsonHtml = n
    ? `<details class="dialog-sec json-sec"><summary>Raw JSON</summary>` +
      `<pre class="item-json">${esc(JSON.stringify(n, null, 2))}</pre></details>`
    : "";

  return (
    `<div class="dialog-item-head">` +
    `<img src="https://artifactsmmo.com/images/npcs/${encodeURIComponent(code)}.png" ` +
    `alt="" onerror="this.remove()">` +
    `<div><div class="dialog-item-name">${esc(name)}</div>` +
    `<div class="mono dialog-item-code">${esc(code)}</div></div>` +
    `</div>` +
    (tags.length ? `<div class="dialog-tags">${tags.join("")}</div>` : "") +
    (n?.description ? `<p class="dialog-desc">${esc(n.description)}</p>` : "") +
    sellsHtml +
    buysHtml +
    jsonHtml
  );
}
