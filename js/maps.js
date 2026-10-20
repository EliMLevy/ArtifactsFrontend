// Locally cached map catalog (data/maps.json, committed to the repo).
// Lets the dashboard resolve map names + content without extra API calls.
let loaded = false;

/** map_id -> full MapSchema */
const byId = new Map();

export async function loadMapCatalog() {
  if (loaded) return;
  // NOTE: fetch() resolves relative URLs against the *document*, not this
  // module — anchor to the module's own URL like js/items.js does.
  const url = new URL("../data/maps.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Map catalog failed to load (HTTP ${res.status})`);
  const maps = await res.json();
  for (const m of maps) {
    if (m && m.map_id != null) byId.set(m.map_id, m);
  }
  loaded = true;
}

export function getMap(mapId) {
  return byId.get(mapId) || null;
}

/** { type, code } of the map's content, or null when the tile is empty. */
export function contentOf(mapId) {
  const m = byId.get(mapId);
  const c = m && m.interactions && m.interactions.content;
  return c && c.code ? { type: c.type, code: c.code } : null;
}
