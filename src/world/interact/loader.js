// Builds interactive things from data/interactables.json and runs them every physics step.
//   const things = new Things(R, world, signals, data, { mess, spots, balance });
//   things.spawn('tin', [x, y, z]);  ...  every step, after world.step(): things.step(dt);
// A def with "pyramid" builds a stack of another thing (a tin pyramid) instead of one body.
import { Thing } from './thing.js';
import { KINDS } from './kinds.js';

export class Things {
  constructor(R, world, signals, data, { mess = null, spots = {}, balance = null } = {}) {
    this.R = R; this.world = world; this.signals = signals; this.defs = data.things;
    this.mess = mess; this.spots = spots;
    this.slip = balance?.things ?? { slipBoost: 1.5, slipMinSpeed: 0.6 };
    for (const [name, d] of Object.entries(this.defs)) {
      if (!KINDS[d.kind]) throw new Error(`"${name}" has unknown kind "${d.kind}" (expected one of ${Object.keys(KINDS).join(', ')})`);
    }
    this.list = []; this.groups = [];
    this.onSpawn = null;          // called with every new thing (the renderer adds a mesh)
    this.onSound = null;          // called with (sound name, position)
    this.announce = null;         // called with the tannoy's text
  }

  spawn(name, pos, opts = {}) {
    const def = this.defs[name];
    if (!def) throw new Error(`no interactable called "${name}" in data/interactables.json`);
    if (def.pyramid) return this.pyramid(name, def, pos, opts);
    const t = new Thing(this.R, this.world, def, name, pos, opts);
    KINDS[def.kind].init?.(t);
    this.list.push(t); this.onSpawn?.(t);
    return t;
  }

  // a pyramid of rows; the bottom row is `rows` long, lined up across the facing direction
  pyramid(name, def, pos, opts) {
    const of = this.defs[def.pyramid.of], r = of.shape.radius, h = of.shape.height, gap = r * 2 + 0.01, rows = opts.rows ?? def.pyramid.rows;
    const yaw = opts.yaw || 0, sx = Math.cos(yaw), sz = -Math.sin(yaw), g = { name, def, kind: def.kind, parts: [], position: { x: pos[0], y: 0, z: pos[2] } };
    for (let row = 0; row < rows; row++) for (let i = 0; i < rows - row; i++) {
      const o = (i - (rows - 1 - row) / 2) * gap;
      g.parts.push(this.spawn(def.pyramid.of, [pos[0] + sx * o, (pos[1] || 0) + row * (h + 0.002), pos[2] + sz * o]));
    }
    g.start = g.parts.map((t) => ({ ...t.position }));
    this.groups.push(g);
    return g;
  }

  sound(t) { if (t.def.sound) this.onSound?.(t.def.sound, t.position ?? t.body?.translation()); }

  use(t) { return KINDS[t.kind].use?.(t, this); }

  // the nearest thing within reach that `pick(t)` accepts
  nearest(p, reach, pick = () => true) {
    let best = null, bd = Infinity;
    for (const t of this.list) {
      if (t.gone || !pick(t)) continue;
      const d = this.distance(t, p);
      if (d < bd && d <= reach) { best = t; bd = d; }
    }
    return best;
  }

  // a tin pyramid is wobbly: once any tin is knocked out of place the whole thing comes down with a crash
  stepGroups() {
    for (const g of this.groups) {
      if (g.fallen || !g.def.pyramid) continue;
      const moved = g.parts.some((t, i) => !t.gone && Math.hypot(t.position.x - g.start[i].x, t.position.z - g.start[i].z) > (g.def.pyramid.collapseAt ?? 0.03));
      if (!moved) continue;
      g.fallen = true;
      this.signals.emit({ type: 'crash', position: g.position, source: g, range: g.def.pyramid.range ?? 12, data: { event: 'pyramid crash' } });
      this.sound(g);
      g.parts.forEach((t, i) => {               // the top rows tumble outwards
        if (t.gone || g.start[i].y < 0.2) return;
        const a = i * 2.39996;
        t.body.applyImpulse({ x: Math.sin(a) * 0.6, y: 0.1, z: Math.cos(a) * 0.6 }, true);
      });
    }
  }

  // flat distance from p to a thing; long boxes (a till belt) count from their edge, not their middle
  distance(t, p) {
    const q = t.position, dx = p.x - q.x, dz = p.z - q.z, sh = t.def.shape;
    if (sh?.type !== 'box') return Math.hypot(dx, dz);
    const c = Math.cos(t.yaw), s = Math.sin(t.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.hypot(Math.max(0, Math.abs(lx) - sh.size[0] / 2), Math.max(0, Math.abs(lz) - sh.size[2] / 2));
  }

  // after world.step(): impacts, machines that are on, and things skidding on the mess
  step(dt) {
    this.stepGroups();
    for (const t of this.list) {
      if (t.gone) continue;
      KINDS[t.kind].tick?.(t, this, dt);
      const speed = t.checkImpact(dt);
      if (speed) KINDS[t.kind].onImpact?.(t, this, speed);
      if (!t.gone && this.mess && t.def.body === 'dynamic' && !t.carried) this.slipCheck(t);
    }
  }

  // a moving thing that reaches a slippery patch loses all grip and shoots off faster: a slip
  slipCheck(t) {
    const p = t.position, on = this.mess.slipperyAt(p.x, p.z) && p.y < 0.6;
    if (on && !t.slipping) {
      const v = t.body.linvel(), sp = Math.hypot(v.x, v.z);
      if (sp < this.slip.slipMinSpeed) return;
      t.setSlipping(true);
      // whoosh: at least slipKick m/s in the direction it was going
      const k = Math.max(this.slip.slipBoost, (this.slip.slipKick ?? 0) / sp);
      t.body.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
      this.signals.emit({ type: 'noise', position: p, source: t, range: 6, data: { event: 'slip' } });
      this.onSound?.('slip_whee', p);
    } else if (!on && t.slipping) t.setSlipping(false);
  }
}
