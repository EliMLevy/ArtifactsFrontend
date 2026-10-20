// Bank item tile renderer (pure: HTML string from a SimpleItemSchema entry).
// Dense layout: icon + quantity only; the name lives in the tooltip.
import { itemByCode } from "../items.js";
import { esc, num, prettyCode } from "../utils.js";

export function bankTileHTML(entry) {
  const info = itemByCode.get(entry.code);
  const name = (info && info.name) || prettyCode(entry.code);
  const subtype = info && info.subtype ? prettyCode(info.subtype) : null;
  const title = subtype ? `${name} — ${subtype}` : name;
  return (
    `<div class="bank-item" data-code="${esc(entry.code)}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(entry.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    `<div class="bank-qty mono">×${num(entry.quantity)}</div>` +
    `</div>`
  );
}

/** Full detail HTML for the item dialog, from the cached catalog entry. */
export function itemDialogHTML(code) {
  const info = itemByCode.get(code);
  const name = (info && info.name) || prettyCode(code);
  const tags = [];
  if (info) {
    if (info.type) tags.push(`<span class="tag">${esc(prettyCode(info.type))}</span>`);
    if (info.subtype) tags.push(`<span class="tag">${esc(prettyCode(info.subtype))}</span>`);
    if (info.level != null) tags.push(`<span class="tag">Lvl ${num(info.level)}</span>`);
    if (info.tradeable === false) tags.push(`<span class="tag">Untradeable</span>`);
  }
  const effects = Array.isArray(info?.effects)
    ? info.effects
        .map(
          (e) =>
            `<div class="fx-row"><span class="fx-code">${esc(prettyCode(e.code))}</span>` +
            `<span class="mono">+${esc(String(e.value))}</span></div>` +
            (e.description ? `<div class="fx-desc">${esc(e.description)}</div>` : "")
        )
        .join("")
    : "";
  return (
    `<div class="dialog-item-head">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(code)}.png" ` +
    `alt="" onerror="this.remove()">` +
    `<div><div class="dialog-item-name">${esc(name)}</div>` +
    `<div class="mono dialog-item-code">${esc(code)}</div></div>` +
    `</div>` +
    (tags.length ? `<div class="dialog-tags">${tags.join("")}</div>` : "") +
    (info?.description ? `<p class="dialog-desc">${esc(info.description)}</p>` : "") +
    (effects ? `<div class="dialog-sec"><h4>Effects</h4>${effects}</div>` : "")
  );
}
