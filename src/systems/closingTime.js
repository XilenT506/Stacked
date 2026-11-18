// Closing Time: the shop closes section by section towards the front doors (the order and the shutters
// are in the place file under closingTime). Each shutter is warned about first, then comes down as a
// solid wall that grown-ups have to walk round. lock(id) shuts one section's shutters straight away
// (Heat 3 locks the front doors).
export class ClosingTime {
  constructor(R, world, place, balance, { nav = null } = {}) {
    this.R = R; this.world = world; this.C = balance.closingTime; this.nav = nav;
    this.sections = place.data.closingTime.sections;
    this.time = 0; this.started = false; this.next = 0; this.warnT = 0; this.events = [];
    this.shut = [];                 // { section, seg, k (0 open .. 1 down) } for the renderer
    this.closed = new Set();        // section ids that are shut
  }

  get startsIn() { return Math.max(0, this.C.startsAt - this.time); }
  get warning() { return this.started && this.next < this.sections.length && this.warnT > 0 ? this.sections[this.next] : null; }

  start() { if (this.started) return; this.started = true; this.time = Math.max(this.time, this.C.startsAt); this.warnT = this.C.warn; this.events.push({ type: 'start' }); }

  step(dt) {
    this.time += dt;
    for (const s of this.shut) s.k = Math.min(1, s.k + dt * 1.5);
    if (!this.started) { if (this.time >= this.C.startsAt) this.start(); return; }
    if (this.next >= this.sections.length) return;
    this.warnT -= dt;
    if (this.warnT <= 0) {
      const s = this.sections[this.next++];
      if (!this.closed.has(s.id)) this.close(s);
      this.warnT = this.C.sectionEvery;
      if (this.next < this.sections.length) this.events.push({ type: 'warn', section: this.sections[this.next] });
    }
  }

  lock(id) { const s = this.sections.find((x) => x.id === id); if (s && !this.closed.has(s.id)) this.close(s); }

  close(s) {
    this.closed.add(s.id);
    const h = this.C.shutterHeight;
    for (const seg of s.shutters) {
      const [x0, z0, x1, z1] = seg, along = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = Math.hypot(x1 - x0, z1 - z0);
      const sx = along ? len : 0.2, sz = along ? 0.2 : len;
      this.world.createCollider(this.R.ColliderDesc.cuboid(sx / 2, h / 2, sz / 2).setTranslation((x0 + x1) / 2, h / 2, (z0 + z1) / 2));
      this.nav?.addBox((x0 + x1) / 2, (z0 + z1) / 2, sx, sz, h);
      this.shut.push({ section: s.id, seg, k: 0 });
    }
    this.events.push({ type: 'shut', section: s });
  }

  // is this point behind a shutter that is down? (anyone left there is shut in)
  isClosed(areaId) { return this.sections.some((s) => this.closed.has(s.id) && s.areas.includes(areaId)); }

  take() { const e = this.events; this.events = []; return e; }
}
