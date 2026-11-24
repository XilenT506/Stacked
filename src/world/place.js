// Builds a place (data/places/<name>.json) into the physics world: the ground, walls, fences and fixed
// furniture. Returns what the renderer and the game need: the fixed boxes, area floors, and helpers.
// Everything about the layout lives in the JSON; this file only turns it into colliders.
const WALL_T = 0.3;
const SOLID_COLORS = { shelf: '#c7d6cf', sweetshelf: '#f2b8c6', freezer: '#a9cfe0', till: '#8fa3b0', counter: '#d9b38c', oven: '#9a8f87',
  crate: '#b88a5a', table: '#b79268', sofa: '#7f9fc9', lockers: '#8e9a8a', rack: '#9aa7b0', pallet: '#c9a46b', bin: '#4f6b4a',
  van: '#f0f0ea', car: '#c4553d', trolleybay: '#7d8a92' };

export const rectsOf = (a) => a.rects || [a.rect];
const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
const rectArea = (r) => (r[2] - r[0]) * (r[3] - r[1]);

export function buildPlace(R, world, data) {
  const statics = [];
  const box = (size, pos, color, fade = false, kind = null, invisible = false) => {
    world.createCollider(R.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(pos[0], pos[1], pos[2]).setFriction(0.7));
    statics.push({ size, pos, color, fade, kind, invisible });
  };
  // the ground (one collider), drawn as area floors
  const [gx0, gz0, gx1, gz1] = data.ground.rect;
  box([gx1 - gx0, 0.2, gz1 - gz0], [(gx0 + gx1) / 2, -0.1, (gz0 + gz1) / 2], data.ground.color, false, 'ground');
  // walls: axis-aligned segments, the gaps between them are the doors (a group marked invisible is a wall
  // nobody sees: the edge of the map behind the getaway gate)
  for (const [name, group] of Object.entries(data.walls)) {
    if (name.startsWith('_')) continue;
    for (const [x0, z0, x1, z1] of group.list) {
      const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = Math.hypot(x1 - x0, z1 - z0) + WALL_T;
      box(along ? [len, group.h, WALL_T] : [WALL_T, group.h, len], [(x0 + x1) / 2, group.h / 2, (z0 + z1) / 2], group.color, group.h > 1.5 && !group.invisible, name, !!group.invisible);
    }
  }
  // fixed furniture: [x, z, width, height, depth, kind]; anything taller than a coat's waist fades when it hides a player
  for (const [x, z, w, h, d, kind] of data.solids.list) box([w, h, d], [x, h / 2, z], SOLID_COLORS[kind] || '#cccccc', h > 1.2, kind);

  const areas = data.areas;
  // which area a point is in (the smallest one that holds it, so a corner inside a bigger area wins)
  const areaAt = (x, z) => {
    let best = null, bestA = Infinity;
    for (const a of areas) for (const r of rectsOf(a)) if (inRect(r, x, z) && rectArea(r) < bestA) { best = a; bestA = rectArea(r); }
    return best;
  };
  const center = (id) => { const r = rectsOf(areas.find((a) => a.id === id))[0]; return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; };
  return { data, statics, areas, areaAt, center, slippery: data.slippery.list, bounds: data.bounds };
}

// put the place's interactive things (and its hiding spots) into the world
export function spawnThings(place, things) {
  const D = place.data, out = [];
  const at = (a) => (a.length === 2 ? [a[0], 0, a[1]] : a);
  for (const e of D.things?.list || []) {
    const p = at(e.at), opts = { yaw: (e.yaw || 0) * Math.PI / 180, rows: e.rows };
    out.push(things.spawn(e.thing, p, opts));
  }
  for (const h of D.hiding.list) if (things.defs[h.thing]) out.push(things.spawn(h.thing, [h.at[0], 0, h.at[1]], { yaw: h.yaw ? h.yaw * Math.PI / 180 : 0 }));
  return out;
}
