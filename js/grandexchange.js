// Grand Exchange: public buy/sell order book, filtered by item code.
// Partial codes ("copper" matches copper_bar and copper_ore) are expanded
// against the local item catalog, then filtered client-side from a cached
// copy of the whole order book. The API is only hit on page load and when
// the Refresh button is pressed — never while searching or toggling sides.
import { API_BASE } from "./config.js";
import { loadItemCatalog, itemByCode, usedIn } from "./items.js";
import { itemDialogHTML } from "./components/bankSection.js";
import { esc, num, prettyCode } from "./utils.js";

const els = {
  geCount: document.getElementById("geCount"),
  geSearch: document.getElementById("geSearch"),
  geSearchClear: document.getElementById("geSearchClear"),
  geKindTags: document.getElementById("geKindTags"),
  geRefresh: document.getElementById("geRefresh"),
  geNote: document.getElementById("geNote"),
  geList: document.getElementById("geList"),
  itemDialog: document.getElementById("itemDialog"),
  itemDialogName: document.getElementById("itemDialogName"),
  itemDialogBody: document.getElementById("itemDialogBody"),
  itemDialogClose: document.getElementById("itemDialogClose"),
};

const filter = { q: "", type: "sell" };
const PAGE_SIZE = 100;

/** Cached order book: { sell: [...], buy: [...] }, fetched once per load/refresh. */
const orderBook = { sell: null, buy: null, fetchedAt: null };
let loading = false;

function renderKindTags() {
  const kinds = [
    ["sell", "Sell orders"],
    ["buy", "Buy orders"],
  ];
  els.geKindTags.innerHTML = kinds
    .map(
      ([v, label]) =>
        `<button type="button" class="typetag" data-type="${v}" aria-pressed="${filter.type === v}">` +
        `${esc(label)}</button>`
    )
    .join("");
}

/** Item codes whose code or name contains the query (case-insensitive). */
function matchingCodes(q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out = [];
  for (const [code, it] of itemByCode) {
    if (code.toLowerCase().includes(needle) || (it.name && it.name.toLowerCase().includes(needle))) {
      out.push(code);
    }
  }
  return out.sort();
}

/**
 * Craftable items whose recipe includes an ingredient matching the query:
 * { craftableCode: [{ ingCode, qty }] }. "yellow" matches sticky_sword
 * because its recipe needs yellow_slimeball.
 */
function ingredientMatches(q) {
  const needle = q.trim().toLowerCase();
  const out = new Map();
  if (!needle) return out;
  for (const [code, it] of itemByCode) {
    if (!(code.toLowerCase().includes(needle) || (it.name && it.name.toLowerCase().includes(needle)))) continue;
    for (const recipe of usedIn.get(code) || []) {
      if (!out.has(recipe.code)) out.set(recipe.code, []);
      out.get(recipe.code).push({ ingCode: code, qty: recipe.quantity });
    }
  }
  return out;
}

/** Fetch every page of orders for one side. */
async function fetchAllOrders(type) {
  const all = [];
  let page = 1;
  let pages = 1;
  do {
    const url = `${API_BASE}/grandexchange/orders?type=${encodeURIComponent(type)}&size=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`GE orders failed (HTTP ${res.status})`);
    const body = await res.json();
    if (Array.isArray(body.data)) all.push(...body.data);
    pages = body.pages || 1;
    page += 1;
  } while (page <= pages);
  return all;
}

/** Refresh the cached order book (both sides) from the API. */
async function refreshOrderBook() {
  if (loading) return;
  loading = true;
  els.geNote.textContent = "Loading orders…";
  els.geList.innerHTML = "";
  try {
    // Sequential, one request per side — this is the only place the API is hit.
    orderBook.sell = await fetchAllOrders("sell");
    orderBook.buy = await fetchAllOrders("buy");
    orderBook.fetchedAt = Date.now();
  } catch {
    els.geNote.textContent = "";
    els.geList.innerHTML = `<div class="log-empty">Could not load Grand Exchange orders (rate limited?). Try Refresh in a moment.</div>`;
  } finally {
    loading = false;
  }
  render();
}

/** "3h 12m" / "2d" style age from an ISO timestamp. */
function ageLabel(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (isNaN(s) || s < 0) return "";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function orderRowHTML(o, viaIngredients) {
  const info = itemByCode.get(o.code);
  const name = (info && info.name) || prettyCode(o.code);
  const total = typeof o.quantity === "number" && typeof o.price === "number" ? o.quantity * o.price : null;
  // Subtitle for ingredient matches: how many of the searched ingredient
  // each craft needs, e.g. "3 × Yellow Slimeball".
  const sub =
    viaIngredients && viaIngredients.length
      ? `<div class="ge-sub">${viaIngredients
          .map(
            ({ ingCode, qty }) =>
              `${num(qty)} × ${esc((itemByCode.get(ingCode) && itemByCode.get(ingCode).name) || prettyCode(ingCode))}`
          )
          .join(" · ")}</div>`
      : "";
  return (
    `<div class="ge-row">` +
    `<button type="button" class="ge-item item-tile" data-code="${esc(o.code)}" title="${esc(name)} — view details">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(o.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()"></button>` +
    `<div class="ge-name">${esc(name)}${sub}</div>` +
    `<div class="ge-qty mono">×${num(o.quantity)}</div>` +
    `<div class="ge-price mono">${num(o.price)} <span class="ge-per">each</span></div>` +
    (total != null ? `<div class="ge-total mono">${num(total)} <span class="ge-per">total</span></div>` : "") +
    `<div class="ge-seller">${esc(o.account || "")}</div>` +
    `<div class="ge-age mono">${esc(ageLabel(o.created_at))}</div>` +
    `</div>`
  );
}

/** Render from the cached order book — no API calls here. */
function render() {
  const book = orderBook[filter.type];
  const q = filter.q.trim();
  if (!book) {
    els.geCount.textContent = "";
    els.geNote.textContent = "";
    els.geList.innerHTML = "";
    return;
  }
  let orders = book;
  let viaMap = null;
  if (q) {
    const codes = new Set(matchingCodes(q));
    // Craftable items reached via a matching ingredient (not direct matches).
    viaMap = ingredientMatches(q);
    for (const c of codes) viaMap.delete(c);
    const wanted = new Set([...codes, ...viaMap.keys()]);
    orders = book.filter((o) => wanted.has(o.code));
  }
  // Sell orders: cheapest first. Buy orders: highest bid first.
  orders = orders.slice().sort((a, b) =>
    filter.type === "sell" ? a.price - b.price || a.quantity - b.quantity : b.price - a.price || a.quantity - b.quantity
  );
  els.geCount.textContent = orders.length ? `· ${num(orders.length)} orders` : "";
  els.geNote.textContent = q
    ? ""
    : orderBook.fetchedAt
      ? `All orders, cheapest first · updated ${updatedLabel()}`
      : "";
  els.geList.innerHTML = orders.length
    ? orders.map((o) => orderRowHTML(o, viaMap ? viaMap.get(o.code) : null)).join("")
    : `<div class="log-empty">${q ? `No items match "${esc(q)}".` : `No ${filter.type} orders right now.`}</div>`;
}

/** "2m ago" style label for the last refresh. */
function updatedLabel() {
  const s = (Date.now() - orderBook.fetchedAt) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/* ---------- controls (all client-side; the API is only hit on load/refresh) ---------- */
els.geSearch.addEventListener("input", () => {
  filter.q = els.geSearch.value;
  els.geSearchClear.classList.toggle("hidden", !filter.q);
  render();
});
els.geSearchClear.addEventListener("click", () => {
  els.geSearch.value = "";
  filter.q = "";
  els.geSearchClear.classList.add("hidden");
  render();
  els.geSearch.focus();
});
els.geKindTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag) return;
  filter.type = tag.dataset.type;
  renderKindTags();
  render(); // the other side is already cached — no API call
});
els.geRefresh.addEventListener("click", refreshOrderBook);

/* ---------- item dialog ---------- */
function openItemDialog(code) {
  const info = itemByCode.get(code);
  els.itemDialogName.textContent = (info && info.name) || prettyCode(code);
  els.itemDialogBody.innerHTML = itemDialogHTML(code);
  if (typeof els.itemDialog.showModal === "function") els.itemDialog.showModal();
}
els.geList.addEventListener("click", (e) => {
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.itemDialogBody.addEventListener("click", (e) => {
  const tile = e.target.closest(".item-tile:not(.monster-tile)");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.itemDialogClose.addEventListener("click", () => els.itemDialog.close());
els.itemDialog.addEventListener("click", (e) => {
  if (e.target === els.itemDialog) els.itemDialog.close();
});

/* ---------- boot: load the catalog, then the order book once ---------- */
renderKindTags();
loadItemCatalog()
  .then(() => refreshOrderBook())
  .catch(() => {
    els.geList.innerHTML = `<div class="log-empty">Could not load the item catalog.</div>`;
  });
