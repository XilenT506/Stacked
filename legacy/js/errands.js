// Errands come from data (data/errands.json, people.json, modifiers.json). This file turns that data into a running
// errand: who is in town, what can be picked up, which modifiers apply, the steps and their checks, and the rank.
import { CFG, E, GAIT, clamp, dist, wrap, yawTo } from './config.js';
import { TOWN, inRect, inZone } from './town.js';
import ERR from './data/errands.json';
import PPL from './data/people.json';
import MOD from './data/modifiers.json';

export const ERRANDS = ERR.errands, ZONES = ERR.zones, ITEMS = ERR.items, PDEF = PPL, MODS = MOD.mods;
export const STORY = ERR.story, SURVIVAL = ERR.survival, SURVIVAL_ORDER = MOD.survivalOrder;

export const inZ = (z, x, y) => (z.r !== undefined ? inZone(z, x, y) : inRect(z, x, y));
export const zoneCentre = (z) => (z.r !== undefined ? { x: z.x, z: z.z } : { x: (z.x0 + z.x1) / 2, z: (z.z0 + z.z1) / 2 });
export const personDef = (Wd, i) => PDEF[Wd.people[i]?.id] || { name: 'Someone', job: '', quotes: ['', '', ''] };

// a small seeded random number generator, kept in the world so a run can be replayed
export function rnd(Wd) {
  let t = (Wd.seed = (Wd.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const range = (Wd, [a, b]) => a + (b - a) * rnd(Wd);

// the merged effect of every modifier in play
export function mergeMods(list) {
  const m = { handLean: 1, accel: 1, notice: 1, gust: null, gustPower: 0, hiccup: null, hicPower: 0, hicTell: 0 };
  for (const id of list) {
    const d = MODS[id]; if (!d) continue;
    if (d.handLean) m.handLean *= d.handLean;
    if (d.accel) m.accel *= d.accel;
    if (d.notice) m.notice *= d.notice;
    if (d.gust) { m.gust = d.gust; m.gustPower = d.gustPower; }
    if (d.hiccup) { m.hiccup = d.hiccup; m.hicPower = d.hicPower; m.hicTell = d.hicTell; }
  }
  return m;
}

// what an errand looks like at the start: people, items, modifiers. Survival adds its extra people and modifiers.
export function errandSetup(id, extraPeople = [], extraMods = []) {
  const d = ERRANDS[id];
  const people = [...d.people, ...extraPeople.filter((p) => !d.people.includes(p))];
  const mods = [...new Set([...d.mods, ...extraMods])];
  const items = d.items.map((k) => { const it = ITEMS[k]; return { id: k, kind: it.kind, x: it.home[0], y: it.home[1], z: it.home[2], vy: 0, held: -1 }; });
  return { d, people, mods, items };
}

export function heldItem(Wd, hand) { return Wd.items.find((it) => it.held === hand) || null; }
export const holdingAll = (Wd, ids) => ids.every((k) => { const it = Wd.items.find((x) => x.id === k); return it && it.held >= 0; });

// ---------- the step checks ----------
// Every errand is made of the same few step types, built from the same body actions: walk, reach, grab, sign, nod, talk.
export function stepErrand(Wd, dt, api, people) {
  const e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
  if (!st || d.drive) return;                       // the driving test has its own checks (drive.js)
  const b = Wd.body, o = Wd.ord;
  const who = st.who ? Wd.people.findIndex((p) => p.id === st.who) : -1;
  const sayW = (line, t = 3.5) => { if (who >= 0) { Wd.people[who].say = line; Wd.people[who].sayT = t; } };
  const done = () => { e.step++; e.q = 0; e.t2 = 0; api.ev(E.STEP, e.step); if (e.step >= d.steps.length) api.errandDone(); };
  const z = st.zone ? ZONES[st.zone] : null;
  const steadyBody = Math.abs(b.v) < 0.15 && Math.hypot(b.lx, b.lz) < 0.3 && !b.down;
  if (st.type === 'goto') { if (inZ(z, b.x, b.z)) done(); }
  else if (st.type === 'still') {
    const ok = inZ(z, b.x, b.z) && steadyBody;
    e.q = ok ? e.q + dt : Math.max(0, e.q - dt * 2);
    if (e.q >= st.secs * 0.4 && !e.said) { e.said = 1; if (st.say !== undefined) sayW(st.say); }
    if (e.q >= st.secs) { e.said = 0; done(); }
  } else if (st.type === 'grab') { if (holdingAll(Wd, st.items)) done(); }
  else if (st.type === 'carry') { if (holdingAll(Wd, st.items) && inZ(z, b.x, b.z)) done(); }
  else if (st.type === 'talk') {
    const p = Wd.people[who];
    const facing = p && Math.abs(wrap(yawTo(p.x - b.x, p.z - b.z) - (b.yaw + o.hy))) < 0.75;
    const ok = p && o.talk && facing && dist(p.x, p.z, b.x, b.z) < 3.4 && !b.down;
    e.q = ok ? e.q + dt : Math.max(0, e.q - dt);
    // e.talked: the head said it out loud (talk.js) and it went down well
    if (e.q >= st.secs || e.talked) { if (st.pay) Wd.money = Math.max(0, Wd.money - st.pay); if (st.say !== undefined && !e.talked) sayW(st.say); api.calm(who, 0.1, true); e.talked = 0; done(); }
  } else if (st.type === 'tall') {
    const inside = inZ(z, b.x, b.z);
    const tall = (o.gait === GAIT.TIPTOE || b.lift > 0) && b.count >= 3;
    const ok = inside && tall && steadyBody;
    e.q = ok ? e.q + dt : Math.max(0, e.q - dt * 1.5);
    // standing at the door without stretching up: the usher gets doubtful
    if (inside && !tall && steadyBody) { e.t2 = (e.t2 || 0) + dt; if (e.t2 > 3) { e.t2 = 0; sayW(24, 2.5); if (who >= 0) people.addSus(who, 0.1); } } else e.t2 = 0;
    if (e.q >= 1 && !e.doubt) { e.doubt = 1; sayW(24, 1.8); }                // 'Bit short for this film, sir?' Keep stretching!
    if (e.q >= st.secs) { e.doubt = 0; if (who >= 0) api.calm(who, 0.12, true); sayW(13, 2); done(); }
  } else if (st.type === 'sign') stepSign(Wd, dt, api);
}

// signing the bank form: one hand holds it flat, the other slides the pen along the line
function stepSign(Wd, dt, api) {
  const e = Wd.errand, teller = Wd.people.findIndex((p) => p.id === 'ruth');
  const sayT = (line) => { if (teller >= 0) { Wd.people[teller].say = line; Wd.people[teller].sayT = 4; } };
  const P = TOWN.paper, len = P.x0 - P.x1;
  const onHold = (h) => Math.abs(h.y - P.y) < 0.1 && Math.hypot(h.x - P.hx, h.z - P.hz) < 0.13;
  e.steady = 0;
  Wd.hands.forEach((h, i) => {
    if (Math.abs(h.y - P.y) > 0.09 || Math.abs(h.z - P.z) > 0.2) return;
    const u = (P.x0 - h.x) / len;
    if (u > e.sign && u < e.sign + 0.3 && u > -0.2) {
      const steady = onHold(Wd.hands[1 - i]);
      e.steady = steady ? 1 : 0;
      e.sign = Math.min(1, u); e.mess += Math.abs(h.z - P.z) + (steady ? 0 : 0.07); e.n++;
      if (!steady && !e.warned && e.sign > 0.15) { e.warned = 1; sayT(21); }
    }
  });
  if (Wd.hands.some(onHold)) e.steady = 1;
  if (e.sign >= 0.95) {
    e.messy = e.n > 0 && e.mess / e.n > 0.05 ? 1 : 0; api.ev(E.SIGNED);
    if (e.messy) { if (teller >= 0) Wd.people[teller].sus = clamp(Wd.people[teller].sus + 0.2, 0, 1); sayT(6); api.worst(5); } else { if (teller >= 0) api.calm(teller, 0.3, true); sayT(7); }
    e.step++; e.q = 0; api.ev(E.STEP, e.step);
  }
}

// ---------- words on screen ----------
export function objective(Wd) {
  const e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
  if (!st) return 'Done!';
  if ((st.type === 'carry') && !holdingAll(Wd, st.items)) {
    const lost = st.items.map((k) => Wd.items.find((x) => x.id === k)).filter((it) => it && it.held < 0).map((it) => ITEMS[it.id].name);
    return `You dropped ${lost.join(' and ')}. Pick it up again.`;
  }
  let t = st.text;
  if ((st.type === 'still' || st.type === 'tall' || st.type === 'talk') && e.q > 0.2) t += ` (${Math.max(0, st.secs - e.q).toFixed(1)}s)`;
  return t;
}
export function hint(Wd, part) {
  const e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
  return d.hints && st && st.hint ? st.hint[part] || '' : '';
}
export function hintAll(Wd, parts) {
  const e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
  if (!d.hints || !st || !st.hint) return '';
  return parts.length === 3 && st.hint.all ? st.hint.all : parts.map((k) => st.hint[k]).filter(Boolean)[0] || '';
}

// ---------- ranks ----------
// Three things decide the rank: time against the target, how many Scatters, and how full the worst "?" got.
export function rankErrand(r) {
  if (!r.ok) return { rank: 'D', pts: 0, why: [r.fail || 'Errand failed'] };
  const tgt = ERRANDS[r.id].target[1];
  const tp = r.time <= tgt ? 2 : r.time <= tgt * 1.5 ? 1 : 0;
  const sp = r.scatters === 0 ? 2 : r.scatters === 1 ? 1 : 0;
  const mp = r.peak < 0.5 ? 2 : r.peak < 0.85 ? 1 : 0;
  const pts = tp + sp + mp;
  const rank = pts >= 6 ? 'S' : pts === 5 ? 'A' : pts >= 3 ? 'B' : 'C';
  return { rank, pts, parts: [tp, sp, mp] };
}
export function rankStory(results) {
  if (results.some((r) => !r.ok)) return 'D';
  const avg = results.reduce((a, r) => a + rankErrand(r).pts, 0) / Math.max(1, results.length);
  return avg >= 5.75 ? 'S' : avg >= 4.75 ? 'A' : avg >= 3 ? 'B' : 'C';
}
export function rankSurvival(n) { return n >= 8 ? 'S' : n >= 6 ? 'A' : n >= 4 ? 'B' : n >= 2 ? 'C' : 'D'; }
