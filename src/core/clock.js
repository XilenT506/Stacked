// Fixed-step game clock: the simulation always advances in steps of 1/60 s,
// however fast or slow the screen draws. Rendering can blend between steps with `alpha`.
export const STEP = 1 / 60;

export class Clock {
  constructor(maxSteps = 5) { this.acc = 0; this.time = 0; this.maxSteps = maxSteps; }
  // feed real seconds; returns how many fixed steps to run now
  advance(dt) {
    this.acc = Math.min(this.acc + Math.max(0, dt), STEP * this.maxSteps);
    let n = 0;
    while (this.acc >= STEP) { this.acc -= STEP; this.time += STEP; n++; }
    return n;
  }
  get alpha() { return this.acc / STEP; }
}
