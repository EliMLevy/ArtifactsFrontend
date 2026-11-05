// Locally cached resource catalog (data/resources.json, committed to the repo).
let loaded = false;

/** resource code -> full resource schema ({ name, code, skill, level, drops }) */
export const resourceByCode = new Map();

/**
 * Reverse drop index: item code -> [{ code, rate }] of the resources that
 * drop it, rarest first (matching how the API lists drops).
 */
export const droppedByResource = new Map();

export async function loadResourceCatalog() {
  if (loaded) return;
  const url = new URL("../data/resources.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Resource catalog failed to load (HTTP ${res.status})`);
  const resources = await res.json();
  for (const r of resources) {
    if (!r || !r.code) continue;
    resourceByCode.set(r.code, r);
    for (const d of r.drops || []) {
      if (!d || !d.code) continue;
      if (!droppedByResource.has(d.code)) droppedByResource.set(d.code, []);
      droppedByResource.get(d.code).push({ code: r.code, rate: d.rate });
    }
  }
  for (const list of droppedByResource.values()) {
    list.sort((a, b) => (b.rate || 0) - (a.rate || 0));
  }
  loaded = true;
}
