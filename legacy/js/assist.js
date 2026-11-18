// Help for the Arms player: the hand is drawn gently towards things it can grab or sign,
// and the game says clearly whether the thing is in reach.
import { clamp, ease, fwd, rgt, wrap, yawTo, GAIT } from './config.js';
import { TOWN } from './town.js';
import { handTarget, armsY, armIndex, shiftAt } from './stack.js';
import { ERRANDS, ITEMS } from './errands.js';

const GRAB_SNAP = 0.24, LINE_SNAP = 0.16, GRAB_OK = 0.3;

// What the hands could use right now.
export function handTargets(Wd) {
  const out = [], st = ERRANDS[Wd.errand.id]?.steps[Wd.errand.step];
  if (Wd.car) return out;
  for (const it of Wd.items) if (it.held < 0) out.push({ kind: 'grab', name: ITEMS[it.id].name, x: it.x, y: it.y + 0.04, z: it.z });
  if (st && st.type === 'sign') {
    const P = TOWN.paper, u = clamp(Wd.errand.sign, 0, 1);
    out.push({ kind: 'sign', name: 'the form', x: P.x0 + (P.x1 - P.x0) * u, y: P.y, z: P.z, x1: P.x1 });
    out.push({ kind: 'hold', name: 'the form', x: P.hx, y: P.y, z: P.hz });
  }
  return out;
}

// The hand offset that would put hand i exactly on a world point.
export function offsetFor(b, i, t) {
  const [fx, fz] = fwd(b.yaw), [rx, rz] = rgt(b.yaw), sh = shiftAt(b, armIndex(b));
  const dx = t.x - b.x, dz = t.z - b.z;
  return { x: dx * rx + dz * rz - b.lx * sh - (i === 0 ? -0.26 : 0.26), y: t.y - armsY(b), z: dx * fx + dz * fz - b.lz * sh - 0.22 };
}
export const reachable = (o) => o.x > -0.57 && o.x < 0.57 && o.z > -0.02 && o.z < 0.77 && o.y > -0.37 && o.y < 0.62;

// Nudges the offset "off" (changed in place) and returns a cue for the screen:
// { kind, name, state: 'on' | 'near' | 'far', x, y, z } or null when nothing is close.
export function assistHand(Wd, i, off, dt, steering, otherOff) {
  const b = Wd.body;
  if (b.down || b.popped || Wd.phase !== 'play' || Wd.items.some((it) => it.held === i)) return null;
  const cur = handTarget(b, i, off);
  let best = null, bd = 1e9;
  for (const t of handTargets(Wd)) {
    // for the form, aim at the nearest point on the part of the line that is still unsigned
    const px = t.kind === 'sign' ? clamp(cur.x, Math.min(t.x, t.x1), Math.max(t.x, t.x1)) : t.x;
    const d = Math.hypot(cur.x - px, cur.z - t.z);
    if (d < bd) { bd = d; best = { ...t, px }; }
  }
  if (!best || Math.hypot(best.x - b.x, best.z - b.z) > 2.2) return null;
  const want = offsetFor(b, i, { x: best.kind === 'sign' ? best.px : best.x, y: best.y, z: best.z });
  const start = offsetFor(b, i, best);
  const canReach = reachable(start);
  const snap = best.kind === 'sign' ? LINE_SNAP : GRAB_SNAP;
  if (bd < snap && canReach) {
    const k = !steering ? ease(dt, 10) : best.kind === 'sign' ? ease(dt, 3.5) : 0;   // snaps when you let go of the stick, so you can always steer away; the pen stays on the line while you slide it
    if (best.kind !== 'sign') off.x += (want.x - off.x) * k;       // on the line the hand stays free to slide along it
    off.z += (want.z - off.z) * k;
    off.y += (want.y - off.y) * ease(dt, 12);
  }
  const now = handTarget(b, i, off);
  const d3 = Math.hypot(now.x - (best.kind === 'sign' ? best.px : best.x), now.y - best.y, now.z - best.z);
  // out of reach for this hand, but the other one could get there: say so
  const other = !canReach && otherOff && reachable(offsetFor(b, 1 - i, best));
  const state = d3 < (best.kind === 'grab' ? GRAB_OK : best.kind === 'hold' ? 0.12 : 0.09) ? 'on' : canReach ? 'near' : other ? 'other' : 'far';
  return { kind: best.kind, name: best.name, state, x: best.x, y: best.y, z: best.z, snapped: bd < snap && canReach };
}

// ---------- all-in-one help: hold G and the hands do the reaching ----------
// Picks the free hand that can reach the nearest thing, moves it there and grabs. On the bank form one hand
// holds the paper flat while the other draws the pen along the line. Returns a cue like assistHand.
let grabCd = 0;
export function autoReach(Wd, input, ctx, dt) {
  const b = Wd.body; grabCd = Math.max(0, grabCd - dt);
  if (b.down || b.popped || Wd.phase !== 'play' || Wd.car) return null;
  const own = [0, 1].filter((i) => ctx.hands[i]);
  const free = own.filter((i) => !Wd.items.some((it) => it.held === i));
  const ts = handTargets(Wd);
  const move = (i, t, k = 6) => { const w = offsetFor(b, i, t), h = input.hand[i]; h.x += (clamp(w.x, -0.55, 0.55) - h.x) * ease(dt, k); h.y += (clamp(w.y, -0.35, 0.6) - h.y) * ease(dt, k); h.z += (clamp(w.z, 0, 0.75) - h.z) * ease(dt, k); return Math.hypot(w.x - h.x, w.y - h.y, w.z - h.z); };
  // too far to reach? If this player has the legs too, G turns the coat to face it and shuffles a step closer
  const approach = (t, near) => {
    if (!ctx.parts.includes('legs') || Math.abs(input.legs.f) > 0.05 || Math.abs(input.legs.t) > 0.05) return;
    const d = Math.hypot(t.x - b.x, t.z - b.z); if (d > 2.4) return;
    const err = wrap(yawTo(t.x - b.x, t.z - b.z) - b.yaw);
    input.legs.t = clamp(-err * 2.2, -0.8, 0.8);
    input.legs.f = Math.abs(err) < 0.35 && d > near ? 0.3 : 0; input.legs.gait = GAIT.SHUFFLE;
  };
  // the stack is wobbling: G steadies first (hands come in), then reaches again
  if (Math.hypot(b.lx, b.lz) > 0.28) {
    for (const i of own) { const h = input.hand[i], k = ease(dt, 7); h.x *= 1 - k * 0.5; h.y += (0.02 - h.y) * k; h.z += (0.22 - h.z) * k; }
    return { kind: 'grab', name: 'balance', state: 'far', x: b.x, y: 1, z: b.z };
  }
  const sign = ts.find((t) => t.kind === 'sign'), hold = ts.find((t) => t.kind === 'hold');
  if (sign && hold) {
    const holder = own.includes(0) ? 0 : own[0], pen = own.find((i) => i !== holder);
    const okHold = reachable(offsetFor(b, holder, hold));
    if (!okHold) { approach(hold, 0.55); return { kind: 'hold', name: 'the form', state: 'far', x: hold.x, y: hold.y, z: hold.z }; }
    move(holder, hold, 8);
    if (pen === undefined) return { kind: 'hold', name: 'the form', state: 'on', x: hold.x, y: hold.y, z: hold.z };
    // the pen: onto the line where the signature has got to, then along it at a steady writing pace
    const P = TOWN.paper, u = clamp(Wd.errand.sign + 0.1, 0, 1);
    const at = { x: P.x0 + (P.x1 - P.x0) * u, y: P.y, z: P.z };
    const d = move(pen, at, 5);
    input.sel = pen;
    return { kind: 'sign', name: 'the form', state: d < 0.08 ? 'on' : 'near', x: at.x, y: at.y, z: at.z };
  }
  // a hand that already holds something comes in close while the other one reaches
  for (const i of own) if (!free.includes(i)) { const h = input.hand[i], k = ease(dt, 4); h.x += ((h.x < 0 ? -0.24 : 0.24) - h.x) * k; h.y += (0.02 - h.y) * k; h.z += (0.26 - h.z) * k; }
  const items = ts.filter((t) => t.kind === 'grab');
  if (!items.length || !free.length) return null;
  let best = null;
  for (const t of items) for (const i of free) {
    const o = offsetFor(b, i, t), ok = reachable(o), d = Math.hypot(t.x - b.x, t.z - b.z) + (ok ? 0 : 5);
    if (!best || d < best.d) best = { t, i, ok, d };
  }
  // only reach out at full stretch if the legs cannot step closer: a long reach tips the stack
  const legs = ctx.parts.includes('legs'), long = best.ok && offsetFor(b, best.i, best.t).z > 0.55;
  if (long && legs && !Wd.items.some((it) => it.held >= 0 && own.includes(it.held))) { approach(best.t, 0.45); }
  if (!best.ok) { approach(best.t, 0.6); return { kind: 'grab', name: best.t.name, state: 'far', x: best.t.x, y: best.t.y, z: best.t.z }; }
  input.sel = best.i;
  const d = move(best.i, best.t, 6);
  if (d < 0.08 && grabCd <= 0) { input.n[best.i]++; grabCd = 0.6; }
  return { kind: 'grab', name: best.t.name, state: d < 0.12 ? 'on' : 'near', x: best.t.x, y: best.t.y, z: best.t.z, snapped: true };
}
