// Grand Exchange: public buy/sell order book, filtered by item code.
// Partial codes ("copper" matches copper_bar and copper_ore) are expanded
// against the local item catalog, then orders are fetched per code.
import { API_BASE } from "./config.js";
import { loadItemCatalog, itemByCode } from "./items.js";
import { itemDialogHTML } from "./components/bankSection.js";
import { esc, num, prettyCode } from "./utils.js";

const els = {
  geCount: document.getElementById("geCount"),
  geSearch: document.getElementById("geSearch"),
  geSearchClear: document.getElementById("geSearchClear"),
  geKindTags: document.getElementById("geKindTags"),
  geNote: document.getElementById("geNote"),
  geList: document.getElementById("geList"),
  itemDialog: document.getElementById("itemDialog"),
  itemDialogName: document.getElementById("itemDialogName"),
  itemDialogBody: document.getElementById("itemDialogBody"),
  itemDialogClose: document.getElementById("itemDialogClose"),
};

const filter = { q: "", type: "sell" };
const MAX_CODES = 20; // cap catalog expansion to keep request count sane
const PAGE_SIZE = 100;

let seq = 0; // guards against out-of-order responses

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

async function fetchOrders(code, type) {
  const all = [];
  let page = 1;
  let pages = 1;
  do {
    const url =
      `${API_BASE}/grandexchange/orders?code=${encodeURIComponent(code)}` +
      `&type=${encodeURIComponent(type)}&size=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`GE orders failed (HTTP ${res.status})`);
    const body = await res.json();
    if (Array.isArray(body.data)) all.push(...body.data);
    pages = body.pages || 1;
    page += 1;
  } while (page <= pages);
  return all;
}

/** "3h 12m" / "2d" style age from an ISO timestamp. */
function ageLabel(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (isNaN(s) || s < 0) return "";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function orderRowHTML(o) {
  const info = itemByCode.get(o.code);
  const name = (info && info.name) || prettyCode(o.code);
  const total = typeof o.quantity === "number" && typeof o.price === "number" ? o.quantity * o.price : null;
  return (
    `<div class="ge-row">` +
    `<button type="button" class="ge-item item-tile" data-code="${esc(o.code)}" title="${esc(name)} — view details">` +
    `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(o.code)}.png" ` +
    `alt="" loading="lazy" onerror="this.remove()"></button>` +
    `<div class="ge-name">${esc(name)}</div>` +
    `<div class="ge-qty mono">×${num(o.quantity)}</div>` +
    `<div class="ge-price mono">${num(o.price)} <span class="ge-per">each</span></div>` +
    (total != null ? `<div class="ge-total mono">${num(total)} <span class="ge-per">total</span></div>` : "") +
    `<div class="ge-seller">${esc(o.account || "")}</div>` +
    `<div class="ge-age mono">${esc(ageLabel(o.created_at))}</div>` +
    `</div>`
  );
}

async function search() {
  const mySeq = ++seq;
  const q = filter.q;
  const codes = matchingCodes(q);
  if (!q.trim()) {
    els.geCount.textContent = "";
    els.geNote.textContent = "";
    els.geList.innerHTML = `<div class="log-empty">Enter an item code above to search the Grand Exchange.</div>`;
    return;
  }
  if (!codes.length) {
    els.geCount.textContent = "";
    els.geNote.textContent = "";
    els.geList.innerHTML = `<div class="log-empty">No items match "${esc(q)}".</div>`;
    return;
  }
  const capped = codes.length > MAX_CODES;
  const useCodes = capped ? codes.slice(0, MAX_CODES) : codes;
  els.geNote.textContent = `Searching ${useCodes.length} item${useCodes.length === 1 ? "" : "s"}…`;
  els.geList.innerHTML = "";

  try {
    const results = await Promise.all(useCodes.map((c) => fetchOrders(c, filter.type)));
    if (mySeq !== seq) return; // a newer search superseded this one
    const orders = results.flat();
    // Sell orders: cheapest first. Buy orders: highest bid first.
    orders.sort((a, b) =>
      filter.type === "sell" ? a.price - b.price || a.quantity - b.quantity : b.price - a.price || a.quantity - b.quantity
    );
    els.geCount.textContent = orders.length ? `· ${num(orders.length)} orders` : "";
    els.geNote.textContent =
      (capped ? `Showing matches for the first ${MAX_CODES} of ${codes.length} items — narrow your search for the rest.` : "") +
      (codes.length && !orders.length ? ` No ${filter.type} orders right now.` : "");
    els.geList.innerHTML = orders.length
      ? orders.map(orderRowHTML).join("")
      : `<div class="log-empty">No ${filter.type} orders right now.</div>`;
  } catch {
    if (mySeq !== seq) return;
    els.geNote.textContent = "";
    els.geList.innerHTML = `<div class="log-empty">Could not load Grand Exchange orders.</div>`;
  }
}

let debounce = null;
els.geSearch.addEventListener("input", () => {
  filter.q = els.geSearch.value;
  els.geSearchClear.classList.toggle("hidden", !filter.q);
  clearTimeout(debounce);
  debounce = setTimeout(search, 350);
});
els.geSearchClear.addEventListener("click", () => {
  els.geSearch.value = "";
  filter.q = "";
  els.geSearchClear.classList.add("hidden");
  search();
  els.geSearch.focus();
});

els.geKindTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag) return;
  filter.type = tag.dataset.type;
  renderKindTags();
  search();
});

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

/* ---------- boot ---------- */
renderKindTags();
loadItemCatalog()
  .then(() => search())
  .catch(() => {
    els.geList.innerHTML = `<div class="log-empty">Could not load the item catalog.</div>`;
  });
