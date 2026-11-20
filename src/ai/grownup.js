// One grown-up: a walking capsule with a type (data/grownups.json), eyes (a sight cone that tall shelves
// block), ears (signals) and a state: idle, wander, routine, investigate, crowd, flee, inspect, shout,
// chase, search, carry, grab, slipped, stunned. Nothing is scripted: they follow their routine until a
// signal or something they see changes their mind.
//   step(dt, { coats, time }) before world.step(); this.events says what happened (voices, sounds, tests).
// Fair catching (M1-F7): while the shop takes a breath (ctx.calmUntil) nobody starts a chase or a shout;
// a kid who just fell out (kid.free) or a Spare Kid who just walked in (coat.safe) is left alone for a moment;
// and a grown-up who is just standing about or strolling steps aside when a coat walks into their space.
import { Walker } from '../entities/walker.js';

const DEG = Math.PI / 180;
const BUSY = new Set(['chase', 'carry', 'grab', 'slipped', 'stunned', 'shout', 'blinded', 'embarrassed']);

export class GrownUp {
  constructor(R, world, type, spec, ctx) {
    this.type = type; this.typeName = spec.type; this.ctx = ctx; this.T = ctx.timing;
    this.id = spec.id; this.model = spec.model; this.home = { x: spec.at[0], z: spec.at[1] };
    this.walker = new Walker(R, world, [spec.at[0], 0, spec.at[1]], { radius: 0.3, height: 1.8, speed: type.walk });
    if (spec.face) this.walker.yaw = Math.atan2(spec.face[0], spec.face[1]);
    this.routine = spec.routine ? ctx.routines[spec.routine] : null; this.routineName = spec.routine || null;
    this.step_i = 0; this.state = this.routine && !(this.routine.startAt > 0) ? 'routine' : type.stays ? 'idle' : 'wander';
    this.t = 0; this.path = null; this.goal = null; this.repathT = 0; this.events = [];
    this.target = null; this.lastSeen = null; this.lostT = 0; this.carrying = null; this.inspected = new Map();
    this.sus = new Map(); this.hostile = new Set(); this.effects = {};      // per coat: the "?" meter (0..1) and who they know is not a grown-up
    this.onIce = false; this.doing = null; this.rnd = mulberry(spec.seed ?? 1);
    this.unlisten = ctx.signals?.listen({ position: () => this.walker.feet, hear: (s, d) => this.hear(s, d) });
  }

  get position() { return this.walker.position; }
  get feet() { return this.walker.feet; }
  say(key) { const k = this.ctx.voices?.[this.model]?.[key]; this.events.push({ type: 'say', key, clip: k }); }
  set(state, t = 0) { this.state = state; this.t = t; this.path = null; this.goal = null; this.doing = null; this.arrived = false; }

  // can I see this point? (in range, inside my cone, nothing tall in between)
  sees(p) {
    if (this.effects.blinded > 0) return false;
    const f = this.feet, dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz);
    if (d > this.type.sight || d < 0.01) return d < 0.01;
    let a = Math.atan2(dx, dz) - this.walker.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > this.type.fov * DEG / 2) return false;
    return this.ctx.nav.clear(f.x, f.z, p.x, p.z, true);
  }

  // ears: every signal within its range reaches here
  hear(s) {
    if (s.source === this || BUSY.has(this.state)) return;
    const p = s.position, run = this.type.run;
    if (s.type === 'smell' && !s.data?.nice) { if (!this.type.stays) this.flee(p); this.say('smell'); return; }
    if (s.type === 'food' || s.type === 'smell') {                         // food, or a nice smell of baking
      if (!this.type.stays && this.state !== 'crowd') { this.go('crowd', p, this.type.walk * 1.4, this.T.crowdTime); this.say('food'); } return; }
    if (s.type === 'noise' || s.type === 'crash' || s.type === 'alarm' || s.type === 'spill') {
      if (this.state === 'crowd' && !(s.type === 'alarm' && s.data?.event === 'shout')) return;   // free cake beats a bit of noise
      if (this.type.stays) { this.face(p); this.say('notice'); return; }   // cashiers just turn and look
      const hurry = this.type.chases && (s.type !== 'noise' || s.data?.event === 'shout');
      this.go('investigate', p, hurry ? run : this.type.walk * 1.3, this.T.investigateLook);
      if (s.type !== 'spill') this.say('notice');
    }
  }

  face(p) { const f = this.feet; this.walker.yaw = Math.atan2(p.x - f.x, p.z - f.z); }
  go(state, p, speed, stay = 0) { this.set(state); this.goal = { x: p.x, z: p.z }; this.speed = speed; this.stay = stay; }

  flee(from) {
    const f = this.feet, dx = f.x - from.x, dz = f.z - from.z, d = Math.hypot(dx, dz) || 1, D = this.T.fleeDistance;
    this.go('flee', { x: f.x + dx / d * D, z: f.z + dz / d * D }, this.type.run, 0); this.t = this.T.fleeTime;
  }

  // walk the path to this.goal; true when arrived
  walkTo(dt, speed) {
    const f = this.feet;
    this.repathT -= dt;
    if (!this.path || this.repathT <= 0) { this.path = this.ctx.nav.path(f.x, f.z, this.goal.x, this.goal.z) || []; this.repathT = this.T.repath; }
    while (this.path.length && Math.hypot(this.path[0].x - f.x, this.path[0].z - f.z) < 0.35) this.path.shift();
    if (!this.path.length) { this.move = null; return true; }
    const n = this.path[0], d = Math.hypot(n.x - f.x, n.z - f.z);
    this.walker.speed = speed; this.move = { x: (n.x - f.x) / d, z: (n.z - f.z) / d };
    return false;
  }

  step(dt, { coats = [], time = 0 } = {}) {
    this.move = null; this.t -= dt; this.clock = time;                  // (events are cleared by People once passed on: M1-F5)
    this.look(coats);
    this.think(dt, coats, time);
    this.checkSlip();
    this.makeRoom(coats);
    for (const k of Object.keys(this.effects)) this.effects[k] = Math.max(0, this.effects[k] - dt);
    // soaked shoes: a sharp turn and they go over
    if (this.effects.soaked > 0 && this.state !== 'slipped' && this.walker.turnRate > 3 && this.walker.flatSpeed > 0.8) { this.effects.soaked = 0; this.slip('soaked'); }
    const m = this.move || { x: 0, z: 0 };
    this.walker.grip = this.state === 'slipped' ? 0.08 : 1;          // slipped: they skid on along the floor
    this.walker.step(dt, m, false, this.faceTo || null); this.faceTo = null;
    if (this.carrying) { const f = this.feet; this.carrying.x = f.x; this.carrying.z = f.z; }
  }

  // eyes: a kid on their own (no disguise), a loose kid, or a coat posing among the mannequins
  look(coats) {
    if (BUSY.has(this.state) && this.state !== 'chase') return;
    if (this.clock < (this.ctx.calmUntil ?? -1) && this.state !== 'chase') return;     // the shop is taking a breath
    for (const c of coats) {
      if (c.safe > 0) continue;                                         // a Spare Kid who just walked in
      const kids = [];
      // a lone kid, or a coat this grown-up knows is not a grown-up (the Caretaker treats every coat that way)
      if (c.caught || c.inCage) continue;                               // already on their way to (or in) the cage
      const knows = this.hostile.has(c) || this.type.hunts;
      if ((c.count === 1 || knows) && !c.hidden && !c.grabbedBy) kids.push({ coat: c, kid: null, p: c.walker.feet });
      for (const k of c.loose) if (!k.carriedBy && !k.caged && !(k.free > 0)) kids.push({ coat: c, kid: k, p: { x: k.x, z: k.z } });
      for (const k of kids) {
        if (!this.sees(k.p)) continue;
        if (this.state === 'chase') { if (this.target.kid === k.kid && this.target.coat === k.coat) { this.lastSeen = { ...k.p }; this.lostT = 0; } continue; }
        if (this.type.chases) { this.set('chase'); this.target = k; this.lastSeen = { ...k.p }; this.lostT = 0; this.say('children'); this.events.push({ type: 'chase' }); if (!knows) this.events.push({ type: 'kidShout' }); return; }
        if (this.clock < (this.shoutCool ?? -1)) { this.faceTo = { x: k.p.x - this.feet.x, z: k.p.z - this.feet.z }; continue; }   // already shouted: just stare
        this.shoutCool = this.clock + this.T.shoutCooldown;
        this.set('shout', this.T.shoutTime); this.face(k.p); this.say('children'); this.events.push({ type: 'kidShout' });
        this.ctx.signals.emit({ type: 'alarm', position: k.p, source: this, range: 25, data: { event: 'shout' } });
        return;
      }
      // a posing coat in the mannequin row gets a long, hard look
      if (c.hidden?.mode === 'pose' && this.state !== 'inspect' && this.state !== 'chase') {
        const p = c.walker.feet, last = this.inspected.get(c) ?? -1e9;
        if (this.clock - last > this.T.inspectCooldown && Math.hypot(p.x - this.feet.x, p.z - this.feet.z) < 9 && this.sees(p)) {
          this.inspected.set(c, this.clock); this.go('inspect', p, this.type.walk, this.T.inspectTime); this.inspectCoat = c; this.say('inspect');
        }
      }
    }
  }

  think(dt, coats, time) {
    const T = this.T, f = this.feet;
    switch (this.state) {
      case 'idle': if (this.routine && time >= (this.routine.startAt ?? 0)) this.set('routine'); break;
      case 'wander':
        if (this.routine && time >= (this.routine.startAt ?? 0)) { this.set('routine'); break; }
        if (!this.goal) {
          if (this.t > 0) break;
          const R = T.wanderRadius, a = this.rnd() * Math.PI * 2, r = 1.5 + this.rnd() * R;
          const p = { x: this.home.x + Math.sin(a) * r, z: this.home.z + Math.cos(a) * r };
          if (this.ctx.nav.walkable(p.x, p.z)) { this.goal = p; this.path = null; }
        } else if (this.walkTo(dt, this.type.walk)) { this.goal = null; this.t = T.wanderWait[0] + this.rnd() * (T.wanderWait[1] - T.wanderWait[0]); }
        break;
      case 'routine': this.runRoutine(dt); break;
      case 'investigate': case 'crowd': case 'inspect':
        if (this.goal && !this.arrived) {
          const stop = this.state === 'inspect' ? 1.5 : this.state === 'crowd' ? 1.2 + (this.id % 4) * 0.5 : 0.6;
          if (Math.hypot(this.goal.x - f.x, this.goal.z - f.z) < stop || this.walkTo(dt, this.speed)) { this.arrived = true; this.t = this.stay; }
        } else {
          this.faceTo = this.goal ? { x: this.goal.x - f.x, z: this.goal.z - f.z } : null;
          if (this.state === 'investigate') this.walker.yaw += Math.sin(this.t * 2.5) * dt * 1.5;    // looking around
          if (this.t <= 0) { if (this.state === 'inspect') this.say('giveUp'); this.arrived = false; this.back(); }
        }
        break;
      case 'flee': if (this.walkTo(dt, this.type.run) || this.t <= 0) this.back(); break;
      case 'shout': if (this.t <= 0) this.back(); break;
      case 'chase': this.chase(dt); break;
      case 'search':
        if (this.goal && !this.arrived) { if (this.walkTo(dt, this.type.run * 0.7)) { this.arrived = true; this.t = T.searchTime; } }
        else { this.walker.yaw += dt * 2.2; if (this.t <= 0) { this.arrived = false; this.say('giveUp'); this.back(); } }
        break;
      case 'carry':
        if (this.walkTo(dt, this.type.walk * 1.2)) this.dropKid(true);
        break;
      case 'grab':
        if (this.t <= 0) { const c = this.holding; if (c) { c.grabbedBy = null; c.mods = {}; } this.holding = null; this.set('stunned', T.stunnedTime * (this.type.toughness ?? 1)); this.events.push({ type: 'wriggleFree' }); }
        break;
      case 'slipped': case 'stunned': case 'embarrassed': if (this.t <= 0) this.back(); break;
      case 'blinded':                       // staggering about, arms out
        this.walker.speed = this.type.walk * 0.6; this.move = { x: Math.sin(this.t * 2.3 + this.id), z: Math.cos(this.t * 1.7) };
        if (this.t <= 0) this.back();
        break;
    }
  }

  back() { this.arrived = false; this.set(this.routine && this.clock >= (this.routine.startAt ?? 0) ? 'routine' : this.type.stays ? 'idle' : 'wander'); }

  runRoutine(dt) {
    const steps = this.routine.steps, s = steps[this.step_i];
    if (!s) { if (this.routine.loop) this.step_i = 0; else this.set('idle'); return; }
    if (s.go) {
      if (!this.goal) { this.goal = { x: s.go[0], z: s.go[1] }; this.path = null; }
      if (this.walkTo(dt, this.type.walk)) { this.goal = null; this.step_i++; this.events.push({ type: 'routine', step: this.step_i - 1, at: s.go }); }
    } else if (s.wait !== undefined) {
      if (!this.doing) { this.doing = s.do || 'wait'; this.t = s.wait; }
      if (this.t <= 0) { this.doing = null; this.step_i++; this.events.push({ type: 'routine', step: this.step_i - 1, did: s.do }); }
    } else this.step_i++;
  }

  chase(dt) {
    const tg = this.target, f = this.feet, T = this.T;
    // the kid got away into the coat again, or out of sight for too long
    if (tg.kid && !tg.coat.loose.includes(tg.kid)) { this.lastSeen = null; }
    const live = tg.kid ? (tg.coat.loose.includes(tg.kid) ? { x: tg.kid.x, z: tg.kid.z } : null) : ((tg.coat.count === 1 || this.hostile.has(tg.coat) || this.type.hunts) && !tg.coat.hidden && !tg.coat.grabbedBy ? tg.coat.walker.feet : null);
    this.lostT += dt;
    if (!live || this.lostT > T.lostSightAfter) {
      if (this.lastSeen) { this.go('search', this.lastSeen, this.type.run * 0.7); } else this.back();
      this.target = null; return;
    }
    const goalP = this.lostT < 0.2 ? live : this.lastSeen;
    this.goal = { x: goalP.x, z: goalP.z };
    const fair = tg.kid ? !(tg.kid.free > 0) : !(tg.coat.safe > 0);         // a head start for a kid who just fell out
    if (fair && Math.hypot(live.x - f.x, live.z - f.z) < (this.type.grabRadius ?? 0.8)) return this.grab(tg);
    this.walkTo(dt, this.type.run);
  }

  grab(tg) {
    this.say('gotYou');
    if (tg.kid) {                     // a loose kid: carried off to Lost & Found (the staff room for now)
      tg.kid.carriedBy = this; this.carrying = tg.kid; tg.kid.waiting = true;
      const lf = this.ctx.rescue?.drop ?? this.ctx.spots.lostAndFound ?? [this.home.x, this.home.z];
      this.set('carry'); this.goal = { x: lf[0], z: lf[1] };
      this.events.push({ type: 'grabKid', kid: tg.kid.id });
    } else if (tg.coat.count > 1) {    // a whole coat: yank the top kid out and carry that one off
      const kid = tg.coat.spill();
      if (kid) { this.target = { coat: tg.coat, kid }; return this.grab(this.target); }
    } else if (this.ctx.rescue) {     // the last kid in the coat: off to the Lost & Found cage (or a Spare Kid steps in)
      this.ctx.rescue.caught(tg.coat, this);
      this.events.push({ type: 'grabCoat' });
    } else {                          // no cage in this place: held for a moment, then you wriggle free
      tg.coat.grabbedBy = this; tg.coat.mods = { frozen: true }; this.holding = tg.coat;
      this.set('grab', this.T.grabHold);
      this.events.push({ type: 'grabCoat' });
    }
    this.target = null;
  }

  // the shop takes a breath after a grab: anyone not carrying a kid gives up the chase and forgets who they
  // busted (their "?" drops to susAfter at most)
  calmDown(susAfter) {
    if (this.carrying || this.warden) return;
    this.hostile.clear(); for (const [c, v] of this.sus) this.sus.set(c, Math.min(v, susAfter));
    if (this.state === 'chase' || this.state === 'search' || this.state === 'shout') { this.target = null; this.say('giveUp'); this.back(); }
  }

  // personal space: someone just standing about or strolling steps aside when a coat walks into them, so a
  // crowd never pins a coat (staff behind a till stay put; anyone chasing or carrying doesn't care)
  makeRoom(coats) {
    const T = this.T; if (!T.personalSpace || this.type.stays || BUSY.has(this.state) || this.state === 'search') return;
    const f = this.feet;
    for (const c of coats) {
      if (c.caught || c.inCage) continue;
      const p = c.walker.feet, dx = f.x - p.x, dz = f.z - p.z, d = Math.hypot(dx, dz);
      const v = c.walker.wish ?? { x: 0, z: 0 };                         // where the coat is trying to go
      if (d >= T.personalSpace || d < 1e-3 || Math.hypot(v.x, v.z) < 0.2 || v.x * dx + v.z * dz < 0) continue;
      // out of the way: to the side of the way the coat is walking (only a little further along it)
      const side = Math.sign(dx * v.z - dz * v.x) || 1, vl = Math.hypot(v.x, v.z);
      const ax = side * v.z / vl + dx / d * 0.25, az = -side * v.x / vl + dz / d * 0.25, n = Math.hypot(ax, az) || 1;
      this.move = { x: ax / n, z: az / n }; this.walker.speed = this.type.walk * T.stepAside;
      return;
    }
  }

  // the "?" meter is full: THAT'S NOT A GROWN-UP!
  bust(coat) {
    if (this.hostile.has(coat)) return;
    this.hostile.add(coat); this.sus.set(coat, 1);
    this.say('children'); this.events.push({ type: 'bust', coat });
    const p = coat.walker.feet;
    this.ctx.signals?.emit({ type: 'alarm', position: p, source: this, range: 25, data: { event: 'shout', bust: true } });
    if (!BUSY.has(this.state)) {
      if (this.type.chases) { this.set('chase'); this.target = { coat, kid: null, p }; this.lastSeen = { ...p }; this.lostT = 0; }
      else { this.set('shout', this.T.shoutTime); this.face(p); this.shoutCool = this.clock + this.T.shoutCooldown; }
    }
  }

  // put the kid down: at Lost & Found it waits there; dropped on the way (slipped) it runs off again
  dropKid(arrived) {
    const k = this.carrying; if (!k) return;
    k.carriedBy = null; this.carrying = null;
    if (this.ctx.rescue) {             // the cage takes it from here (a kid, or a whole caught player)
      if (arrived) { this.ctx.rescue.lockUp(k, this); this.events.push({ type: 'lostAndFound', kid: k.id }); this.back(); }
      else { this.ctx.rescue.escape(k, this); this.events.push({ type: 'dropKid', kid: k.id }); }
      return;
    }
    if (arrived) { k.waiting = true; k.t = 0; this.events.push({ type: 'lostAndFound', kid: k.id }); this.back(); }
    else { k.waiting = false; k.t = 6; k.grace = 0.8; k.heading = this.rnd() * Math.PI * 2; this.events.push({ type: 'dropKid', kid: k.id }); }
  }

  // walking onto something slippery (a puddle, the freezer ice): down they go
  checkSlip() {
    if (this.state === 'slipped') return;
    const f = this.feet, mess = this.ctx.mess, ice = this.ctx.ice?.some((r) => f.x >= r[0] && f.x <= r[2] && f.z >= r[1] && f.z <= r[3]);
    const wet = (mess && mess.slipperyAt(f.x, f.z)) || ice;
    const moving = this.walker.flatSpeed > 0.7 || (this.move && this.walker.speed > 0.7);
    if (!wet) { this.onIce = false; return; }
    if (this.onIce || !moving) return;
    this.onIce = true;                       // one roll of the dice per puddle
    if (this.rnd() < this.type.slipChance * (ice && !mess?.slipperyAt(f.x, f.z) ? 0.4 : 1)) this.slip('puddle');
  }

  // down they go: drop whatever they hold, skid, lie there with stars
  slip(why, seconds = this.T.slippedTime) {
    const f = this.feet;
    if (this.carrying) this.dropKid(false);
    if (this.holding) { this.holding.grabbedBy = null; this.holding.mods = {}; this.holding = null; }
    this.set('slipped', seconds * (this.type.toughness ?? 1)); this.say('slip');
    this.ctx.signals?.emit({ type: 'noise', position: f, source: this, range: 8, data: { event: 'grown-up slip' } });
    this.events.push({ type: 'slip', why });
  }

  // gadget effects (data/gadgets.json): soaked (slips on the next sharp turn), blinded (can't see, staggers
  // about), embarrassed (stands there red-faced), slipped (straight down)
  applyEffect(name, seconds) {
    if (name === 'slipped') { if (this.state !== 'slipped') this.slip('gadget', seconds); return; }
    if (name === 'soaked') { this.effects.soaked = Math.max(this.effects.soaked ?? 0, seconds); this.events.push({ type: 'soaked' }); return; }
    if (this.state === 'slipped') return;
    if (this.carrying && name === 'blinded') this.dropKid(false);
    if (name === 'blinded') { this.effects.blinded = seconds; this.set('blinded', seconds); this.say('slip'); }
    if (name === 'embarrassed') { this.set('embarrassed', seconds); this.say('giveUp'); }
    this.events.push({ type: name });
  }

  // a hit makes them turn round and look (they might see who did it)
  struckFrom(p) { if (!BUSY.has(this.state)) { this.face(p); this.go('investigate', p, this.type.walk * 1.3, this.T.investigateLook); } }

  remove() { this.unlisten?.(); }
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
