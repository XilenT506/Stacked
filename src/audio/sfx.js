// Placeholder sound effects made by the browser from data/sounds.json (no sound files yet).
// play(name, position): quieter the further it is from the listener. Silent until the first key or click
// (browsers do not allow sound before that).
export class Sfx {
  constructor(sounds) {
    this.sounds = sounds; this.ctx = null; this.listener = { x: 0, z: 0 }; this.on = true; this.recent = new Map();
    const start = () => { if (!this.ctx) try { this.ctx = new AudioContext(); } catch { this.on = false; } };
    addEventListener('keydown', start, { once: true }); addEventListener('pointerdown', start, { once: true });
  }

  play(name, pos) {
    const s = this.sounds[name], c = this.ctx;
    if (!s || !c || !this.on) return;
    // the same sound many times in one moment (40 tins) is played a few times, not forty
    const now = c.currentTime, last = this.recent.get(name) || 0;
    if (now - last < 0.04) return; this.recent.set(name, now);
    const d = pos ? Math.hypot(pos.x - this.listener.x, pos.z - this.listener.z) : 0, vol = s.vol * Math.max(0, 1 - d / 30);
    if (vol < 0.01) return;
    const g = c.createGain(); g.connect(c.destination);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + s.dur);
    let src;
    if (s.wave === 'noise') {
      const b = c.createBuffer(1, Math.ceil(c.sampleRate * s.dur), c.sampleRate), ch = b.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      src = c.createBufferSource(); src.buffer = b;
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(s.f0, now); f.frequency.exponentialRampToValueAtTime(Math.max(30, s.f1), now + s.dur);
      src.connect(f); f.connect(g);
    } else {
      src = c.createOscillator(); src.type = s.wave;
      src.frequency.setValueAtTime(s.f0, now); src.frequency.exponentialRampToValueAtTime(Math.max(30, s.f1), now + s.dur);
      src.connect(g);
    }
    src.start(now); src.stop(now + s.dur + 0.02);
  }
}
