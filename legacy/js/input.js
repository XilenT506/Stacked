// Turns keyboard and mouse, gamepad and touch into orders for the part you are playing.
// The legs only move while the walk control is held. Solo players can switch on "keep walking"
// so the legs carry on while they play another part.
import { clamp, GAIT } from './config.js';
import { emptyPacket } from './parts.js';

// in the car the hands sit up on the steering wheel, in front of the chest
const WHEEL = { y: 0.42, z: 0.4 };
const MOVE = { KeyW: 'up', ArrowUp: 'up', KeyS: 'dn', ArrowDown: 'dn', KeyA: 'lf', ArrowLeft: 'lf', KeyD: 'rt', ArrowRight: 'rt' };
// keys you hold: they mean something different for each part
const HOLD = {
  legs: { ShiftLeft: 'tip', ShiftRight: 'tip', KeyE: 'stride', KeyQ: 'shuffle', KeyR: 'scope' },
  arms: { KeyE: 'raise', KeyQ: 'lower', KeyC: 'wave', KeyX: 'point' },
  head: { KeyN: 'nod', KeyM: 'shake', KeyE: 'brow', Space: 'talk' },
  kid: {},
  // all-in-one: one player with several parts plays them all at once, no switching
  all: { ShiftLeft: 'tip', ShiftRight: 'tip', KeyQ: 'shuffle', KeyR: 'stride', KeyY: 'scope', KeyC: 'wave', KeyX: 'point', KeyN: 'nod', KeyM: 'shake', KeyE: 'brow', Space: 'talk', KeyG: 'reach' },
};
// keys you tap
const TAP = { Tab: 'next', Digit1: 'legs', Digit2: 'arms', Digit3: 'head', Digit4: 'kid', KeyB: 'hop', KeyV: 'swap', KeyK: 'keep', KeyP: 'peek' };
const TAP_PART = { arms: { KeyG: 'grab', KeyF: 'hand', KeyZ: 'pat' }, head: { KeyH: 'hat' }, all: { KeyF: 'hand', KeyZ: 'pat', KeyH: 'hat' } };
const KNOWN = new Set([...Object.keys(MOVE), ...Object.keys(TAP), ...Object.values(HOLD).flatMap(Object.keys), ...Object.values(TAP_PART).flatMap(Object.keys)]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.part = 'legs';
    this.legs = { f: 0, t: 0, gait: 0 };
    this.hand = [{ x: 0, y: 0, z: 0, act: 0 }, { x: 0, y: 0, z: 0, act: 0 }];
    this.sel = 1;                                   // which hand you are moving (0 left, 1 right)
    this.head = { y: 0, p: 0, nod: 0, shake: 0, talk: 0, brow: 0, scope: 0 };
    this.kid = { mx: 0, mz: 0, sel: 0 };
    this.n = [0, 0, 0, 0, 0, 0];                    // counters: grab left, grab right, hop, swap, hat, pat
    this.peek = false;                              // P: look through your own part's eyes instead of the shared camera
    this.all = false;                               // all-in-one controls (set every frame from how many parts I have)
    this.classic = /[?&]classic/.test(location.search);   // the old way: one part at a time, Tab to switch
    this.look = null;                               // all-in-one: where the head should look (set by the game: whoever is talking to the coat)
    this.keep = false;                              // solo: legs keep walking while you play another part
    this.codes = new Set(); this.stale = new Set(); this.tapped = new Set(); this.touchHeld = {}; this.touchTapped = new Set(); this.padHeld = {};
    this.move = { x: 0, y: 0 }; this.touchMove = { x: 0, y: 0 };
    this.aim = { x: 0, y: 0 };
    this.steering = false; this.yIdle = 9;          // used by the hand aim-assist
    this.linger = { wave: 0, nod: 0, hand: 1, shake: 0, brow: 0, point: 0 };     // a wave or a nod carries on for a moment, so a solo player can do both at once
    this.queue = []; this.padPrev = []; this.locked = false; this.dragging = false; this.usedTouch = false; this.usedPad = false;
    this.lastPress = 0;                             // when the last key or button went down (for measuring response)

    addEventListener('keydown', (e) => {
      if (e.target?.tagName === 'INPUT') return;
      if (!KNOWN.has(e.code)) return;
      e.preventDefault();
      if (e.repeat) return;
      this.lastPress = performance.now();
      this.codes.add(e.code); this.tapped.add(e.code);
      const tap = TAP[e.code] || TAP_PART[this.all ? 'all' : this.part]?.[e.code];
      if (tap) this.queue.push(tap);
    });
    addEventListener('keyup', (e) => { this.codes.delete(e.code); this.stale.delete(e.code); });
    addEventListener('blur', () => { this.codes.clear(); this.stale.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true; this.lastPress = performance.now();
      if (this.locked && (this.part === 'arms' || this.all)) this.queue.push('grab');
      try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* pointer lock is optional */ }
    });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', (e) => {         // some browsers report one huge jump when the pointer locks: ignore those
      if (!(this.locked || this.dragging)) return;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) < 200 && Math.abs(dy) < 200) { this.aim.x += dx; this.aim.y += dy; }
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    canvas.addEventListener('wheel', (e) => { if (this.part === 'arms' || this.all) { this.hand[this.sel].y = clamp(this.hand[this.sel].y - e.deltaY * 0.0006, -0.35, 0.6); this.yIdle = 0; } }, { passive: true });
  }

  // used by the touch buttons, the on-screen joystick and the test bot
  press(name) { this.lastPress = performance.now(); this.queue.push(name); }
  setHeld(name, on) { if (on) { this.lastPress = performance.now(); this.touchTapped.add(name); } this.touchHeld[name] = on ? 1 : 0; }
  setMove(x, y) { this.touchMove.x = x; this.touchMove.y = y; }
  addAim(dx, dy) { this.aim.x += dx; this.aim.y += dy; }
  down(name) {
    if (this.touchHeld[name] || this.padHeld[name] || this.touchTapped.has(name)) return 1;
    const map = HOLD[this.all && this.part !== 'kid' ? 'all' : this.part] || {};
    for (const c of this.codes) if (map[c] === name || (MOVE[c] === name && !this.stale.has(c))) return 1;
    for (const c of this.tapped) if (map[c] === name) return 1;
    return 0;
  }

  #gamepad() {
    this.padHeld = {}; let mx = 0, my = 0, ax = 0, ay = 0;
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() || [] : []; } catch { pads = []; }   // some embedded pages forbid gamepads
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      mx += dz(p.axes[0] || 0); my -= dz(p.axes[1] || 0); ax += dz(p.axes[2] || 0); ay += dz(p.axes[3] || 0);
      const B = p.buttons.map((b) => (b.pressed ? 1 : 0)), was = this.padPrev;
      const hit = (i) => B[i] && !was[i];
      if (B.some(Boolean) || mx || my) this.usedPad = true;
      const part = this.part, H = this.padHeld, q = (n) => this.queue.push(n);
      // A / B / X / Y and the left bumper mean different things for each part; the right bumper switches part
      if (part === 'legs') { H.tip = B[0]; H.shuffle = B[1]; H.stride = B[2]; H.scope = B[3]; if (hit(4)) q('keep'); }
      if (part === 'arms') { if (hit(0)) q('grab'); H.point = B[1]; H.wave = B[2]; if (hit(3)) q('pat'); if (hit(4)) q('hand'); }
      if (part === 'head') { H.nod = B[0]; H.shake = B[1]; H.brow = B[2]; if (hit(3)) q('hat'); H.talk = B[4]; }
      if (hit(5)) q('next');
      if (hit(8)) q('hop'); if (hit(9)) q('swap');
      this.padPrev = B;
      break;
    }
    return { mx, my, ax, ay };
  }

  // ctx: { parts: ['legs','arms','head'], kid: bool, scatter: bool, hands: [ownLeft, ownRight] }
  update(dt, ctx) {
    const pad = this.#gamepad();
    let mx = clamp(this.down('rt') - this.down('lf') + this.touchMove.x + pad.mx, -1, 1);
    let my = clamp(this.down('up') - this.down('dn') + this.touchMove.y + pad.my, -1, 1);
    this.move.x = mx; this.move.y = my;
    const avail = ctx.scatter ? ['kid'] : [...ctx.parts, ...(ctx.kid ? ['kid'] : [])];
    const wasPart = this.part;
    if (!avail.includes(this.part)) this.part = avail[0] || 'legs';
    const canKeep = ctx.parts.includes('legs') && ctx.parts.length > 1;
    if (!canKeep) this.keep = false;
    const events = [];
    for (const q of this.queue.splice(0)) {
      if (q === 'next') {
        if (ctx.scatter) this.kid.sel++; else this.part = avail[(avail.indexOf(this.part) + 1) % avail.length];
      } else if (avail.includes(q)) this.part = q;
      else if (q === 'grab' && !ctx.scatter) { if (ctx.hands[this.sel]) this.n[this.sel]++; }
      else if (q === 'hand') { if (ctx.hands[0] && ctx.hands[1]) this.sel = 1 - this.sel; }
      else if (q === 'pat') this.n[5]++;
      else if (q === 'hat') this.n[4]++;
      else if (q === 'hop') this.n[2]++;
      else if (q === 'swap') this.n[3]++;
      else if (q === 'keep') { if (canKeep) this.keep = !this.keep; }
      else if (q === 'peek') this.peek = !this.peek;
      events.push(q);
    }
    if (this.part !== wasPart) {
      // keys still held from the last part (W/A/S/D too) do nothing until they are let go and pressed again
      for (const c of [...this.codes]) { if (!MOVE[c]) this.codes.delete(c); else this.stale.add(c); }
      this.touchHeld = {};
      if (this.part === 'legs') this.keep = false;
      if (this.stale.size) { mx = my = 0; this.move.x = this.move.y = 0; }
    }
    if (!ctx.hands[this.sel]) this.sel = ctx.hands[0] ? 0 : 1;
    const ax = this.aim.x, ay = this.aim.y; this.aim.x = this.aim.y = 0;
    this.all = !this.classic && !ctx.scatter && ctx.parts.length > 1;
    if (this.all) { this.#allInOne(dt, ctx, mx, my, ax, ay, pad); this.tapped.clear(); this.touchTapped.clear(); return events; }
    const p = this.part;

    // legs: walk only while held (or while "keep walking" is on and you are playing another part)
    if (p === 'legs') {
      this.legs.f = my; this.legs.t = mx;
      this.legs.gait = this.down('tip') ? GAIT.TIPTOE : this.down('stride') ? GAIT.STRIDE : this.down('shuffle') ? GAIT.SHUFFLE : GAIT.WALK;
    } else if (!this.keep) { this.legs.f = 0; this.legs.t = 0; this.legs.gait = GAIT.WALK; }
    this.head.scope = p === 'legs' ? this.down('scope') : 0;

    // arms: the stick (or WASD, or the mouse) moves the hand left / right and near / far; height looks after itself
    this.hand[0].act = this.hand[1].act = 0;
    this.steering = false; this.yIdle += dt;
    const L = this.linger; for (const k of ['wave', 'nod', 'shake', 'brow', 'point']) L[k] = Math.max(0, L[k] - dt);
    if (p === 'arms') {
      const h = this.hand[this.sel], sx = mx + pad.ax, sz = my - pad.ay;
      h.x = clamp(h.x + ax * 0.0016 + sx * dt * 0.7, -0.55, 0.55);
      h.z = clamp(h.z - ay * 0.0016 + sz * dt * 0.7, 0, 0.75);
      // in the car both of my hands are on the wheel: they turn it together
      if (ctx.car) for (const i of [0, 1]) if (ctx.hands[i]) { this.hand[i].x = h.x; this.hand[i].z = WHEEL.z; this.hand[i].y = WHEEL.y; }
      const lift = this.down('raise') - this.down('lower');
      if (lift) { h.y = clamp(h.y + lift * dt * 0.9, -0.35, 0.6); this.yIdle = 0; }
      this.steering = Math.abs(ax) + Math.abs(ay) > 0.5 || Math.abs(sx) + Math.abs(sz) > 0.05;
      if (this.down('wave')) { L.wave = 1.3; L.hand = this.sel; L.point = 0; }
      else if (this.down('point')) { L.point = 0.35; L.wave = 0; }
      if (L.point > 0) h.act = 2;
    }
    if (L.wave > 0 && ctx.hands[L.hand] && !ctx.scatter && this.hand[L.hand].act === 0) this.hand[L.hand].act = 1;

    // head: the stick (or WASD, or the mouse) looks around in every direction
    const hd = this.head, on = p === 'head';
    if (on && this.down('nod')) L.nod = 0.9;
    if (on && this.down('shake')) L.shake = 0.5;
    if (on && this.down('brow')) L.brow = 0.5;
    const headOk = ctx.parts.includes('head') && !ctx.scatter;
    hd.nod = L.nod > 0 && headOk ? 1 : 0; hd.shake = L.shake > 0 && headOk ? 1 : 0; hd.talk = on ? this.down('talk') : 0; hd.brow = L.brow > 0 && headOk ? 1 : 0;
    if (on) {
      hd.y = clamp(hd.y - ax * 0.0022 - (mx + pad.ax) * dt * 1.8, -1.9, 1.9);
      hd.p = clamp(hd.p - ay * 0.0022 + (my - pad.ay) * dt * 1.2, -0.9, 0.7);
    }
    this.kid.mx = p === 'kid' ? mx : 0; this.kid.mz = p === 'kid' ? my : 0;
    this.tapped.clear(); this.touchTapped.clear();
    return events;
  }

  // one player, every part at once: legs on WASD, hands on the mouse (G reaches for you), head on single keys
  #allInOne(dt, ctx, mx, my, ax, ay, pad) {
    const has = (k) => ctx.parts.includes(k), car = ctx.car, L = this.linger;
    for (const k of ['wave', 'nod', 'shake', 'brow', 'point']) L[k] = Math.max(0, L[k] - dt);
    if (has('legs')) {
      this.legs.f = my; this.legs.t = car ? 0 : mx;
      this.legs.gait = this.down('tip') ? GAIT.TIPTOE : this.down('stride') ? GAIT.STRIDE : this.down('shuffle') && !car ? GAIT.SHUFFLE : GAIT.WALK;
    } else { this.legs.f = this.legs.t = 0; this.legs.gait = GAIT.WALK; }
    this.head.scope = has('legs') ? this.down('scope') : 0;
    this.hand[0].act = this.hand[1].act = 0; this.yIdle += dt;
    this.steering = Math.abs(ax) + Math.abs(ay) > 0.5;
    if (has('arms')) {
      if (car) {
        // both hands on the wheel: A / D turn it, letting go straightens up
        const want = mx * 0.42;
        for (const i of [0, 1]) if (ctx.hands[i]) { const h = this.hand[i]; h.x += (want - h.x) * clamp(dt * 6, 0, 1); h.z = WHEEL.z; h.y = WHEEL.y; }
      } else {
        const h = this.hand[this.sel];
        h.x = clamp(h.x + ax * 0.0016 + pad.ax * dt * 0.7, -0.55, 0.55);
        h.z = clamp(h.z - ay * 0.0016 - pad.ay * dt * 0.7, 0, 0.75);
        if (this.down('wave')) { L.wave = 1.3; L.hand = this.sel; L.point = 0; }
        else if (this.down('point')) { L.point = 0.35; L.wave = 0; }
        if (L.point > 0) h.act = 2;
        // hands come back to rest by themselves when you are not using them
        this.handIdle = this.down('reach') || this.steering ? 0 : (this.handIdle || 0) + dt;
        if (this.handIdle > 0.8) for (const i of [0, 1]) { const k = this.hand[i], e = clamp(dt * 1.6, 0, 1); k.x -= k.x * e; k.z -= k.z * e; k.y -= k.y * e; }
      }
    }
    if (L.wave > 0 && ctx.hands[L.hand] && this.hand[L.hand].act === 0) this.hand[L.hand].act = 1;
    const hd = this.head, headOk = has('head');
    if (this.down('nod')) L.nod = 0.9;
    if (this.down('shake')) L.shake = 0.5;
    if (this.down('brow')) L.brow = 0.5;
    hd.nod = L.nod > 0 && headOk ? 1 : 0; hd.shake = L.shake > 0 && headOk ? 1 : 0; hd.brow = L.brow > 0 && headOk ? 1 : 0; hd.talk = headOk ? this.down('talk') : 0;
    // the head looks for you: at whoever is talking to the coat; in the car Q / E look into the mirrors
    let wantY = this.look ?? 0;
    if (car) { const q = this.codes.has('KeyQ') ? 1 : 0, e = this.codes.has('KeyE') ? 1 : 0; wantY = (q - e) * 1.75; if (e) { hd.brow = 0; L.brow = 0; } }
    hd.y += (wantY - hd.y) * clamp(dt * 5, 0, 1); hd.p += (0 - hd.p) * clamp(dt * 5, 0, 1);
    this.kid.mx = this.kid.mz = 0;
  }

  packet() {
    const P = emptyPacket(), r = (v) => Math.round(v * 1000) / 1000, hd = this.head;
    P.l = [r(this.legs.f), r(this.legs.t), this.legs.gait];
    P.h = this.hand.map((h) => [r(h.x), r(h.y), r(h.z), h.act]);
    P.hd = [r(hd.y), r(hd.p), hd.nod | (hd.shake << 1) | (hd.talk << 2) | (hd.brow << 3)];
    P.k = [r(this.kid.mx), r(this.kid.mz), this.kid.sel];
    P.n = this.n.slice();
    return P;
  }

  reset() {
    this.legs = { f: 0, t: 0, gait: 0 }; this.hand = [{ x: 0, y: 0, z: 0, act: 0 }, { x: 0, y: 0, z: 0, act: 0 }];
    this.head = { y: 0, p: 0, nod: 0, shake: 0, talk: 0, brow: 0, scope: 0 }; this.part = 'legs'; this.keep = false;
  }
}
