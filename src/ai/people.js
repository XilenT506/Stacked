// Everyone in the place: builds the grown-ups from the place file (people + routines) and the types in
// data/grownups.json, steps them every physics step, and collects what they did (for voices and tests).
import { GrownUp } from './grownup.js';
import { NavGrid } from './navgrid.js';

export class People {
  constructor(R, world, place, data, { signals, mess, things = [] } = {}) {
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
    this.time = 0; this.events = [];
  }

  step(dt, coats) {
    this.time += dt;
    for (const g of this.list) { g.step(dt, { coats, time: this.time }); for (const e of g.events) this.events.push({ ...e, who: g }); }
  }

  // events since the last call (the frame loop plays voices from these)
  take() { const e = this.events; this.events = []; return e; }
  byType(t) { return this.list.filter((g) => g.typeName === t); }
}
