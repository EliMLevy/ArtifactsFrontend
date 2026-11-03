// Locally cached monster catalog (data/monsters.json, committed to the repo).
// Lets the dashboard resolve monster names and drops without extra API calls.
let loaded = false;

/** monster code -> full MonsterSchema */
export const monsterByCode = new Map();

/**
 * Reverse drop index: item code -> [{ code, rate }] of the monsters that
 * drop it. Sorted by drop rate, rarest first (matching how the API lists
 * drops).
 */
export const droppedBy = new Map();

export async function loadMonsterCatalog() {
  if (loaded) return;
  const url = new URL("../data/monsters.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Monster catalog failed to load (HTTP ${res.status})`);
  const monsters = await res.json();
  for (const m of monsters) {
    if (!m || !m.code) continue;
    monsterByCode.set(m.code, m);
    const drops = m.drops;
    if (Array.isArray(drops)) {
      for (const d of drops) {
        if (!d || !d.code) continue;
        if (!droppedBy.has(d.code)) droppedBy.set(d.code, []);
        droppedBy.get(d.code).push({ code: m.code, rate: d.rate });
      }
    }
  }
  for (const list of droppedBy.values()) {
    list.sort((a, b) => (b.rate || 0) - (a.rate || 0));
  }
  loaded = true;
}
