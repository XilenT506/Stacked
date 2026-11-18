// A first-time group: same plans as the expert bots, but people who are new to the controls.
// They react late, stop to read the instructions when a step changes, now and then freeze while they work out
// which key does what, push the walk too hard, shake the hands, and forget to nod back.
import { clamp } from '../../js/config.js';
export class Novice {
  constructor(n, rng) {
    this.n = n; this.rng = rng; this.freeze = Array(n).fill(0); this.step = -1; this.miss = Array(n).fill(0); this.missT = 0; this.held = [];
  }
  apply(Wd, P, dt) {
    const r = this.rng, e = Wd.errand;
    const key = e.id + '/' + e.step;
    if (key !== this.step) { this.step = key; for (let p = 0; p < this.n; p++) this.freeze[p] = Math.max(this.freeze[p], 1.5 + r() * 3); }   // "what do we do now?"
    this.missT -= dt; if (this.missT <= 0) { this.missT = 4; for (let p = 0; p < this.n; p++) this.miss[p] = r() < 0.45 ? 1 : 0; }
    P.forEach((pk, p) => {
      if (this.freeze[p] > 0) { this.freeze[p] -= dt; if (this.held[p]) { pk.l = [0, 0, 0]; pk.h = this.held[p].h; pk.hd = [this.held[p].hd[0], this.held[p].hd[1], 0]; } return; }
      if (r() < 0.05 * dt * (this.n === 1 ? 1.6 : 1)) this.freeze[p] = 0.8 + r() * 2.2;                 // lost for a moment
      // the walk: too much, too long
      if (pk.l[0] > 0.05 && !Wd.car) pk.l[0] = clamp(pk.l[0] * 1.15 + 0.08, -1, 1);
      // shaky hands
      pk.h = pk.h.map((h) => [h[0] + (r() - 0.5) * 0.05, h[1] + (r() - 0.5) * 0.05, h[2] + (r() - 0.5) * 0.04, h[3]]);
      // forgot to nod or answer
      if (this.miss[p]) pk.hd = [pk.hd[0], pk.hd[1], pk.hd[2] & ~1];
      this.held[p] = JSON.parse(JSON.stringify(pk));
    });
    return P;
  }
}
