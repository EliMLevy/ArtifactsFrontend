// Bank item tile renderer (pure: HTML string from a SimpleItemSchema entry).
import { itemByCode } from "../items.js";
import { esc, num, prettyCode } from "../utils.js";

export function bankTileHTML(entry) {
  const info = itemByCode.get(entry.code);
  const name = (info && info.name) || prettyCode(entry.code);
  const subtype = info && info.subtype ? prettyCode(info.subtype) : null;
  const title = subtype ? `${name} — ${subtype}` : name;
  return (
    `<div class="bank-item" title="${esc(title)}">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(entry.code)}.png" ` +
    `alt="${esc(name)}" loading="lazy" onerror="this.remove()">` +
    `<div class="bank-name">${esc(name)}</div>` +
    `<div class="bank-qty mono">×${num(entry.quantity)}</div>` +
    (subtype ? `<div class="bank-sub">${esc(subtype)}</div>` : "") +
    `</div>`
  );
}
