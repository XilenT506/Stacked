// Where to go next, for one coat: the job's target loot while you don't hold it, the getaway gate once you
// do (in your arms or in a pocket). Nothing once the target is banked or the job is over. Works on the real
// Game and on a client's Mirror (both have loot.items with state, carriers and owner).
//   pointerFor(model, coat, placeData) -> { to: 'target' | 'gate', x, z, label } | null
export function targetItem(loot, placeData) {
  const id = placeData.job?.targetLoot; return id ? loot.items.find((it) => it.id === id) ?? null : null;
}

export function pointerFor(model, coat, placeData) {
  if (!coat || model.job?.over) return null;
  const it = targetItem(model.loot, placeData); if (!it || it.state === 'banked') return null;
  const held = (it.state === 'carried' && it.carriers.includes(coat)) || (it.state === 'pocket' && it.owner === coat);
  if (held) { const g = placeData.getaway.at; return { to: 'gate', x: g[0], z: g[1], label: 'GATE' }; }
  return { to: 'target', x: it.x, z: it.z, label: placeData.job.sign ?? it.name };
}

// the parts of the place everyone knows from the briefing: where the target is, and the getaway gate
export function briefedAreas(place) {
  const d = place.data, it = (d.loot?.list ?? []).find((e) => e.id === d.job?.targetLoot), out = [];
  if (it) { const a = place.areaAt(it.at[0], it.at[2]); if (a) out.push(a.id); }
  const g = place.areaAt(d.getaway.at[0], d.getaway.at[1]); if (g) out.push(g.id);
  return out;
}
