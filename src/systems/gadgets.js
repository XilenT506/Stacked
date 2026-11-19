// Prank gadgets, all from data/gadgets.json. Three ways to use one:
//   projectile: flies from the coat towards where you aim and hits the first thing in its way
//               (auto = keeps firing while held; charge = hold to wind up, let go to fire)
//   thrown:     an arc that lands and splashes everything in a radius
//   place:      put down in front of you; whoever steps on it gets the onTrigger
// What a hit does is data too: an effect (soaked, slipped, blinded, embarrassed), a knock, and signals.
// It works the same on grown-ups, on friends (friendly fire is always on), on loose kids and on things.
//   gadgets.arm(coat); every step: gadgets.use(coat, dt, input); gadgets.step(dt, coats)
const lerp = (r, k) => (Array.isArray(r) ? r[0] + (r[1] - r[0]) * k : r);

export class Gadgets {
  constructor(data, { R, world, signals, things = null, people = null, sus = null, balance = null }) {
    this.data = data; this.R = R; this.world = world; this.signals = signals; this.things = things; this.people = people; this.sus = sus;
    this.projectiles = []; this.items = []; this.events = []; this.seed = 7; this.counts = {};   // counts: hits by target, for tests
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  def(id) { const d = this.data.gadgets[id]; if (!d) throw new Error(`no gadget "${id}" in data/gadgets.json`); return d; }

  // give a coat its gadgets (full ammo): ids, or { id, copies } from the run (a second copy doubles the ammo)
  arm(coat, slots = this.data.loadout.slots) {
    const kit = slots.map((s) => (typeof s === 'string' ? { id: s, copies: 1 } : s)).filter((s) => this.data.gadgets[s.id]);
    coat.gadgets = { slots: kit.map((s) => s.id), i: 0, ammo: Object.fromEntries(kit.map((s) => [s.id, this.def(s.id).ammo * s.copies])), charge: 0, cool: 0, wasDown: false };
    return coat.gadgets;
  }

  current(coat) { const G = coat.gadgets; return G ? G.slots[G.i] : null; }

  // input: { fire: button held, select: slot index or null, cycle: +1/-1/0, aim: {x, z} }
  use(coat, dt, { fire = false, select = null, cycle = 0, aim = null } = {}) {
    const G = coat.gadgets; if (!G) return;
    if (select !== null && select < G.slots.length && select !== G.i) { G.i = select; G.charge = 0; }
    if (cycle) { G.i = (G.i + cycle + G.slots.length) % G.slots.length; G.charge = 0; }
    G.cool = Math.max(0, G.cool - dt);
    const id = G.slots[G.i], d = this.def(id), busy = coat.hidden || coat.grabbedBy;
    if (busy || (G.ammo[id] <= 0 && !(coat.superT > 0))) { G.wasDown = fire; G.charge = 0; return; }     // a Giggle Rush: endless ammo
    if (d.charge) {                               // hold to wind up, let go to fire
      if (fire) G.charge += dt;
      else if (G.wasDown && G.charge >= d.charge.min) { this.fire(coat, id, Math.min(1, G.charge / d.charge.full), aim); G.charge = 0; }
      else G.charge = 0;
    } else if (fire && G.cool <= 0 && (d.auto || !G.wasDown)) {
      this.fire(coat, id, 1, aim); G.cool = d.auto ? 1 / d.fireRate : d.cooldown ?? 0.3;
    }
    G.wasDown = fire;
  }

  fire(coat, id, power, aim) {
    const d = this.def(id), w = coat.walker, f = w.feet, G = coat.gadgets;
    if (!(coat.superT > 0)) G.ammo[id]--;
    const fw = aim && Math.hypot(aim.x, aim.z) > 0.01 ? aim : { x: Math.sin(w.yaw), z: Math.cos(w.yaw) }, l = Math.hypot(fw.x, fw.z), dir = { x: fw.x / l, z: fw.z / l };
    this.events.push({ type: 'fire', gadget: id, coat, power, sound: d.sound, at: { ...f } });
    if (d.mode === 'place') {
      const it = d.item, p = { x: f.x + dir.x * (it.ahead ?? 0.8), z: f.z + dir.z * (it.ahead ?? 0.8) };
      this.items.push({ n: (this.itemSeq = (this.itemSeq ?? 0) + 1), id, def: d, x: p.x, z: p.z, arm: it.arm ?? 0.5, uses: it.uses ?? 1, owner: coat });
      this.send(d.onPlace, p, id);
      return;
    }
    const P = d.projectile, sp = lerp(P.speed, power), spread = (this.rnd() - 0.5) * 2 * (P.spread ?? 0);
    const c = Math.cos(spread), s = Math.sin(spread), vx = (dir.x * c - dir.z * s) * sp, vz = (dir.x * s + dir.z * c) * sp;
    const h = (P.height ?? 1.2) * (w.height / 2.2);
    this.projectiles.push({ id, def: d, power, owner: coat, from: { x: f.x, z: f.z }, x: f.x + dir.x * 0.45, y: f.y + h, z: f.z + dir.z * 0.45, vx, vy: d.mode === 'thrown' ? lerp(P.lift ?? 3, power) : P.lift ?? 0, vz, life: P.life ?? 2 });
  }

  // send a hit's or a landing's signals
  send(spec, p, id) {
    for (const s of spec?.signals || []) {
      if (s.chance !== undefined && this.rnd() > s.chance) continue;
      this.signals?.emit({ type: s.type, position: { x: p.x, y: 0, z: p.z }, range: s.range, data: { color: s.color, event: 'gadget', gadget: id } });
    }
  }

  // who owns a collider: a grown-up, a coat, or an interactive thing
  owners(coats) {
    const m = new Map();
    for (const g of this.people?.list || []) m.set(g.walker.collider.handle, { kind: 'grownup', g });
    for (const c of coats) m.set(c.walker.collider.handle, { kind: 'coat', c });
    for (const t of this.things?.list || []) if (!t.gone) for (const col of t.colliders) m.set(col.handle, { kind: 'thing', t });
    return m;
  }

  step(dt, coats) {
    const own = this.projectiles.length ? this.owners(coats) : null;
    for (const p of this.projectiles) {
      p.life -= dt; p.vy -= (p.def.projectile.gravity ?? 0) * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt, len = Math.hypot(nx - p.x, ny - p.y, nz - p.z);
      // loose kids are not physics bodies: check them by distance
      const kid = this.kidHit(coats, p, nx, nz);
      const ray = new this.R.Ray({ x: p.x, y: p.y, z: p.z }, { x: (nx - p.x) / len, y: (ny - p.y) / len, z: (nz - p.z) / len });
      const hit = len > 1e-6 ? this.world.castRay(ray, len, true, undefined, undefined, p.owner.walker.collider) : null;
      if (kid) { this.hitKid(p, kid); p.dead = true; continue; }
      if (hit) {
        const toi = hit.toi ?? hit.timeOfImpact ?? 0, at = { x: p.x + ray.dir.x * toi, y: p.y + ray.dir.y * toi, z: p.z + ray.dir.z * toi };
        this.hit(p, own.get(hit.collider.handle), at, coats); p.dead = true; continue;
      }
      p.x = nx; p.y = ny; p.z = nz;
      if (p.y <= 0.02 || p.life <= 0) { this.land(p, { x: p.x, y: 0, z: p.z }, coats); p.dead = true; }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.stepItems(dt, coats);
  }

  kidHit(coats, p, nx, nz) {
    if (p.y > 1) return null;
    for (const c of coats) for (const k of c.loose) if (!k.carriedBy && Math.hypot(k.x - nx, k.z - nz) < 0.35) return { c, k };
    return null;
  }

  // what a hit does, by what was hit
  hit(p, who, at, coats = []) {
    const d = p.def, H = d.onHit || {}, dir = norm(p.vx, p.vz), knock = lerp(H.knock ?? 0, p.power);
    const effect = H.effect && p.power >= (H.effectFromCharge ?? 0) ? H.effect : null, secs = effect ? this.data.effects[effect].seconds : 0;
    const shooter = p.owner;
    if (!who) { this.land(p, at, coats); return; }
    if (who.kind === 'grownup') {
      const g = who.g;
      if (effect) g.applyEffect(effect, secs);
      g.walker.vel.x += dir.x * knock; g.walker.vel.z += dir.z * knock;
      g.struckFrom(shooter.walker.feet);
      // they may well have seen who did it
      if (this.sus && shooter.count > 1 && g.sees(shooter.walker.feet)) this.sus.bump(g, shooter, this.sus.S.gadgetHitSeen ?? 0.5);
      this.events.push({ type: 'hit', gadget: p.id, by: p.owner, from: p.from, target: 'grownup', who: g, effect, at });
    } else if (who.kind === 'coat') {        // friendly fire
      const c = who.c;
      if (effect) c.applyEffect(effect, secs);
      if (knock > 0) c.hit(knock);
      this.events.push({ type: 'hit', gadget: p.id, by: p.owner, from: p.from, target: 'coat', coat: c, effect, at });
    } else if (who.kind === 'thing') {
      const t = who.t; let toggled = false;
      if (t.body && t.def.body === 'dynamic' && !t.carried) {
        const m = t.body.mass(); t.body.applyImpulse({ x: dir.x * knock * m, y: knock * m * 0.3, z: dir.z * knock * m }, true);
      } else if (t.kind === 'machine' && t.def.use?.type === 'toggle' && knock >= 2) { this.things.use(t); toggled = true; }   // flip a switch from across the room
      this.events.push({ type: 'hit', gadget: p.id, by: p.owner, from: p.from, target: 'thing', thing: t, toggled, at });
    }
    this.send(H, at, p.id);
    if (d.mode === 'thrown') this.land(p, { x: at.x, y: 0, z: at.z }, coats);      // a balloon bursts on whatever it hits
  }

  hitKid(p, { c, k }) {
    const dir = norm(p.vx, p.vz), knock = lerp(p.def.onHit?.knock ?? 0, p.power);
    k.vx += dir.x * knock * 1.5; k.vz += dir.z * knock * 1.5; if (k.waiting) { k.waiting = false; k.t = 2; }
    this.events.push({ type: 'hit', gadget: p.id, by: p.owner, from: p.from, target: 'kid', coat: c, kid: k.id });
    this.send(p.def.onHit, { x: k.x, z: k.z }, p.id);
  }

  // a thrown gadget lands: everyone in its radius gets the onLand; a projectile that misses just splashes
  land(p, at, coats = []) {
    const L = p.def.onLand || {};
    if (L.radius) {
      const effect = L.effect, secs = effect ? this.data.effects[effect].seconds : 0;
      for (const g of this.people?.list || []) if (dist(g.feet, at) <= L.radius) { if (effect) g.applyEffect(effect, secs); g.struckFrom(at); this.events.push({ type: 'hit', gadget: p.id, by: p.owner, from: p.from, target: 'grownup', who: g, effect, at }); }
      for (const c of coats) if (dist(c.walker.feet, at) <= L.radius) { if (effect) c.applyEffect(effect, secs); this.events.push({ type: 'hit', gadget: p.id, by: p.owner, from: p.from, target: 'coat', coat: c, effect, at }); }
    }
    this.events.push({ type: 'land', gadget: p.id, by: p.owner, at });
    this.send(L, at, p.id);
  }

  // placed things (banana peels): whoever moves over one gets its onTrigger
  stepItems(dt, coats) {
    for (const it of this.items) {
      it.arm -= dt; if (it.arm > 0 || it.uses <= 0) continue;
      const T = it.def.onTrigger || {}, r = it.def.item.radius ?? 0.45, effect = T.effect, secs = effect ? this.data.effects[effect].seconds : 0;
      const trigger = (who, vel) => { it.uses--; const dir = norm(vel.x, vel.z); this.send(T, it, it.id); this.events.push({ type: 'trigger', gadget: it.id, ...who, at: { x: it.x, z: it.z }, dir }); return dir; };
      for (const g of this.people?.list || []) {
        if (it.uses <= 0) break;
        if (g.walker.flatSpeed < 0.5 || dist(g.feet, it) > r) continue;
        const dir = trigger({ target: 'grownup', who: g }, g.walker.vel);
        if (effect) g.applyEffect(effect, secs);
        g.walker.vel.x += dir.x * (T.knock ?? 0); g.walker.vel.z += dir.z * (T.knock ?? 0);
      }
      for (const c of coats) {
        if (it.uses <= 0) break;
        if (c.walker.flatSpeed < 0.5 || dist(c.walker.feet, it) > r) continue;
        trigger({ target: 'coat', coat: c }, c.walker.vel);
        if (effect) c.applyEffect(effect, secs);
      }
      for (const c of coats) for (const k of c.loose) {
        if (it.uses <= 0 || k.carriedBy || Math.hypot(k.vx, k.vz) < 0.5 || Math.hypot(k.x - it.x, k.z - it.z) > r) continue;
        const dir = trigger({ target: 'kid', coat: c, kid: k.id }, { x: k.vx, z: k.vz }); k.vx += dir.x * 3; k.vz += dir.z * 3;
      }
    }
    this.items = this.items.filter((it) => it.uses > 0);
  }

  take() { const e = this.events; for (const x of e) if (x.type === 'hit' || x.type === 'trigger') this.counts[x.target] = (this.counts[x.target] ?? 0) + 1; this.events = []; return e; }
}

const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
