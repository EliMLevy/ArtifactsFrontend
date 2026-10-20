// Achievements page: cards for every achievement with the account's
// progress merged in (public endpoint — only the username is needed).
import { ACCOUNT_KEY } from "./config.js";
import { getAccountAchievementsPage } from "./api.js";
import { esc, num, pct, prettyCode } from "./utils.js";

const els = {
  achCount: document.getElementById("achCount"),
  achPoints: document.getElementById("achPoints"),
  accountPanel: document.getElementById("accountPanel"),
  accountInput: document.getElementById("accountInput"),
  accountBtn: document.getElementById("accountBtn"),
  accountBanner: document.getElementById("accountBanner"),
  achSearch: document.getElementById("achSearch"),
  achSearchClear: document.getElementById("achSearchClear"),
  achTags: document.getElementById("achTags"),
  achContent: document.getElementById("achContent"),
};

const ACH_PAGE_SIZE = 100;
const ACH_MAX_PAGES = 20;

let all = [];
let query = "";
let typeFilter = "";
let completedOnly = false;

function readAccount() {
  try {
    return localStorage.getItem(ACCOUNT_KEY) || "";
  } catch {
    return "";
  }
}

function saveAccount(account) {
  try {
    localStorage.setItem(ACCOUNT_KEY, account);
  } catch {
    /* storage unavailable — the page still works for this visit */
  }
}

function overallProgress(a) {
  let p = 0;
  let t = 0;
  for (const o of a.objectives || []) {
    p += o.progress || 0;
    t += o.total || 0;
  }
  return t > 0 ? p / t : 0;
}

function objectiveHTML(o) {
  const p = o.progress || 0;
  const t = o.total || 0;
  return (
    `<div class="ach-obj"><div class="ach-obj-top">` +
    `<span class="tag">${esc(prettyCode(o.type))}</span>` +
    `<span class="ach-obj-target">${esc(prettyCode(o.target))}</span>` +
    `<span class="mono ach-obj-nums">${num(p)} / ${num(t)}</span></div>` +
    `<div class="bar"><i style="width:${pct(p, t).toFixed(1)}%"></i></div></div>`
  );
}

function rewardsHTML(r) {
  if (!r) return "";
  const parts = [];
  if (r.gold) parts.push(`<span class="ach-reward-gold">🪙 ${num(r.gold)} gold</span>`);
  for (const it of r.items || []) {
    parts.push(
      `<span class="ach-reward-item" title="${esc(prettyCode(it.code))}">` +
        `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(it.code)}.png" ` +
        `alt="" loading="lazy" onerror="this.remove()">` +
        `<span class="mono">×${num(it.quantity)}</span></span>`
    );
  }
  return parts.length
    ? `<div class="ach-rewards"><span class="ach-rewards-lbl">Rewards:</span>${parts.join("")}</div>`
    : "";
}

function achCardHTML(a) {
  const done = !!a.completed_at;
  const date = done
    ? new Date(a.completed_at).toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
  const objs = (a.objectives || []).map(objectiveHTML).join("");
  return (
    `<article class="card ach-card${done ? " completed" : ""}">` +
    `<div class="ach-head"><h3 class="ach-name">${esc(a.name)}</h3>` +
    `<span class="ach-points mono">${num(a.points)} pts</span></div>` +
    (a.description ? `<p class="ach-desc">${esc(a.description)}</p>` : "") +
    (objs ? `<div class="ach-objs">${objs}</div>` : "") +
    rewardsHTML(a.rewards) +
    (done ? `<div class="ach-done">✓ Completed ${esc(date)}</div>` : "") +
    `</article>`
  );
}

/** Quick-filter tags: one per objective type present, plus a Completed toggle. */
function renderAchTags() {
  const counts = new Map();
  for (const a of all) {
    const seen = new Set((a.objectives || []).map((o) => o.type).filter(Boolean));
    for (const t of seen) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const types = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const doneCount = all.filter((a) => a.completed_at).length;
  els.achTags.innerHTML =
    types
      .map(
        ([t, n]) =>
          `<button type="button" class="typetag" data-type="${esc(t)}" ` +
          `aria-pressed="${typeFilter === t ? "true" : "false"}">` +
          `${esc(prettyCode(t))} <span class="mono">${n}</span></button>`
      )
      .join("") +
    `<button type="button" class="typetag" data-completed="1" ` +
    `aria-pressed="${completedOnly ? "true" : "false"}">` +
    `✓ Completed <span class="mono">${doneCount}</span></button>`;
}

function render() {
  const q = query.trim().toLowerCase();
  const list = all.filter((a) => {
    if (q && !(a.name || "").toLowerCase().includes(q)) return false;
    if (typeFilter && !(a.objectives || []).some((o) => o.type === typeFilter)) return false;
    if (completedOnly && !a.completed_at) return false;
    return true;
  });
  const doneCount = all.filter((a) => a.completed_at).length;
  els.achCount.textContent = all.length
    ? `· ${list.length} of ${all.length} shown · ${doneCount} completed`
    : "";
  els.achContent.innerHTML = list.length
    ? `<div class="grid">${list.map(achCardHTML).join("")}</div>`
    : `<div class="log-empty">${
        q
          ? `No achievements match “${esc(query.trim())}”.`
          : "No achievements match the current filters."
      }</div>`;
}

async function loadAchievements(account) {
  els.achContent.innerHTML = `<div class="log-empty">Loading achievements…</div>`;
  const items = [];
  for (let page = 1; page <= ACH_MAX_PAGES; page++) {
    const body = await getAccountAchievementsPage(account, page, ACH_PAGE_SIZE);
    const data = (body && body.data) || [];
    items.push(...data);
    const pages = body && body.pages;
    if (data.length < ACH_PAGE_SIZE || (pages && page >= pages)) break;
  }
  // Incomplete first (closest to done first), completed last by name.
  items.sort((a, b) => {
    const da = a.completed_at ? 1 : 0;
    const db = b.completed_at ? 1 : 0;
    if (da !== db) return da - db;
    if (!da) return overallProgress(b) - overallProgress(a);
    return String(a.name).localeCompare(String(b.name));
  });
  all = items;
  const earned = all.reduce((s, a) => s + (a.completed_at ? a.points || 0 : 0), 0);
  const total = all.reduce((s, a) => s + (a.points || 0), 0);
  els.achPoints.textContent = all.length ? `${earned} / ${total} points` : "";
  renderAchTags();
  render();
}

function showBanner(msg) {
  els.accountBanner.textContent = msg;
  els.accountBanner.classList.toggle("show", !!msg);
}

async function loadFor(account) {
  showBanner("");
  try {
    await loadAchievements(account);
    els.accountPanel.classList.add("hidden");
  } catch (err) {
    els.accountPanel.classList.remove("hidden");
    els.achContent.innerHTML = `<div class="log-empty">Could not load achievements for “${esc(account)}”.</div>`;
    showBanner(err && err.message ? err.message : "Failed to load achievements.");
  }
}

els.achSearch.addEventListener("input", () => {
  query = els.achSearch.value;
  els.achSearchClear.classList.toggle("hidden", !query);
  render();
});
els.achSearchClear.addEventListener("click", () => {
  els.achSearch.value = "";
  query = "";
  els.achSearchClear.classList.add("hidden");
  render();
  els.achSearch.focus();
});
els.achTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag) return;
  if (tag.dataset.completed) {
    completedOnly = !completedOnly;
  } else {
    const t = tag.dataset.type;
    typeFilter = typeFilter === t ? "" : t;
  }
  renderAchTags();
  render();
});

els.accountBtn.addEventListener("click", () => {
  const account = els.accountInput.value.trim();
  if (!account) {
    showBanner("Enter an account username first.");
    return;
  }
  saveAccount(account);
  loadFor(account);
});
els.accountInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.accountBtn.click();
});

/* ---------- init ---------- */
const saved = readAccount();
if (saved) {
  els.accountInput.value = saved;
  loadFor(saved);
} else {
  els.accountPanel.classList.remove("hidden");
  els.achContent.innerHTML =
    `<div class="log-empty">Enter an account username above to view its achievements.</div>`;
}
