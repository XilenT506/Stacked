// Loot: small pieces go in your pockets, big ones are carried in your arms (slow and wobbly alone,
// easier with two coats carrying together). Dropping loot (on purpose, when a kid falls out, when a
// grown-up grabs you) costs some of its value. Bring it to the getaway gate to bank it for the job.
//   loot.near(coat) / loot.press(coat): what E does with loot; every step: loot.step(dt, coats)
export class Loot {
  constructor(place, looks, balance) {
    this.L = balance.loot; this.events = [];
    this.gate = place.data.getaway;
    this.items = place.data.loot.list.map((e, i) => ({
      n: i, id: e.id, kind: e.kind, base: e.value, value: e.value, name: looks.items[e.id]?.name ?? e.id, look: looks.items[e.id] ?? {},
      mass: looks.items[e.id]?.mass ?? 0, x: e.at[0], y: e.at[1], z: e.at[2], state: 'lying', carriers: [], owner: null, drops: 0,
    }));
  }

  pockets(coat) { return this.items.filter((it) => it.state === 'pocket' && it.owner === coat); }
  carried(coat) { return this.items.find((it) => it.state === 'carried' && it.carriers.includes(coat)) || null; }
  get banked() { return this.items.filter((it) => it.state === 'banked'); }
  get bankedValue() { return this.banked.reduce((a, it) => a + it.value, 0); }
  inHand(coats) { return this.items.filter((it) => (it.state === 'pocket' || it.state === 'carried')).reduce((a, it) => a + it.value, 0); }

  // the loot E would act on for this coat (or null): your carried piece first, then the nearest in reach
  near(coat) {
    const c = this.carried(coat); if (c) return c;
    const f = coat.walker.feet; let best = null, bd = this.L.reach;
    for (const it of this.items) {
      const free = it.state === 'lying' || (it.state === 'carried' && it.kind === 'big' && it.carriers.length === 1);
      if (!free) continue;
      if (it.kind === 'small' && this.pockets(coat).length >= this.L.pockets) continue;
      if (it.kind === 'big' && it.state === 'lying' && this.carried(coat)) continue;
      const d = Math.hypot(it.x - f.x, it.z - f.z); if (d < bd) { best = it; bd = d; }
    }
    return best;
  }

  hint(coat) {
    const it = this.near(coat); if (!it) return '';
    if (it.state === 'carried' && it.carriers.includes(coat)) return `${it.name} (${it.value}): E put it down${it.carriers.length > 1 ? ' (you are carrying it together)' : ''}`;
    if (it.state === 'carried') return `E: help carry the ${it.name.toLowerCase()}`;
    return `E: ${it.kind === 'small' ? 'pocket' : 'pick up'} the ${it.name.toLowerCase()} (${it.value} sweets)`;
  }

  // E on loot; returns true when loot used the key press
  press(coat) {
    const it = this.near(coat); if (!it) return false;
    if (it.state === 'carried' && it.carriers.includes(coat)) { this.drop(it, 'put down', coat); return true; }
    if (it.kind === 'small') { it.state = 'pocket'; it.owner = coat; this.events.push({ type: 'pocket', item: it, coat }); return true; }
    if (it.state === 'carried') { it.carriers.push(coat); this.events.push({ type: 'coCarry', item: it, coat }); this.load(it); return true; }
    it.state = 'carried'; it.carriers = [coat]; this.load(it); this.events.push({ type: 'carry', item: it, coat });
    return true;
  }

  // how heavy the piece is for each carrier: slower and wobblier, shared between two
  load(it) {
    for (const c of it.carriers) {
      const kg = it.mass / it.carriers.length;
      c.carryKg = kg; c.carrySilly = true; c.carrySpeedMul = Math.max(this.L.minSpeed, 1 - kg * this.L.perKg);
    }
  }
  unload(c) { c.carryKg = 0; c.carrySpeedMul = 1; c.carrySilly = false; }

  // dropped loot loses some value (never below minValue of what it was worth)
  drop(it, why, coat = null) {
    for (const c of it.carriers) this.unload(c);
    const f = (coat ?? it.carriers[0] ?? it.owner)?.walker.feet;
    if (f && it.state !== 'lying') { const fw = coat?.walker ?? it.carriers[0]?.walker; const y = fw?.yaw ?? 0; it.x = f.x + Math.sin(y) * 0.6; it.z = f.z + Math.cos(y) * 0.6; it.y = 0; }
    it.state = 'lying'; it.carriers = []; it.owner = null; it.drops++;
    it.value = Math.max(Math.round(it.base * this.L.minValue), Math.round(it.value * (1 - this.L.dropLoss)));
    this.events.push({ type: 'drop', item: it, why });
  }

  step(dt, coats) {
    for (const c of coats) {
      // a kid falling out, or a grown-up grabbing you, makes you drop what you carry (and a pocketful when grabbed)
      const spilled = (c.events || []).some((e) => e.type === 'stumble') || c.count < (c._lootCount ?? c.count);
      c._lootCount = c.count;
      const big = this.carried(c);
      if (big && (spilled || c.grabbedBy || c.count < 1)) this.drop(big, spilled ? 'a kid fell out' : 'grabbed', c);
      if (c.grabbedBy && !c._lootGrabbed) { const p = this.pockets(c); if (p.length) this.drop(p[p.length - 1], 'grabbed', c); }
      c._lootGrabbed = !!c.grabbedBy;
    }
    // carried loot rides between its carriers; two carriers who pull apart drop it
    for (const it of this.items) {
      if (it.state === 'carried') {
        const ps = it.carriers.map((c) => c.walker.feet);
        if (ps.length === 2 && Math.hypot(ps[0].x - ps[1].x, ps[0].z - ps[1].z) > this.L.coCarryDistance) { this.drop(it, 'pulled apart'); continue; }
        const c0 = it.carriers[0], y = c0.walker.yaw;
        it.x = ps.reduce((a, p) => a + p.x, 0) / ps.length + (ps.length === 1 ? Math.sin(y) * 0.55 : 0);
        it.z = ps.reduce((a, p) => a + p.z, 0) / ps.length + (ps.length === 1 ? Math.cos(y) * 0.55 : 0);
        it.y = 0.9 * (c0.state?.height ?? 2.2) / 2.2;
      } else if (it.state === 'pocket') { const f = it.owner.walker.feet; it.x = f.x; it.z = f.z; }
    }
    // the getaway gate: everything in pockets and arms is banked
    for (const c of coats) {
      const f = c.walker.feet;
      if (Math.hypot(f.x - this.gate.at[0], f.z - this.gate.at[1]) > this.gate.radius) { c.atGate = false; continue; }
      c.atGate = true;
      for (const it of [...this.pockets(c), ...(this.carried(c) ? [this.carried(c)] : [])]) {
        if (it.state === 'carried') for (const k of it.carriers) this.unload(k);
        it.state = 'banked'; it.carriers = []; it.owner = null;
        this.events.push({ type: 'bank', item: it, coat: c });
      }
    }
  }

  take() { const e = this.events; this.events = []; return e; }
}
