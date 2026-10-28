// Characters Summary: one dense row per character — a cooldown ring plus
// only the progress estimates the logs can actually support. The ETAs are
// the exact ones from characterCard.etasFor (the tooltip calculations), so
// the summary can never disagree with a card's tooltip.
import { state } from "../store.js";
import { etasFor, cooldownRemaining } from "./characterCard.js";
import { esc, num, fmtClock, fmtDuration, prettyCode } from "../utils.js";

const SKILL_LABELS = {
  mining: "Mining",
  woodcutting: "Woodcutting",
  fishing: "Fishing",
};

/** Circumference of the ring (r = 15.5 in the 40x40 viewBox). */
export const RING_CIRC = 2 * Math.PI * 15.5;

function etaChip(label, body, eta) {
  return (
    `<span class="sum-eta"><b>${esc(label)}</b> ${esc(body)}` +
    (eta != null ? ` · <span class="mono">${esc(fmtDuration(eta))}</span>` : "") +
    `</span>`
  );
}

export function summaryRowHTML(c, idx) {
  const etas = etasFor(c, state.logsByCharacter[c.name] || []);
  const remaining = cooldownRemaining(c);
  const total = Math.max(c.cooldown || 0, remaining);
  const offset = total > 0 ? RING_CIRC * (remaining / total) : 0;
  const ready = remaining <= 0.5;

  const chips = [];
  if (c.task) {
    const prog = c.task_total
      ? ` · ${num(c.task_progress)} / ${num(c.task_total)}`
      : "";
    chips.push(etaChip("Task", `${prettyCode(c.task)}${prog}`, etas.task));
  }
  if (etas.combat != null) {
    chips.push(etaChip("Combat", `Lv ${num(c.level)} → ${num((c.level || 0) + 1)}`, etas.combat));
  }
  for (const [key, label] of Object.entries(SKILL_LABELS)) {
    const eta = etas.skills[key];
    if (eta == null) continue;
    const lv = c[`${key}_level`];
    chips.push(etaChip(label, `Lv ${num(lv)} → ${num((lv || 0) + 1)}`, eta));
  }

  return (
    `<div class="summary-row" data-summary-row data-idx="${idx}">` +
    `<div class="summary-cd${ready ? " ready" : ""}" data-summary-cd>` +
    `<svg viewBox="0 0 40 40" aria-hidden="true">` +
    `<circle class="cd-ring-bg" cx="20" cy="20" r="15.5"></circle>` +
    `<circle class="cd-ring-fg" cx="20" cy="20" r="15.5" data-summary-ring-fg ` +
    `stroke-dasharray="${RING_CIRC.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>` +
    `</svg>` +
    `<span class="summary-cd-label" data-summary-cd-label>${ready ? "✓" : esc(fmtClock(remaining))}</span>` +
    `</div>` +
    `<div class="summary-body">` +
    `<div class="summary-name">${esc(c.name)} <span class="mono">Lv ${num(c.level)}</span></div>` +
    `<div class="summary-etas">` +
    (chips.length ? chips.join("") : `<span class="sum-none">No estimates from recent logs</span>`) +
    `</div></div></div>`
  );
}

/** Advance one summary row's ring between 5s refreshes (called by the 1s ticker). */
export function tickSummaryRow(row, c) {
  const cd = row.querySelector("[data-summary-cd]");
  const fg = row.querySelector("[data-summary-ring-fg]");
  const label = row.querySelector("[data-summary-cd-label]");
  if (!cd || !fg || !label) return;
  const remaining = cooldownRemaining(c);
  const total = Math.max(c.cooldown || 0, remaining);
  const ready = remaining <= 0.5;
  cd.classList.toggle("ready", ready);
  fg.style.strokeDashoffset = total > 0 ? String(RING_CIRC * (remaining / total)) : "0";
  label.textContent = ready ? "✓" : fmtClock(remaining);
}
