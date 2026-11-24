// The world has no holes (M1-F8): nothing that walks (a coat, a grown-up) may cross a wall's centre line or
// leave the place's bounds. The physics already keeps walkers out of walls; this is the safety net for the
// odd case where it doesn't (low frame rates, a hard shove), which once put two coats outside the shop and a
// shopper far off the map. A walker that walks through a wall or out of the bounds goes back to where it
// was a moment ago.
//   const edges = new WorldEdges(place.data); every step after the physics: edges.keep(walker)
const TELEPORT = 1.5;          // a jump longer than this in one step is a teleport (respawn, carried off), not a walk

export class WorldEdges {
  constructor(data) {
    this.b = data.bounds;
    this.walls = Object.entries(data.walls).filter(([k]) => !k.startsWith('_')).flatMap(([, g]) => g.list);
  }

  // does the step from a to b cross any wall's centre line?
  crosses(a, b) {
    for (const [x0, z0, x1, z1] of this.walls) {
      const d = (b.x - a.x) * (z1 - z0) - (b.z - a.z) * (x1 - x0); if (Math.abs(d) < 1e-9) continue;
      const t = ((x0 - a.x) * (z1 - z0) - (z0 - a.z) * (x1 - x0)) / d, u = ((x0 - a.x) * (b.z - a.z) - (z0 - a.z) * (b.x - a.x)) / d;
      if (t > 0 && t <= 1 && u >= 0 && u <= 1) return true;
    }
    return false;
  }

  inside(p) { return p.x > this.b[0] && p.x < this.b[2] && p.z > this.b[1] && p.z < this.b[3]; }

  // put the walker back if it walked somewhere it can't be (through a wall, off the map); returns true if
  // it had to. A long jump in one step is a teleport (respawn, carried off, a test parking someone) and is left alone.
  keep(w) {
    if (!w.collider.isEnabled()) return false;                   // (a couch player waiting for the next job)
    const p = w.position, f = { x: p.x, z: p.z }, last = w.lastSafe;
    const walked = last && Math.hypot(f.x - last.x, f.z - last.z) < TELEPORT;
    if (!walked || (this.inside(f) || !this.inside(last)) && !this.crosses(last, f)) { w.lastSafe = f; return false; }
    w.body.setTranslation({ x: last.x, y: w.half + w.radius + 0.05, z: last.z }, true); w.vel.x = w.vel.z = 0;
    return true;
  }
}
