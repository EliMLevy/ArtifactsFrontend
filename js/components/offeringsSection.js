// Daily seasonal offerings at the Altar of Sacrifice
// (GET /seasonal_offerings, public — no token needed).
// Loads on page load and refreshes every minute, independently of the
// character connection, like the Active Events section.
import { state } from "../store.js";
import { getSeasonalOfferings } from "../api.js";
import { findMapByContentType } from "../maps.js";
import { itemTileHTML } from "./itemTile.js";
import { esc, fmtDuration, num, prettyCode } from "../utils.js";

/** "Resets in ~2h" until expiration, "" when unknown or past. */
function resetLabel(expiresAt) {
  const s = (new Date(expiresAt).getTime() - Date.now()) / 1000;
  if (isNaN(s) || s <= 0) return "";
  return `Resets in ${fmtDuration(s)}`;
}

const OFFERINGS_REFRESH_MS = 60 * 1000;

let els = null;
let loading = false;
let timer = null;

/** "+50%" from a 1.5 multiplier, or "" when there is no bonus. */
function bonusLabel(mult) {
  if (typeof mult !== "number" || mult <= 1) return "";
  return `+${Math.round((mult - 1) * 100)}%`;
}

function favorHTML(favor) {
  if (!favor) return "";
  const bits = [];
  const xp = bonusLabel(favor.xp_multiplier);
  if (xp) bits.push(`${xp} XP`);
  const drops = bonusLabel(favor.drop_multiplier);
  if (drops) bits.push(`${drops} drops`);
  const target = favor.target_code ? ` → ${esc(prettyCode(favor.target_code))}` : "";
  return bits.length ? `<span class="off-favor">Favor: ${bits.join(" · ")}${target}</span>` : "";
}

export function offeringRowHTML(o) {
  const req = o.requirement || {};
  const range =
    typeof o.level_min === "number" && typeof o.level_max === "number"
      ? `Lv ${o.level_min}–${o.level_max}`
      : "";
  return (
    `<div class="off-row">` +
    `<span class="off-bracket mono">${esc(range)}</span>` +
    (req.code ? itemTileHTML({ code: req.code, quantity: req.quantity || 1 }) : "") +
    `<div class="off-detail">${favorHTML(o.favor)}</div>` +
    `</div>`
  );
}

export function categoryCardHTML(category, offerings) {
  const rows = offerings
    .slice()
    .sort((a, b) => (a.level_min || 0) - (b.level_min || 0))
    .map(offeringRowHTML)
    .join("");
  return (
    `<div class="off-cat">` +
    `<div class="off-cat-head"><h3>${esc(prettyCode(category))}</h3>` +
    `<span class="count mono">${offerings.length} brackets</span></div>` +
    rows +
    `</div>`
  );
}

function altarLine() {
  const m = findMapByContentType("seasonal_altar");
  if (!m) return "Accept and complete offerings at the Altar of Sacrifice.";
  const coords =
    typeof m.x === "number" && typeof m.y === "number" ? ` (${m.x}, ${m.y})` : "";
  return `Accept and complete offerings at the Altar of Sacrifice — ${esc(prettyCode(m.name))}${esc(coords)}.`;
}

function renderOfferings() {
  const d = state.seasonalOfferings;
  const list = (d && Array.isArray(d.offerings) && d.offerings) || [];
  if (!d) {
    els.offeringsCount.textContent = "";
    els.offeringsMeta.textContent = "Loading…";
    els.offeringsList.innerHTML = "";
    return;
  }
  const byCat = new Map();
  for (const o of list) {
    const cat = o.category || "other";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(o);
  }
  els.offeringsCount.textContent = list.length ? `· ${list.length} offerings` : "· none today";
  const reset = d.expires_at ? resetLabel(d.expires_at) : "";
  els.offeringsMeta.innerHTML =
    (d.date ? `<span>Date <strong>${esc(d.date)}</strong></span>` : "") +
    (reset ? `<span><strong>${esc(reset)}</strong></span>` : "") +
    (typeof d.xp_reward_percent === "number"
      ? `<span>Completion reward <strong>${num(d.xp_reward_percent)}% of next-level XP</strong></span>`
      : "") +
    `<span>${altarLine()}</span>`;
  els.offeringsList.innerHTML = byCat.size
    ? [...byCat.entries()].map(([cat, os]) => categoryCardHTML(cat, os)).join("")
    : `<div class="log-empty">No offerings today.</div>`;
}

async function loadOfferings() {
  if (loading) return;
  loading = true;
  try {
    state.seasonalOfferings = await getSeasonalOfferings();
  } catch {
    /* keep the previous day's data on failure; first load shows the error below */
    if (!state.seasonalOfferings) {
      els.offeringsCount.textContent = "";
      els.offeringsMeta.textContent = "";
      els.offeringsList.innerHTML = `<div class="log-empty">Could not load seasonal offerings.</div>`;
    }
  } finally {
    loading = false;
  }
  renderOfferings();
}

export function initOfferingsSection() {
  els = {
    offeringsCount: document.getElementById("offeringsCount"),
    offeringsMeta: document.getElementById("offeringsMeta"),
    offeringsList: document.getElementById("offeringsList"),
    offeringsRefresh: document.getElementById("offeringsRefresh"),
  };
  if (!els.offeringsList) return;
  els.offeringsRefresh.addEventListener("click", loadOfferings);
  loadOfferings();
  if (timer) clearInterval(timer);
  timer = setInterval(loadOfferings, OFFERINGS_REFRESH_MS);
}
