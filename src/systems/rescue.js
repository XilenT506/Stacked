// Caught and rescue. A grown-up who grabs your last kid carries you off to the Lost & Found cage in the
// staff room (grabbed loose kids end up there too). A grown-up stands guard at it. A friend frees you by
// luring the guard away (any noise will do) and opening the gate with E: everyone inside comes out, you
// as one kid. Playing alone you have Spare Kids instead: a new kid walks in at the entrance and the
// caught one waits in the cage for you to fetch. The job ends only when every player is caught at once.
export class Rescue {
  constructor({ R, world, place, people, balance, solo = false, suspicion = null }) {
    this.R = R; this.world = world; this.D = place.data; this.C = place.data.lostAndFound; this.B = balance.rescue;
    this.people = people; this.sus = suspicion; this.solo = solo; this.spares = solo ? this.B.spareKids : 0;
    this.drop = this.C.drop; this.events = []; this.open = false; this.coats = [];
    if (people) people.ctx.rescue = this;
    // the bars: four sides, the gate is a gap in one side closed by its own bar
    const [x0, z0, x1, z1] = this.C.rect, h = this.C.height, t = 0.12, [gx0, gz0, gx1, gz1] = this.C.gate;
    this.bars = [];
    const bar = (ax, az, bx, bz) => {
      const along = Math.abs(bx - ax) > Math.abs(bz - az), len = Math.hypot(bx - ax, bz - az);
      const d = R.ColliderDesc.cuboid(along ? len / 2 : t / 2, h / 2, along ? t / 2 : len / 2).setTranslation((ax + bx) / 2, h / 2, (az + bz) / 2);
      const c = world.createCollider(d); this.bars.push({ seg: [ax, az, bx, bz], c }); return c;
    };
    bar(x0, z0, x1, z0); bar(x0, z0, x0, z1); bar(x1, z0, x1, z1);
    bar(x0, z1, gx0, z1); bar(gx1, z1, x1, z1);                       // the front, either side of the gate
    this.gateBar = bar(gx0, gz0, gx1, gz1); this.gateSeg = [gx0, gz0, gx1, gz1];
    people?.nav.addBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, 0, 0.32);
    this.warden = people?.add({ type: this.B.warden, at: this.C.guard, routine: 'cageWatch' });
    if (this.warden) this.warden.warden = true;
  }

  get gateAt() { const [a, b, c, d] = this.gateSeg; return { x: (a + c) / 2, z: (b + d) / 2 }; }
  inside() { const [x0, z0, x1, z1] = this.C.rect; return { x: (x0 + x1) / 2, z: (z0 + z1) / 2 }; }
  setGate(open) { this.open = open; this.gateBar.setEnabled(!open); this.events.push({ type: open ? 'gateOpen' : 'gateShut' }); }

  // a grown-up got hold of the last kid in this coat
  caught(coat, g) {
    if (!this.coats.includes(coat)) this.coats.push(coat);
    const kid = { id: coat.stack[0], x: coat.walker.feet.x, z: coat.walker.feet.z, vx: 0, vz: 0, t: 0, heading: 0, waiting: true, grace: 1, carriedBy: g };
    if (this.solo && this.spares > 0) {          // a Spare Kid takes over; the caught kid goes to the cage
      this.spares--;
      coat.loose.push(kid); g.carrying = kid;
      const [x, z] = this.D.spawns.players[0];
      this.respawn(coat, x, z, `spare${this.B.spareKids - this.spares}`);
      this.events.push({ type: 'spareKid', coat, left: this.spares });
    } else {                                        // the whole player is carried off
      kid.coat = coat; g.carrying = kid;
      coat.caught = g; coat.grabbedBy = g; coat.mods = { frozen: true }; coat.walker.collider.setEnabled(false);
      this.events.push({ type: 'caught', coat });
    }
    g.set('carry'); g.goal = { x: this.drop[0], z: this.drop[1] };
    this.checkAll();
  }

  // the grown-up got there: shut them in
  lockUp(k, g) {
    const p = this.inside();
    if (this.open) this.setGate(false);
    if (k.coat) {
      const c = k.coat; c.caught = null; c.grabbedBy = null; c.inCage = true; c.mods = {}; c.walker.collider.setEnabled(true);
      c.walker.body.setTranslation({ x: p.x, y: c.walker.half + c.walker.radius + 0.02, z: p.z }, true);
      this.events.push({ type: 'locked', coat: c });
    } else { k.caged = true; k.waiting = true; k.x = p.x + (Math.random() - 0.5); k.z = p.z + (Math.random() - 0.5) * 0.8; this.events.push({ type: 'locked', kid: k.id }); }
    this.checkAll();
  }

  // the grown-up slipped on the way: a carried player is free again, right there
  escape(k, g) {
    if (k.coat) { const c = k.coat, f = g.feet; c.caught = null; c.grabbedBy = null; c.mods = {}; c.walker.collider.setEnabled(true); c.walker.body.setTranslation({ x: f.x + 0.6, y: c.walker.half + c.walker.radius + 0.02, z: f.z }, true); this.events.push({ type: 'escaped', coat: c }); }
    else { k.waiting = false; k.t = 6; k.grace = 0.8; }
  }

  respawn(coat, x, z, id) {
    coat.stack = [id]; coat.wobble = 0; coat.mods = {}; coat.hidden = null; coat.grabbedBy = null; coat.caught = null; coat.inCage = false;
    coat.walker.collider.setEnabled(true); coat.applyHeight();
    coat.walker.body.setTranslation({ x, y: coat.walker.half + coat.walker.radius + 0.02, z }, true);
  }

  // E next to the closed gate: anyone outside the cage can open it (if the guard sees you, he knows)
  canOpen(coat) { if (this.open || coat.inCage || coat.caught) return false; const f = coat.walker.feet, g = this.gateAt; return Math.hypot(f.x - g.x, f.z - g.z) <= this.B.gateReach; }
  openBy(coat) {
    if (!this.canOpen(coat)) return false;
    this.setGate(true);
    if (this.warden && this.sus && coat.count > 1 && this.warden.sees(coat.walker.feet)) this.sus.bump(this.warden, coat, this.B.openSeen);
    // everyone inside comes out: caught players as one kid, caged kids wait just outside to be picked up
    const out = this.gateAt;
    for (const c of this.coats) if (c.inCage) { c.inCage = false; c.walker.body.setTranslation({ x: out.x, y: c.walker.half + c.walker.radius + 0.02, z: out.z + 0.9 }, true); this.events.push({ type: 'freed', coat: c, by: coat }); }
    for (const c of this.allCoats ?? []) for (const k of c.loose) if (k.caged) { k.caged = false; k.waiting = true; k.x = out.x + (Math.random() - 0.5) * 1.2; k.z = out.z + 1.2; this.events.push({ type: 'freed', kid: k.id, by: coat }); }
    return true;
  }

  // the run ends when every player is caught at the same time
  checkAll() {
    const all = this.allCoats ?? this.coats;
    if (all.length && all.every((c) => c.caught || c.inCage)) this.events.push({ type: 'allCaught' });
  }

  step(coats) { this.allCoats = coats; for (const c of coats) if (!this.coats.includes(c)) this.coats.push(c); }

  hint(coat) {
    if (coat.inCage) return this.solo ? 'Locked in the Lost & Found!' : 'Locked in the Lost & Found! A friend can lure the guard away and open the gate.';
    if (this.canOpen(coat)) return 'E: open the Lost & Found cage';
    return '';
  }

  take() { const e = this.events; this.events = []; return e; }
}
