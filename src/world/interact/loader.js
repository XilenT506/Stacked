// Builds interactive things from data/interactables.json and runs them every physics step.
//   const things = new Things(R, world, signals, data);
//   things.spawn('tin', [x, y, z]);  ...  every step: things.step(dt);
import { Thing } from './thing.js';
import { KINDS } from './kinds.js';

export class Things {
  constructor(R, world, signals, data) {
    this.R = R; this.world = world; this.signals = signals; this.defs = data.things;
    for (const [name, d] of Object.entries(this.defs)) {
      if (!KINDS[d.kind]) throw new Error(`"${name}" has unknown kind "${d.kind}" (expected one of ${Object.keys(KINDS).join(', ')})`);
    }
    this.list = [];
  }

  spawn(name, pos, opts) {
    const def = this.defs[name];
    if (!def) throw new Error(`no interactable called "${name}" in data/interactables.json`);
    const t = new Thing(this.R, this.world, def, name, pos, opts);
    KINDS[def.kind].init?.(t);
    this.list.push(t);
    return t;
  }

  use(t) { return KINDS[t.kind].use?.(t, this.signals); }

  // after world.step(): find impacts and let each kind react
  step(dt) {
    for (const t of this.list) {
      const speed = t.checkImpact(dt);
      if (speed) KINDS[t.kind].onImpact?.(t, this.signals, speed);
    }
  }
}
