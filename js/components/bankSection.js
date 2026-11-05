// Item detail dialog content (pure HTML; tile clicks are wired in app.js).
import { itemByCode, usedIn } from "../items.js";
import { droppedBy } from "../monsters.js";
import { droppedByResource } from "../resources.js";
import { itemTrades, npcByCode } from "../npcs.js";
import { itemTileHTML } from "./itemTile.js";
import { monsterTileHTML } from "./monsterTile.js";
import { resourceTileHTML } from "./resourceTile.js";
import { npcTileHTML } from "./npcTile.js";
import { currencyName } from "./npcDialog.js";
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

  // Reverse lookup: monsters that drop this item (click a monster for details).
  const droppers = droppedBy.get(code) || [];
  const droppedHtml = droppers.length
    ? `<div class="dialog-sec"><h4>Dropped by</h4><div class="dialog-tiles">` +
      droppers.map((d) => monsterTileHTML({ code: d.code })).join("") +
      `</div></div>`
    : "";

  // Reverse lookup: resources that drop this item (click a resource for details).
  const gatherers = droppedByResource.get(code) || [];
  const gatheredHtml = gatherers.length
    ? `<div class="dialog-sec"><h4>Gathered from</h4><div class="dialog-tiles">` +
      gatherers.map((d) => resourceTileHTML({ code: d.code })).join("") +
      `</div></div>`
    : "";

  // Reverse lookup: NPCs that trade this item (click an NPC for details).
  // Tile tooltips show the deal, e.g. "Tailor — sells for 3 × Wool".
  const trades = itemTrades.get(code) || [];
  const npcDealTitle = (npcCode, verb, t) => {
    const n = npcByCode.get(npcCode);
    const npcName = (n && n.name) || prettyCode(npcCode);
    return `${npcName} — ${verb} for ${num(t.buy_price ?? t.sell_price)} × ${currencyName(t.currency)}`;
  };
  const sellsToYou = trades.filter((t) => t.buy_price != null); // NPC sells the item
  const buysFromYou = trades.filter((t) => t.sell_price != null); // NPC buys the item
  const sellsHtml = sellsToYou.length
    ? `<div class="dialog-sec"><h4>Sold by NPCs</h4><div class="dialog-tiles">` +
      sellsToYou.map((t) => npcTileHTML({ code: t.npc, title: npcDealTitle(t.npc, "sells", t) })).join("") +
      `</div></div>`
    : "";
  const buysHtml = buysFromYou.length
    ? `<div class="dialog-sec"><h4>Bought by NPCs</h4><div class="dialog-tiles">` +
      buysFromYou.map((t) => npcTileHTML({ code: t.npc, title: npcDealTitle(t.npc, "buys", t) })).join("") +
      `</div></div>`
    : "";

  // The full catalog object, collapsed until the user asks for it.
  const jsonHtml = info
    ? `<details class="dialog-sec json-sec"><summary>Raw JSON</summary>` +
      `<pre class="item-json">${esc(JSON.stringify(info, null, 2))}</pre></details>`
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
    usedHtml +
    droppedHtml +
    gatheredHtml +
    sellsHtml +
    buysHtml +
    jsonHtml
  );
}
