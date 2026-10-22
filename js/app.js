// App bootstrap: DOM wiring, rendering, cooldown ticker, init.
import { TOKEN_KEY, ACCOUNT_KEY, LOGS_EVERY_N_TICKS, SLOW_EVERY_N_TICKS } from "./config.js";
import { state, readStore, saveCredentials, clearCredentials, resetConnectionState } from "./store.js";
import { getServerStatus } from "./api.js";
import {
  resolveAccount,
  fetchCharacters,
  refreshLogs,
  fetchRates,
  fetchAllBankItems,
  fetchBankDetails,
  startAutoRefresh,
  stopAutoRefresh,
} from "./loader.js";
import { cardHTML, cooldownRemaining } from "./components/characterCard.js";
import { itemDialogHTML } from "./components/bankSection.js";
import { itemTileHTML } from "./components/itemTile.js";
import { loadItemCatalog, itemByCode } from "./items.js";
import { initPiSection } from "./piSection.js";
import { loadMapCatalog } from "./maps.js";
import { esc, num, fmtClock, fmtTime, prettyCode } from "./utils.js";

const els = {
  token: document.getElementById("tokenInput"),
  account: document.getElementById("accountInput"),
  toggleToken: document.getElementById("toggleTokenBtn"),
  connect: document.getElementById("connectBtn"),
  refresh: document.getElementById("refreshBtn"),
  clear: document.getElementById("clearBtn"),
  autoToggle: document.getElementById("autoRefreshToggle"),
  banner: document.getElementById("banner"),
  chip: document.getElementById("accountChip"),
  content: document.getElementById("content"),
  charCount: document.getElementById("charCount"),
  endpointNote: document.getElementById("endpointNote"),
  lastUpdated: document.getElementById("lastUpdated"),
  serverDot: document.getElementById("serverDot"),
  serverStatus: document.getElementById("serverStatus"),
  seasonPill: document.getElementById("seasonPill"),
  seasonName: document.getElementById("seasonName"),
  onlinePill: document.getElementById("onlinePill"),
  onlineCount: document.getElementById("onlineCount"),
  versionPill: document.getElementById("versionPill"),
  apiVersion: document.getElementById("apiVersion"),
  ratesPill: document.getElementById("ratesPill"),
  bankSection: document.getElementById("bankSection"),
  bankPanel: document.getElementById("bankPanel"),
  bankSearch: document.getElementById("bankSearch"),
  bankSearchClear: document.getElementById("bankSearchClear"),
  typeTags: document.getElementById("typeTags"),
  bankGrid: document.getElementById("bankGrid"),
  bankCount: document.getElementById("bankCount"),
  bankInfo: document.getElementById("bankInfo"),
  itemDialog: document.getElementById("itemDialog"),
  itemDialogName: document.getElementById("itemDialogName"),
  itemDialogBody: document.getElementById("itemDialogBody"),
  itemDialogClose: document.getElementById("itemDialogClose"),
};

/* ---------- banner ---------- */
function showBanner(msg, kind = "error") {
  els.banner.textContent = msg;
  els.banner.className = `banner show ${kind}`;
}
function hideBanner() {
  els.banner.className = "banner";
  els.banner.textContent = "";
}

/* ---------- loading / skeletons ---------- */
function setLoading(on) {
  state.loading = on;
  els.connect.disabled = on;
  els.connect.textContent = on ? "Loading…" : "Connect & load characters";
  els.refresh.disabled = on || !state.connected;
}

function showSkeletons() {
  let html = '<div class="grid" aria-busy="true">';
  for (let i = 0; i < 3; i++) {
    html +=
      '<div class="skeleton"><div class="sk" style="height:56px"></div>' +
      '<div class="sk" style="height:14px;width:70%"></div>' +
      '<div class="sk" style="height:14px;width:50%"></div>' +
      '<div class="sk" style="height:90px"></div></div>';
  }
  els.content.innerHTML = html + "</div>";
}

function renderAccountChip(d) {
  if (!d || !d.username) {
    els.chip.className = "account-chip";
    els.chip.innerHTML = "";
    return;
  }
  const bits = [`<span>Account <strong>${esc(d.username)}</strong></span>`];
  if (d.member) bits.push("<span>★ Member</span>");
  if (typeof d.gems === "number") bits.push(`<span>Gems <span class="mono">${num(d.gems)}</span></span>`);
  if (typeof d.achievements_points === "number")
    bits.push(`<span>Achievement points <span class="mono">${num(d.achievements_points)}</span></span>`);
  if (d.status) bits.push(`<span>Status ${esc(prettyCode(d.status))}</span>`);
  if (d.banned) bits.push(`<span>⚠ Banned${d.ban_reason ? ": " + esc(d.ban_reason) : ""}</span>`);
  els.chip.innerHTML = bits.join("");
  els.chip.className = "account-chip show";
}

/* ---------- rate-limit monitor ---------- */
function renderRates() {
  const scope = state.rates && state.rates.data;
  if (!scope) {
    els.ratesPill.classList.add("hidden");
    return;
  }
  const bits = [];
  if (scope.minute) bits.push(`<strong>${num(scope.minute.remaining)}</strong>/min`);
  if (scope.hour) bits.push(`<strong>${num(scope.hour.remaining)}</strong>/hr`);
  if (scope.day) bits.push(`<strong>${num(scope.day.remaining)}</strong>/day`);
  if (!bits.length) {
    els.ratesPill.classList.add("hidden");
    return;
  }
  els.ratesPill.innerHTML = `⏱ ${bits.join(" · ")} left`;
  els.ratesPill.classList.remove("hidden");
  els.ratesPill.title = "Remaining Artifacts API calls (data endpoints)";
}

/* ---------- bank section ---------- */

/** Item types actually present in the bank, with counts — drives the tag row. */
function bankTypes() {
  const counts = new Map();
  for (const entry of state.bankItems) {
    const ty = itemByCode.get(entry.code)?.type || "";
    if (!ty) continue;
    counts.set(ty, (counts.get(ty) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderTypeTags() {
  const types = bankTypes();
  els.typeTags.innerHTML = types
    .map(
      ([ty, n]) =>
        `<button type="button" class="typetag" data-type="${esc(ty)}" ` +
        `aria-pressed="${state.bankFilter.type === ty ? "true" : "false"}">` +
        `${esc(prettyCode(ty))} <span class="mono">${n}</span></button>`
    )
    .join("");
}

function filteredBankItems() {
  const q = state.bankFilter.q.trim().toLowerCase();
  const ty = state.bankFilter.type;
  return state.bankItems.filter((entry) => {
    const info = itemByCode.get(entry.code);
    if (ty && (info?.type || "") !== ty) return false;
    if (q) {
      const name = ((info && info.name) || entry.code).toLowerCase();
      if (!name.includes(q) && !entry.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderBankInfo() {
  const d = state.bankDetails;
  els.bankInfo.textContent = d
    ? `· ${state.bankItems.length} / ${num(d.slots)} slots · ${num(d.gold)} gold in bank · next expansion ${num(d.next_expansion_cost)} gold`
    : "";
}

function renderBankGrid() {
  const items = filteredBankItems();
  els.bankCount.textContent = `· ${items.length} of ${state.bankItems.length} items`;
  renderBankInfo();
  els.bankGrid.innerHTML = items.length
    ? items.map(itemTileHTML).join("")
    : `<div class="log-empty">No items match the current filters.</div>`;
}

function showBankSection() {
  els.bankSection.classList.remove("hidden");
  els.bankPanel.classList.remove("hidden");
  renderTypeTags();
  renderBankGrid();
}

function hideBankSection() {
  els.bankSection.classList.add("hidden");
  els.bankPanel.classList.add("hidden");
  els.bankGrid.innerHTML = "";
  els.bankCount.textContent = "";
  els.bankInfo.textContent = "";
}

/* ---------- character rendering ---------- */
/** Names of characters whose gear section the user has manually collapsed. */
function closedGearNames() {
  const closed = new Set();
  els.content.querySelectorAll(".card").forEach((card) => {
    const d = card.querySelector("details.gear");
    if (d && !d.open) {
      const c = state.characters[Number(card.getAttribute("data-idx"))];
      if (c) closed.add(c.name);
    }
  });
  return closed;
}

/** Log-list scroll offsets per character, so re-renders don't snap to top. */
function logScrollPositions() {
  const pos = new Map();
  els.content.querySelectorAll(".card").forEach((card) => {
    const list = card.querySelector(".log-list");
    if (list && list.scrollTop > 0) {
      const c = state.characters[Number(card.getAttribute("data-idx"))];
      if (c) pos.set(c.name, list.scrollTop);
    }
  });
  return pos;
}

function renderCharacters() {
  if (!state.characters.length) {
    els.charCount.textContent = "";
    els.content.innerHTML =
      `<div class="empty"><h3>No characters on this account yet</h3>` +
      `<p>The API returned an empty roster for <strong>${esc(state.account)}</strong>. ` +
      `Create a character in the game first — see the ` +
      `<a href="https://docs.artifactsmmo.com" target="_blank" rel="noopener">Artifacts docs</a> — then refresh.</p></div>`;
    return;
  }
  const gearClosed = closedGearNames();
  const logScroll = logScrollPositions();
  els.charCount.textContent = `· ${state.characters.length} ${state.characters.length === 1 ? "character" : "characters"}`;
  els.content.innerHTML =
    '<div class="grid">' + state.characters.map((c, i) => cardHTML(c, i)).join("") + "</div>";
  // Gear sections are open by default; re-collapse any the user closed,
  // and restore log scroll positions so refreshes don't snap to the top.
  els.content.querySelectorAll(".card").forEach((card) => {
    const c = state.characters[Number(card.getAttribute("data-idx"))];
    if (!c) return;
    if (gearClosed.has(c.name)) {
      const d = card.querySelector("details.gear");
      if (d) d.open = false;
    }
    if (logScroll.has(c.name)) {
      const list = card.querySelector(".log-list");
      if (list) list.scrollTop = logScroll.get(c.name);
    }
  });
  tickCooldowns();
}

/* ---------- live cooldown ticker (1s) ---------- */
function tickCooldowns() {
  els.content.querySelectorAll("[data-cd-box]").forEach((box) => {
    const card = box.closest(".card");
    if (!card) return;
    const c = state.characters[Number(card.getAttribute("data-idx"))];
    if (!c) return;
    const remaining = cooldownRemaining(c);
    const timeEl = box.querySelector("[data-cd-time]");
    const barEl = box.querySelector("[data-cd-bar]");
    const barWrap = box.querySelector("[data-cd-bar-wrap]");
    const subEl = box.querySelector("[data-cd-sub]");
    if (remaining <= 0.5) {
      box.classList.add("ready");
      timeEl.textContent = "✓ Ready";
      if (barWrap) barWrap.style.display = "none";
      subEl.textContent = "No active cooldown — this character can act now.";
    } else {
      box.classList.remove("ready");
      timeEl.textContent = fmtClock(remaining);
      if (barWrap) barWrap.style.display = "";
      const total = Math.max(c.cooldown || 0, remaining);
      if (barEl && total > 0) barEl.style.width = ((remaining / total) * 100).toFixed(1) + "%";
      subEl.textContent = c.cooldown_expiration
        ? `Ready at ${fmtTime(c.cooldown_expiration)} · total ${fmtClock(total)}`
        : `Total ${fmtClock(total)}`;
    }
  });
}

function friendlyError(err) {
  let msg = (err && err.message) || "Something went wrong loading your characters.";
  if (err && (err.status === 401 || err.status === 403)) {
    msg = `The API rejected that token (HTTP ${err.status}). Check you copied the full token from your Artifacts account page.`;
  } else if (err && err.status === 404) {
    msg = "Account not found (HTTP 404). Check the username, or clear it to let the token resolve it automatically.";
  }
  return msg;
}

/* ---------- data flows ---------- */

/** Full connect: resolve account, load roster, maps, logs. */
async function connectAndLoad() {
  const token = els.token.value.trim();
  const accountInput = els.account.value.trim();
  if (!token && !accountInput) {
    showBanner("Enter your API token (or at least an account username to view a public roster).");
    return;
  }
  hideBanner();
  setLoading(true);
  showSkeletons();
  try {
    const { account, details } = await resolveAccount(token, accountInput);
    if (accountInput !== account) els.account.value = account;
    if (details) renderAccountChip(details);
    state.token = token;
    state.account = account;

    const { list, via } = await fetchCharacters(account, token);
    state.characters = Array.isArray(list) ? list : [];
    state.via = via;
    state.connected = true;
    saveCredentials(token, account);
    els.endpointNote.textContent =
      via === "accounts" ? `via GET /accounts/${account}/characters` : "via GET /my/characters";

    renderCharacters();
    if (token) {
      try {
        await refreshLogs();
      } catch {
        /* logs are a bonus — a failure here must not break the dashboard */
      }
      renderCharacters();
      try {
        await fetchRates();
      } catch {
        /* rates are informational */
      }
      renderRates();
      await fetchBankDetails();
      try {
        await fetchAllBankItems();
      } catch {
        /* bank is optional on failure */
      }
      showBankSection();
    }
    els.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })}`;
    startAutoRefresh(onAutoTick);
  } catch (err) {
    state.connected = false;
    const msg = friendlyError(err);
    showBanner(msg);
    els.content.innerHTML = `<div class="empty"><h3>Couldn’t load characters</h3><p>${esc(msg)}</p></div>`;
    els.charCount.textContent = "";
    els.endpointNote.textContent = "";
  } finally {
    setLoading(false);
    els.refresh.disabled = state.loading || !state.connected;
  }
}

/** Lightweight 5s refresh: roster (+ logs / bank+rates on slower cadences). */
async function refreshData({ logs = false, slow = false } = {}) {
  if (!state.connected || state.loading) return;
  state.loading = true;
  try {
    const { list, via } = await fetchCharacters(state.account, state.token);
    state.characters = Array.isArray(list) ? list : [];
    state.via = via;
    els.endpointNote.textContent =
      via === "accounts" ? `via GET /accounts/${state.account}/characters` : "via GET /my/characters";
    if (logs && state.token) {
      try {
        await refreshLogs();
      } catch {
        /* keep old logs on failure */
      }
    }
    if (slow && state.token) {
      try {
        await fetchRates();
      } catch {
        /* silent */
      }
      renderRates();
      await fetchBankDetails();
      try {
        await fetchAllBankItems();
      } catch {
        /* keep old bank contents on failure */
      }
      renderBankGrid();
    }
    hideBanner();
    renderCharacters();
    els.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  } catch (err) {
    if (err && err.status === 429 && !state.backingOff) {
      // Rate limited: pause auto-refresh for 60s, then resume automatically.
      state.backingOff = true;
      stopAutoRefresh();
      showBanner("Rate limited by the Artifacts API (HTTP 429) — auto-refresh paused for 60s.");
      setTimeout(() => {
        state.backingOff = false;
        hideBanner();
        if (state.autoRefresh && state.connected) startAutoRefresh(onAutoTick);
      }, 60000);
    } else {
      showBanner(friendlyError(err) + " (auto-refresh will retry)");
    }
  } finally {
    state.loading = false;
  }
}

function onAutoTick(tickCount) {
  refreshData({
    logs: tickCount % LOGS_EVERY_N_TICKS === 0,
    slow: tickCount % SLOW_EVERY_N_TICKS === 0,
  });
}

/* ---------- server status strip ---------- */
function loadServerStatus() {
  getServerStatus()
    .then((d) => {
      els.serverDot.className = "dot on";
      els.serverStatus.innerHTML = "Server <strong>online</strong>";
      if (d.season && d.season.name) {
        els.seasonName.textContent = d.season.name + (d.season.number ? ` · S${d.season.number}` : "");
        els.seasonPill.classList.remove("hidden");
      }
      if (typeof d.characters_online === "number") {
        els.onlineCount.textContent = num(d.characters_online);
        els.onlinePill.classList.remove("hidden");
      }
      if (d.version) {
        els.apiVersion.textContent = d.version;
        els.versionPill.classList.remove("hidden");
      }
    })
    .catch(() => {
      els.serverDot.className = "dot err";
      els.serverStatus.textContent = "Server unreachable";
    });
}

/* ---------- events ---------- */
els.connect.addEventListener("click", connectAndLoad);
els.refresh.addEventListener("click", () => refreshData({ logs: true, slow: true }));
els.bankSearch.addEventListener("input", () => {
  state.bankFilter.q = els.bankSearch.value;
  els.bankSearchClear.classList.toggle("hidden", !els.bankSearch.value);
  renderBankGrid();
});
els.bankSearchClear.addEventListener("click", () => {
  els.bankSearch.value = "";
  state.bankFilter.q = "";
  els.bankSearchClear.classList.add("hidden");
  renderBankGrid();
  els.bankSearch.focus();
});
els.typeTags.addEventListener("click", (e) => {
  const tag = e.target.closest(".typetag");
  if (!tag) return;
  const ty = tag.dataset.type;
  // Single-select toggle: clicking the active tag clears the filter.
  state.bankFilter.type = state.bankFilter.type === ty ? "" : ty;
  renderTypeTags();
  renderBankGrid();
});

/* ---------- item detail dialog ---------- */
function openItemDialog(code) {
  const info = itemByCode.get(code);
  els.itemDialogName.textContent = (info && info.name) || prettyCode(code);
  els.itemDialogBody.innerHTML = itemDialogHTML(code);
  if (typeof els.itemDialog.showModal === "function") els.itemDialog.showModal();
}
els.bankGrid.addEventListener("click", (e) => {
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.bankGrid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) {
    e.preventDefault();
    openItemDialog(tile.dataset.code);
  }
});
// Inventory tiles + equipped gear inside character cards open the item dialog.
els.content.addEventListener("click", (e) => {
  const tile = e.target.closest(".inv-grid .item-tile, .gear-list .gear-item");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.content.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const tile = e.target.closest(".inv-grid .item-tile, .gear-list .gear-item");
  if (tile && tile.dataset.code) {
    e.preventDefault();
    openItemDialog(tile.dataset.code);
  }
});
els.itemDialogClose.addEventListener("click", () => els.itemDialog.close());
els.itemDialog.addEventListener("click", (e) => {
  if (e.target === els.itemDialog) els.itemDialog.close();
});
// Tiles inside the dialog (recipe ingredients / used-in items) drill down.
els.itemDialogBody.addEventListener("click", (e) => {
  const tile = e.target.closest(".item-tile");
  if (tile && tile.dataset.code) openItemDialog(tile.dataset.code);
});
els.token.addEventListener("keydown", (e) => {
  if (e.key === "Enter") connectAndLoad();
});
els.account.addEventListener("keydown", (e) => {
  if (e.key === "Enter") connectAndLoad();
});
els.toggleToken.addEventListener("click", () => {
  const show = els.token.type === "password";
  els.token.type = show ? "text" : "password";
  els.toggleToken.textContent = show ? "Hide" : "Show";
  els.toggleToken.setAttribute("aria-pressed", show ? "true" : "false");
});
els.clear.addEventListener("click", () => {
  clearCredentials();
  resetConnectionState();
  stopAutoRefresh();
  els.token.value = "";
  els.account.value = "";
  els.bankSearch.value = "";
  els.bankSearchClear.classList.add("hidden");
  els.chip.className = "account-chip";
  els.chip.innerHTML = "";
  els.charCount.textContent = "";
  els.endpointNote.textContent = "";
  els.lastUpdated.textContent = "";
  els.refresh.disabled = true;
  els.ratesPill.classList.add("hidden");
  hideBankSection();
  hideBanner();
  els.content.innerHTML =
    `<div class="empty"><h3>Token forgotten</h3>` +
    `<p>The saved token was removed from this browser. Paste it again whenever you want to reconnect.</p></div>`;
});
els.autoToggle.addEventListener("click", () => {
  state.autoRefresh = !state.autoRefresh;
  els.autoToggle.setAttribute("aria-pressed", state.autoRefresh ? "true" : "false");
  if (state.autoRefresh) startAutoRefresh(onAutoTick);
  else stopAutoRefresh();
});

/* ---------- init ---------- */
setInterval(tickCooldowns, 1000);
loadServerStatus();
initPiSection();
// Local catalogs are niceties — the dashboard degrades gracefully without them.
loadItemCatalog().catch(() => {});
loadMapCatalog().catch(() => {});
const savedToken = readStore(TOKEN_KEY);
const savedAccount = readStore(ACCOUNT_KEY);
if (savedAccount) els.account.value = savedAccount;
if (savedToken) {
  els.token.value = savedToken;
  connectAndLoad();
}
