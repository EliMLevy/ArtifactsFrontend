// App bootstrap: DOM wiring, rendering, cooldown ticker, init.
import { TOKEN_KEY, ACCOUNT_KEY, LOGS_EVERY_N_TICKS } from "./config.js";
import { state, readStore, saveCredentials, clearCredentials, resetConnectionState } from "./store.js";
import { getServerStatus } from "./api.js";
import {
  resolveAccount,
  fetchCharacters,
  refreshLogs,
  warmMapCache,
  startAutoRefresh,
  stopAutoRefresh,
} from "./loader.js";
import { cardHTML, cooldownRemaining } from "./components/characterCard.js";
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

/* ---------- character rendering ---------- */
function openGearNames() {
  const open = new Set();
  els.content.querySelectorAll(".card").forEach((card) => {
    const d = card.querySelector("details.gear");
    if (d && d.open) {
      const c = state.characters[Number(card.getAttribute("data-idx"))];
      if (c) open.add(c.name);
    }
  });
  return open;
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
  const gearOpen = openGearNames();
  els.charCount.textContent = `· ${state.characters.length} ${state.characters.length === 1 ? "character" : "characters"}`;
  els.content.innerHTML =
    '<div class="grid">' + state.characters.map((c, i) => cardHTML(c, i)).join("") + "</div>";
  // Restore any gear sections the user had expanded before the re-render.
  els.content.querySelectorAll(".card").forEach((card) => {
    const c = state.characters[Number(card.getAttribute("data-idx"))];
    if (c && gearOpen.has(c.name)) {
      const d = card.querySelector("details.gear");
      if (d) d.open = true;
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
    await warmMapCache();
    renderCharacters();
    if (token) {
      try {
        await refreshLogs();
      } catch {
        /* logs are a bonus — a failure here must not break the dashboard */
      }
      renderCharacters();
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

/** Lightweight 5s refresh: roster (+ logs every Nth tick), no skeletons. */
async function refreshData(includeLogs) {
  if (!state.connected || state.loading) return;
  state.loading = true;
  try {
    const { list, via } = await fetchCharacters(state.account, state.token);
    state.characters = Array.isArray(list) ? list : [];
    state.via = via;
    els.endpointNote.textContent =
      via === "accounts" ? `via GET /accounts/${state.account}/characters` : "via GET /my/characters";
    await warmMapCache();
    if (includeLogs && state.token) {
      try {
        await refreshLogs();
      } catch {
        /* keep old logs on failure */
      }
    }
    hideBanner();
    renderCharacters();
    els.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  } catch (err) {
    showBanner(friendlyError(err) + " (auto-refresh will retry)");
  } finally {
    state.loading = false;
  }
}

function onAutoTick(tickCount) {
  refreshData(tickCount % LOGS_EVERY_N_TICKS === 0);
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
els.refresh.addEventListener("click", () => refreshData(true));
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
  els.chip.className = "account-chip";
  els.chip.innerHTML = "";
  els.charCount.textContent = "";
  els.endpointNote.textContent = "";
  els.lastUpdated.textContent = "";
  els.refresh.disabled = true;
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
const savedToken = readStore(TOKEN_KEY);
const savedAccount = readStore(ACCOUNT_KEY);
if (savedAccount) els.account.value = savedAccount;
if (savedToken) {
  els.token.value = savedToken;
  connectAndLoad();
}
