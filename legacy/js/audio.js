// Sound with the Web Audio API. Effects are made in code: footsteps that drift out of step, a creak when
// the stack leans, fabric ripping, gasps, a cash register, mumbled grown-up gibberish.
// Music and background sound are recorded loops (assets/music, made by tools/prep_music.sh), one per place;
// until they are decoded (or if decoding fails) the code-made themes play: a sneaky errand theme that
// tightens as the "?" meters rise, and a frantic chase theme during Scatter.
import { E } from './config.js';
import mJazz from '../assets/music/m_theme_jazz.mp3';
import mSneaky from '../assets/music/m_sneaky.mp3';
import mChase from '../assets/music/m_chase.mp3';
import mDriving from '../assets/music/m_driving.mp3';
import mCinema from '../assets/music/m_cinema.mp3';
import mSurvival from '../assets/music/m_survival.mp3';
import mResults from '../assets/music/m_results.mp3';
import mBusted from '../assets/music/m_busted.mp3';
import aTown from '../assets/music/a_town.mp3';
import aBank from '../assets/music/a_bank.mp3';
import aCinema from '../assets/music/a_cinema.mp3';
import aCar from '../assets/music/a_car.mp3';

const FILES = { jazz: mJazz, sneaky: mSneaky, chase: mChase, driving: mDriving, cinema: mCinema, survival: mSurvival, results: mResults, busted: mBusted,
  aTown, aBank, aCinema, aCar };
// which loop plays where
const MUSIC = { shop: 'jazz', bank: 'sneaky', cinema: 'cinema', drive: 'driving' };
const AMB = { shop: 'aTown', bank: 'aBank', cinema: 'aCinema', drive: 'aCar' };

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.step = 0; this.next = 0; this.beat = 0; this.gibT = 0; this.lastPh = 0; this.tension = 0; }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
    this.fx = c.createGain(); this.fx.gain.value = 0.9; this.fx.connect(this.master);
    const len = c.sampleRate; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // the creak is one voice that is always there, silent until the stack leans
    this.creakOsc = c.createOscillator(); this.creakOsc.type = 'sawtooth';
    this.creakF = c.createBiquadFilter(); this.creakF.type = 'bandpass'; this.creakF.Q.value = 9;
    this.creakG = c.createGain(); this.creakG.gain.value = 0;
    this.creakOsc.connect(this.creakF).connect(this.creakG).connect(this.fx); this.creakOsc.start();
    this.next = c.currentTime + 0.1;
    this.amb = c.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);
    this.buf = {}; this.loops = { music: null, amb: null };
    // decode the recorded loops: the one asked for first, then the rest in the background, one at a time
    this.dec = {};
    (async () => { await new Promise((r) => setTimeout(r, 1500)); for (const k of Object.keys(FILES)) await this.decode(k); })();
  }
  decode(k) {
    return (this.dec[k] ||= (async () => {
      try { const ab = await (await fetch(FILES[k])).arrayBuffer(); this.buf[k] = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)); } catch { /* the code-made music stays */ }
    })());
  }

  // one looping recording per slot ('music' or 'amb'); a new key fades the old one out and the new one in
  loop(slot, key) {
    const cur = this.loops[slot];
    if ((cur?.key ?? null) === (key ?? null)) return !!cur;
    if (key && !this.buf[key]) { this.decode(key); return false; }
    const c = this.ctx, t = c.currentTime;
    if (cur) { cur.g.gain.setTargetAtTime(0, t, 0.35); cur.s.stop(t + 2); }
    this.loops[slot] = null;
    if (!key) return false;
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.buf[key]; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(1, t, 0.5);
    s.connect(g).connect(slot === 'music' ? this.music : this.amb); s.start(t);
    this.loops[slot] = { key, s, g };
    return true;
  }
  once(key, vol = 1) {
    if (!this.buf[key]) { this.decode(key); return false; }
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.buf[key]; g.gain.value = vol; s.connect(g).connect(this.music); s.start();
    return true;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; }

  tone(f, t, dur, type = 'sine', vol = 0.2, dest = this.fx, slide = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  noise(t, dur, freq, q = 1, vol = 0.3, type = 'bandpass', dest = this.fx, slide = 0) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // One syllable of grown-up mumble: a buzzy voice through two moving vowel filters.
  syllable(t, pitch, vol = 0.16) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
    const vow = [[700, 1100], [400, 2000], [300, 900], [500, 1500], [350, 2300]][Math.floor(Math.random() * 5)];
    o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch * (0.9 + Math.random() * 0.25), t); o.frequency.linearRampToValueAtTime(pitch * (0.85 + Math.random() * 0.3), t + 0.12);
    f1.type = f2.type = 'bandpass'; f1.frequency.value = vow[0]; f2.frequency.value = vow[1]; f1.Q.value = f2.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(this.fx); o.start(t); o.stop(t + 0.16);
  }
  mumble(pitch, n = 5) { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < n; i++) this.syllable(t + i * 0.13 + Math.random() * 0.03, pitch); }

  event(kind, arg) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    switch (kind) {
      case E.FALL: this.noise(t, 0.35, 140, 0.8, 0.9, 'lowpass'); this.tone(90, t, 0.3, 'sine', 0.5, this.fx, 0.5); this.noise(t + 0.12, 0.2, 900, 1, 0.25); break;
      case E.STUMBLE: this.tone(520, t, 0.16, 'triangle', 0.14, this.fx, 0.6); break;
      case E.RIP: this.noise(t, 0.55, 2600, 1.5, 0.7, 'bandpass', this.fx, 0.25); this.noise(t + 0.05, 0.4, 5200, 3, 0.3, 'highpass'); break;
      case E.GASP: this.noise(t, 0.3, 900, 3, 0.35, 'bandpass', this.fx, 2.6); break;
      case E.REGISTER: this.noise(t, 0.08, 3000, 1, 0.3, 'highpass'); this.tone(1760, t + 0.07, 0.5, 'sine', 0.3); this.tone(2637, t + 0.07, 0.6, 'sine', 0.2); this.tone(2093, t + 0.2, 0.5, 'sine', 0.16); break;
      case E.YELP: this.tone(900, t, 0.14, 'square', 0.16, this.fx, 1.9); this.tone(1200, t + 0.16, 0.12, 'square', 0.12, this.fx, 0.6); break;
      case E.CLANG: this.tone(310, t, 0.5, 'square', 0.14); this.tone(467, t, 0.4, 'square', 0.1); this.noise(t, 0.15, 1800, 1, 0.35); break;
      case E.COIN: this.tone(1568, t, 0.09, 'square', 0.1); this.tone(2093, t + 0.08, 0.25, 'square', 0.1); break;
      case E.SLIP: this.tone(300, t, 0.4, 'sawtooth', 0.12, this.fx, 3); break;
      case E.CAUGHT: this.tone(392, t, 0.15, 'square', 0.12); this.tone(294, t + 0.15, 0.3, 'square', 0.12); break;
      case E.FREED: case E.HOPIN: case E.RESTACK: this.tone(523, t, 0.1, 'triangle', 0.16); this.tone(784, t + 0.1, 0.2, 'triangle', 0.16); break;
      case E.DROP: this.noise(t, 0.12, 300, 1, 0.5, 'lowpass'); break;
      case E.HOPOUT: case E.SWAP: this.noise(t, 0.18, 1500, 2, 0.25, 'bandpass', this.fx, 0.5); break;
      case E.HAT: this.noise(t, 0.1, 2500, 2, 0.12); break;
      case E.SIGNED: this.noise(t, 0.2, 3500, 4, 0.14, 'bandpass', this.fx, 1.5); break;
      case E.CALM:        // a bluff landed: a soft "phew" breath, then a warm three-note chime
        this.noise(t, 0.35, 1400, 1.2, 0.22, 'bandpass', this.fx, 0.35);
        [523, 659, 784].forEach((f, i) => { this.tone(f, t + 0.12 + i * 0.09, 0.45, 'sine', 0.2); this.tone(f * 2, t + 0.12 + i * 0.09, 0.3, 'triangle', 0.06); });
        break;
      case E.PAT: for (let i = 0; i < 4; i++) this.noise(t + i * 0.11, 0.05, 300, 1, 0.3, 'lowpass'); this.tone(2400, t + 0.2, 0.08, 'square', 0.03); break;
      case E.LOOK: this.tone(700, t, 0.1, 'triangle', 0.1, this.fx, 1.4); break;
      case E.POINT: this.tone(988, t, 0.1, 'square', 0.08); this.tone(1319, t + 0.09, 0.3, 'square', 0.08); break;
      case E.LEVEL: [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.1, 0.4, 'triangle', 0.2)); this.noise(t + 0.5, 0.4, 6000, 2, 0.1, 'highpass'); break;
      case E.BUMP: this.noise(t, 0.1, 220, 1, 0.5, 'lowpass'); break;
      case E.GRAB: this.noise(t, 0.06, 1200, 2, 0.2); break;
      case E.UP: this.tone(330, t, 0.2, 'triangle', 0.12, this.fx, 1.6); break;
      case E.END:
        if (this.once(arg === 1 ? 'results' : 'busted', 1.4)) break;
        if (arg === 1) [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.12, 0.35, 'triangle', 0.18));
        else [392, 330, 262, 196].forEach((f, i) => this.tone(f, t + i * 0.18, 0.4, 'sawtooth', 0.1));
        break;
    }
  }

  // Called every frame with what this screen can hear.
  update(Wd, dt, ctx) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, b = Wd.body;
    // footsteps: three kids never land together
    if (!b.popped && !b.down) {
      const ph = Math.floor(b.ph / Math.PI);
      if (ph !== this.lastPh) {
        this.lastPh = ph; const g = Wd.ord.gait, tip = g === 1 ? 0.35 : g === 2 ? 1.5 : g === 3 ? 0.6 : 1;
        if (g === 3) this.noise(t, 0.16, 900, 0.8, 0.12, 'bandpass');            // shuffle: a scrape
        this.noise(t, 0.07, 160 + Math.random() * 60, 1, 0.42 * tip, 'lowpass');
        this.noise(t + 0.05 + Math.random() * 0.07, 0.05, 420, 2, 0.12 * tip);
        if (b.count > 2 && Math.random() < 0.5) this.noise(t + 0.13 + Math.random() * 0.06, 0.04, 700, 3, 0.07 * tip);
      }
    }
    for (const k of Wd.kids) if (k.lead && !k.caught && Math.random() < dt * 7) this.noise(t, 0.04, 500, 2, 0.1);
    // creak
    const lean = b.popped || b.down ? 0 : Math.min(1, Math.hypot(b.lx, b.lz) / 0.55);
    this.creakOsc.frequency.setTargetAtTime(55 + lean * 70, t, 0.05); this.creakF.frequency.setTargetAtTime(300 + lean * 900, t, 0.05);
    this.creakG.gain.setTargetAtTime(lean > 0.35 ? (lean - 0.35) * 0.5 : 0, t, 0.06);
    // voices
    this.gibT -= dt;
    if (this.gibT <= 0) {
      if (Wd.ord.talk && !b.popped) { this.syllable(t, 300 + Math.random() * 60, 0.18); this.gibT = 0.12 + Math.random() * 0.08; }
    }
    Wd.people.forEach((p, i) => { if (p.say >= 0 && p.say !== (this.said?.[i] ?? -1)) this.mumble([210, 120, 95, 160, 250, 140, 185][i % 7], 4); });
    this.said = Wd.people.map((p) => p.say);
    // music
    const sus = Math.max(0, ...Wd.people.map((p) => p.sus));
    this.tension += ((Wd.phase === 'scatter' ? 1 : sus) - this.tension) * Math.min(1, dt * 2);
    const chase = Wd.phase === 'scatter', over = Wd.phase === 'end' || ctx.paused;
    const id = Wd.errand?.id;
    const rec = this.loop('music', over ? null : chase ? 'chase' : Wd.run?.mode === 'survival' ? 'survival' : MUSIC[id] || 'jazz');
    this.loop('amb', over ? null : AMB[id] || 'aTown');
    if (rec) {   // a recording plays: only keep the code-made ticking that rises with the "?" meters
      this.music.gain.setTargetAtTime(0.32 * (1 + this.tension * 0.25), t, 0.3);
      while (this.next < t + 0.12) {
        const st = this.beat % 16, T = this.tension;
        if (!chase && !over && ((T > 0.45 && st % 2 === 0) || T > 0.8)) this.noise(this.next, 0.025, 7000, 2, 0.03 + T * 0.06, 'highpass', this.music);
        this.beat = (this.beat + 1) % 64; this.next += 60 / (100 + T * 30) / 4;
      }
      return;
    }
    const bpm = chase ? 168 : 92 + this.tension * 26, s16 = 60 / bpm / 4;
    while (this.next < t + 0.12) {
      if (!over) (chase ? this.chaseStep : this.sneakStep).call(this, this.beat, this.next, s16);
      this.beat = (this.beat + 1) % 64; this.next += s16 * (this.beat % 2 && !chase ? 0.82 : chase ? 1 : 1.18);   // swing
    }
  }

  // Sneaky theme: tiptoe bass, plucked answer, a ticking hat that gets busier with tension.
  sneakStep(i, t, s) {
    const m = this.music, T = this.tension, bar = Math.floor(i / 16) % 4, st = i % 16;
    const roots = [110, 110, 87.3, 98], r = roots[bar];
    const bass = [1, 0, 0, 0, 0, 0, 1.5, 0, 1, 0, 0, 0, 1.19, 0, 0, 1.33][st];
    if (bass) this.tone(r * bass, t, s * 1.6, 'triangle', 0.42, m);
    const mel = [[0, 0, 4, 0, 3, 0, 0, 0, 0, 0, 4, 0, 6, 0, 3, 0], [0, 0, 4, 0, 3, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 3, 0, 2, 0, 0, 0, 0, 0, 3, 0, 5, 0, 2, 0], [0, 0, 6, 0, 5, 0, 4, 0, 3, 0, 0, 0, 0, 0, 0, 0]][bar][st];
    const scale = [0, 220, 261.6, 293.7, 329.6, 349.2, 415.3, 440];
    if (mel) this.tone(scale[mel], t, s * 1.1, 'square', 0.085, m);
    if (st % 4 === 2 || (T > 0.4 && st % 2 === 0) || (T > 0.75)) this.noise(t, 0.025, 7000, 2, 0.05 + T * 0.07, 'highpass', m);
    if (T > 0.5 && st % 8 === 0) { this.tone(r * 2 * 1.06, t, s * 6, 'sawtooth', 0.035 * T, m); this.tone(r * 2, t, s * 6, 'sawtooth', 0.035 * T, m); }
    if (st === 4 || st === 12) this.noise(t, 0.05, 1900, 3, 0.07, 'bandpass', m);
  }

  // Chase theme: fast, driving, slightly silly.
  chaseStep(i, t, s) {
    const m = this.music, bar = Math.floor(i / 16) % 4, st = i % 16, r = [146.8, 146.8, 174.6, 130.8][bar];
    if (st % 2 === 0) this.tone(r * (st % 8 === 6 ? 1.5 : 1), t, s * 1.5, 'sawtooth', 0.2, m);
    const arp = [1, 1.19, 1.5, 2, 1.5, 1.19, 1.78, 1.5][st % 8];
    this.tone(r * 2 * arp, t, s * 0.9, 'square', 0.085, m);
    if (st % 4 === 0) this.noise(t, 0.09, 110, 1, 0.5, 'lowpass', m);
    if (st % 4 === 2) this.noise(t, 0.07, 1900, 1.5, 0.22, 'bandpass', m);
    this.noise(t, 0.02, 8000, 2, 0.07, 'highpass', m);
  }
}
