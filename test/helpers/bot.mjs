// A simple bot player for logic tests: follows a list of goals (walk to a point, press E, wait),
// finding its way with the grown-ups' walking grid. It walks (never runs) and acts natural whenever
// someone near is getting suspicious, like a careful player would.
export class Bot {
  constructor(coat, nav, goals) { this.coat = coat; this.nav = nav; this.goals = goals; this.i = 0; this.path = null; this.waitT = 0; this.log = []; }

  get done() { return this.i >= this.goals.length; }

  // returns this step's input: { move, grab, natural }
  input(dt, people = []) {
    const out = { move: { x: 0, z: 0 }, grab: false, natural: false };
    const worried = people.some((g) => (g.sus.get(this.coat) ?? 0) > 0.45);
    const g = this.goals[this.i]; if (!g) return out;
    const f = this.coat.walker.feet;
    if (g.go) {
      if (!this.path) this.path = this.nav.path(f.x, f.z, g.go[0], g.go[1]) || [{ x: g.go[0], z: g.go[1] }];
      while (this.path.length && Math.hypot(this.path[0].x - f.x, this.path[0].z - f.z) < 0.4) this.path.shift();
      if (!this.path.length || Math.hypot(g.go[0] - f.x, g.go[1] - f.z) < (g.within ?? 0.45)) { this.next(`at ${g.go}`); return out; }
      if (worried && !g.hurry) { out.natural = true; return out; }           // stop and act natural until they calm down
      const n = this.path[0], d = Math.hypot(n.x - f.x, n.z - f.z);
      out.move = { x: (n.x - f.x) / d, z: (n.z - f.z) / d };
      this.stuck = (this.stuck ?? 0) + (this.coat.walker.flatSpeed < 0.2 ? dt : -this.stuck);
      if (this.stuck > 1.5) { this.path = null; this.stuck = 0; }           // bumped into something: find a new way
    } else if (g.press) { out.grab = true; this.next('press E'); }
    else if (g.fire) {                                       // hold the gadget button, then let go
      this.fireT = (this.fireT ?? 0) + dt; out.select = g.fire.select; out.aim = g.fire.aim;
      if (this.fireT < (g.fire.hold ?? 0.1)) out.fire = true; else { this.fireT = 0; this.next('fired'); }
    }
    else if (g.until) { if (g.until()) this.next('until'); }
    else if (g.wait !== undefined) { this.waitT += dt; out.natural = !!g.natural; if (this.waitT >= g.wait) { this.waitT = 0; this.next('waited'); } }
    return out;
  }

  next(what) { this.log.push(`${this.i}: ${what}`); this.i++; this.path = null; }
}
