// Encyclopedia: every item, monster, resource and NPC, sorted by level then name.
// Kind/type/subtype filters; type and subtype options are populated from
// the entries currently displayed (before type/subtype selection).
import { loadItemCatalog, itemByCode } from "./items.js";
import { loadMonsterCatalog, monsterByCode } from "./monsters.js";
import { loadResourceCatalog, resourceByCode } from "./resources.js";
import { loadNpcCatalog, npcByCode } from "./npcs.js";
import { itemDialogHTML } from "./components/bankSection.js";
import { monsterDialogHTML } from "./components/monsterDialog.js";
import { resourceDialogHTML } from "./components/resourceDialog.js";
import { npcDialogHTML } from "./components/npcDialog.js";
import { esc, num, prettyCode } from "./utils.js";

const els = {
  encyCount: document.getElementById("encyCount"),
  encyKindTags: document.getElementById("encyKindTags"),
  encyTypeTags: document.getElementById("encyTypeTags"),
  encySubtypeTags: document.getElementById("encySubtypeTags"),
  encyGrid: document.getElementById("encyGrid"),
  itemDialog: document.getElementById("itemDialog"),
  itemDialogName: document.getElementById("itemDialogName"),
  itemDialogBody: document.getElementById("itemDialogBody"),
  itemDialogClose: document.getElementById("itemDialogClose"),
  monsterDialog: document.getElementById("monsterDialog"),
  monsterDialogName: document.getElementById("monsterDialogName"),
  monsterDialogBody: document.getElementById("monsterDialogBody"),
  monsterDialogClose: document.getElementById("monsterDialogClose"),
  resourceDialog: document.getElementById("resourceDialog"),
  resourceDialogName: document.getElementById("resourceDialogName"),
  resourceDialogBody: document.getElementById("resourceDialogBody"),
  resourceDialogClose: document.getElementById("resourceDialogClose"),
  npcDialog: document.getElementById("npcDialog"),
  npcDialogName: document.getElementById("npcDialogName"),
  npcDialogBody: document.getElementById("npcDialogBody"),
  npcDialogClose: document.getElementById("npcDialogClose"),
};

const filter = { kind: "all", type: "", subtype: "" };

/** Flat entry list: { kind, code, name, level, type, subtype }. */
function buildEntries() {
  const out = [];
  for (const it of itemByCode.values()) {
    out.push({
      kind: "item",
      code: it.code,
      name: it.name || prettyCode(it.code),
      level: typeof it.level === "number" ? it.level : Infinity,
      type: it.type || "",
      subtype: it.subtype || "",
    });
  }
  for (const m of monsterByCode.values()) {
    out.push({
      kind: "monster",
      code: m.code,
      name: m.name || prettyCode(m.code),
      level: typeof m.level === "number" ? m.level : Infinity,
      type: m.type || "",
      subtype: "",
    });
  }
  for (const r of resourceByCode.values()) {
    out.push({
      kind: "resource",
      code: r.code,
      name: r.name || prettyCode(r.code),
      level: typeof r.level === "number" ? r.level : Infinity,
      type: r.skill || "",
      subtype: "",
    });
  }
  for (const n of npcByCode.values()) {
    out.push({
      kind: "npc",
      code: n.code,
      name: n.name || prettyCode(n.code),
      level: Infinity,
      type: n.type || "",
      subtype: "",
    });
  }
  return out;
}

let entries = [];

/** Entries after the kind filter, before type/subtype selection. */
function kindPool() {
  return filter.kind === "all" ? entries : entries.filter((e) => e.kind === filter.kind);
}

function countsOf(list, key) {
  const m = new Map();
  for (const e of list) {
    const v = e[key];
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderTags(el, options, active) {
  el.innerHTML = options
    .map(
      ([v, n]) =>
        `<button type="button" class="typetag" data-value="${esc(v)}" aria-pressed="${active === v}">` +
        `${esc(prettyCode(v))} <span class="mono">${n}</span></button>`
    )
    .join("");
}

function renderKindTags() {
  const kinds = [
    ["all", "All", entries.length],
    ["item", "Items", entries.filter((e) => e.kind === "item").length],
    ["monster", "Monsters", entries.filter((e) => e.kind === "monster").length],
    ["resource", "Resources", entries.filter((e) => e.kind === "resource").length],
    ["npc", "NPCs", entries.filter((e) => e.kind === "npc").length],
  ];
  els.encyKindTags.innerHTML = kinds
    .map(
      ([v, label, n]) =>
        `<button type="button" class="typetag" data-kind="${v}" aria-pressed="${filter.kind === v}">` +
        `${esc(label)} <span class="mono">${n}</span></button>`
    )
    .join("");
}

/** Horizontal encyclopedia card: 30px icon left, name + level right.
 * The whole card is the clickable outline (border encompasses icon + text). */
function cardHTML(e) {
  const imgPath = { item: "items", monster: "monsters", resource: "resources", npc: "npcs" }[e.kind] || "items";
  const lvl = e.level === Infinity ? "" : `Lv ${num(e.level)}`;
  const title = lvl ? `${e.name} — ${lvl}` : e.name;
  return (
    `<div class="ency-card" data-code="${esc(e.code)}" data-kind="${e.kind}" title="${esc(title)}" ` +
    `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
    `<img src="https://artifactsmmo.com/images/${imgPath}/${encodeURIComponent(e.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()">` +
    `<div class="ency-card-text"><div class="ency-card-name">${esc(e.name)}</div>` +
    (lvl ? `<div class="mono ency-card-lvl">${esc(lvl)}</div>` : "") +
    `</div></div>`
  );
}

function render() {
  const pool = kindPool();
  // Drop selections that no longer exist in the displayed pool.
  if (filter.type && !pool.some((e) => e.type === filter.type)) filter.type = "";
  // Subtype options follow the selected type: only subtypes that exist on
  // the type-filtered entries are shown.
  const subtypePool = filter.type ? pool.filter((e) => e.type === filter.type) : pool;
  if (filter.subtype && !subtypePool.some((e) => e.subtype === filter.subtype)) filter.subtype = "";

  renderKindTags();
  renderTags(els.encyTypeTags, countsOf(pool, "type"), filter.type);
  renderTags(els.encySubtypeTags, countsOf(subtypePool, "subtype"), filter.subtype);

  const shown = pool
    .filter((e) => (!filter.type || e.type === filter.type) && (!filter.subtype || e.subtype === filter.subtype))
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  els.encyCount.textContent = shown.length ? `· ${num(shown.length)} shown` : "";
  els.encyGrid.innerHTML = shown.length
    ? shown.map(cardHTML).join("")
    : `<div class="log-empty">Nothing matches these filters.</div>`;
}

els.encyKindTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag) return;
  filter.kind = tag.dataset.kind;
  render();
});

els.encyTypeTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag) return;
  filter.type = filter.type === tag.dataset.value ? "" : tag.dataset.value;
  render();
});

els.encySubtypeTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag) return;
  filter.subtype = filter.subtype === tag.dataset.value ? "" : tag.dataset.value;
  render();
});

/* ---------- dialogs (same drill-down as the dashboard) ---------- */
// Detail dialogs never stack: opening one closes the others.
function closeDetailDialogs(except) {
  for (const d of [els.itemDialog, els.monsterDialog, els.resourceDialog, els.npcDialog]) {
    if (d !== except && d.open) d.close();
  }
}

function openItemDialog(code) {
  closeDetailDialogs(els.itemDialog);
  const info = itemByCode.get(code);
  els.itemDialogName.textContent = (info && info.name) || prettyCode(code);
  els.itemDialogBody.innerHTML = itemDialogHTML(code);
  if (typeof els.itemDialog.showModal === "function") els.itemDialog.showModal();
}

function openMonsterDialog(code) {
  closeDetailDialogs(els.monsterDialog);
  const info = monsterByCode.get(code);
  els.monsterDialogName.textContent = (info && info.name) || prettyCode(code);
  els.monsterDialogBody.innerHTML = monsterDialogHTML(code);
  if (typeof els.monsterDialog.showModal === "function") els.monsterDialog.showModal();
}

function openResourceDialog(code) {
  closeDetailDialogs(els.resourceDialog);
  const info = resourceByCode.get(code);
  els.resourceDialogName.textContent = (info && info.name) || prettyCode(code);
  els.resourceDialogBody.innerHTML = resourceDialogHTML(code);
  if (typeof els.resourceDialog.showModal === "function") els.resourceDialog.showModal();
}

function openNpcDialog(code) {
  closeDetailDialogs(els.npcDialog);
  const info = npcByCode.get(code);
  els.npcDialogName.textContent = (info && info.name) || prettyCode(code);
  els.npcDialogBody.innerHTML = npcDialogHTML(code);
  if (typeof els.npcDialog.showModal === "function") els.npcDialog.showModal();
}

/** Open the dialog matching an encyclopedia card's kind. */
function openEntryDialog(kind, code) {
  if (kind === "monster") return openMonsterDialog(code);
  if (kind === "resource") return openResourceDialog(code);
  if (kind === "npc") return openNpcDialog(code);
  return openItemDialog(code);
}

els.encyGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".ency-card");
  if (!card || !card.dataset.code) return;
  openEntryDialog(card.dataset.kind, card.dataset.code);
});
els.encyGrid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".ency-card");
  if (card && card.dataset.code) {
    e.preventDefault();
    openEntryDialog(card.dataset.kind, card.dataset.code);
  }
});
// Drill-down inside the dialogs.
els.itemDialogBody.addEventListener("click", (e) => {
  const mt = e.target.closest(".monster-tile");
  if (mt && mt.dataset.code) return openMonsterDialog(mt.dataset.code);
  const rt = e.target.closest(".resource-tile");
  if (rt && rt.dataset.code) return openResourceDialog(rt.dataset.code);
  const nt = e.target.closest(".npc-tile");
  if (nt && nt.dataset.code) return openNpcDialog(nt.dataset.code);
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.monsterDialogBody.addEventListener("click", (e) => {
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.resourceDialogBody.addEventListener("click", (e) => {
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.npcDialogBody.addEventListener("click", (e) => {
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.itemDialogClose.addEventListener("click", () => els.itemDialog.close());
els.itemDialog.addEventListener("click", (e) => {
  if (e.target === els.itemDialog) els.itemDialog.close();
});
els.monsterDialogClose.addEventListener("click", () => els.monsterDialog.close());
els.monsterDialog.addEventListener("click", (e) => {
  if (e.target === els.monsterDialog) els.monsterDialog.close();
});
els.resourceDialogClose.addEventListener("click", () => els.resourceDialog.close());
els.resourceDialog.addEventListener("click", (e) => {
  if (e.target === els.resourceDialog) els.resourceDialog.close();
});
els.npcDialogClose.addEventListener("click", () => els.npcDialog.close());
els.npcDialog.addEventListener("click", (e) => {
  if (e.target === els.npcDialog) els.npcDialog.close();
});

/* ---------- boot ---------- */
Promise.all([loadItemCatalog(), loadMonsterCatalog(), loadResourceCatalog(), loadNpcCatalog()])
  .then(() => {
    entries = buildEntries();
    render();
  })
  .catch(() => {
    els.encyGrid.innerHTML = `<div class="log-empty">Could not load the encyclopedia catalogs.</div>`;
  });
