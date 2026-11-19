// Music with three layers that fade in with Heat: calm (Heat 0), alert (staring, Security) and panic.
// All three loops play together from the first key or click; only their volumes change, so a rising Heat
// slides the music from cool jazz into a sneaky chase without a jump. Closing Time keeps it at least
// "alert"; a Giggle Rush speeds the music up; between jobs (results and Del's) a results tune plays.
// The tracks are the old game's placeholders (assets/music); real licensed music comes later.
import calm from '../../assets/music/m_theme_jazz.mp3';
import alert from '../../assets/music/m_sneaky.mp3';
import panic from '../../assets/music/m_chase.mp3';
import results from '../../assets/music/m_results.mp3';

const FILES = { calm, alert, panic, results };

export class Music {
  constructor(M) {
    this.M = M; this.on = true; this.ctx = null; this.layers = {}; this.level = 0; this.mode = 'job';
    const start = () => this.start(); globalThis.addEventListener?.('keydown', start, { once: true }); globalThis.addEventListener?.('pointerdown', start, { once: true });
  }

  async start() {
    if (this.ctx) return;
    try { this.ctx = new AudioContext(); } catch { return; }
    const c = this.ctx; this.out = c.createGain(); this.out.gain.value = this.on ? this.M.volume : 0; this.out.connect(c.destination);
    for (const [k, url] of Object.entries(FILES)) {
      try {
        const buf = await c.decodeAudioData(await (await fetch(url)).arrayBuffer());
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = c.createGain(); g.gain.value = 0; src.connect(g).connect(this.out); src.start();
        this.layers[k] = { src, g };
      } catch { /* that layer stays silent */ }
    }
    this.apply(true);
  }

  // what is going on: Heat level, Closing Time, a Giggle Rush, and whether we are between jobs
  set({ heat = 0, closing = false, rush = false, between = false }) {
    const level = Math.max(heat, closing ? this.M.closingTimeAtLeast : 0), mode = between ? 'between' : 'job';
    if (level === this.level && mode === this.mode && rush === this.rush) return;
    this.level = level; this.mode = mode; this.rush = rush; this.apply();
  }

  apply(now = false) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, fade = now ? 0.05 : this.M.fade, mix = this.M.layers[this.level] ?? this.M.layers[0];
    const want = this.mode === 'between' ? { calm: 0, alert: 0, panic: 0, results: 1 } : { calm: mix[0], alert: mix[1], panic: mix[2], results: 0 };
    for (const [k, L] of Object.entries(this.layers)) {
      L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(want[k] ?? 0, t, fade / 3);
      L.src.playbackRate.setTargetAtTime(this.rush && this.mode === 'job' ? this.M.rushRate : 1, t, 0.3);
    }
  }

  toggle() { this.on = !this.on; if (this.out) this.out.gain.setTargetAtTime(this.on ? this.M.volume : 0, this.ctx.currentTime, 0.1); return this.on; }

  // for the tests: how loud each layer is meant to be right now
  mix() { return this.mode === 'between' ? [0, 0, 0] : this.M.layers[this.level]; }
}
