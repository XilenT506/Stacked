// Timed events during a job ("Free samples at the bakery", "Clean-up on aisle 4"), from
// data/places/<place>/events.json. An event only says things, sends signals and spawns things;
// everything else is the living map reacting to those signals.
export class JobEvents {
  // ctx: { signals, things, spots, say(text) }; timing: { firstAt, gap }
  constructor(list, ctx, timing = { firstAt: 60, gap: 75 }) {
    this.list = list; this.ctx = ctx; this.timing = timing;
    this.time = 0; this.next = 0; this.fired = []; this.pending = [];
  }

  get upcoming() { return this.list[this.next] || null; }
  get nextAt() { return this.timing.firstAt + this.next * this.timing.gap; }

  step(dt) {
    this.time += dt;
    if (this.next < this.list.length && this.time >= this.nextAt) this.fire(this.list[this.next].id);
    for (const p of this.pending) { p.wait -= dt; if (p.wait <= 0) { this.emit(p.a); p.left--; p.wait = p.a.every; } }
    this.pending = this.pending.filter((p) => p.left > 0);
  }

  // start an event now (the T test key, or its time came)
  fire(id) {
    const e = this.list.find((x) => x.id === id); if (!e) return null;
    const i = this.list.indexOf(e); if (i >= this.next) this.next = i + 1;
    this.fired.push({ id, time: this.time });
    if (e.say) this.ctx.say?.(e.say, e.name);
    for (const a of e.actions) {
      if (a.spawn) for (const at of a.at) this.ctx.things.spawn(a.spawn, at.length === 2 ? [at[0], 0, at[1]] : at);
      if (a.signal) { this.emit(a); if ((a.repeat || 1) > 1) this.pending.push({ a, left: a.repeat - 1, wait: a.every }); }
    }
    return e;
  }

  emit(a) {
    const pts = a.points || [typeof a.at === 'string' ? this.ctx.spots[a.at] : a.at];
    for (const [x, z] of pts) this.ctx.signals.emit({ type: a.signal, position: { x, y: 0, z }, range: a.range, source: this, data: { event: 'timed', color: a.color } });
  }
}
