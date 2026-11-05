// Shared dense NPC tile: icon, name in the tooltip.
// Clickable via data-code (dialog wiring lives in app.js).
import { npcByCode } from "../npcs.js";
import { esc, prettyCode } from "../utils.js";

export function npcTileHTML(entry) {
  const info = npcByCode.get(entry.code);
  const name = (info && info.name) || prettyCode(entry.code);
  const title = info && info.type ? `${name} — ${prettyCode(info.type)}` : name;
  return (
    `<div class="item-tile npc-tile" data-code="${esc(entry.code)}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/npcs/${encodeURIComponent(entry.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    `</div>`
  );
}
