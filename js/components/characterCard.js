// Character card renderer (pure: HTML string from a character object).
import { LOGS_PER_CHARACTER } from "../config.js";
import { state } from "../store.js";
import { getMap, contentOf } from "../maps.js";
import { itemByCode } from "../items.js";
import { itemTileHTML } from "./itemTile.js";
import { esc, num, pct, fmtClock, fmtTime, fmtDuration, prettyCode } from "../utils.js";

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

function skillsHTML(c, skillEtas = {}) {
  const items = SKILLS.map(([key, label]) => {
    const lv = c[`${key}_level`];
    const xp = c[`${key}_xp`];
    const mx = c[`${key}_max_xp`];
    const eta = skillEtas[key];
    const title =
      eta !== undefined
        ? ` title="${esc(eta == null ? "Not enough info" : `Next level in ${fmtDuration(eta)}`)}"`
        : "";
    return (
      `<div class="skill"${title}><div class="skill-top"><span class="nm">${esc(label)}</span>` +
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
      const name = (itemByCode.get(code)?.name) || prettyCode(code);
      const title = qty ? `${label} — ${name} ×${num(qty)}` : `${label} — ${name}`;
      return (
        `<span class="gear-item" data-code="${esc(code)}" title="${esc(title)}" ` +
        `role="button" tabindex="0" aria-label="${esc(title)} — view details">` +
        `<img src="https://artifactsmmo.com/images/items/${encodeURIComponent(code)}.png" ` +
        `alt="${esc(name)}" loading="lazy" onerror="this.remove()"></span>`
      );
    })
    .join("");
  const invEntries = (Array.isArray(c.inventory) ? c.inventory : []).filter(
    (s) => s && s.code
  );
  const invTiles = invEntries
    .map((s) => itemTileHTML({ code: s.code, quantity: s.quantity }))
    .join("");
  const invCount = invEntries.reduce((a, s) => a + (s.quantity || 0), 0);
  if (!items && !invTiles) return "";
  return (
    `<details class="gear" open><summary>Equipment &amp; inventory</summary>` +
    (items
      ? `<div class="gear-list">${items}</div>`
      : `<div class="inv-line">No equipment equipped.</div>`) +
    (invTiles
      ? `<div class="inv-sec"><div class="inv-line">Inventory: <span class="mono">` +
        `${num(invCount)} / ${num(c.inventory_max_items)}</span> items</div>` +
        `<div class="inv-grid">${invTiles}</div></div>`
      : `<div class="inv-line">Inventory empty.</div>`) +
    `</details>`
  );
}

/** Recursive key lookup that skips the `character` snapshot subtree —
 *  it carries totals (e.g. current XP), never gains. */
function findGain(node, key, depth = 0) {
  if (!node || typeof node !== "object" || depth > 4) return 0;
  for (const [k, v] of Object.entries(node)) {
    if (k === "character") continue;
    if (k === key && typeof v === "number" && v > 0) return v;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "character") continue;
    const r = findGain(v, key, depth + 1);
    if (r) return r;
  }
  return 0;
}

/**
 * XP actually gained by an action, from the log's content payload:
 * - fights: content.fight.characters[].xp for this character
 * - gathering / crafting / …: an xp_gained field in the action payload
 */
export function logXp(l) {
  let content = l && l.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      return 0;
    }
  }
  if (!content || typeof content !== "object") return 0;

  const fighters = content.fight && content.fight.characters;
  if (Array.isArray(fighters) && fighters.length) {
    const mine = fighters.filter((f) => f && f.character_name === l.character);
    const list = mine.length ? mine : fighters;
    const xp = list.reduce((a, f) => a + (typeof f.xp === "number" ? f.xp : 0), 0);
    if (xp > 0) return xp;
  }
  return findGain(content, "xp_gained");
}

/* ---------- ETA estimates (seconds, or null when the logs can't say) ---------- */

function logContent(l) {
  let content = l && l.content;
  if (typeof content === "string") {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return content && typeof content === "object" ? content : null;
}

/** Seconds between the character's oldest and newest log; 0 when unknowable. */
function logWindowSeconds(logs) {
  let min = Infinity;
  let max = -Infinity;
  for (const l of logs) {
    const t = Date.parse(l && l.created_at);
    if (isNaN(t)) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return max > min ? (max - min) / 1000 : 0;
}

function taskEtaSeconds(c, logs, windowSec) {
  if (!c.task || !c.task_total) return null;
  const remaining = c.task_total - (c.task_progress || 0);
  if (remaining <= 0) return 0;
  if (windowSec <= 0) return null;
  let fights = 0;
  for (const l of logs) {
    if (l.type !== "fight") continue;
    const f = logContent(l)?.fight;
    if (f && f.opponent === c.task) fights++;
  }
  if (!fights) return null;
  return (windowSec / fights) * remaining;
}

function combatEtaSeconds(c, logs, windowSec) {
  const remaining = (c.max_xp || 0) - (c.xp || 0);
  if (remaining <= 0) return 0;
  if (windowSec <= 0) return null;
  let gained = 0;
  for (const l of logs) if (l.type === "fight") gained += logXp(l);
  if (gained <= 0) return null;
  return (windowSec / gained) * remaining;
}

/** skill code -> total xp_gained reported across the logs (snapshot excluded). */
function skillGains(logs) {
  const gains = new Map();
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 4) return;
    if (typeof node.skill === "string" && typeof node.xp_gained === "number") {
      gains.set(node.skill, (gains.get(node.skill) || 0) + node.xp_gained);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === "character") continue;
      visit(v, depth + 1);
    }
  };
  for (const l of logs) visit(logContent(l), 0);
  return gains;
}

export const GATHER_SKILLS = ["mining", "woodcutting", "fishing"];

/** { task, combat, skills: {mining, woodcutting, fishing} } — seconds or null. */
export function etasFor(c, logs) {
  const windowSec = logWindowSeconds(logs);
  const gains = skillGains(logs);
  const skills = {};
  for (const key of GATHER_SKILLS) {
    const remaining = (c[`${key}_max_xp`] || 0) - (c[`${key}_xp`] || 0);
    const gained = gains.get(key) || 0;
    skills[key] =
      remaining <= 0
        ? 0
        : windowSec > 0 && gained > 0
          ? (windowSec / gained) * remaining
          : null;
  }
  return {
    task: taskEtaSeconds(c, logs, windowSec),
    combat: combatEtaSeconds(c, logs, windowSec),
    skills,
  };
}

function logsHTML(c) {
  if (!state.logsAvailable) return "";
  const logs = (state.logsByCharacter[c.name] || []).slice(0, LOGS_PER_CHARACTER);
  const rows = logs
    .map((l) => {
      const xp = logXp(l);
      return (
        `<div class="log-row"><span class="log-time mono">${esc(fmtTime(l.created_at))}</span>` +
        `<span class="tag">${esc(prettyCode(l.type))}</span>` +
        `<span class="log-desc">${esc(l.description || "")}</span>` +
        (xp ? `<span class="log-xp">+${num(xp)} XP</span>` : "") +
        (l.cooldown > 0 ? `<span class="log-cd mono">⏱ ${esc(fmtClock(l.cooldown))}</span>` : "") +
        `</div>`
      );
    })
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

  const etas = etasFor(c, state.logsByCharacter[c.name] || []);
  const etaTitle = (eta, label) =>
    eta == null ? "Not enough info" : `${label} ${fmtDuration(eta)}`;

  const taskHtml = c.task
    ? `<div class="task-line" title="${esc(etaTitle(etas.task, "Estimated completion:"))}">Task: <strong>${esc(prettyCode(c.task))}</strong>` +
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
    `<div class="bar-row" title="${esc(etaTitle(etas.combat, "Next level in"))}"><div class="bar-head"><span class="lbl">Combat XP</span>` +
    `<span class="val">${num(c.xp)} / ${num(c.max_xp)}</span></div>` +
    `<div class="bar xp"><i style="width:${xpPct.toFixed(1)}%"></i></div></div>` +
    `</div>` +
    `<div class="cd-box" data-cd-box>` +
    `<div class="cd-head"><span class="lbl">Cooldown</span><span class="cd-time" data-cd-time></span></div>` +
    `<div class="bar cd" data-cd-bar-wrap><i data-cd-bar style="width:${cdPct.toFixed(1)}%"></i></div>` +
    `<div class="cd-sub" data-cd-sub></div>` +
    `</div>` +
    taskHtml +
    skillsHTML(c, etas.skills) +
    logsHTML(c) +
    gearHTML(c) +
    `</article>`
  );
}
