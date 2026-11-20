// Everyone in the place: builds the grown-ups from the place file (people + routines) and the types in
// data/grownups.json, steps them every physics step, and collects what they did (for voices and tests).
import { GrownUp } from './grownup.js';
import { NavGrid } from './navgrid.js';

export class People {
  constructor(R, world, place, data, { signals, mess, things = [] } = {}) {
    // (ctx.rescue is set by the Rescue system when the place has a Lost & Found cage)
    const D = place.data, voices = {};
    for (const [m, v] of Object.entries(data.models)) if (!m.startsWith('_')) voices[m] = v.voice;
    this.nav = NavGrid.fromPlace(place, things);
    this.ctx = { nav: this.nav, signals, mess, ice: place.slippery, timing: data.timing, routines: D.routines || {}, spots: D.events || {}, voices };
    const count = {};
    this.list = (D.people?.list || []).map((spec, i) => {
      const type = data.types[spec.type]; if (!type) throw new Error(`unknown grown-up type "${spec.type}"`);
      const n = count[spec.type] = (count[spec.type] ?? -1) + 1;
      const model = spec.model || type.models[n % type.models.length];
      return new GrownUp(R, world, type, { ...spec, id: i, model, seed: 1000 + i * 77 }, this.ctx);
    });
    this.time = 0; this.events = []; this.R = R; this.world = world; this.data = data; this.count = count;
    this.onAdd = null;            // the renderer adds a figure for anyone who arrives later
  }

  // someone new walks in (extra guards at higher Heat, the Caretaker)
  add(spec) {
    const type = this.data.types[spec.type]; if (!type) throw new Error(`unknown grown-up type "${spec.type}"`);
    const n = this.count[spec.type] = (this.count[spec.type] ?? -1) + 1;
    const g = new GrownUp(this.R, this.world, type, { ...spec, id: this.list.length, model: spec.model || type.models[n % type.models.length], seed: 5000 + this.list.length * 77 }, this.ctx);
    this.list.push(g); this.onAdd?.(g); this.events.push({ type: 'arrive', who: g });
    return g;
  }

  step(dt, coats) {
    this.time += dt;
    for (const g of this.list) { g.step(dt, { coats, time: this.time }); for (const e of g.events) this.events.push({ ...e, who: g }); g.events = []; }   // (including what happened to them between steps: a burp, a soak)
  }

  // the shop takes a breath (after a grab): for a few seconds nobody starts a chase or a shout, and anyone
  // not carrying a kid gives up and forgets who they busted
  calm(seconds, susAfter) {
    this.ctx.calmUntil = Math.max(this.ctx.calmUntil ?? -1, this.time + seconds);
    for (const g of this.list) g.calmDown(susAfter);
  }

  // events since the last call (the frame loop plays voices from these)
  take() { const e = this.events; this.events = []; return e; }
  byType(t) { return this.list.filter((g) => g.typeName === t); }
}
