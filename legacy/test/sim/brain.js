// The headless test bot. It plays any errand from the data, at any player count, without drawing anything.
// A "brain" decides what the coat should do (walk here, reach there, nod now). A "team" turns that into
// what each player could really send: every player reacts a little late, and a solo player can only
// work one part at a time (switching takes a moment; the legs can be left walking with "keep walking").
import { CFG, GAIT, clamp, dist, wrap, yawTo } from '../../js/config.js';
import { TOWN, collide } from '../../js/town.js';
import { ERRANDS, ZONES, ITEMS, inZ, zoneCentre, heldItem } from '../../js/errands.js';
import { offsetFor } from '../../js/assist.js';
import { sees } from '../../js/townspeople.js';
import { emptyPacket } from '../../js/parts.js';
import { CAR_HALF } from '../../js/drive.js';

// ---------- a little road map for walking ----------
const NODES = [[-7.0, -4.8], [-6.0, -3.4], [-5.8, -2.1], [0, 2.6], [0, 3.5], [0, 4.6]];
for (let x = -10; x <= 10; x += 2) NODES.push([x, 0.4], [x, 2.15], [x, -3.0]);
const clear = (ax, az, bx, bz) => {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
  for (let i = 0; i <= n; i++) {
    const x = ax + (bx - ax) * (i / n), z = az + (bz - az) * (i / n);
    if (i * 0.2 < 0.35) continue;                 // standing right against a wall is fine: only the way ahead counts
    if (collide(x, z, 0.36, false).hit) return false;
    for (const p of TOWN.props) if (Math.hypot(p.x - x, p.z - z) < p.r + 0.36) return false;
  }
  return true;
};
const OK = NODES.filter(([x, z]) => !collide(x, z, 0.36, false).hit && !TOWN.props.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.36));
const EDGES = OK.map((a, i) => OK.map((b, j) => (i !== j && Math.hypot(a[0] - b[0], a[1] - b[1]) < 4.6 && clear(a[0], a[1], b[0], b[1]) ? j : -1)).filter((j) => j >= 0));
function path(fx, fz, tx, tz) {
  if (clear(fx, fz, tx, tz)) return [[tx, tz]];
  const near = (x, z) => OK.map((n, i) => [Math.hypot(n[0] - x, n[1] - z), i]).filter(([d, i]) => clear(x, z, OK[i][0], OK[i][1])).sort((a, b) => a[0] - b[0]).slice(0, 4).map((a) => a[1]);
  const starts = near(fx, fz), ends = new Set(near(tx, tz));
  const dd = new Map(), prev = new Map(), open = [];
  for (const s of starts) { dd.set(s, Math.hypot(OK[s][0] - fx, OK[s][1] - fz)); open.push(s); }
  while (open.length) {
    open.sort((a, b) => dd.get(a) - dd.get(b)); const u = open.shift();
    if (ends.has(u)) { const out = [[tx, tz]]; for (let v = u; v !== undefined; v = prev.get(v)) out.unshift(OK[v]); return out; }
    for (const v of EDGES[u]) { const nd = dd.get(u) + Math.hypot(OK[u][0] - OK[v][0], OK[u][1] - OK[v][1]); if (nd < (dd.get(v) ?? 1e9)) { dd.set(v, nd); prev.set(v, u); if (!open.includes(v)) open.push(v); } }
  }
  return [[tx, tz]];
}

// ---------- the brain: what the coat should be doing right now ----------
export class Brain {
  constructor(skill = 1) { this.skill = skill; this.route = null; this.goal = null; this.t = 0; this.out = blank(); this.grabN = [0, 0]; this.hatN = 0; this.bluffT = 0; this.nodT = 0; this.mirror = 0; this.headLook = null; }
  think(Wd, dt) {
    this.t += dt;
    const o = this.out = blank(this.out.hand), b = Wd.body;
    if (Wd.phase === 'scatter') return this.scatter(Wd, o);
    if (Wd.phase !== 'play' || b.popped) return o;
    const e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
    if (Wd.car) { this.drive(Wd, dt, o, st); this.head(Wd, dt, o); return o; }
    if (b.down) return o;
    const lean = Math.hypot(b.lx, b.lz);
    // what this step needs
    let dest = null, stopAt = null, tall = false, face = null;
    const dropped = Wd.items.find((it) => it.held < 0 && d.steps.slice(0, e.step).some((s) => s.type === 'grab' && s.items.includes(it.id)));
    if (dropped) dest = { x: dropped.x, z: dropped.z, tol: 0.5, item: dropped };
    else if (!st) return o;
    else if (st.type === 'goto' || st.type === 'carry') dest = { ...zoneCentre(ZONES[st.zone]), tol: ZONES[st.zone].r ? ZONES[st.zone].r * 0.55 : 0.6 };
    else if (st.type === 'still' || st.type === 'tall') { dest = { ...zoneCentre(ZONES[st.zone]), tol: ZONES[st.zone].r * 0.55 }; stopAt = true; tall = st.type === 'tall'; }
    else if (st.type === 'grab') {
      const it = Wd.items.find((x) => st.items.includes(x.id) && x.held < 0);
      if (it) { const home = ITEMS[it.id].home; dest = this.standFor(home); face = { x: home[0], z: home[2] }; }
    } else if (st.type === 'sign') { dest = { x: 0.3, z: 7.74, tol: 0.14 }; face = { x: 0.3, z: 9 }; }
    else if (st.type === 'talk') { const p = Wd.people.find((x) => x.id === st.who); if (p) face = { x: p.x, z: p.z }; }
    // legs: walk the route, slow and steady; stop and settle if the coat leans too far
    if (dest) {
      const there = dist(b.x, b.z, dest.x, dest.z) < (dest.tol || 0.3);
      if (!there) this.walk(Wd, o, dest, lean);
      else if (face) this.turnTo(Wd, o, face);
    } else if (face) this.turnTo(Wd, o, face);
    if (tall) o.gait = GAIT.TIPTOE;
    // arms
    this.arms(Wd, dt, o, st, dropped);
    // head
    if (st && st.type === 'talk') { const p = Wd.people.find((x) => x.id === st.who); if (p) { o.hy = clamp(wrap(yawTo(p.x - b.x, p.z - b.z) - b.yaw), -1.8, 1.8); o.talk = Math.abs(o.hy) < 1.75 ? 1 : 0; } }
    this.head(Wd, dt, o);
    return o;
  }
  standFor(home) {
    // where to stand to reach something on a counter
    if (home[2] > 8) return { x: home[0] < 0.6 ? 0.3 : 0.6, z: 7.78, tol: 0.14 };
    if (home[2] > 2) return { x: -8.2, z: 2.08, tol: 0.14 };
    return { x: 2.37, z: -3.1, tol: 0.25 };
  }
  walk(Wd, o, dest, lean) {
    const b = Wd.body;
    // stuck against something (a planter, a counter corner): back up and turn, like a person would
    const gone = dist(b.x, b.z, dest.x, dest.z);
    if (this.unstick > 0) { this.unstick -= 1 / 60; o.f = -0.5; o.t = this.unstickDir; return; }
    if (this.prog === undefined || gone < this.prog - 0.25) { this.prog = gone; this.progT = this.t; }
    else if (this.t - this.progT > 3 && !b.down) { this.unstick = 0.9; this.unstickDir = Math.random() < 0.5 ? 1 : -1; this.prog = undefined; this.route = null; return; }
    const key = `${dest.x.toFixed(1)},${dest.z.toFixed(1)}`;
    if (!this.route || this.routeKey !== key || this.t - this.routeAt > 3) { this.route = path(b.x, b.z, dest.x, dest.z); this.routeKey = key; this.routeAt = this.t; }
    while (this.route.length > 1 && dist(b.x, b.z, this.route[0][0], this.route[0][1]) < 0.5) this.route.shift();
    const [tx, tz] = this.route[0];
    const err = wrap(yawTo(tx - b.x, tz - b.z) - b.yaw);
    o.t = clamp(-err * 2.2, -1, 1);
    const left = dist(b.x, b.z, dest.x, dest.z);
    o.f = Math.abs(err) > 0.6 ? 0.12 : clamp(left * 0.9, 0.25, 0.85) * this.skill;
    if (lean > 0.3) o.f *= 0.3;                  // let the wobble settle
    if (Wd.items.some((it) => it.held >= 0)) o.f *= 0.8;
    if (left < 1.2) o.gait = GAIT.SHUFFLE;       // fine steps near the spot
    if (Math.hypot(TOWN.wet.x - b.x, TOWN.wet.z - b.z) < TOWN.wet.r + 1.4) o.f = Math.min(o.f, 0.4);   // the legs can see the wet floor: tiptoe-slow across it
  }
  turnTo(Wd, o, p) { const b = Wd.body, err = wrap(yawTo(p.x - b.x, p.z - b.z) - b.yaw); if (Math.abs(err) > 0.25) { o.t = clamp(-err * 2, -1, 1) * 0.6; o.gait = GAIT.SHUFFLE; } }
  arms(Wd, dt, o, st, dropped) {
    const b = Wd.body;
    const want = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
    const targets = [];
    if (dropped) targets.push(dropped);
    else if (st && st.type === 'grab') for (const it of Wd.items) if (st.items.includes(it.id) && it.held < 0) targets.push(it);
    // free hands go for the targets, nearest first
    for (const it of targets) {
      let best = -1, bd = 9;
      for (const i of [0, 1]) { if (heldItem(Wd, i) || want[i].busy) continue; const off = offsetFor(b, i, it), d = Math.abs(off.x) + Math.abs(off.z); if (d < bd) { bd = d; best = i; } }
      if (best < 0) continue;
      const off = offsetFor(b, best, it);
      if (!(Math.abs(off.x) < 0.6 && off.z < 0.8 && off.z > -0.1 && Math.abs(b.v) < 0.3)) continue;      // only reach once the legs have got us close
      want[best] = { x: clamp(off.x, -0.55, 0.55), y: clamp(off.y, -0.35, 0.6), z: clamp(off.z, 0, 0.75), busy: 1 };
      const h = Wd.hands[best];
      if (Math.hypot(h.x - it.x, h.y - it.y, h.z - it.z) < 0.27 && dist(b.x, b.z, it.x, it.z) < 1.3) this.press(o, best);
    }
    if (st && st.type === 'sign' && dist(b.x, b.z, 0.3, 7.74) < 0.3 && Math.abs(b.v) < 0.2) {
      const P = TOWN.paper;
      const hold = offsetFor(b, 0, { x: P.hx, y: P.y, z: P.hz });
      want[0] = { x: hold.x, y: hold.y, z: hold.z };
      const u = clamp(Wd.errand.sign + 0.12, 0, 1);
      const pen = offsetFor(b, 1, { x: P.x0 + (P.x1 - P.x0) * u, y: P.y, z: P.z });
      const holding = Math.hypot(Wd.hands[0].x - P.hx, Wd.hands[0].z - P.hz) < 0.12 && Math.abs(Wd.hands[0].y - P.y) < 0.09;
      want[1] = holding ? { x: pen.x, y: pen.y, z: pen.z } : { x: 0.1, y: 0, z: 0.2 };
    }
    // wobbling too much: pull the hands in until it settles
    if (Math.hypot(b.lx, b.lz) > 0.3) for (const i of [0, 1]) if (!heldItem(Wd, i)) want[i] = { x: 0, y: 0, z: 0 };
    // a bluff: one hand waves while the head nods
    if (this.bluffT > 0) o.act[0] = 1;
    // move the hands at about the speed a player could (the stick moves a hand about 0.7 m a second)
    for (const i of [0, 1]) {
      const h = o.hand[i], w = want[i], k = 0.9 * dt;
      h.x += clamp(w.x - h.x, -k, k); h.y += clamp(w.y - h.y, -k * 1.4, k * 1.4); h.z += clamp(w.z - h.z, -k, k);
    }
  }
  press(o, i) { if (this.t - (this.lastGrab?.[i] || 0) > 0.6) { (this.lastGrab ||= [0, 0])[i] = this.t; o.grab[i] = 1; } }
  // the head: answer greetings, bluff when someone is getting suspicious, tip the hat now and then
  head(Wd, dt, o) {
    const b = Wd.body;
    this.bluffT = Math.max(0, this.bluffT - dt); this.nodT = Math.max(0, this.nodT - dt);
    let worst = null;
    Wd.people.forEach((p) => { if (p.id === 'price') return; if (sees(p, b.x, b.z) && (!worst || p.sus > worst.sus)) worst = p; });
    for (const p of Wd.people) {
      if (p.greet && sees(p, b.x, b.z) && dist(p.x, p.z, b.x, b.z) < 4.5) {
        if (p.greet === 1) { o.nod = 1; this.headLook = p; } else { o.shake = 1; this.headLook = p; }
      }
    }
    if (worst && worst.sus > 0.5 && this.t - (this.lastBluff || 0) > 4.5) { this.lastBluff = this.t; this.bluffT = 1.2; this.nodT = 1.0; }
    if (this.nodT > 0) o.nod = 1;
    if (Wd.car) {
      const c = Wd.car, P = Wd.people.find((p) => p.id === 'price');
      if (c.ask > 0 && c.ask < 3.4) o.nod = 1;
      if (P && P.sus > 0.35 && this.t - (this.lastHat || 0) > (c.slipT > 0 ? 1.5 : 6)) { this.lastHat = this.t; o.hat = 1; }
    }
    if (!o.talk && this.headLook && !Wd.car) { const p = this.headLook; o.hy = clamp(wrap(yawTo(p.x - b.x, p.z - b.z) - b.yaw), -1.8, 1.8); }
  }
  scatter(Wd, o) {
    // every kid runs for the alley, tags anyone on the bench on the way if the grown-ups gave up
    o.kid = true; return o;
  }
  // ---------- the driving test ----------
  drive(Wd, dt, o, st) {
    const c = Wd.car;
    if (!st) return;
    let tx = c.x + 3 * Math.sin(c.yaw), tz = 0.35, vt = 0, wheelOverride = null;
    const head = Math.sin(c.yaw) >= 0 ? 1 : -1;                 // which way along the street we face
    if (st.type === 'mirrors') { o.hy = c.ml < 0.5 ? 1.0 : c.mr < 0.5 ? -1.0 : 0; vt = 0; }
    else if (st.type === 'stopline') { const z = ZONES.line, goal = (z.x0 + z.x1) / 2 - CAR_HALF[1]; vt = clamp((goal - c.x) * 0.7, 0, 2.4); }
    else if (st.type === 'cones') {
      const pts = [[-1.2, -0.45], [1.3, -0.45], [2.6, 1.15], [3.9, 1.15], [5.2, -0.45], [6.6, -0.45], [8.0, 0.35]];
      const nxt = pts.find(([x]) => x > c.x + 0.6) || [9, 0.35]; tx = nxt[0]; tz = nxt[1]; vt = 1.5 * this.skill;
    } else if (st.type === 'turn') {
      // a three-point turn: full lock forwards until near the kerb, full lock backwards, again
      const fz = Math.cos(c.yaw);
      if (this.turnDir === undefined) this.turnDir = 1;
      if (!this.turnStarted) { vt = 0; if (Math.abs(c.v) < 0.15) this.turnStarted = true; }
      else
      if (this.turnDir > 0) { vt = 0.9; wheelOverride = -1; if ((c.z > 1.4 && fz > 0.2) || (c.z < -0.7 && fz < -0.2)) this.turnDir = -1; }
      else { vt = -0.8; wheelOverride = 1; if ((c.z < -0.3 && fz > 0.2) || (c.z > 1.0 && fz < -0.2) || Math.abs(fz) < 0.25) this.turnDir = 1; }
      if (this.turnDir > 0 && Math.abs(c.v) < 0.05 && this.lastDir < 0) this.turnDir = 1;
      this.lastDir = this.turnDir;
    } else if (st.type === 'estop') {
      if (c.stopT >= 0) { vt = 0; o.f = -1; this.hardBrake = true; }
      else { vt = 2.0; tx = c.x - 3; tz = 0.35; }
    } else if (st.type === 'park') {
      const z = ZONES[st.zone], gx = (z.x0 + z.x1) / 2, gz = (z.z0 + z.z1) / 2;
      const along = (gx - c.x) * head, off = Math.abs(c.z - gz) > 0.3 || Math.abs(Math.cos(c.yaw)) > 0.35;
      if (this.backing) { vt = -0.8; tx = c.x + 3 * head; tz = gz; if (along > 3.0) this.backing = false; }
      else { vt = clamp(along * 0.6, 0, 2.0); tx = c.x + Math.max(2.2, along) * head; tz = gz; if (off && along < 1.0 && Math.abs(c.v) < 0.1) this.backing = true; }
    }
    const err = wrap(yawTo(tx - c.x, tz - c.z) - c.yaw);
    // calm steering: a player reacts late, so a twitchy wheel would snake down the road
    const yr = c.yr || 0, wheel = wheelOverride ?? clamp(-(err * 0.9 - yr * 0.35), -0.8, 0.8) * (vt < 0 ? -0.6 : 1);
    o.hand[0].x += clamp(wheel * 0.45 - o.hand[0].x, -dt * 1.2, dt * 1.2); o.hand[1].x = o.hand[0].x;
    if (Math.abs(c.wheel - wheel) > 0.4 && vt > 0.6) vt = 0.6;            // never speed off with the wheel still turned
    // gentle on the pedals: ease the gas on to a speed, brake softly (except for the emergency stop)
    if (this.hardBrake && st.type === 'estop') return;
    this.hardBrake = false;
    const v = c.v;
    o.f = vt > 0.05 ? (v < -0.05 ? -0.4 : clamp(vt / 5.2 + (vt - v) * 0.25, 0.06, 0.6)) : vt < -0.05 ? (v > 0.05 ? -0.4 : v < -0.9 ? 0 : -0.35) : clamp((vt - v) * 0.3, -0.4, 0);
  }
}
function blank(hand) { return { f: 0, t: 0, gait: 0, hand: hand || [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], act: [0, 0], grab: [0, 0], hy: 0, hp: 0, nod: 0, shake: 0, talk: 0, brow: 0, hat: 0, kid: false }; }

// ---------- the team: players with their own reaction time, and solo part switching ----------
export class Team {
  constructor(n, rng) {
    this.n = n; this.rng = rng;
    this.delay = Array.from({ length: n }, () => Math.round((0.22 + rng() * 0.25) * 60));     // reaction time in ticks
    this.hist = []; this.counters = Array.from({ length: n }, () => [0, 0, 0, 0, 0, 0]);
    this.part = 'legs'; this.switchT = 0; this.keep = 0; this.stay = 0;
    this.idle = {}; this.idleMax = {}; this.lastOut = null;
  }
  packets(Wd, out, dt) {
    this.hist.push(JSON.parse(JSON.stringify(out))); if (this.hist.length > 60) this.hist.shift();
    const late = (p) => this.hist[Math.max(0, this.hist.length - 1 - this.delay[p])];
    const s = Wd.seats, P = Array.from({ length: this.n }, () => emptyPacket());
    if (this.n === 1) return [this.solo(Wd, out, dt)];
    const owner = { legs: s.legs, armL: s.armL, armR: s.armR, head: s.head };
    for (let p = 0; p < this.n; p++) {
      const o = late(p), pk = P[p];
      if (owner.legs === p) pk.l = [o.f, o.t, o.gait];
      for (const [i, k] of [[0, 'armL'], [1, 'armR']]) if (owner[k] === p) { pk.h[i] = [o.hand[i].x, o.hand[i].y, o.hand[i].z, o.act[i]]; if (o.grab[i]) this.counters[p][i]++; }
      if (owner.head === p) { pk.hd = [o.hy, o.hp, o.nod | (o.shake << 1) | (o.talk << 2) | (o.brow << 3)]; if (o.hat) this.counters[p][4]++; }
      pk.n = this.counters[p].slice();
      if (Wd.phase === 'scatter') pk.k = this.kid(Wd, p);
    }
    this.track(Wd, dt, P);
    return P;
  }
  // one player, one part at a time: pick what matters most right now, switching costs a moment
  solo(Wd, o, dt) {
    const pk = emptyPacket(), b = Wd.body;
    const need = {
      legs: Math.abs(o.f) > 0.05 || Math.abs(o.t) > 0.05 || o.gait === GAIT.TIPTOE ? (Wd.car ? 3 : Math.abs(o.f) > 0.2 ? 3 : 2) : 0,
      arms: (o.grab[0] || o.grab[1] || o.act[0] || this.handGap(o) > 0.03) ? 2.5 : 0,
      head: (o.nod || o.shake || o.talk || o.hat || (Wd.car && Math.abs(o.hy) > 0.5)) ? 3 : 0,
    };
    // in the car what matters is how far each control is from where it should be: pedal, wheel, or a nod
    if (Wd.car && this.held) { need.legs = Math.abs(o.f - this.keep) * 5 + (this.part === 'legs' ? Math.abs(o.f) * 2 : 0); need.arms = Math.abs(o.hand[0].x - this.held.hand[0].x) * 9; need.head = o.nod || o.hat || Math.abs(o.hy - this.held.hy) > 0.3 ? 3.2 : 0; }
    this.stay -= dt;
    if (this.switchT > 0) { this.switchT -= dt; }
    else if (this.stay <= 0) {
      let best = this.part, bv = need[this.part] + 0.4;
      for (const k of ['legs', 'arms', 'head']) if (need[k] > bv) { best = k; bv = need[k]; }
      if (best !== this.part) {
        // leave the legs walking if they are going straight ("keep walking")
        this.keep = this.part === 'legs' && !Wd.car && Math.abs(o.t) < 0.3 && o.f > 0.2 ? o.f : 0;
        if (this.part === 'legs' && Wd.car) this.keep = o.f;          // a held pedal stays held
        this.part = best; this.switchT = 0.3; this.stay = Wd.car ? 0.45 : 0.7;
      }
    }
    this.held ||= { hand: [{ x: 0, y: 0, z: 0, act: 0 }, { x: 0, y: 0, z: 0, act: 0 }], hy: 0 };
    const H = this.held, act = this.switchT > 0 ? null : this.part;
    if (act === 'legs') { pk.l = [o.f, o.t, o.gait]; this.keep = 0; } else pk.l = [this.keep, 0, 0];
    this.waveLeft = Math.max(0, (this.waveLeft || 0) - dt);
    if (act === 'arms') { for (const i of [0, 1]) { H.hand[i] = { ...o.hand[i], act: o.act[i] }; if (o.grab[i]) this.counters[0][i]++; if (o.act[i] === 1) this.waveLeft = 1.3; } }
    pk.h = [0, 1].map((i) => [H.hand[i].x, H.hand[i].y, H.hand[i].z, H.hand[i].act]);
    if (act === 'head') { H.hy = o.hy; pk.hd = [o.hy, o.hp, o.nod | (o.shake << 1) | (o.talk << 2)]; if (o.hat) this.counters[0][4]++; } else pk.hd = [H.hy, 0, 0];
    if (act !== 'arms') for (const i of [0, 1]) if (H.hand[i].act) H.hand[i] = { ...H.hand[i], act: this.waveLeft > 0 ? 1 : 0 };
    pk.n = this.counters[0].slice();
    if (Wd.phase === 'scatter') pk.k = this.kid(Wd, 0);
    this.track(Wd, dt, [pk]);
    return pk;
  }
  // how far the hands I hold are from where the brain wants them
  handGap(o) { const H = this.held; if (!H) return 1; return Math.max(...[0, 1].map((i) => Math.abs(H.hand[i].x - o.hand[i].x) + Math.abs(H.hand[i].y - o.hand[i].y) + Math.abs(H.hand[i].z - o.hand[i].z))); }
  handMove(o) { const l = this.lastHands; this.lastHands = o.hand.map((h) => ({ ...h })); if (!l) return 0; return Math.max(...[0, 1].map((i) => Math.abs(l[i].x - o.hand[i].x) + Math.abs(l[i].z - o.hand[i].z) + Math.abs(l[i].y - o.hand[i].y))); }
  // in a Scatter, each player runs their kid straight for the alley (or to free a friend on the bench)
  kid(Wd, p) {
    const mine = Wd.kids.filter((k) => k.owner === p && !k.caught); if (!mine.length) return [0, 0, 0];
    const k = mine.find((x) => x.lead) || mine[0];
    let tx = -7.0, tz = -4.6;
    const bench = Wd.kids.find((x) => x.caught && x.seat);
    if (bench && Wd.scatterT <= 0) { tx = bench.x; tz = bench.z; }
    const route = path(k.x, k.z, tx, tz); while (route.length > 1 && Math.hypot(route[0][0] - k.x, route[0][1] - k.z) < 0.6) route.shift();
    const [wx, wz] = route[0];
    const dx = wx - k.x, dz = wz - k.z, d = Math.hypot(dx, dz) || 1;
    return [-dx / d, dz / d, 0];
  }
  // how long each part has gone without anything to do
  track(Wd, dt, P) {
    if (Wd.phase !== 'play') return;
    const s = Wd.seats, parts = this.n >= 4 ? ['legs', 'armL', 'armR', 'head'] : ['legs', 'arms', 'head'];
    const prev = this.prevP || P;
    for (const part of parts) {
      let busy;
      if (part === 'legs') { const pk = P[s.legs]; busy = Math.abs(pk.l[0]) > 0.05 || Math.abs(pk.l[1]) > 0.05 || pk.l[2]; }
      else if (part === 'head') { const pk = P[s.head], pv = prev[s.head]; busy = pk.hd[2] || Math.abs(pk.hd[0] - pv.hd[0]) > 0.003 || pk.n[4] !== pv.n[4]; }
      else {
        const hs = part === 'armL' ? [0] : part === 'armR' ? [1] : [0, 1];
        busy = hs.some((i) => { const own = i === 0 ? s.armL : s.armR, pk = P[own], pv = prev[own]; return pk.h[i][3] || Math.abs(pk.h[i][0] - pv.h[i][0]) + Math.abs(pk.h[i][2] - pv.h[i][2]) + Math.abs(pk.h[i][1] - pv.h[i][1]) > 0.002 || pk.n[i] !== pv.n[i] || Wd.items.some((it) => it.held === i); });
      }
      this.idle[part] = busy ? 0 : (this.idle[part] || 0) + dt;
      this.idleMax[part] = Math.max(this.idleMax[part] || 0, this.idle[part]);
    }
    this.prevP = JSON.parse(JSON.stringify(P));
  }
}
