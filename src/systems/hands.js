// What a coat does with the things around it: E picks up, drops, uses, rides and hides; right click
// throws what you hold; left click squirts a ketchup bottle; holding Q in the mannequin row strikes a pose.
// Order every physics step: hands.step(input) -> coat.step(...) -> hands.carry() -> world.step().
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Hands {
  constructor(coat, things, balance) {
    this.coat = coat; this.things = things; this.T = balance.things;
    this.held = null; this.riding = null; this.belt = null; this.squirtT = 0;
    this.events = [];
  }

  get walker() { return this.coat.walker; }
  get forward() { const y = this.walker.yaw; return { x: Math.sin(y), z: Math.cos(y) }; }

  // the thing E would act on right now
  target() {
    if (this.held || this.riding || this.belt || this.coat.hidden?.mode === 'inside') return null;
    return this.things.nearest(this.walker.feet, this.T.reach, (t) => usable(t));
  }

  // a short line for the HUD: what E (or Q) does here
  hint() {
    if (this.rescue) { const h = this.rescue.hint(this.coat); if (h) return h; }
    if (this.loot && !this.riding && !this.belt && !this.held && !this.coat.hidden) { const h = this.loot.hint(this.coat); if (h) return h; }
    if (this.riding) return 'E: let go of the trolley';
    if (this.belt) return 'E: hop off the belt';
    if (this.coat.hidden?.mode === 'inside') return 'E: climb out of the box';
    if (this.held) return `${this.held.def.name}: right click throw · E drop${this.held.def.squirt ? ` · left click squirt (${this.held.squirts})` : ''}`;
    const pose = this.things.nearest(this.walker.feet, 1.2, (t) => t.kind === 'hide' && t.mode === 'pose');
    const t = this.target();
    if (t) return `E: ${t.def.verb || 'use the ' + t.def.name.toLowerCase()}`;
    if (pose) return 'Hold Q: strike a pose like the mannequins';
    return '';
  }

  step(dt, { grab = false, throwIt = false, use = false, natural = false, aim = null } = {}) {
    this.events = [];
    const c = this.coat;
    // posing in the mannequin row: hidden while Q is held and you keep still
    const pose = natural ? this.things.nearest(this.walker.feet, 1.2, (t) => t.kind === 'hide' && t.mode === 'pose') : null;
    if (pose && !this.riding && !this.belt) this.hide(pose);
    else if (c.hidden?.mode === 'pose') this.unhide();
    // standing still among the coats or behind the banana
    if (!c.hidden || c.hidden.mode === 'stand') {
      const stand = this.walker.flatSpeed < 0.3 && this.things.nearest(this.walker.feet, 1.2, (t) => t.kind === 'hide' && t.mode === 'stand' && flat(t.position, this.walker.feet) <= t.radius);
      if (stand) c.hidden = { thing: stand, mode: 'stand' }; else if (c.hidden?.mode === 'stand') c.hidden = null;
    }
    if (this.belt) this.stepBelt();
    if (grab) this.pressE();
    if (throwIt && this.held) this.throw(aim);
    if (this.held?.def.squirt) {
      this.squirtT -= dt;
      if (use && this.squirtT <= 0 && this.held.squirts > 0) this.squirt();
    }
  }

  pressE() {
    if (this.riding) return this.letGo();
    if (this.belt) return this.offBelt(true);
    if (this.coat.hidden?.mode === 'inside') return this.unhide();
    if (this.held) return this.drop();
    if (this.rescue?.openBy(this.coat)) { this.events.push({ type: 'openCage' }); return; }
    if (this.loot?.press(this.coat)) { this.events.push({ type: 'loot' }); return; }
    if (this.loot?.carried(this.coat)) return;                       // arms full of loot: nothing else
    const t = this.target(); if (!t) return;
    if (t.kind === 'machine') { const r = this.things.use(t); this.events.push({ type: 'use', thing: t, result: r }); return; }
    if (t.kind === 'ride') return t.def.ride?.type === 'belt' ? this.onBelt(t) : this.ride(t);
    if (t.kind === 'hide') return this.hide(t);
    this.pickUp(t);
  }

  pickUp(t) {
    this.held = t; t.holder = this.coat; t.setCarried(true);
    for (const col of t.colliders) this.walker.ignore.add(col.handle);   // walk through what you hold (M1-F3: it shoved the coat across the shop)
    this.coat.carryKg = t.def.mass || 0;
    this.coat.disguiseProp = t.def.disguise || null;
    this.coat.carrySilly = !t.def.disguise;                             // a grown-up carrying a melon about looks odd
    this.things.sound(t); this.events.push({ type: 'pickUp', thing: t });
  }

  release(vel) {
    const t = this.held; this.held = null; t.holder = null; t.setCarried(false);
    for (const col of t.colliders) this.walker.ignore.delete(col.handle);
    t.body.setLinvel(vel, true); t.prevVel = { ...vel };
    this.coat.carryKg = 0; this.coat.disguiseProp = null; this.coat.carrySilly = false;
    return t;
  }

  drop() { const t = this.release({ x: 0, y: 0, z: 0 }); this.events.push({ type: 'drop', thing: t }); }

  throw(aim) {
    const f = aim && Math.hypot(aim.x, aim.z) > 0.01 ? aim : this.forward, l = Math.hypot(f.x, f.z);
    const t = this.release({ x: f.x / l * this.T.throwSpeed, y: this.T.throwUp, z: f.z / l * this.T.throwSpeed });
    t.thrownBy = this.coat; this.coat.ignoreHit(t.body.handle); this.events.push({ type: 'throw', thing: t });   // (M1-F8: your own melon whacked a kid out of you)
  }

  // a slippery ketchup trail behind you
  squirt() {
    const t = this.held, s = t.def.squirt, p = this.walker.feet, f = this.forward;
    this.squirtT = s.every; t.squirts--;
    this.things.signals.emit({ type: 'slippery', position: { x: p.x - f.x * 0.5, y: 0, z: p.z - f.z * 0.5 }, source: t, range: s.range, data: { color: t.def.splat, event: 'squirt' } });
    this.things.sound(t);
  }

  // trolley: you push it in front of you, fast and wobbly; let go and it keeps rolling
  ride(t) {
    const r = t.def.ride;
    this.riding = t; t.rider = this.coat; t.setCarried(true);
    for (const col of t.colliders) this.walker.ignore.add(col.handle);
    this.coat.mods = { speed: r.topSpeed, grip: r.grip, wobble: r.wobble }; this.coat.riding = true;
    this.things.sound(t); this.events.push({ type: 'ride', thing: t });
  }

  letGo() {
    const t = this.riding, v = this.walker.vel, k = t.def.ride.letGoBoost ?? 1;
    this.riding = null; t.rider = null; t.setCarried(false);
    const vel = { x: v.x * k, y: 0, z: v.z * k };
    t.body.setLinvel(vel, true); t.prevVel = { ...vel };
    for (const col of t.colliders) this.walker.ignore.delete(col.handle);
    this.coat.mods = {}; this.coat.riding = false; this.events.push({ type: 'letGo', thing: t });
  }

  // the till belt: you lie on it like shopping and it carries you to the end
  beltDir(t) {
    const [dx, dz] = t.def.ride.dir, c = Math.cos(t.yaw), s = Math.sin(t.yaw);
    return { x: dx * c + dz * s, z: -dx * s + dz * c };
  }

  onBelt(t) {
    const d = this.beltDir(t), c = t.position, L = t.def.ride.length;
    const start = { x: c.x - d.x * (L / 2 - 0.3), z: c.z - d.z * (L / 2 - 0.3) }, w = this.walker;
    const top = c.y + t.def.shape.size[1] / 2;
    w.body.setTranslation({ x: start.x, y: top + w.half + w.radius + 0.02, z: start.z }, true);
    w.vel.x = w.vel.z = 0;
    this.belt = t; this.coat.mods = { speed: t.def.ride.speed, forceMove: d };
    this.coat.hidden = { thing: t, mode: 'shopping' };
    this.things.sound(t); this.events.push({ type: 'belt', thing: t });
  }

  stepBelt() {
    const t = this.belt, d = this.beltDir(t), c = t.position, p = this.walker.feet;
    if ((p.x - c.x) * d.x + (p.z - c.z) * d.z > t.def.ride.length / 2) this.offBelt(false);
  }

  offBelt(sideways) {
    const t = this.belt, d = this.beltDir(t), c = t.position, w = this.walker, L = t.def.ride.length;
    const off = sideways ? { x: c.x + d.z * 1.0, z: c.z - d.x * 1.0 } : { x: c.x + d.x * (L / 2 + 0.6), z: c.z + d.z * (L / 2 + 0.6) };
    w.body.setTranslation({ x: off.x, y: w.half + w.radius + 0.05, z: off.z }, true);
    this.belt = null; this.coat.mods = {}; this.coat.hidden = null;
    this.events.push({ type: 'offBelt', thing: t });
  }

  hide(t) {
    if (this.coat.hidden?.thing === t) return;
    this.coat.hidden = { thing: t, mode: t.mode }; t.occupant = this.coat;
    this.coat.mods = { ...this.coat.mods, frozen: true };
    this.things.sound(t); this.events.push({ type: 'hide', thing: t });
  }

  unhide() {
    const h = this.coat.hidden; if (!h) return;
    h.thing.occupant = null; this.coat.hidden = null;
    const { frozen, ...rest } = this.coat.mods; this.coat.mods = rest;
    this.events.push({ type: 'unhide', thing: h.thing });
  }

  // move what you hold and what you ride along with you (before world.step)
  carry() {
    const w = this.walker, p = w.position, f = this.forward, feet = w.feet;
    if (this.held?.body) {
      const y = feet.y + w.height * 0.55;
      this.held.body.setNextKinematicTranslation({ x: p.x + f.x * 0.5, y, z: p.z + f.z * 0.5 });
    }
    if (this.riding?.body) {
      const th = (w.yaw - Math.PI / 2) / 2;
      this.riding.body.setNextKinematicTranslation({ x: p.x + f.x * 0.85, y: feet.y, z: p.z + f.z * 0.85 });
      this.riding.body.setNextKinematicRotation({ x: 0, y: Math.sin(th), z: 0, w: Math.cos(th) });
    }
  }
}

function usable(t) {
  if (t.kind === 'machine') return !!t.def.use;
  if (t.kind === 'ride') return !t.rider;
  if (t.kind === 'hide') return t.mode === 'inside' && !t.occupant;
  if (t.kind === 'disguise' || t.kind === 'food') return !t.holder && !t.carried && !!t.body;
  return false;
}
