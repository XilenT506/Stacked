// One player's coat: three kids stacked inside a trench coat. Your health is your height.
//   3 kids: a tall grown-up · 2 kids: a short grown-up · 1 kid: just a kid (fast, no disguise)
// The wobble bar fills when you run, carry, turn sharply, get hit or walk on something slippery.
// When it is full the top kid falls out and runs around squeaking for 10 seconds; walk over a loose kid
// to stack them back in. R unstacks on purpose (the coat lies on the floor like laundry with two kids
// hiding in it, and you go on as one fast kid) and, back at the pile, R stacks up again.
// All numbers come from data/balance.json.
import { Walker } from './walker.js';

let kidSeq = 0;

export class Coat {
  constructor(R, world, signals, balance, pos = [0, 0, 0], kids = ['sid', 'mo', 'tank']) {
    this.B = balance; this.signals = signals;
    this.stack = kids.slice();            // bottom first: [bottom, middle, top]
    this.walker = new Walker(R, world, pos, { height: balance.heights['3'].height, speed: balance.heights['3'].speed, runMul: balance.run.speedMultiplier });
    this.wobble = 0; this.loose = []; this.pile = null; this.patches = []; this.carryKg = 0;
    this.stunned = 0; this.events = [];                         // what happened this step (for sounds and tests)
    this.time = 0;
    // slippery signals leave a slippery patch on the floor for a while
    if (signals) signals.listen({ types: ['slippery'], everywhere: true, hear: (s) => this.patches.push({ x: s.position.x, z: s.position.z, r: Math.max(0.6, Math.min(3, s.range)), until: this.time + this.B.slippery.patchSeconds }) });
    this.applyHeight();
  }

  get count() { return this.stack.length; }
  get state() { return this.B.heights[String(this.count)]; }
  get position() { return this.walker.position; }
  get unstacked() { return !!this.pile; }
  get disguise() { return this.state.disguise; }

  applyHeight() {
    const h = this.state;
    if (Math.abs(this.walker.height - h.height) > 1e-3) this.walker.setHeight(h.height);
    this.walker.speed = h.speed;
  }

  onSlippery() {
    const f = this.walker.feet;
    this.patches = this.patches.filter((p) => p.until > this.time);
    return this.patches.some((p) => Math.hypot(p.x - f.x, p.z - f.z) <= p.r);
  }

  // a hit with a force (Newton-ish, 1 = a nudge, 6+ = a proper whack)
  hit(force) {
    this.events.push({ type: 'hit', force });
    if (force >= this.B.wobble.spillHitForce) this.spill();
    else this.wobble = Math.min(1, this.wobble + force * this.B.wobble.hitPerForce);
  }

  // the top kid falls out
  spill() {
    if (this.count <= 1) { this.stunned = 0.8; this.wobble = this.B.wobble.afterSpill; this.events.push({ type: 'stumble' }); return null; }
    const id = this.stack.pop(), p = this.walker.position, a = (kidSeq++ * 2.4) % (Math.PI * 2);
    const kid = { id, x: p.x + Math.sin(a) * 1.1, z: p.z + Math.cos(a) * 1.1, vx: Math.sin(a) * this.B.looseKid.spillSpeed, vz: Math.cos(a) * this.B.looseKid.spillSpeed, t: this.B.looseKid.seconds, heading: a, waiting: false, grace: 1 };   // can't be picked up in the first second
    this.loose.push(kid);
    this.wobble = this.B.wobble.afterSpill;
    this.applyHeight();
    this.events.push({ type: 'spill', kid: id });
    this.signals?.emit({ type: 'noise', position: p, source: this });
    return kid;
  }

  // things flying into the coat: a fast melon is a whack, a rolling tin a nudge
  checkHits(world) {
    this.hitCool ??= new Map();
    for (const [h, t] of this.hitCool) if (t <= this.time) this.hitCool.delete(h);
    world.contactPairsWith(this.walker.collider, (other) => {
      const b = other.parent(); if (!b || !b.isDynamic() || this.hitCool.has(b.handle)) return;
      const v = b.linvel(), rel = Math.hypot(v.x - this.walker.vel.x, v.y, v.z - this.walker.vel.z);
      if (rel < 3) return;
      this.hitCool.set(b.handle, this.time + 0.5);
      this.hit(rel * Math.min(b.mass(), 10) / 2);
    });
  }

  // R: unstack into a laundry pile, or stack back up at the pile
  toggleStack() {
    const p = this.walker.feet;
    if (this.pile) {
      if (Math.hypot(this.pile.x - p.x, this.pile.z - p.z) > this.B.unstack.restackRadius) { this.events.push({ type: 'tooFar' }); return false; }
      this.stack = [...this.pile.kids, ...this.stack].slice(0, 3); this.pile = null; this.applyHeight();
      this.events.push({ type: 'restack' }); return true;
    }
    if (this.count < 2) return false;
    const top = this.stack.pop();
    this.pile = { x: p.x, z: p.z, yaw: this.walker.yaw, kids: this.stack.slice() };
    this.stack = [top]; this.wobble = 0; this.applyHeight();
    this.events.push({ type: 'unstack' }); return true;
  }

  step(dt, move, run, face, actNatural = false) {
    this.time += dt; this.events = [];
    const B = this.B.wobble, slip = this.onSlippery();
    this.walker.grip = slip ? this.B.slippery.grip : 1;
    if (this.stunned > 0) { this.stunned -= dt; move = { x: 0, z: 0 }; }
    this.walker.step(dt, move, run, face);
    // wobble: fills with running, carrying, sharp turns and slippery floors; drains when calm
    const sp = this.walker.flatSpeed, moving = sp > 0.5;
    let fill = 0;
    if (run && moving) fill += B.runFill;
    if (this.carryKg && moving) fill += B.carryFillPerKg * this.carryKg;
    if (slip && moving) fill += B.slipperyFill;
    if (this.walker.turnRate > 4 && moving) fill += B.turnFill * this.walker.turnRate / 4;
    const scale = this.count === 3 ? 1 : this.count === 2 ? 0.7 : 0.3;     // a shorter stack is steadier
    if (fill > 0) this.wobble += fill * scale * dt;
    else this.wobble -= (actNatural ? B.actNaturalDrain : B.calmDrain) * dt;
    this.wobble = Math.max(0, Math.min(1, this.wobble));
    if (this.wobble >= 1) this.spill();
    this.stepLoose(dt);
  }

  // loose kids run around squeaking, then wait; walk over one to stack it back in
  stepLoose(dt) {
    const p = this.walker.feet, L = this.B.looseKid;
    for (const k of this.loose) {
      k.grace = Math.max(0, k.grace - dt);
      if (!k.waiting) {
        k.t -= dt;
        k.heading += Math.sin(this.time * 3 + k.x) * dt * 3;          // zig-zag
        const want = { x: Math.sin(k.heading) * L.speed, z: Math.cos(k.heading) * L.speed };
        k.vx += (want.x - k.vx) * Math.min(1, dt * 3); k.vz += (want.z - k.vz) * Math.min(1, dt * 3);
        k.x += k.vx * dt; k.z += k.vz * dt;
        if (k.t <= 0) { k.waiting = true; k.vx = k.vz = 0; this.events.push({ type: 'kidWaits', kid: k.id }); }
      }
      if (this.bounds) { k.x = Math.max(this.bounds.x0, Math.min(this.bounds.x1, k.x)); k.z = Math.max(this.bounds.z0, Math.min(this.bounds.z1, k.z)); }
    }
    if (this.count < 3 && !this.pile) {
      const got = this.loose.find((k) => k.grace <= 0 && Math.hypot(k.x - p.x, k.z - p.z) <= L.pickupRadius);
      if (got) {
        this.loose = this.loose.filter((k) => k !== got);
        this.stack.push(got.id); this.applyHeight();
        this.events.push({ type: 'restack', kid: got.id });
      }
    }
  }
}
