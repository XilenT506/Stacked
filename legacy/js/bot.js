// A test bot that plays every part through the same controls a person uses: the joystick for all
// movement (walking, the hand, the eyes) and the action buttons. No mouse, no raise / lower keys.
// It tries every action, falls over and gets up, lets a kid out and back in, gets busted, survives
// the Scatter, restacks, bluffs the grown-ups and finishes the bank errand.
// Start it with ?bot=1 (add &speed=3 to hurry).
import { E, wrap, dist, yawTo, clamp } from './config.js';
import { TOWN } from './town.js';
import { offsetFor } from './assist.js';

export class Bot {
  constructor(input, getCue = () => null) {
    this.i = input; this.cue = getCue; this.t = 0; this.log = []; this.times = {}; this.done = false; this.error = null; this.gen = this.script();
    this.idle = { legs: 0, arms: 0, head: 0 }; this.lastAct = { legs: 0, arms: 0, head: 0 }; this.evSeen = 0; this.bluffs = 0;
  }

  update(Wd, dt) {
    this.W = Wd; this.t = Wd.time;
    if (this.done) return;
    if (Wd.phase === 'end' && !this.endOk) { this.error = 'the game ended early (end=' + Wd.end + ')'; this.done = true; console.error('[bot] ' + this.error); return; }
    for (const [id, k] of Wd.ev) { if (id <= this.evSeen) continue; this.evSeen = id; if (k === E.CALM) { this.bluffs++; this.mark('bluff landed'); } }
    // how long has each part had nothing to do? (the bot is one player, so only the part in use is busy)
    if (Wd.phase === 'play') for (const p of ['legs', 'arms', 'head']) {
      if (this.i.part === p) this.lastAct[p] = this.t; else this.idle[p] = Math.max(this.idle[p], this.t - this.lastAct[p]);
    } else for (const p of ['legs', 'arms', 'head']) this.lastAct[p] = this.t;
    try { if (this.gen.next().done) this.done = true; } catch (e) { this.error = e.message; this.done = true; console.error('[bot] ' + e.message); }
  }
  mark(what) { this.log.push(what); this.times[what] = +this.t.toFixed(1); console.log('[bot] ' + what + ' @' + this.t.toFixed(1) + 's'); }

  *wait(sec) { const end = this.t + sec; while (this.t < end) yield; }
  *until(fn, timeout, name) { const end = this.t + timeout; while (!fn()) { if (this.t > end) throw new Error('timed out waiting for: ' + (typeof name === 'function' ? name() : name)); yield; } }
  *part(p) { if (this.i.part === p) return; this.i.setMove(0, 0); yield; this.i.press(p); yield; yield; }
  *tap(name) { this.i.press(name); yield; yield; }
  *hold(name, sec) { this.i.setHeld(name, true); yield* this.wait(sec); this.i.setHeld(name, false); yield; }

  // the bluff: a wave and a nod at the same moment (the wave lingers while the bot switches to the head)
  *bluff(shake) {
    yield* this.part('arms'); yield* this.hold('wave', 0.25);
    yield* this.part('head'); yield* this.tap('hat'); yield* this.hold(shake ? 'shake' : 'nod', 0.7);
  }
  *manners() {
    const g = this.W.people.find((p) => p.greet);
    if (!g || this.W.body.down) return false;
    yield* this.bluff(g.greet === 2);
    yield* this.part('legs');
    return true;
  }

  *walkTo(x, z, o = {}) {
    const tol = o.tol ?? 0.35, end = this.t + (o.timeout ?? 40);
    yield* this.part('legs');
    for (;;) {
      const b = this.W.body;
      if (this.W.phase !== 'play') { this.i.setMove(0, 0); return false; }
      if (this.t > end) throw new Error(`could not walk to ${x},${z}`);
      const d = dist(b.x, b.z, x, z);
      if (d < tol) break;
      if (!o.rude && (yield* this.manners())) continue;
      const err = wrap(yawTo(x - b.x, z - b.z) - b.yaw);
      const wob = Math.hypot(b.lx, b.lz);
      const go = Math.abs(err) < 0.45 && wob < 0.3 ? (o.speed ?? 0.85) * Math.min(1, 0.35 + d) : 0;
      this.i.setHeld('tip', o.gait === 'tip'); this.i.setHeld('stride', o.gait === 'stride'); this.i.setHeld('shuffle', o.gait === 'shuffle');
      this.i.setMove(clamp(-err * 2.2, -1, 1), go);
      yield;
    }
    this.i.setMove(0, 0); for (const g of ['tip', 'stride', 'shuffle']) this.i.setHeld(g, false);
    yield* this.until(() => Math.abs(this.W.body.v) < 0.1, 4, 'stopping');
    return true;
  }

  *face(yaw) {
    yield* this.part('legs');
    yield* this.until(() => { const e = wrap(yaw - this.W.body.yaw); this.i.setMove(clamp(-e * 2.5, -1, 1), 0); return Math.abs(e) < 0.05; }, 8, 'turning');
    this.i.setMove(0, 0); yield;
  }

  // move one hand with the joystick only (left / right and near / far); height is automatic
  *handTo(idx, x, z, tol = 0.03, timeout = 8) {
    yield* this.part('arms');
    if (this.i.sel !== idx) { yield* this.tap('hand'); }
    const h = this.i.hand[idx];
    yield* this.until(() => {
      const dx = x - h.x, dz = z - h.z;
      this.i.setMove(clamp(dx * 9, -1, 1), clamp(dz * 9, -1, 1));
      return Math.abs(dx) < tol && Math.abs(dz) < tol;
    }, timeout, () => `moving hand ${idx} to ${x.toFixed(2)},${z.toFixed(2)} (at ${h.x.toFixed(2)},${h.z.toFixed(2)}; part ${this.i.part}, sel ${this.i.sel})`);
    this.i.setMove(0, 0); yield;
  }

  *kidTo(x, z, timeout = 30) {
    const end = this.t + timeout;
    for (;;) {
      const mine = this.W.kids.filter((k) => !k.caught);
      if (!mine.length || this.W.phase === 'end') return false;
      const k = mine.find((q) => q.lead) || mine[0];
      const dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz);
      if (d < 0.45 || this.t > end) break;
      let vx = dx / d, vz = dz / d;
      for (const p of this.W.people) {            // swerve round a grown-up who is chasing
        if (p.mode !== 1) continue;
        const ax = k.x - p.x, az = k.z - p.z, ad = Math.hypot(ax, az);
        if (ad < 3.6 && ad > 0.01) {              // back off a little and, mostly, run round them
          const w = (3.6 - ad) / 3.6, nx = ax / ad, nz = az / ad;
          let tx = -nz, tz = nx; if (tx * dx + tz * dz < 0) { tx = -tx; tz = -tz; }
          vx += nx * w * 1.2 + tx * w * 2.2; vz += nz * w * 1.2 + tz * w * 2.2;
        }
      }
      const vm = Math.hypot(vx, vz) || 1;
      this.i.setMove(-vx / vm, vz / vm);          // the kid camera looks north, so screen right is west
      yield;
    }
    this.i.setMove(0, 0); yield;
    return true;
  }

  *script() {
    const W = () => this.W;
    yield* this.wait(0.5);
    // 0. try every action once, hidden in the alley
    yield* this.part('legs');
    for (const [g, want] of [['stride', 2.6], ['shuffle', 0.35], ['tip', 0.6]]) {
      this.i.setHeld(g, true); this.i.setMove(0, 1); let top = 0;
      yield* this.until(() => { top = Math.max(top, W().body.v); return W().body.z > -3.4 || top > want; }, 4, g);
      this.i.setHeld(g, false); this.i.setMove(0, -1); yield* this.until(() => W().body.z < -4.6, 6, 'backing up'); this.i.setMove(0, 0);
      if (top <= want * 0.8) throw new Error(g + ' did not change the walking speed (top ' + top.toFixed(2) + ')');
    }
    this.mark('gaits: stride, shuffle, tiptoe');
    yield* this.until(() => Math.abs(W().body.v) < 0.05, 3, 'stopping');
    // the legs stop when the walk control is let go, even after switching part
    this.i.setMove(0, 1); yield* this.wait(0.3); yield* this.part('arms'); yield* this.wait(0.6);
    if (Math.abs(W().body.v) > 0.05) throw new Error('the legs kept walking after the walk control was released');
    this.mark('legs stop when released');
    // ...unless "keep walking" is switched on
    yield* this.part('legs'); yield* this.tap('keep'); this.i.setMove(0, -0.5); yield* this.wait(0.3);
    this.i.press('arms'); yield; yield; this.i.setMove(0, 0); yield* this.wait(0.5);
    if (Math.abs(W().body.v) < 0.2) throw new Error('keep walking did not keep the legs going');
    yield* this.part('legs'); yield* this.tap('keep'); this.i.setMove(0, 0); yield* this.wait(0.4);
    this.mark('keep walking toggle');
    yield* this.part('arms');
    yield* this.tap('pat'); if (!(W().patT > 0)) throw new Error('pat pockets did nothing'); yield* this.wait(1.1);
    this.i.setHeld('point', true); yield* this.wait(0.3); if (W().ord.hand[this.i.sel].act !== 2) throw new Error('point did nothing'); this.i.setHeld('point', false);
    this.i.setHeld('wave', true); yield* this.wait(0.3); if (W().ord.hand[this.i.sel].act !== 1) throw new Error('wave did nothing'); this.i.setHeld('wave', false); yield* this.wait(1.5);
    yield* this.part('head');
    this.i.setHeld('brow', true); yield* this.wait(0.3); if (!W().ord.brow) throw new Error('eyebrows did nothing'); this.i.setHeld('brow', false);
    this.i.setMove(1, 1); yield* this.wait(0.4); this.i.setMove(0, 0);
    if (!(this.i.head.y < -0.2 && this.i.head.p > 0.1)) throw new Error('the joystick did not move the eyes in both directions');
    this.i.setMove(-1, -1); yield* this.wait(0.4); this.i.setMove(0, 0);
    this.mark('arm and head actions');
    // 1. fall over on purpose, hidden in the alley, and get back up
    yield* this.handTo(1, 0.5, 0.75); yield* this.handTo(0, -0.5, 0.75);
    yield* this.part('legs');
    let flip = 1, next = 0;
    this.i.setHeld('stride', true);
    yield* this.until(() => { if (this.t > next) { flip = -flip; next = this.t + 0.5; } this.i.setMove(flip, flip > 0 ? 1 : -0.4); return W().body.down; }, 15, 'falling over');
    this.i.setHeld('stride', false);
    this.mark('fell over'); this.i.setMove(0, 0);
    yield* this.until(() => !W().body.down, 6, 'getting up');
    this.mark('got back up');
    yield* this.handTo(1, 0, 0); yield* this.handTo(0, 0, 0);
    // 2. back to the middle of the alley, let a kid out, run about, come back, swap places
    yield* this.walkTo(-7.3, -4.9, { tol: 0.5 });
    this.i.press('hop'); yield* this.until(() => W().kids.length === 1 && W().body.count === 2, 3, 'kid hopping out');
    this.mark('kid out');
    yield* this.part('kid'); this.i.setMove(0.6, 0.6); yield* this.wait(0.35); this.i.setMove(0, 0); yield;
    yield* this.kidTo(W().body.x + 0.8, W().body.z);
    this.i.press('hop'); yield* this.until(() => W().kids.length === 0 && W().body.count === 3, 3, 'kid hopping back in');
    this.mark('kid back in');
    yield* this.tap('swap'); this.mark('swap pressed');
    // 3. walk out to the street and fall over right in front of Officer Hale
    yield* this.walkTo(-5.8, -3.6); yield* this.walkTo(-5.8, 0.3); yield* this.walkTo(0.6, 0.6, { rude: true, gait: 'stride' });
    if (W().phase === 'play') {
      yield* this.handTo(1, 0.5, 0.75); yield* this.handTo(0, -0.5, 0.75);
      yield* this.part('legs'); this.i.setHeld('stride', true);
      yield* this.until(() => { if (this.t > next) { flip = -flip; next = this.t + 0.5; } this.i.setMove(flip, 1); return W().phase !== 'play'; }, 25, 'getting busted');
      this.i.setHeld('stride', false);
    }
    if (W().phase !== 'scatter') throw new Error('expected a Scatter, got ' + W().phase);
    this.mark('busted: scatter');
    // 4. Scatter: run the kids home. Anyone caught waits on the bench until the grown-ups give up, then gets freed.
    this.times.scatterStart = +this.t.toFixed(1);
    yield* this.kidTo(-5.8, 0.3); yield* this.kidTo(-5.8, -2.3, 8); yield* this.kidTo(-7.3, -5.2, 8);
    for (let lap = 0; lap < 8 && W().phase === 'scatter'; lap++) {
      if (!W().kids.some((k) => k.caught)) { yield* this.wait(0.5); continue; }
      yield* this.until(() => W().scatterT <= 0 || W().phase !== 'scatter', 40, 'the grown-ups giving up');
      if (W().phase !== 'scatter') break;
      yield* this.wait(2.5);
      yield* this.kidTo(-5.8, -3.4); yield* this.kidTo(-5.8, 0.3); yield* this.kidTo(5.5, 0.3);
      for (const c of W().kids.filter((k) => k.caught)) yield* this.kidTo(c.x, c.z + 0.7, 6);
      this.mark('freed friends from the bench');
      yield* this.kidTo(5.5, 0.3); yield* this.kidTo(-5.8, 0.3); yield* this.kidTo(-5.8, -2.3, 8); yield* this.kidTo(-7.3, -5.2, 8);
      yield* this.wait(1.2);
    }
    yield* this.until(() => W().phase === 'play', 10, 'restacking');
    this.mark('restacked'); this.times.scatterEnd = +this.t.toFixed(1);
    yield* this.wait(1);
    // 5. the errand
    this.times.errandStart = +this.t.toFixed(1);
    for (const [x, z] of [[-5.8, -3.6], [-5.8, 0.3], [-0.55, 0.9]]) yield* this.walkTo(x, z);
    // everyone is still suspicious after the Scatter: bluff them back down
    for (let n = 0; n < 4 && W().people.some((p) => p.sus > 0.1) && W().phase === 'play'; n++) { yield* this.bluff(false); yield* this.wait(3.6); }
    for (const [x, z] of [[-0.55, 3.0], [-0.55, 5.3]]) yield* this.walkTo(x, z);
    yield* this.walkTo(TOWN.queue.x, TOWN.queue.z, { tol: 0.22, speed: 0.6 });
    yield* this.until(() => W().errand.step >= 2, 20, 'the queue');
    this.mark('queued');
    yield* this.walkTo(0.3, 7.74, { tol: 0.14, speed: 0.5, rude: true, gait: 'shuffle' });
    yield* this.face(0);
    // sign: bring the right hand near the start of the line (it snaps on), then slide right
    const b = W().body, P = TOWN.paper;
    // one hand holds the form flat, the other signs
    const hold = offsetFor(b, 0, { x: P.hx, y: P.y, z: P.hz });
    yield* this.handTo(0, hold.x, hold.z, 0.04);
    yield* this.until(() => this.cue()?.kind === 'hold' && this.cue().state === 'on', 4, 'holding the form flat');
    this.mark('holding the form');
    const start = offsetFor(b, 1, { x: P.x0 + 0.02, y: P.y, z: P.z });
    yield* this.handTo(1, start.x, start.z - 0.06, 0.05);
    yield* this.until(() => this.cue()?.kind === 'sign' && this.cue().state === 'on', 4, 'the pen snapping to the line');
    this.mark('pen snapped to the line');
    this.i.setMove(0.45, 0);
    yield* this.until(() => W().errand.step >= 3, 8, 'signing');
    this.i.setMove(0, 0);
    this.mark('signed' + (W().errand.messy ? ' (messy)' : ''));
    yield* this.handTo(1, 0, 0.05);
    // grab: bring the left hand near the cash, wait for "in reach", grab
    const G = W().items.find((it) => it.id === 'cash'), want = offsetFor(b, 0, G);
    yield* this.handTo(0, want.x + 0.1, want.z - 0.1, 0.06);
    yield* this.until(() => this.cue()?.kind === 'grab' && this.cue().state === 'on', 4, 'the "in reach" cue');
    this.mark('in reach cue');
    this.i.press('grab'); yield* this.until(() => G.held === 0, 3, 'grabbing the cash');
    this.mark('took the cash');
    yield* this.handTo(0, 0, 0.08);
    // heavy pockets and a bag of cash: walk out slowly
    for (const [x, z] of [[-0.55, 5.6], [-0.55, 3.0], [-0.55, 0.8], [6.6, 0.3]]) yield* this.walkTo(x, z, { speed: 0.55 });
    this.endOk = true;
    if (W().phase !== 'end') yield* this.walkTo(8.4, 0.3, { tol: 1.0, speed: 0.55 });
    yield* this.until(() => W().phase === 'end', 10, 'the end card');
    this.times.errandEnd = +this.t.toFixed(1);
    this.mark('errand done: end=' + W().end);
  }
}
