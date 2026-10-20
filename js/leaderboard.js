// Accounts leaderboard page: ranked accounts from the public API.
// Selecting an account opens the achievements page with it loaded.
import { ACCOUNT_KEY } from "./config.js";
import { getAccountsLeaderboardPage } from "./api.js";
import { esc, num } from "./utils.js";

const els = {
  lbCount: document.getElementById("lbCount"),
  lbSearch: document.getElementById("lbSearch"),
  lbSearchClear: document.getElementById("lbSearchClear"),
  lbSortTags: document.getElementById("lbSortTags"),
  lbContent: document.getElementById("lbContent"),
};

const LB_PAGE_SIZE = 100;
const LB_MAX_PAGES = 20;

let all = [];
let sort = "achievements_points";
let query = "";

function readAccount() {
  try {
    return localStorage.getItem(ACCOUNT_KEY) || "";
  } catch {
    return "";
  }
}
const ownAccount = readAccount();

function rowHTML(r) {
  const own = ownAccount && r.account.toLowerCase() === ownAccount.toLowerCase();
  const date = r.completed_at
    ? new Date(r.completed_at).toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
  return (
    `<tr data-account="${esc(r.account)}"${own ? ' class="own"' : ""}>` +
    `<td class="mono">${num(r.position)}</td>` +
    `<td><a href="./achievements.html?account=${encodeURIComponent(r.account)}">${esc(r.account)}</a>` +
    (own ? ` <span class="tag">You</span>` : "") +
    (r.member ? ` <span class="tag">Member</span>` : "") +
    `</td>` +
    `<td class="num mono">${num(r.achievements_points)}</td>` +
    `<td class="num mono">${num(r.gold)}</td>` +
    `<td>${esc(date)}</td></tr>`
  );
}

function render() {
  const q = query.trim().toLowerCase();
  const list = all.filter((r) => !q || r.account.toLowerCase().includes(q));
  els.lbCount.textContent = all.length ? `· ${list.length} of ${all.length} accounts` : "";
  els.lbContent.innerHTML = list.length
    ? `<div class="lb-wrap"><table class="lb-table"><thead><tr>` +
      `<th>#</th><th>Account</th><th class="num">Achievement Points</th>` +
      `<th class="num">Gold</th><th>Completed All</th>` +
      `</tr></thead><tbody>${list.map(rowHTML).join("")}</tbody></table></div>`
    : `<div class="log-empty">No accounts match “${esc(query.trim())}”.</div>`;
}

async function load() {
  els.lbContent.innerHTML = `<div class="log-empty">Loading leaderboard…</div>`;
  try {
    const items = [];
    for (let page = 1; page <= LB_MAX_PAGES; page++) {
      const body = await getAccountsLeaderboardPage(sort, page, LB_PAGE_SIZE);
      const data = (body && body.data) || [];
      items.push(...data);
      const pages = body && body.pages;
      if (data.length < LB_PAGE_SIZE || (pages && page >= pages)) break;
    }
    all = items;
    render();
  } catch {
    els.lbContent.innerHTML = `<div class="log-empty">Could not load the leaderboard.</div>`;
  }
}

els.lbSearch.addEventListener("input", () => {
  query = els.lbSearch.value;
  els.lbSearchClear.classList.toggle("hidden", !query);
  render();
});
els.lbSearchClear.addEventListener("click", () => {
  els.lbSearch.value = "";
  query = "";
  els.lbSearchClear.classList.add("hidden");
  render();
  els.lbSearch.focus();
});

els.lbSortTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag || tag.dataset.sort === sort) return;
  sort = tag.dataset.sort;
  els.lbSortTags.querySelectorAll(".typetag").forEach((t) => {
    t.setAttribute("aria-pressed", t.dataset.sort === sort ? "true" : "false");
  });
  load();
});

// Whole-row navigation (the account name is a real link as well).
els.lbContent.addEventListener("click", (e) => {
  if (e.target.closest("a")) return;
  const row = e.target.closest("tr[data-account]");
  if (row) {
    location.href = `./achievements.html?account=${encodeURIComponent(row.dataset.account)}`;
  }
});

load();
