// The kids inside the coat and the narrator, out loud (the recorded lines from the old game; which line
// for which moment is in data/juice.json). The kids are trying to be quiet, so they only pipe up now and
// then and never talk over each other; the narrator talks over the kids for the big moments.
// Also the kids' idle mutters while you walk about.
import { CALLOUT_VOICES } from './calloutVoices.gen.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Callouts {
  constructor(J) {
    this.J = J; this.on = true; this.unlocked = false; this.kidT = 0; this.narT = 0; this.idleT = 16; this.cur = null; this.said = [];
    const u = () => { this.unlocked = true; }; globalThis.addEventListener?.('keydown', u, { once: true }); globalThis.addEventListener?.('pointerdown', u, { once: true });
  }

  play(file, vol = 1, narr = false) {
    this.said.push(file); if (this.said.length > 20) this.said.shift();          // tests read this
    const src = CALLOUT_VOICES[file]; if (!src || !this.on || !this.unlocked) return false;
    try {
      if (narr && this.cur) this.cur.volume *= 0.4;                              // the narrator talks over the kids
      const a = new Audio(src); a.volume = Math.max(0, Math.min(1, vol)); a.play().catch(() => {});
      if (!narr) this.cur = a;
      return true;
    } catch { return false; }
  }

  // a kid line for a moment (by name in juice.kids), if the kids are not already talking
  kid(name, vol = 0.8) {
    const list = this.J.kids[name]; if (!list || this.kidT > 0) return false;
    if (Math.random() > (this.J.kidChance[name] ?? 1)) return false;
    const [who, n] = pick(list); this.kidT = 2.2;
    this.play(`${who}_K${n}`, vol); return true;
  }

  narrator(name) {
    const n = this.J.narrator[name]; if (n === undefined || this.narT > 0) return false;
    this.narT = 3.5; this.play(`narrator_N${n}`, 1, true); return true;
  }

  // every frame: the kids mutter now and then while you walk about
  update(dt, walking) {
    this.kidT -= dt; this.narT -= dt;
    if (walking && (this.idleT -= dt) <= 0) { this.idleT = 18 + Math.random() * 16; this.kid('idle', 0.5); }
  }
}
