// The mess: puddles, splats and stains that stay on the floor for the rest of the job.
// It listens to every spill and slippery signal anywhere in the place and remembers a patch.
// Slippery patches make coats (and later grown-ups and props) slide. Nothing is ever cleaned up
// on its own; the shelf stacker might, later.
export class Mess {
  constructor(signals, balance) {
    this.patches = [];            // { x, z, r, color, slippery, time }
    this.time = 0;
    const life = balance?.slippery?.patchSeconds ?? null;      // null: the mess stays for the whole job
    this.life = life ?? Infinity;
    signals?.listen({ types: ['slippery', 'spill'], everywhere: true, hear: (s) => this.add(s) });
  }

  add(s) {
    const slippery = s.type === 'slippery', r = Math.max(0.5, Math.min(3, s.range));
    const color = s.data?.color ?? (slippery ? '#e8f6ff' : '#c9a46b');
    // a spill and a slippery signal from the same splat are one patch
    const same = this.patches.find((p) => Math.hypot(p.x - s.position.x, p.z - s.position.z) < 0.35 && p.color === color);
    if (same) { same.slippery ||= slippery; same.r = Math.max(same.r, r); same.time = this.time; return same; }
    const p = { x: s.position.x, z: s.position.z, r, color, slippery, time: this.time };
    this.patches.push(p);
    return p;
  }

  step(dt) {
    this.time += dt;
    if (this.life !== Infinity) this.patches = this.patches.filter((p) => this.time - p.time < this.life);
  }

  slipperyAt(x, z) { return this.patches.some((p) => p.slippery && Math.hypot(p.x - x, p.z - z) <= p.r); }
}
