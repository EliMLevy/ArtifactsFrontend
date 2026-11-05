// Resource detail dialog content (pure HTML; tile clicks are wired in app.js).
import { resourceByCode } from "../resources.js";
import { itemByCode } from "../items.js";
import { esc, num, prettyCode } from "../utils.js";

/** Drop tile: the dropped item's icon, with drop rate in the tooltip. */
function dropTileHTML(drop) {
  const info = itemByCode.get(drop.code);
  const name = (info && info.name) || prettyCode(drop.code);
  const qty =
    drop.min_quantity != null && drop.max_quantity != null && drop.min_quantity !== drop.max_quantity
      ? ` ×${num(drop.min_quantity)}–${num(drop.max_quantity)}`
      : drop.min_quantity > 1
        ? ` ×${num(drop.min_quantity)}`
        : "";
  const rate = drop.rate != null ? `1/${num(drop.rate)}` : "";
  const title = `${name}${qty}${rate ? ` — drops ${rate}` : ""}`;
  return (
    `<div class="item-tile" data-code="${esc(drop.code)}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(drop.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    (rate ? `<div class="item-qty mono">${esc(rate)}</div>` : "") +
    `</div>`
  );
}

/** Full detail HTML for the resource dialog, from the cached catalog entry. */
export function resourceDialogHTML(code) {
  const r = resourceByCode.get(code);
  const name = (r && r.name) || prettyCode(code);
  const tags = [];
  if (r && r.skill) tags.push(`<span class="tag">${esc(prettyCode(r.skill))}</span>`);
  if (r && r.level != null) tags.push(`<span class="tag">Lvl ${num(r.level)}</span>`);
  const drops = r && Array.isArray(r.drops) ? r.drops : [];
  const dropsHtml = drops.length
    ? `<div class="dialog-sec"><h4>Drops</h4><div class="dialog-tiles">` +
      drops.map(dropTileHTML).join("") +
      `</div></div>`
    : "";
  const jsonHtml = r
    ? `<details class="dialog-sec json-sec"><summary>Raw JSON</summary>` +
      `<pre class="item-json">${esc(JSON.stringify(r, null, 2))}</pre></details>`
    : "";

  return (
    `<div class="dialog-item-head">` +
    `<img src="https://artifactsmmo.com/images/resources/${encodeURIComponent(code)}.png" ` +
    `alt="" onerror="this.remove()">` +
    `<div><div class="dialog-item-name">${esc(name)}</div>` +
    `<div class="mono dialog-item-code">${esc(code)}</div></div>` +
    `</div>` +
    (tags.length ? `<div class="dialog-tags">${tags.join("")}</div>` : "") +
    dropsHtml +
    jsonHtml
  );
}
