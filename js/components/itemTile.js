// Shared dense item tile: icon + quantity, name in the tooltip.
// Clickable via data-code (dialog wiring lives in app.js).
import { itemByCode } from "../items.js";
import { esc, num, prettyCode } from "../utils.js";

export function itemTileHTML(entry) {
  const info = itemByCode.get(entry.code);
  const name = (info && info.name) || prettyCode(entry.code);
  const subtype = info && info.subtype ? prettyCode(info.subtype) : null;
  const title = subtype ? `${name} — ${subtype}` : name;
  return (
    `<div class="item-tile" data-code="${esc(entry.code)}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(entry.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    `<div class="item-qty mono">×${num(entry.quantity)}</div>` +
    `</div>`
  );
}
