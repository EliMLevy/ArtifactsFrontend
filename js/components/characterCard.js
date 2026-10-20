// Character card renderer (pure: HTML string from a character object).
import { LOGS_PER_CHARACTER } from "../config.js";
import { state } from "../store.js";
import { getMap, contentOf } from "../maps.js";
import { esc, num, pct, fmtClock, fmtTime, prettyCode } from "../utils.js";

const SKILLS = [
  ["mining", "Mining"],
  ["woodcutting", "Woodcutting"],
  ["fishing", "Fishing"],
  ["weaponcrafting", "Weaponcrafting"],
  ["gearcrafting", "Gearcrafting"],
  ["jewelrycrafting", "Jewelrycrafting"],
  ["cooking", "Cooking"],
  ["alchemy", "Alchemy"],
];

const GEAR = [
  ["weapon_slot", "Weapon"],
  ["rune_slot", "Rune"],
  ["shield_slot", "Shield"],
  ["helmet_slot", "Helmet"],
  ["body_armor_slot", "Body"],
  ["leg_armor_slot", "Legs"],
  ["boots_slot", "Boots"],
  ["ring1_slot", "Ring 1"],
  ["ring2_slot", "Ring 2"],
  ["amulet_slot", "Amulet"],
  ["artifact1_slot", "Artifact 1"],
  ["artifact2_slot", "Artifact 2"],
  ["artifact3_slot", "Artifact 3"],
  ["bag_slot", "Bag"],
  ["utility1_slot", "Utility 1"],
  ["utility2_slot", "Utility 2"],
];

export function cooldownRemaining(c) {
  if (c.cooldown_expiration) {
    const diff = (new Date(c.cooldown_expiration).getTime() - Date.now()) / 1000;
    return isNaN(diff) ? 0 : Math.max(0, diff);
  }
  return Math.max(0, c.cooldown || 0);
}

function skillsHTML(c) {
  const items = SKILLS.map(([key, label]) => {
    const lv = c[`${key}_level`];
    const xp = c[`${key}_xp`];
    const mx = c[`${key}_max_xp`];
    return (
      `<div class="skill"><div class="skill-top"><span class="nm">${esc(label)}</span>` +
      `<span class="lv">Lv ${num(lv)}</span></div>` +
      `<div class="bar"><i style="width:${pct(xp, mx).toFixed(1)}%"></i></div>` +
      `<div class="xpv">${num(xp)} / ${num(mx)} XP</div></div>`
    );
  }).join("");
  return `<div class="skill-sec"><h3>Skills</h3><div class="skills-grid">${items}</div></div>`;
}

function gearHTML(c) {
  const items = GEAR.filter(([slot]) => c[slot])
    .map(([slot, label]) => {
      const code = c[slot];
      const qty =
        slot === "utility1_slot"
          ? c.utility1_slot_quantity
          : slot === "utility2_slot"
            ? c.utility2_slot_quantity
            : null;
      const name = prettyCode(code);
      const title = qty ? `${label} — ${name} ×${num(qty)}` : `${label} — ${name}`;
      return (
        `<span class="gear-item" title="${esc(title)}">` +
        `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(code)}.png" ` +
        `alt="${esc(name)}" loading="lazy" onerror="this.remove()"></span>`
      );
    })
    .join("");
  const invCount = Array.isArray(c.inventory)
    ? c.inventory.reduce((a, s) => a + (s && s.quantity ? s.quantity : 0), 0)
    : null;
  if (!items && invCount == null) return "";
  return (
    `<details class="gear"><summary>Equipment &amp; inventory</summary>` +
    (items
      ? `<div class="gear-list">${items}</div>`
      : `<div class="inv-line">No equipment equipped.</div>`) +
    (invCount != null
      ? `<div class="inv-line">Inventory: <span class="mono">${num(invCount)} / ${num(c.inventory_max_items)}</span> items</div>`
      : "") +
    `</details>`
  );
}

function logsHTML(c) {
  if (!state.logsAvailable) return "";
  const logs = (state.logsByCharacter[c.name] || []).slice(0, LOGS_PER_CHARACTER);
  const rows = logs
    .map(
      (l) =>
        `<div class="log-row"><span class="log-time mono">${esc(fmtTime(l.created_at))}</span>` +
        `<span class="tag">${esc(prettyCode(l.type))}</span>` +
        `<span class="log-desc">${esc(l.description || "")}</span></div>`
    )
    .join("");
  return (
    `<div class="log-sec"><h3>Recent activity</h3>` +
    (rows ? `<div class="log-list">${rows}</div>` : `<div class="log-empty">No recent activity.</div>`) +
    `</div>`
  );
}

export function cardHTML(c, idx) {
  const hpPct = pct(c.hp, c.max_hp);
  const hpClass = hpPct <= 25 ? "hp low" : hpPct <= 55 ? "hp mid" : "hp";
  const xpPct = pct(c.xp, c.max_xp);
  const map = c.map_id != null ? getMap(c.map_id) : null;
  const place = map && map.name ? prettyCode(map.name) : "Map #" + (c.map_id != null ? c.map_id : "—");
  const content = c.map_id != null ? contentOf(c.map_id) : null;
  const initials = esc((c.name || "?").slice(0, 2).toUpperCase());
  const skinImg = c.skin
    ? `<img src="https://artifactsmmo.com/images/characters/${encodeURIComponent(c.skin)}.png" alt="" loading="lazy" onerror="this.remove()">`
    : "";
  const remaining = cooldownRemaining(c);
  const cdTotal = Math.max(c.cooldown || 0, remaining);
  const cdPct = cdTotal > 0 ? (remaining / cdTotal) * 100 : 0;

  const taskHtml = c.task
    ? `<div class="task-line">Task: <strong>${esc(prettyCode(c.task))}</strong>` +
      (c.task_type ? ` <span class="tag">${esc(c.task_type)}</span>` : "") +
      (c.task_total
        ? ` · <span class="mono">${num(c.task_progress)} / ${num(c.task_total)}</span>`
        : "") +
      `</div>`
    : "";

  return (
    `<article class="card" data-idx="${idx}">` +
    `<div class="card-top">` +
    `<div class="avatar" aria-hidden="true">${initials}${skinImg}</div>` +
    `<div class="card-id"><div class="card-name">${esc(c.name)}</div>` +
    `<div class="card-meta"><span class="mono">${num(c.gold)}</span> gold</div></div>` +
    `<div class="lvl"><div class="n">${num(c.level)}</div><div class="t">Level</div></div>` +
    `</div>` +
    `<div class="loc"><span aria-hidden="true">📍</span><span class="place">${esc(place)}</span>` +
    (content
      ? `<span class="coords">${esc(prettyCode(content.code))}</span>` +
        `<span class="tag">${esc(prettyCode(content.type))}</span>`
      : `<span class="coords mono">(${num(c.x)}, ${num(c.y)})</span>`) +
    (c.layer ? `<span class="tag">${esc(c.layer)}</span>` : "") +
    `<span class="tag">Map ${c.map_id != null ? c.map_id : "—"}</span></div>` +
    `<div class="bars-row">` +
    `<div class="bar-row"><div class="bar-head"><span class="lbl">❤ Health</span>` +
    `<span class="val">${num(c.hp)} / ${num(c.max_hp)} HP</span></div>` +
    `<div class="bar ${hpClass}"><i style="width:${hpPct.toFixed(1)}%"></i></div></div>` +
    `<div class="bar-row"><div class="bar-head"><span class="lbl">Combat XP</span>` +
    `<span class="val">${num(c.xp)} / ${num(c.max_xp)}</span></div>` +
    `<div class="bar xp"><i style="width:${xpPct.toFixed(1)}%"></i></div></div>` +
    `</div>` +
    `<div class="cd-box" data-cd-box>` +
    `<div class="cd-head"><span class="lbl">Cooldown</span><span class="cd-time" data-cd-time></span></div>` +
    `<div class="bar cd" data-cd-bar-wrap><i data-cd-bar style="width:${cdPct.toFixed(1)}%"></i></div>` +
    `<div class="cd-sub" data-cd-sub></div>` +
    `</div>` +
    taskHtml +
    skillsHTML(c) +
    logsHTML(c) +
    gearHTML(c) +
    `</article>`
  );
}
