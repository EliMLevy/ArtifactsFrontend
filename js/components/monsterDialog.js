// Monster detail dialog content (pure HTML; tile clicks are wired in app.js).
import { monsterByCode } from "../monsters.js";
import { itemByCode } from "../items.js";
import { esc, num, prettyCode } from "../utils.js";

const ATTACKS = ["fire", "earth", "water", "air"];

function attackRows(m) {
  return ATTACKS.filter((el) => m[`attack_${el}`] > 0).map(
    (el) => `<div class="fx-row"><span class="fx-code">${esc(prettyCode(el))}</span><span class="mono">${num(m[`attack_${el}`])}</span></div>`
  );
}

function resistRows(m) {
  return ATTACKS.filter((el) => m[`res_${el}`] > 0).map(
    (el) => `<div class="fx-row"><span class="fx-code">${esc(prettyCode(el))}</span><span class="mono">${num(m[`res_${el}`])}%</span></div>`
  );
}

/** Drop tile: the dropped item's icon, with drop rate in the tooltip. */
function dropTileHTML(m, drop) {
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

/** Full detail HTML for the monster dialog, from the cached catalog entry. */
export function monsterDialogHTML(code) {
  const m = monsterByCode.get(code);
  const name = (m && m.name) || prettyCode(code);
  const tags = [];
  if (m) {
    if (m.level != null) tags.push(`<span class="tag">Lvl ${num(m.level)}</span>`);
    if (m.hp != null) tags.push(`<span class="tag">${num(m.hp)} HP</span>`);
    if (m.type) tags.push(`<span class="tag">${esc(prettyCode(m.type))}</span>`);
    if (m.initiative != null) tags.push(`<span class="tag">Init ${num(m.initiative)}</span>`);
    if (m.critical_strike > 0) tags.push(`<span class="tag">Crit ${num(m.critical_strike)}%</span>`);
  }
  const attacks = m ? attackRows(m).join("") : "";
  const resists = m ? resistRows(m).join("") : "";
  const drops = m && Array.isArray(m.drops) ? m.drops : [];
  const dropsHtml = drops.length
    ? `<div class="dialog-sec"><h4>Drops</h4><div class="dialog-tiles">` +
      drops.map((d) => dropTileHTML(m, d)).join("") +
      `</div></div>`
    : "";
  const gold =
    m && (m.min_gold != null || m.max_gold != null)
      ? `<div class="dialog-sec"><h4>Gold</h4><div class="mono">${num(m.min_gold || 0)} – ${num(m.max_gold || 0)}</div></div>`
      : "";
  const jsonHtml = m
    ? `<details class="dialog-sec json-sec"><summary>Raw JSON</summary>` +
      `<pre class="item-json">${esc(JSON.stringify(m, null, 2))}</pre></details>`
    : "";

  return (
    `<div class="dialog-item-head">` +
    `<img src="https://artifactsmmo.com/images/monsters/${encodeURIComponent(code)}.png" ` +
    `alt="" onerror="this.remove()">` +
    `<div><div class="dialog-item-name">${esc(name)}</div>` +
    `<div class="mono dialog-item-code">${esc(code)}</div></div>` +
    `</div>` +
    (tags.length ? `<div class="dialog-tags">${tags.join("")}</div>` : "") +
    (attacks ? `<div class="dialog-sec"><h4>Attack</h4>${attacks}</div>` : "") +
    (resists ? `<div class="dialog-sec"><h4>Resistances</h4>${resists}</div>` : "") +
    gold +
    dropsHtml +
    jsonHtml
  );
}
