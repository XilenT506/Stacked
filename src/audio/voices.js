// The grown-ups' recorded reactions ("Hm?", "THOSE ARE CHILDREN!", "Got you!"), played from the clips
// in src/audio/peopleVoices.gen.js. Quieter further away; one line at a time per grown-up, and at most
// two people talking at once so it never turns into a wall of noise.
import { PEOPLE_VOICES } from './peopleVoices.gen.js';

export class Voices {
  constructor() { this.listener = { x: 0, z: 0 }; this.busy = new Map(); this.playing = 0; this.on = true; this.unlocked = false;
    const u = () => { this.unlocked = true; }; addEventListener('keydown', u, { once: true }); addEventListener('pointerdown', u, { once: true }); }

  say(who, clip, pos) {
    const src = PEOPLE_VOICES[clip]; if (!src || !this.on || !this.unlocked) return false;
    const now = performance.now();
    if ((this.busy.get(who) ?? 0) > now || this.playing >= 2) return false;
    const d = pos ? Math.hypot(pos.x - this.listener.x, pos.z - this.listener.z) : 0, vol = Math.max(0, Math.min(1, 1.2 - d / 18));
    if (vol < 0.08) return false;
    try {
      const a = new Audio(src); a.volume = vol; this.playing++;
      const done = () => { this.playing = Math.max(0, this.playing - 1); };
      a.addEventListener('ended', done, { once: true }); a.addEventListener('error', done, { once: true });
      a.play().catch(done);
      this.busy.set(who, now + 2500);
      return true;
    } catch { return false; }
  }
}
