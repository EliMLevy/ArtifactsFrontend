// Shared dense monster tile: icon + level, name in the tooltip.
// Clickable via data-code (dialog wiring lives in app.js).
import { monsterByCode } from "../monsters.js";
import { esc, num, prettyCode } from "../utils.js";

export function monsterTileHTML(entry) {
  const info = monsterByCode.get(entry.code);
  const name = (info && info.name) || prettyCode(entry.code);
  const title = info && info.level != null ? `${name} — Lvl ${info.level}` : name;
  return (
    `<div class="item-tile monster-tile" data-code="${esc(entry.code)}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/monsters/${encodeURIComponent(entry.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    (info && info.level != null ? `<div class="item-qty mono">Lv ${num(info.level)}</div>` : "") +
    `</div>`
  );
}
