// Loot: small pieces go in your pockets, big ones are carried in your arms (slow and wobbly alone,
// easier with two coats carrying together). Dropping loot (on purpose, when a kid falls out, when a
// grown-up grabs you) costs some of its value. Bring it to the getaway gate to bank it for the job.
// Each kid in the coat holds its share of the pockets (it.kid): a kid who falls out drops its sweets on the
// floor right next to where it lands, ready to pocket again (M1-F8; never back on the shelves).
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

  // the loot E would act on for this coat (or null): your carried piece first, then what's in reach, the one in
  // front of the coat before one behind it, and small before big (M1-F11: E grabbed the giant lolly instead of
  // the chocolate right in front)
  near(coat) {
    const c = this.carried(coat); if (c) return c;
    const f = coat.walker.feet, fx = Math.sin(coat.walker.yaw ?? 0), fz = Math.cos(coat.walker.yaw ?? 0); let best = null, bd = Infinity;
    for (const it of this.items) {
      const free = it.state === 'lying' || (it.state === 'carried' && it.kind === 'big' && it.carriers.length === 1);
      if (!free) continue;
      if (it.kind === 'small' && this.pockets(coat).length >= this.L.pockets) continue;
      if (it.kind === 'big' && it.state === 'lying' && this.carried(coat)) continue;
      const d = Math.hypot(it.x - f.x, it.z - f.z); if (d >= this.L.reach) continue;
      const behind = d > 0.2 && ((it.x - f.x) * fx + (it.z - f.z) * fz) / d < 0.3;
      const score = d + (behind ? 1 : 0) + (it.kind === 'big' ? 0.4 : 0);
      if (score < bd) { best = it; bd = score; }
    }
    return best;
  }

  hint(coat) {
    const it = this.near(coat), full = this.pockets(coat).length >= this.L.pockets;
    if (full && (!it || it.kind === 'big') && this.smallInReach(coat)) return `Pockets full (${this.L.pockets} of ${this.L.pockets}): bank them at the getaway gate`;
    if (!it) return '';
    // carrying big loot with small loot in reach: say why E won't pocket it
    if (it.state === 'carried' && it.carriers.includes(coat) && this.smallInReach(coat)) return `Hands full: drop the ${lower(it.name)} first (E)`;
    if (it.state === 'carried' && it.carriers.includes(coat)) return `${it.name} (${it.value}): E put it down${it.carriers.length > 1 ? ' (you are carrying it together)' : ''}`;
    if (it.state === 'carried') return `E: help carry ${the(it.name)}`;
    return `E: ${it.kind === 'small' ? 'pocket' : 'pick up'} ${the(it.name)} (${it.value} sweets)`;
  }

  smallInReach(coat) {
    const f = coat.walker.feet;
    return this.items.some((o) => o.kind === 'small' && o.state === 'lying' && Math.hypot(o.x - f.x, o.z - f.z) < this.L.reach);
  }

  // E on loot; returns true when loot used the key press
  press(coat) {
    const it = this.near(coat); if (!it) return false;
    if (it.state === 'carried' && it.carriers.includes(coat)) { this.drop(it, 'put down', coat); return true; }
    if (it.kind === 'small') { it.state = 'pocket'; it.owner = coat; it.kid = this.emptiestKid(coat); this.events.push({ type: 'pocket', item: it, coat }); return true; }
    if (it.state === 'carried') { it.carriers.push(coat); this.events.push({ type: 'coCarry', item: it, coat }); this.load(it); return true; }
    it.state = 'carried'; it.carriers = [coat]; this.load(it); this.events.push({ type: 'carry', item: it, coat });
    return true;
  }

  // how heavy the piece is for each carrier: slower and wobblier, shared between two
  load(it) {
    for (const c of it.carriers) {
      const kg = it.mass / it.carriers.length;
      c.carryKg = kg; c.carrySilly = true; c.carrySpeedMul = Math.max(this.L.minSpeed, 1 - kg * this.L.perKg);
      c.coCarry = it.carriers.length > 1;                                  // carrying together is steadier (src/entities/coat.js)
    }
  }
  unload(c) { c.carryKg = 0; c.carrySpeedMul = 1; c.carrySilly = false; c.coCarry = false; }

  // the kid in the coat with the fewest sweets in its pockets
  emptiestKid(coat) {
    const n = (k) => this.pockets(coat).filter((it) => it.kid === k).length;
    return coat.stack.reduce((best, k) => (best === null || n(k) < n(best) ? k : best), null);
  }

  // kids who left the stack (fell out, or were grabbed) drop their sweets around where they landed
  kidsLeft(c, before) {
    const gone = before.filter((k) => !c.stack.includes(k) && !c.pile?.kids.includes(k));
    for (const id of gone) {
      const kid = c.loose.find((k) => k.id === id), mine = this.pockets(c).filter((it) => it.kid === id);
      if (!kid || !mine.length) continue;                   // (a Spare Kid replacing a caught one is not a fall)
      const at = kid; let total = 0;
      mine.forEach((it, i) => {
        total += it.value;                                   // what leaves "Holding" (the HUD line drops by this much)
        this.drop(it, 'a kid fell out', c);
        const a = i * 2.4 + 0.5; it.x = at.x + Math.sin(a) * 0.45; it.z = at.z + Math.cos(a) * 0.45; it.y = 0; it.kid = null;
      });
      c.whyDropped = (c.whyDropped ?? 0) + total;
      this.events.push({ type: 'kidDrop', coat: c, kid: id, items: mine, value: total });
    }
  }

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
      if (c._lootStack && !c.grabbedBy && !c.caught) this.kidsLeft(c, c._lootStack);
      c._lootStack = c.stack.slice();
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

// "the big chocolate bar", but "Nan's birthday cake" keeps its capital and needs no "the" (M1-F11)
const own = (name) => /^[A-Z][a-z]*'s /.test(name);
const lower = (name) => (own(name) ? name : name[0].toLowerCase() + name.slice(1));
const the = (name) => (own(name) ? name : 'the ' + lower(name));
