// Currently active game events (GET /events/active, public — no token needed).
// Loads on page load and refreshes every minute, independently of the
// character connection, so it works even before an account is connected.
import { state } from "../store.js";
import { getActiveEvents } from "../api.js";
import { esc, fmtDuration, prettyCode } from "../utils.js";

/** "Oct 25, 9:41 AM" — time alone would hide an event ending tomorrow. */
function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const EVENTS_REFRESH_MS = 60 * 1000;

let els = null;
let loading = false;

/** Time left until expiration, as a short label, or "Expired". */
export function timeLeftLabel(expiration, now = new Date()) {
  const ms = new Date(expiration) - now;
  if (isNaN(ms) || ms <= 0) return "Expired";
  return `${fmtDuration(ms / 1000)} left`;
}

/** One active event row. Defensive: any missing field degrades to a placeholder. */
export function eventHTML(ev) {
  const map = ev.map || {};
  const mapName = map.name || "Unknown location";
  const coords =
    typeof map.x === "number" && typeof map.y === "number" ? ` (${map.x}, ${map.y})` : "";
  const layer = map.layer ? ` · ${prettyCode(map.layer)}` : "";
  return (
    `<div class="event-row">` +
    `<div class="event-name">${esc(ev.name || prettyCode(ev.code))}` +
    (ev.code ? ` <span class="mono event-code">${esc(ev.code)}</span>` : "") +
    `</div>` +
    `<div class="event-meta">${esc(mapName)}${esc(coords)}${esc(layer)}` +
    ` · Started ${ev.created_at ? esc(fmtDateTime(ev.created_at)) : "—"}` +
    ` · Ends ${ev.expiration ? esc(fmtDateTime(ev.expiration)) : "—"}` +
    ` · <strong>${esc(timeLeftLabel(ev.expiration))}</strong>` +
    (typeof ev.duration === "number" ? ` · ${ev.duration} min` : "") +
    `</div></div>`
  );
}

function renderEvents() {
  const events = state.activeEvents;
  els.eventsCount.textContent = events.length
    ? `· ${events.length} active`
    : "· none right now";
  els.eventsList.innerHTML = events.length
    ? events.map(eventHTML).join("")
    : `<div class="log-empty">No active events right now.</div>`;
}

async function loadEvents() {
  if (loading) return;
  loading = true;
  try {
    const events = await getActiveEvents();
    state.activeEvents = Array.isArray(events) ? events : [];
    renderEvents();
  } catch {
    // Events are informational — a failure must not break the dashboard.
    els.eventsCount.textContent = "";
    els.eventsList.innerHTML =
      `<div class="log-empty">Could not load active events.</div>`;
  } finally {
    loading = false;
  }
}

export function initEventsSection() {
  els = {
    eventsCount: document.getElementById("eventsCount"),
    eventsList: document.getElementById("eventsList"),
    eventsRefresh: document.getElementById("eventsRefresh"),
  };
  els.eventsRefresh.addEventListener("click", loadEvents);
  loadEvents();
  setInterval(loadEvents, EVENTS_REFRESH_MS);
}
