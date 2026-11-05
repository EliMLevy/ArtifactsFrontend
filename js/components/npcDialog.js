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

/**
 * Horizontal trade row: traded item icon : price currency icon.
 * Both item icons are clickable (they open the item dialog); gold has no icon.
 * Title reads e.g. "Cloth — 3 × Wool".
 */
function tradeRowHTML(trade) {
  const info = itemByCode.get(trade.code);
  const name = (info && info.name) || prettyCode(trade.code);
  const deal = `${num(trade.price)} × ${currencyName(trade.currency)}`;
  const title = `${name} — ${deal}`;
  const itemTile =
    `<div class="item-tile" data-code="${esc(trade.code)}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(trade.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    `</div>`;
  const curTile =
    trade.currency === "gold"
      ? `<span class="trade-gold" title="Gold">🪙</span>`
      : `<div class="item-tile" data-code="${esc(trade.currency)}" title="${esc(currencyName(trade.currency))} — view details" ` +
        `role="button" tabindex="0" aria-label="${esc(currencyName(trade.currency))} — view details">` +
        `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(trade.currency)}.png" ` +
        `alt="" loading="lazy" onerror="this.remove()">` +
        `</div>`;
  return (
    `<div class="trade-row" title="${esc(title)}">` +
    itemTile +
    `<span class="trade-colon">:</span>` +
    `<span class="mono trade-price">${num(trade.price)}</span>` +
    curTile +
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
    ? `<div class="dialog-sec"><h4>Sells</h4><div class="dialog-trades">` +
      sells.map((t) => tradeRowHTML({ code: t.code, price: t.buy_price, currency: t.currency })).join("") +
      `</div></div>`
    : "";
  const buysHtml = buys.length
    ? `<div class="dialog-sec"><h4>Buys</h4><div class="dialog-trades">` +
      buys.map((t) => tradeRowHTML({ code: t.code, price: t.sell_price, currency: t.currency })).join("") +
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
