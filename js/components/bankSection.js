// Item detail dialog content (pure HTML; tile clicks are wired in app.js).
import { itemByCode, usedIn } from "../items.js";
import { itemTileHTML } from "./itemTile.js";
import { esc, num, prettyCode } from "../utils.js";

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

  // Craft recipe (ingredients render as clickable dense tiles, like the bank).
  const craft = info && info.craft;
  const ingredients = craft && Array.isArray(craft.items) ? craft.items : [];
  const recipeHtml = ingredients.length
    ? `<div class="dialog-sec"><h4>Craft recipe` +
      (craft.skill
        ? ` — ${esc(prettyCode(craft.skill))}${craft.level != null ? ` Lvl ${num(craft.level)}` : ""}`
        : "") +
      (craft.quantity ? ` ×${num(craft.quantity)}` : "") +
      `</h4><div class="dialog-tiles">` +
      ingredients.map((ing) => itemTileHTML({ code: ing.code, quantity: ing.quantity })).join("") +
      `</div></div>`
    : "";

  // Reverse lookup: recipes this item is an ingredient in.
  const used = usedIn.get(code) || [];
  const usedHtml = used.length
    ? `<div class="dialog-sec"><h4>Used in</h4><div class="dialog-tiles">` +
      used.map((u) => itemTileHTML(u)).join("") +
      `</div></div>`
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
    (effects ? `<div class="dialog-sec"><h4>Effects</h4>${effects}</div>` : "") +
    recipeHtml +
    usedHtml
  );
}
