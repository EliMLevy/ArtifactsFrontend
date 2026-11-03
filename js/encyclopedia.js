// Encyclopedia: every item and monster, sorted by level then name.
// Kind/type/subtype filters; type and subtype options are populated from
// the entries currently displayed (before type/subtype selection).
import { loadItemCatalog, itemByCode } from "./items.js";
import { loadMonsterCatalog, monsterByCode } from "./monsters.js";
import { itemDialogHTML } from "./components/bankSection.js";
import { monsterDialogHTML } from "./components/monsterDialog.js";
import { itemTileHTML } from "./components/itemTile.js";
import { monsterTileHTML } from "./components/monsterTile.js";
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
  ];
  els.encyKindTags.innerHTML = kinds
    .map(
      ([v, label, n]) =>
        `<button type="button" class="typetag" data-kind="${v}" aria-pressed="${filter.kind === v}">` +
        `${esc(label)} <span class="mono">${n}</span></button>`
    )
    .join("");
}

function tileHTML(e) {
  return e.kind === "monster" ? monsterTileHTML({ code: e.code }) : itemTileHTML({ code: e.code, quantity: 1 });
}

function render() {
  const pool = kindPool();
  // Drop selections that no longer exist in the displayed pool.
  if (filter.type && !pool.some((e) => e.type === filter.type)) filter.type = "";
  if (filter.subtype && !pool.some((e) => e.subtype === filter.subtype)) filter.subtype = "";

  renderKindTags();
  renderTags(els.encyTypeTags, countsOf(pool, "type"), filter.type);
  renderTags(els.encySubtypeTags, countsOf(pool, "subtype"), filter.subtype);

  const shown = pool
    .filter((e) => (!filter.type || e.type === filter.type) && (!filter.subtype || e.subtype === filter.subtype))
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  els.encyCount.textContent = shown.length ? `· ${num(shown.length)} shown` : "";
  els.encyGrid.innerHTML = shown.length
    ? shown.map(tileHTML).join("")
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
function openItemDialog(code) {
  const info = itemByCode.get(code);
  els.itemDialogName.textContent = (info && info.name) || prettyCode(code);
  els.itemDialogBody.innerHTML = itemDialogHTML(code);
  if (typeof els.itemDialog.showModal === "function") els.itemDialog.showModal();
}

function openMonsterDialog(code) {
  const info = monsterByCode.get(code);
  els.monsterDialogName.textContent = (info && info.name) || prettyCode(code);
  els.monsterDialogBody.innerHTML = monsterDialogHTML(code);
  if (typeof els.monsterDialog.showModal === "function") els.monsterDialog.showModal();
}

els.encyGrid.addEventListener("click", (e) => {
  const mt = e.target.closest(".monster-tile");
  if (mt && mt.dataset.code) return openMonsterDialog(mt.dataset.code);
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.encyGrid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const mt = e.target.closest(".monster-tile");
  const tile = mt || e.target.closest(".item-tile");
  if (tile && tile.dataset.code) {
    e.preventDefault();
    if (mt) openMonsterDialog(tile.dataset.code);
    else openItemDialog(tile.dataset.code);
  }
});
// Drill-down inside the dialogs.
els.itemDialogBody.addEventListener("click", (e) => {
  const mt = e.target.closest(".monster-tile");
  if (mt && mt.dataset.code) return openMonsterDialog(mt.dataset.code);
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.monsterDialogBody.addEventListener("click", (e) => {
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

/* ---------- boot ---------- */
Promise.all([loadItemCatalog(), loadMonsterCatalog()])
  .then(() => {
    entries = buildEntries();
    render();
  })
  .catch(() => {
    els.encyGrid.innerHTML = `<div class="log-empty">Could not load the encyclopedia catalogs.</div>`;
  });
