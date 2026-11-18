// Recorded voices for moments: the narrator introduces each errand and reads the rank, the kids inside
// the coat squeak when something happens ("Scatter!", "Ow! My nose!"), and the grown-ups react out loud
// ("Hm?", "Well, I never!"). Clips are in js/voicefiles.gen.js; the line order is in tools/voice_plan.mjs.
import { E } from './config.js';
import { VOICE_FILES } from './voicefiles.gen.js';

// grown-up reactions, in BARK order: 0 Hm?  1 Oh!  2 Pardon?  3 Well, I never!  4 Ha ha ha!  5 Ooh!  6 Hmm. Right.  7 Oh, how lovely.  8 Excuse me?  9 Goodness me!
const BARK = { calm: [4, 7, 6], shock: [3, 9, 5, 1], doubt: [0, 2, 8] };
// what the kids say (kid, line) for each event; one is picked at random
const KID = {
  [E.RIP]: [['kid_top', 2], ['kid_middle', 7], ['kid_top', 1]],
  [E.RESTACK]: [['kid_top', 3], ['kid_middle', 8]],
  [E.FALL]: [['kid_top', 5], ['kid_bottom', 6], ['kid_top', 11]],
  [E.STUMBLE]: [['kid_top', 10], ['kid_bottom', 3], ['kid_middle', 3], ['kid_bottom', 4]],
  [E.SLIP]: [['kid_bottom', 8]],
  [E.GRAB]: [['kid_middle', 1], ['kid_middle', 5]],
  [E.DROP]: [['kid_middle', 6]],
  [E.CALM]: [['kid_middle', 9], ['kid_middle', 13], ['kid_middle', 12]],
  [E.ASK]: [['kid_top', 4], ['kid_bottom', 14]],
  [E.SIGNED]: [['kid_top', 13], ['kid_middle', 14]],
  [E.CAUGHT]: [['kid_bottom', 9]],
  [E.NEXT]: [['kid_top', 7], ['kid_bottom', 15], ['kid_middle', 12]],
};
// how often the kids speak up for each event (they are trying to be quiet, after all)
const KID_CHANCE = { [E.STUMBLE]: 0.35, [E.GRAB]: 0.4, [E.CALM]: 0.5, [E.FALL]: 0.8 };
// idle mutters while walking along
const IDLE = [['kid_bottom', 1], ['kid_bottom', 2], ['kid_bottom', 13], ['kid_middle', 11], ['kid_middle', 2], ['kid_top', 9], ['kid_top', 14], ['kid_bottom', 7], ['kid_middle', 15]];
// the narrator: each errand's name and its one-liner, then the ranks
const INTRO = { shop: [2, 3], bank: [4, 5], cinema: [6, 7], drive: [8] };
const RANK = { S: 16, A: 17, B: 18, C: 19, D: 20 };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Callouts {
  constructor() { this.kidT = 0; this.idleT = 14; this.lastErrand = ''; this.firstRun = true; this.cur = null; }

  play(key, vol = 1, delay = 0, narr = false) {
    const file = VOICE_FILES[key]; if (!file || !this.on) return false;
    globalThis.__calls?.push(key);          // tests listen here
    const go = () => {
      try {
        if (narr && this.cur) this.cur.volume *= 0.4;             // the narrator talks over the kids
        const a = new Audio(file); a.volume = Math.max(0, Math.min(1, vol)); a.play().catch(() => {});
        if (!narr) this.cur = a;
      } catch { /* no audio here */ }
    };
    if (delay) setTimeout(go, delay * 1000); else go();
    return true;
  }
  kid(list, vol = 0.8, delay = 0) { if (this.kidT > 0) return; const [who, n] = pick(list); if (this.play(`${who}:K${n}`, vol, delay)) this.kidT = 2.2; }
  // the grown-up nearest the coat reacts
  bark(Wd, i, kind, vol = 0.85) {
    const p = i >= 0 ? Wd.people[i] : nearest(Wd); if (!p) return;
    const d = Math.hypot(p.x - Wd.body.x, p.z - Wd.body.z), v = vol * Math.max(0, Math.min(1, 1.25 - d / 12));
    if (v > 0.08) this.play(`${p.id}:B${pick(BARK[kind])}`, v, 0.25);
  }

  // every event the screen sees
  event(Wd, k, a, rank) {
    if (!this.on) return;
    if (k === E.END) { this.play(a === 1 ? `narrator:N${RANK[rank] ?? 15}` : 'narrator:N11', 1, 1.2, true); return; }
    if (k === E.RIP) this.play('narrator:N13', 0.9, 0, true);
    if (k === E.CALM) this.bark(Wd, a, 'calm');
    if (k === E.FALL || k === E.RIP) this.bark(Wd, -1, 'shock');
    if (k === E.STUMBLE && Math.random() < 0.3) this.bark(Wd, -1, 'doubt');
    if (k === E.NEXT) this.play('narrator:N15', 1, 0.3, true);
    const list = KID[k]; if (!list) return;
    if (Math.random() > (KID_CHANCE[k] ?? 1)) return;
    this.kid(list, 0.8, k === E.RIP ? 1.1 : 0.15);
  }

  // every frame: the narrator's errand intros and the kids' idle mutters
  update(Wd, dt, on) {
    this.on = on; this.kidT -= dt;
    const id = Wd.errand?.id;
    if (Wd.phase === 'play' && id && id !== this.lastErrand && Wd.time > 0.3) {
      this.lastErrand = id;
      if (on) {
        let t = 0.4;
        if (this.firstRun) { this.play('narrator:N25', 1, t, true); t += 1.8; this.firstRun = false; }
        for (const n of INTRO[id] || []) { this.play(`narrator:N${n}`, 1, t, true); t += 1.9; }
        this.kidT = t + 1;
      }
    }
    const b = Wd.body, moved = Math.hypot(b.x - (this.px ?? b.x), b.z - (this.pz ?? b.z)); this.px = b.x; this.pz = b.z;
    if (Wd.phase === 'play' && !b.popped && !Wd.car && moved > dt * 0.3) {
      this.idleT -= dt;
      if (this.idleT <= 0) { this.idleT = 18 + Math.random() * 16; this.kid(IDLE, 0.55); }
    }
  }
  reset() { this.lastErrand = ''; this.firstRun = true; }
}

function nearest(Wd) {
  let best = null, bd = 1e9;
  for (const p of Wd.people) { const d = Math.hypot(p.x - Wd.body.x, p.z - Wd.body.z); if (d < bd) { bd = d; best = p; } }
  return best;
}
