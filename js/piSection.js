// Raspberry Pi companion API (reachable only on the local network):
// a one-line bot state plus a searchable log feed, shown in a terminal panel.
import { state } from "./store.js";
import { esc, num } from "./utils.js";

const PI_BASE = "https://artifacts.home";
const PI_REFRESH_MS = 3000;

let els = null;
let activeFilter = "";
let loading = false;
let namesSignature = "";

async function fetchText(path) {
  const res = await fetch(PI_BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** get-state returns a single-line string (plain text or a JSON string). */
function parseState(text) {
  try {
    const v = JSON.parse(text);
    if (typeof v === "string") return v;
  } catch {
    /* plain text — use as-is */
  }
  return text.trim();
}

function filterTerms() {
  const names = state.characters.map((c) => c.name).filter(Boolean);
  const terms = [];
  const seen = new Set();
  for (const t of ["error", ...names, "craft"]) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(t);
  }
  return terms;
}

function renderFilters() {
  const terms = filterTerms();
  namesSignature = terms.join("|");
  els.piFilters.innerHTML = terms
    .map(
      (t) =>
        `<button type="button" class="typetag" data-term="${esc(t)}" ` +
        `aria-pressed="${activeFilter === t ? "true" : "false"}">${esc(t)}</button>`
    )
    .join("");
}

async function loadPi() {
  if (loading) return;
  loading = true;
  // Capture scroll state before swapping the text: with autoscroll on we
  // stick to the bottom (newest lines); with it off we keep the user's
  // place so the 3s refresh doesn't yank the view around.
  const stick = els.piAutoscroll.checked;
  const prevScrollTop = els.piLogs.scrollTop;
  try {
    const logsPath = activeFilter
      ? `/api/logs?query=${encodeURIComponent(activeFilter)}`
      : "/api/logs";
    const [stateText, logsText] = await Promise.all([
      fetchText("/api/get-state"),
      fetchText(logsPath),
    ]);
    els.piState.textContent = parseState(stateText);
    els.piLogs.textContent = logsText;
    const count = logsText ? logsText.replace(/\n$/, "").split("\n").length : 0;
    els.piCount.textContent =
      `· ${num(count)} lines` + (activeFilter ? ` matching “${activeFilter}”` : "");
  } catch {
    els.piState.textContent = "Pi unreachable";
    els.piLogs.textContent =
      "Could not reach https://artifacts.home — this panel only works on your local network, with Caddy's root CA trusted on this device.";
    els.piCount.textContent = "";
  } finally {
    if (stick) els.piLogs.scrollTop = els.piLogs.scrollHeight;
    else els.piLogs.scrollTop = prevScrollTop;
    loading = false;
  }
}

export function initPiSection() {
  els = {
    piState: document.getElementById("piState"),
    piCount: document.getElementById("piCount"),
    piFilters: document.getElementById("piFilters"),
    piLogs: document.getElementById("piLogs"),
    piAutoscroll: document.getElementById("piAutoscroll"),
    piRefresh: document.getElementById("piRefresh"),
  };
  renderFilters();
  els.piAutoscroll.addEventListener("change", () => {
    if (els.piAutoscroll.checked) els.piLogs.scrollTop = els.piLogs.scrollHeight;
  });
  els.piFilters.addEventListener("click", (e) => {
    const tag = e.target.closest(".typetag");
    if (!tag) return;
    const term = tag.dataset.term;
    activeFilter = activeFilter === term ? "" : term;
    renderFilters();
    loadPi();
  });
  els.piRefresh.addEventListener("click", loadPi);
  loadPi();
  setInterval(() => {
    // Character names arrive after connect — rebuild tags when they change.
    if (filterTerms().join("|") !== namesSignature) renderFilters();
    loadPi();
  }, PI_REFRESH_MS);
}
