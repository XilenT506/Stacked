// One player's coat: three kids stacked inside a trench coat. Your health is your height.
//   3 kids: a tall grown-up · 2 kids: a short grown-up · 1 kid: just a kid (fast, no disguise)
// The wobble bar fills when you run, carry, turn sharply, get hit or walk on something slippery.
// When it is full the top kid falls out and runs around squeaking for 10 seconds; walk over a loose kid
// to stack them back in. R unstacks on purpose (the coat lies on the floor like laundry with two kids
// hiding in it, and you go on as one fast kid) and, back at the pile, R stacks up again.
// All numbers come from data/balance.json.
import { Walker } from './walker.js';
import { Mess } from '../systems/mess.js';

let kidSeq = 0;

export class Coat {
  constructor(R, world, signals, balance, pos = [0, 0, 0], kids = ['sid', 'mo', 'tank'], { mess } = {}) {
    this.B = balance; this.signals = signals;
    this.stack = kids.slice();            // bottom first: [bottom, middle, top]
    this.walker = new Walker(R, world, pos, { height: balance.heights['3'].height, speed: balance.heights['3'].speed, runMul: balance.run.speedMultiplier });
    this.wobble = 0; this.loose = []; this.pile = null; this.carryKg = 0;
    this.mods = {};             // set by what you are doing: riding (speed, grip, wobble), hiding (frozen), a belt (forceMove)
    this.stunned = 0; this.events = [];                         // what happened this step (for sounds and tests)
    this.time = 0;
    // slippery signals leave a patch on the floor (the shared mess of the place, or this coat's own one in tests)
    this.ownMess = !mess; this.mess = mess ?? new Mess(signals, balance);
    this.applyHeight();
  }

  get patches() { return this.mess.patches; }
  get count() { return this.stack.length; }
  get state() { return this.B.heights[String(this.count)]; }
  get position() { return this.walker.position; }
  get unstacked() { return !!this.pile; }
  get disguise() { return this.state.disguise; }

  applyHeight() {
    const h = this.state;
    if (Math.abs(this.walker.height - h.height) > 1e-3) this.walker.setHeight(h.height);
    this.walker.speed = this.mods.speed ?? h.speed;
  }

  onSlippery() {
    const f = this.walker.feet;
    if (this.floorZones?.some((r) => f.x >= r[0] && f.x <= r[2] && f.z >= r[1] && f.z <= r[3])) return true;   // ice that is always there
    return this.mess.slipperyAt(f.x, f.z);
  }

  // gadget effects (friendly fire): slipped spins you round and fills the wobble, soaked makes the next sharp
  // turn a stumble, blinded blurs your view (and your steering), embarrassed freezes you for a moment
  applyEffect(name, seconds) {
    const G = this.B.gadgetsOnCoat;
    this.effects ??= {};
    if (name === 'slipped') { this.stunned = Math.max(this.stunned, G.slippedStun); this.wobble = Math.min(1, this.wobble + G.slippedWobble); this.spin = 1; if (this.wobble >= 1) this.spill(); }
    else if (name === 'embarrassed') this.stunned = Math.max(this.stunned, G.embarrassedStun);
    else this.effects[name] = Math.max(this.effects[name] ?? 0, seconds);
    this.events.push({ type: 'effect', name });
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
    if (this.ownMess) this.mess.step(dt);
    const B = this.B.wobble, M = this.mods, slip = this.onSlippery();
    this.walker.speed = (M.speed ?? this.state.speed) * (this.carrySpeedMul ?? 1);      // big loot in your arms slows you down
    this.walker.grip = Math.min(slip ? this.B.slippery.grip : 1, M.grip ?? 1);
    if (this.stunned > 0) { this.stunned -= dt; move = { x: 0, z: 0 }; }
    this.effects ??= {};
    for (const k of Object.keys(this.effects)) this.effects[k] = Math.max(0, this.effects[k] - dt);
    this.spin = Math.max(0, (this.spin ?? 0) - dt);
    if (this.effects.blinded > 0 && (move.x || move.z)) {        // can't see where you're going: the steering wanders
      const a = Math.sin(this.time * 3.1) * 0.8, c = Math.cos(a), s = Math.sin(a); move = { x: move.x * c - move.z * s, z: move.x * s + move.z * c };
    }
    if (M.frozen) { move = { x: 0, z: 0 }; run = false; }
    if (M.forceMove) { move = M.forceMove; run = false; }
    this.walker.step(dt, move, run, face);
    // wobble: fills with running, carrying, sharp turns and slippery floors; drains when calm
    const sp = this.walker.flatSpeed, moving = sp > 0.5;
    this.running = !!run && moving && !M.forceMove;                       // grown-ups notice running
    this.actingNatural = !!actNatural && !this.hidden;                   // Q: tip the hat, nod, wave
    let fill = 0;
    if (run && moving) fill += B.runFill;
    if (this.carryKg && moving) fill += B.carryFillPerKg * this.carryKg;
    if (slip && moving) fill += B.slipperyFill;
    if (this.walker.turnRate > 4 && moving) fill += B.turnFill * this.walker.turnRate / 4;
    if (M.wobble && moving) fill += M.wobble * sp / 4;
    if (this.effects.soaked > 0 && moving && this.walker.turnRate > 4) { this.effects.soaked = 0; this.wobble += this.B.gadgetsOnCoat.soakedTurnWobble; this.events.push({ type: 'stumble' }); }
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
      if (k.carriedBy) continue;                                        // a grown-up has got this one
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
      const got = this.loose.find((k) => k.grace <= 0 && !k.carriedBy && Math.hypot(k.x - p.x, k.z - p.z) <= L.pickupRadius);
      if (got) {
        this.loose = this.loose.filter((k) => k !== got);
        this.stack.push(got.id); this.applyHeight();
        this.events.push({ type: 'restack', kid: got.id });
      }
    }
  }
}
