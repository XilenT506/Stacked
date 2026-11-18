// One afternoon: the world state, the errands (from data), getting busted, Scatter, restacking, modifiers,
// story and survival runs, and the end cards with their rank.
// The host runs stepWorld(). Everyone else only receives snapshots (pack / unpack).
import { CFG, E, clamp, dist, r2, r3, levelFor } from './config.js';
import { TOWN, collide, inAlley } from './town.js';
import { newBody, newOrders, stepBody, handTarget } from './stack.js';
import { assignSeats, kidOwners, applyInputs, stepKids, spawnKid } from './parts.js';
import { newPeople, stepPeople, tell } from './townspeople.js';
import { ERRANDS, ITEMS, STORY, SURVIVAL, SURVIVAL_ORDER, MODS, errandSetup, mergeMods, stepErrand, rankErrand, rankStory, rankSurvival, personDef, rnd, range, heldItem } from './errands.js';
import { newCar, stepDrive, SEAT_LIFT } from './drive.js';
import { applyTalk } from './talk.js';
import { PDEF } from './errands.js';

// run: { mode: 'story' | 'survival' | 'single', errand: id (single only) }
export function newWorld(players = ['solo'], pts = 0, run = { mode: 'single', errand: 'bank' }, seed = (Math.random() * 1e9) | 0) {
  const b = newBody(), o = newOrders(), lvl = levelFor(pts);
  b.lift = lvl >= 2 ? CFG.platform : 0;
  const Wd = {
    phase: 'play', time: 0, clock: CFG.clock, money: CFG.startMoney, rot: 0, seed,
    players, seats: assignSeats(players.length, 0),
    body: b, ord: o, hands: [handTarget(b, 0, o.hand[0]), handTarget(b, 1, o.hand[1])], hatT: 0,
    items: [], coins: 0, props: 0, cones: 0, people: [], dog: { x: 5, z: -0.8, yaw: 0, tx: 5, tz: -0.8, wait: 2, run: 0, off: 0 },
    kids: [], scatterT: 0, errand: { id: 'bank', step: 0, q: 0, sign: 0, mess: 0, n: 0, messy: 0 },
    stats: { falls: 0, busts: 0, worst: 0, who: 0, sev: 0, fooled: 0, earned: 0 }, end: 0, ev: [], evId: 0, last: [], asks: !(run.noAsks || run.noMods),
    dis: { pts, lvl }, patT: 0, browT: 0, car: null, mods: mergeMods([]), modList: [], notice: 1,
    run: { noMods: !!run.noMods, daily: run.daily || '', mode: run.mode, list: run.mode === 'story' ? STORY.slice() : run.mode === 'single' ? [run.errand] : [], idx: 0, done: 0, scatters: 0, extras: [], extraMods: [], results: [], betweenT: 0, last: '' },
    es: null,
  };
  if (Wd.run.mode === 'survival') { Wd.clock = 300; Wd.run.list = [pickSurvival(Wd)]; }
  setupErrand(Wd, Wd.run.list[0]);
  return Wd;
}

function pickSurvival(Wd) {
  const opts = SURVIVAL.filter((k) => k !== Wd.run.last);
  const k = opts[Math.floor(rnd(Wd) * opts.length)]; Wd.run.last = k; return k;
}

// put the town and the coat into the starting state for an errand
export function setupErrand(Wd, id) {
  const r = Wd.run, s = errandSetup(id, r.extras, r.extraMods), d = s.d;
  Object.assign(Wd.body, newBody(), { lift: Wd.dis.lvl >= 2 ? CFG.platform : 0 });
  Wd.errand = { id, step: 0, q: 0, sign: 0, mess: 0, n: 0, messy: 0, steady: 0 };
  Wd.talkLog = []; Wd.coatSayT = 0;
  if (r.noMods) s.mods = [];                       // test runs can switch the modifiers off
  Wd.items = s.items; Wd.modList = s.mods; Wd.mods = mergeMods(s.mods);
  // survival keeps getting harder: once every extra grown-up and modifier is in, everyone notices a little faster each errand
  Wd.notice = d.notice * Wd.mods.notice * (r.mode === 'survival' ? 1 + Math.max(0, r.done - SURVIVAL_ORDER.length) * 0.12 + r.done * 0.04 : 1);
  Wd.body.accel = Wd.mods.accel;
  Wd.people = newPeople(s.people);
  Wd.kids = []; Wd.phase = 'play'; Wd.end = 0; Wd.cones = 0; Wd.props = 0; Wd.coins = 0;
  Wd.dog.off = d.drive ? 1 : 0;
  Wd.car = d.drive ? newCar(Wd, d) : null;
  if (Wd.car) { Object.assign(Wd.body, { x: Wd.car.x, z: Wd.car.z, yaw: Wd.car.yaw }); Wd.body.lift = SEAT_LIFT; }
  if (r.mode !== 'survival') Wd.clock = d.clock;
  Wd.gustT = Wd.mods.gust ? range(Wd, Wd.mods.gust) : 0; Wd.hicT = Wd.mods.hiccup ? range(Wd, Wd.mods.hiccup) : 0;
  Wd.es = { start: Wd.time, scatters: 0, peak: 0, falls: 0 };
  Wd.stats.sev = 0; Wd.stats.worst = 0; Wd.stats.who = 0;
}

const WORST_SEV = [0, 3, 2, 5, 6, 4, 1, 7, 8, 7, 6, 5, 4];
export const WORST = ['Nothing. Suspiciously smooth.', 'Slipped on the wet floor', 'Kicked the dog', 'Fell over in front of {who}',
  'The coat popped open in front of {who}', 'Signed the form like an earthquake', 'Knocked over the {prop}',
  'Missed dinner', 'Every single kid got caught', 'Failed the driving test', 'Knocked over a cone', 'Dropped {item}',
  'Said something very childish to {who}'];

function makeApi(Wd) {
  const ev = (k, a = 0) => { Wd.ev.push([++Wd.evId, k, a]); if (Wd.ev.length > 8) Wd.ev.shift(); };
  const worst = (code, who = 0) => { if (WORST_SEV[code] > Wd.stats.sev) { Wd.stats.sev = WORST_SEV[code]; Wd.stats.worst = code; Wd.stats.who = who; ev(E.WORST, code); } };
  const dropAll = () => { for (const it of Wd.items) if (it.held >= 0) { it.held = -1; ev(E.DROP); tell(Wd, it.x, it.z, 0.2, 8); worst(11, Wd.items.indexOf(it)); } };
  const api = {
    ev, worst, banner: (i) => ev(E.BANNER, i),
    fell() {
      Wd.stats.falls++; if (Wd.es) Wd.es.falls++; ev(E.FALL); api.banner(1); dropAll();
      const b = Wd.body; let who = -1;
      Wd.people.forEach((p, i) => { if (!inAlley(b.x, b.z) && dist(p.x, p.z, b.x, b.z) < 8) who = i; });
      if (who >= 0) worst(3, who);
    },
    grab(i) {
      const h = Wd.hands[i], mine = heldItem(Wd, i);
      if (mine) { mine.held = -1; ev(E.DROP); tell(Wd, mine.x, mine.z, 0.12, 6); return; }
      if (Wd.body.down) return;
      let best = null, bd = 0.34;
      for (const it of Wd.items) { if (it.held >= 0) continue; const d = Math.hypot(h.x - it.x, h.y - it.y, h.z - it.z); if (d < bd) { bd = d; best = it; } }
      if (best) { best.held = i; ev(E.GRAB); }
    },
    // a bluff landed on person i: the meter drops and everyone gets to see it. While the examiner looks away it counts double.
    calm(i, amount, always) {
      const p = Wd.people[i]; if (!p || (p.sus <= 0.01 && !always)) return;
      if (Wd.car && Wd.car.slipT > 0) amount *= 2;
      p.sus = Math.max(0, p.sus - amount); ev(E.CALM, i);
    },
    driveTell(amount, line) {
      if (Wd.car && Wd.car.slipT > 0) return;           // he did not see that
      const i = Wd.people.findIndex((p) => p.id === 'price'); if (i < 0) return;
      const p = Wd.people[i]; p.sus = clamp(p.sus + amount * Wd.notice, 0, 1); if (line !== undefined) { p.say = line; p.sayT = 2.5; }
      if (line === 31) worst(10, i);
    },
    fooled(i) { Wd.stats.fooled++; api.points(1); api.banner(17); ev(E.POINT, i); },
    points(n) {
      const d = Wd.dis; d.pts += n; Wd.stats.earned += n;
      const lvl = levelFor(d.pts);
      if (lvl > d.lvl) { d.lvl = lvl; Wd.body.lift = Wd.car ? SEAT_LIFT : (lvl >= 2 ? CFG.platform : 0); ev(E.LEVEL, lvl); api.banner(13 + lvl); }
    },
    pat() {
      if (Wd.patT > 0 || Wd.body.down || Wd.phase !== 'play') return;
      Wd.patT = 1; Wd.body.iz -= 0.35; ev(E.PAT);
    },
    hat() {
      Wd.hatT = 1; Wd.body.ix += 0.3; ev(E.HAT);
      Wd.people.forEach((p, i) => { if (!inAlley(Wd.body.x, Wd.body.z) && dist(p.x, p.z, Wd.body.x, Wd.body.z) < 5 && p.sus > 0.01) api.calm(i, 0.05); });
    },
    hop(pid) {
      const b = Wd.body;
      if (Wd.phase !== 'play' || b.down || Wd.car) return;
      if (Wd.kids.length) {
        const k = Wd.kids[0];
        if (!inAlley(b.x, b.z) || dist(k.x, k.z, b.x, b.z) > 1.8) { api.banner(10); return; }
        Wd.kids = []; b.count = 3; ev(E.HOPIN); api.banner(6); return;
      }
      if (!inAlley(b.x, b.z)) { api.banner(9); return; }
      b.count = 2; spawnKid(Wd, b.x + 0.9, b.z - 0.2, pid, 2); ev(E.HOPOUT); api.banner(5);
    },
    swap() {
      if (Wd.phase !== 'play' || !inAlley(Wd.body.x, Wd.body.z)) { api.banner(9); return; }
      Wd.rot = (Wd.rot + 1) % Math.max(1, Wd.players.length); Wd.seats = assignSeats(Wd.players.length, Wd.rot); ev(E.SWAP); api.banner(7);
    },
    caught() { ev(E.CAUGHT); },
    bust(i) {
      if (Wd.phase !== 'play') return;
      const b = Wd.body;
      Wd.stats.busts++; Wd.es.scatters++; Wd.run.scatters++; worst(4, i);
      dropAll(); ev(E.RIP); api.banner(3);
      Wd.people[i].say = 9; Wd.people[i].sayT = 3;
      b.popped = 1; b.v = 0;
      // the finale cannot be restacked: a full meter fails the test
      if (Wd.car) { worst(9, i); Wd.car.v = 0; finishErrand(Wd, api, false, 'Mr Price saw through the coat'); return; }
      // survival: the third Scatter ends the day
      if (Wd.run.mode === 'survival' && Wd.run.scatters >= 3) { finishRun(Wd, api, 'Third Scatter: grounded for the day'); return; }
      Wd.phase = 'scatter'; Wd.scatterT = CFG.scatterTime;
      const owners = kidOwners(Wd.seats, Wd.players.length);
      const have = Wd.kids.length;                        // a kid who was already out stays out
      for (let k = 0; k < owners.length - have; k++) {
        const a = (k / owners.length) * Math.PI * 2 + 0.5;
        spawnKid(Wd, b.x + Math.cos(a) * 0.7, b.z + Math.sin(a) * 0.7, owners[k], k);
      }
    },
    errandDone() { finishErrand(Wd, api, true); },
  };
  return api;
}

// one errand is over: record it, rank it, and move the run along
function finishErrand(Wd, api, ok, fail) {
  if (Wd.phase === 'end' || Wd.phase === 'between') return;
  const r = Wd.run, peak = Math.max(Wd.es.peak, ...Wd.people.map((p) => p.peak || 0));
  const res = { id: Wd.errand.id, ok, fail: ok ? '' : fail, time: Math.round(Wd.time - Wd.es.start), scatters: Wd.es.scatters, peak: r2(peak), falls: Wd.es.falls,
    worst: worstText(Wd), quotes: quotes(Wd), lines: talkLines(Wd) };
  res.rank = rankErrand(res).rank;
  r.results.push(res);
  if (ok) { Wd.money += 10; if (!Wd.es.scatters) { api.points(3); api.banner(18); } }
  if (r.mode === 'survival') {
    if (ok) { r.done++; Wd.clock += Math.max(10, 40 - r.done * 4); Wd.phase = 'between'; Wd.run.betweenT = 3; growSurvival(Wd); api.ev(E.NEXT, r.done); return; }
    finishRun(Wd, api, fail); return;
  }
  Wd.end = ok ? 1 : 4; Wd.phase = 'end';
  api.ev(E.END, Wd.end);
}

function finishRun(Wd, api, why) {
  Wd.run.why = why; Wd.end = 5; Wd.phase = 'end'; api.worst(7); api.ev(E.END, 5);
}

// each new survival errand adds one more grown-up or one more modifier
function growSurvival(Wd) {
  const r = Wd.run, add = SURVIVAL_ORDER[(r.done - 1) % SURVIVAL_ORDER.length];
  const [kind, id] = add.split(':');
  if (kind === 'person' && !r.extras.includes(id)) r.extras.push(id);
  else if (kind === 'mod' && !r.extraMods.includes(id)) r.extraMods.push(id);
  r.added = kind === 'mod' ? MODS[id]?.name : personDef({ people: [{ id }] }, 0).name + ' joins the street';
  r.list.push(pickSurvival(Wd));
}

// the host moves the story on to the next errand (or starts again)
export function nextErrand(Wd) {
  const r = Wd.run;
  if (r.mode === 'story' && r.idx + 1 < r.list.length) { r.idx++; setupErrand(Wd, r.list[r.idx]); return true; }
  return false;
}

function restack(Wd, api) {
  const b = Wd.body;
  let gx = 0, gz = 0; for (const k of Wd.kids) { gx += k.x; gz += k.z; }
  const n = Math.max(1, Wd.kids.length), at = collide(gx / n, gz / n, CFG.bodyR, false);
  Object.assign(b, { x: at.x, z: at.z, yaw: TOWN.start.yaw, v: 0, lx: 0, lz: 0, lvx: 0, lvz: 0, down: 0, popped: 0, count: 3, stum: 0, still: 0 });
  Wd.kids = []; Wd.phase = 'play'; Wd.money = Math.max(0, Wd.money - 5);
  for (const p of Wd.people) { p.sus = 0.15; p.mode = 2; p.greet = 0; p.cool = Wd.time + 10; p.carry = -1; }
  // anything that was carried goes back where it came from; the errand picks up from there
  const d = ERRANDS[Wd.errand.id];
  for (const it of Wd.items) { const h = ITEMS[it.id].home; Object.assign(it, { x: h[0], y: h[1], z: h[2], vy: 0, held: -1 }); }
  const g = d.steps.findIndex((st) => st.type === 'grab');
  if (g >= 0 && Wd.errand.step > g) Wd.errand.step = g;
  Wd.errand.q = 0;
  api.ev(E.RESTACK); api.banner(4);
}

function stepThings(Wd, dt, api) {
  const b = Wd.body;
  // things you can carry: held, resting where they belong, or falling to the floor
  for (const it of Wd.items) {
    if (it.held >= 0) { const h = Wd.hands[it.held]; it.x = h.x; it.y = h.y - 0.1; it.z = h.z; it.vy = 0; it.heldT = (it.heldT || 0) + dt; continue; }
    it.heldT = 0;
    const home = ITEMS[it.id].home, onHome = Math.hypot(it.x - home[0], it.z - home[2]) < 0.6;
    const floor = onHome ? home[1] : 0.13;
    if (it.y > floor) { it.vy -= 9.8 * dt; it.y = Math.max(floor, it.y + it.vy * dt); } else { it.vy = 0; it.y = Math.max(it.y, floor); }
  }
  if (b.popped) return;
  if (!Wd.car) {
    TOWN.coins.forEach((c, i) => { if (!(Wd.coins & (1 << i)) && dist(c.x, c.z, b.x, b.z) < 0.5) { Wd.coins |= 1 << i; Wd.money += 2; api.ev(E.COIN); } });
    for (const k of Wd.kids) if (!(Wd.coins & 8) && dist(TOWN.kidCoin.x, TOWN.kidCoin.z, k.x, k.z) < 0.6) { Wd.coins |= 8; Wd.money += 10; api.ev(E.COIN); api.banner(8); }
    // props are solid: bump one and it tips over, noisily
    TOWN.props.forEach((p, i) => {
      const d = dist(p.x, p.z, b.x, b.z), min = p.r + CFG.bodyR;
      if (d >= min) return;
      const nx = (b.x - p.x) / (d || 1), nz = (b.z - p.z) / (d || 1);
      b.x = p.x + nx * min; b.z = p.z + nz * min;
      if (!(Wd.props & (1 << i))) { Wd.props |= 1 << i; b.iz -= 0.7; api.ev(E.CLANG); tell(Wd, p.x, p.z, 0.12, 7); api.worst(6, i); }
    });
    // the wet floor: walk across it at full speed and you slide
    if (Math.hypot(TOWN.wet.x - b.x, TOWN.wet.z - b.z) < TOWN.wet.r && Math.abs(b.v) > 1.1 && b.bumpT <= 0 && !b.down) {
      b.iz += 1.45; b.ix += 0.6; b.bumpT = 1.5; api.ev(E.SLIP); api.banner(11); api.worst(1); tell(Wd, b.x, b.z, 0.1, 7);
    }
  }
  // modifiers: gusts of wind and hiccups
  const m = Wd.mods;
  if (m.gust && !b.down) { Wd.gustT -= dt; if (Wd.gustT <= 0) { Wd.gustT = range(Wd, m.gust); b.ix += m.gustPower * (rnd(Wd) < 0.5 ? -1 : 1); b.iz += m.gustPower * 0.5 * (rnd(Wd) - 0.5); api.ev(E.GUST); } }
  if (m.hiccup && !b.down) { Wd.hicT -= dt; if (Wd.hicT <= 0) { Wd.hicT = range(Wd, m.hiccup); b.iz += m.hicPower; api.ev(E.HIC); tell(Wd, b.x, b.z, m.hicTell, 5); } }
  // the dog
  const d = Wd.dog;
  if (d.off) { d.x = 12; d.z = -6; return; }
  d.wait -= dt; d.run = Math.max(0, d.run - dt);
  if (d.wait <= 0) { d.tx = -8 + Math.random() * 16; d.tz = -1.6 + Math.random() * 3.6; d.wait = 3 + Math.random() * 4; }
  const ddx = d.tx - d.x, ddz = d.tz - d.z, dd = Math.hypot(ddx, ddz);
  if (dd > 0.1) { const sp = d.run > 0 ? 4 : 0.9; d.x += (ddx / dd) * sp * dt; d.z += (ddz / dd) * sp * dt; d.yaw = Math.atan2(ddx, ddz); }
  if (dist(d.x, d.z, b.x, b.z) < 0.5 && d.run <= 0 && !b.down) {
    d.run = 2; d.tx = clamp(d.x + (d.x - b.x) * 12, -9, 9); d.tz = clamp(d.z + (d.z - b.z) * 12, -1.8, 2); d.wait = 3;
    b.iz -= 0.9 * Math.sign(b.v || 1); api.ev(E.YELP); api.banner(12); api.worst(2); tell(Wd, d.x, d.z, 0.1, 7);
  }
}

// inputs: one packet per player index (see parts.emptyPacket)
export function stepWorld(Wd, dt, inputs) {
  const api = makeApi(Wd);
  if (Wd.phase === 'end') return;
  Wd.time += dt; Wd.coatSayT = Math.max(0, (Wd.coatSayT || 0) - dt); Wd.hatT = Math.max(0, Wd.hatT - dt * 1.4); Wd.patT = Math.max(0, Wd.patT - dt);
  applyInputs(Wd, inputs, Wd.last, api);
  if (Wd.coatSayT > 0.5) Wd.ord.talk = 1;            // the coat's mouth moves while its line is on screen
  if (Wd.phase === 'between') {
    Wd.run.betweenT -= dt;
    if (Wd.run.betweenT <= 0) { setupErrand(Wd, Wd.run.list[Wd.run.list.length - 1]); api.ev(E.RESTACK); }
    return;
  }
  if (Wd.phase === 'play') {
    Wd.clock -= dt;
    stepBody(Wd, dt, api);
    stepKids(Wd, inputs, dt, api);
    stepThings(Wd, dt, api);
    stepPeople(Wd, dt, api);
    if (Wd.car) stepDrive(Wd, dt, api);
    if (Wd.phase === 'play') stepErrand(Wd, dt, api, { addSus: (i, a) => { Wd.people[i].sus = clamp(Wd.people[i].sus + a * Wd.notice, 0, 1); } });
    for (const p of Wd.people) Wd.es.peak = Math.max(Wd.es.peak, p.sus);
    if (Wd.clock <= 0 && Wd.phase === 'play') {
      if (Wd.run.mode === 'survival') finishRun(Wd, api, 'Dinner time!'); else { api.worst(7); finishErrand(Wd, api, false, 'Late: the shop shut / the town went home'); }
    }
  } else if (Wd.phase === 'scatter') {
    Wd.scatterT = Math.max(0, Wd.scatterT - dt);
    if (Wd.run.mode === 'survival') Wd.clock -= dt;
    stepKids(Wd, inputs, dt, api);
    stepThings(Wd, dt, api);
    stepPeople(Wd, dt, api);
    const free = Wd.kids.filter((k) => !k.caught);
    if (!free.length) { api.worst(8); if (Wd.run.mode === 'survival') finishRun(Wd, api, 'Every kid got caught'); else finishErrand(Wd, api, false, 'Every kid got caught'); }
    else if (free.length === Wd.kids.length && free.every((k) => inAlley(k.x, k.z))) restack(Wd, api);
  }
}

export function setPlayers(Wd, players) {
  Wd.players = players; Wd.rot %= Math.max(1, players.length); Wd.seats = assignSeats(players.length, Wd.rot);
  for (const k of Wd.kids) if (k.owner >= players.length) k.owner = 0;
}

// ---------- end cards ----------
// the best bluff and the worst blurt of the errand, as said out loud: the bit people screenshot
function talkLines(Wd) {
  const log = Wd.talkLog || []; if (!log.length) return null;
  const name = (id) => PDEF[id]?.name || 'Someone';
  const best = log.reduce((a, l) => (l[3] < a[3] ? l : a)), worst = log.reduce((a, l) => (l[3] > a[3] ? l : a));
  const out = [];
  if (best[3] < 0) out.push({ tag: 'Best bluff', said: best[0], who: name(best[2]), reply: best[1] });
  if (worst[3] > 0.05 && worst !== best) out.push({ tag: 'Worst blurt', said: worst[0], who: name(worst[2]), reply: worst[1] });
  return out.length ? out : null;
}
export function hostTalk(Wd, i, said, v) { applyTalk(Wd, makeApi(Wd), i, said, v); }
function worstText(Wd) {
  const s = Wd.stats, it = Wd.items[s.who];
  return WORST[s.worst].replace('{who}', personDef(Wd, s.who).name).replace('{prop}', TOWN.props[s.who]?.name || 'bin').replace('{item}', it ? ITEMS[it.id].name : 'something');
}
function quotes(Wd) {
  return Wd.people.map((p, i) => {
    const def = personDef(Wd, i), s = Wd.stats;
    const lvl = (s.busts && s.who === i && s.worst === 4) || (p.peak || 0) >= 0.999 ? 2 : (p.peak || 0) > 0.45 ? 1 : 0;
    return { who: def.name + ', ' + def.job, text: def.quotes[lvl] };
  });
}
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t) % 60).padStart(2, '0')}`;

export function endCard(Wd) {
  const r = Wd.run, s = Wd.stats;
  const next = CFG.levels[Wd.dis.lvl];
  const disguise = `Level ${Wd.dis.lvl}` + (next ? ` (${next - Wd.dis.pts} more points to level ${Wd.dis.lvl + 1})` : ' (the best there is)');
  if (r.mode === 'survival') {
    const n = r.done, last = r.results[r.results.length - 1] || { quotes: quotes(Wd), worst: worstText(Wd) };
    const peak = Math.max(0, ...r.results.map((x) => x.peak), ...Wd.people.map((p) => p.peak || 0));
    return { kind: 'survival', daily: r.daily, title: (r.daily ? `Today's town: ` : '') + `${n} errand${n === 1 ? '' : 's'} done`, sub: r.why || '', rank: rankSurvival(n),
      why: [`Errands completed: ${n}`, `Scatters: ${r.scatters} of 3`, `Highest "?": ${Math.round(peak * 100)}%`],
      quotes: last.quotes || quotes(Wd), worst: last.worst || worstText(Wd), lines: last.lines || talkLines(Wd), disguise, earned: s.earned, fooled: s.fooled, money: Wd.money, results: r.results };
  }
  const res = r.results[r.results.length - 1];
  const rk = rankErrand(res), tgt = ERRANDS[res.id].target[1];
  const why = res.ok ? [`Time ${mmss(res.time)} (target ${mmss(tgt)}) ${'★'.repeat(rk.parts[0])}`, `Scatters: ${res.scatters} ${'★'.repeat(rk.parts[1])}`, `Highest "?": ${Math.round(res.peak * 100)}% ${'★'.repeat(rk.parts[2])}`]
    : [res.fail || 'Errand failed', `Time ${mmss(res.time)}`, `Scatters: ${res.scatters}`];
  const lastStory = r.mode === 'story' && r.idx === r.list.length - 1;
  return { kind: r.mode, title: (res.ok ? ERRANDS[res.id].name + ': done' : ERRANDS[res.id].name + ': failed'), sub: r.mode === 'story' ? `Errand ${r.idx + 1} of ${r.list.length}` : '',
    rank: res.rank, why, quotes: res.quotes, worst: res.worst, lines: res.lines, disguise, earned: s.earned, fooled: s.fooled, money: Wd.money,
    next: r.mode === 'story' && !lastStory, afternoon: lastStory ? { rank: rankStory(r.results), results: r.results.map((x) => ({ name: ERRANDS[x.id].name, rank: x.rank, time: mmss(x.time) })) } : null };
}

// ---------- snapshots ----------
const PH = ['play', 'scatter', 'end', 'between'];
const RM = ['single', 'story', 'survival'];
export function pack(Wd) {
  const b = Wd.body, o = Wd.ord, h = Wd.hands, r = Wd.run, c = Wd.car;
  return {
    p: PH.indexOf(Wd.phase), t: r2(Wd.time), c: r2(Wd.clock), m: Wd.money, r: Wd.rot, pl: Wd.players,
    b: [r2(b.x), r2(b.z), r3(b.yaw), r2(b.v), r3(b.lx), r3(b.lz), b.down, b.count, b.popped, r2(b.fl[0]), r2(b.fl[1]), r2(b.ph), b.stum, r2(b.lift)],
    h: [r2(h[0].x), r2(h[0].y), r2(h[0].z), r2(h[1].x), r2(h[1].y), r2(h[1].z)],
    o: [r2(o.f), r2(o.t), o.gait, r2(o.hy), r2(o.hp), o.nod | (o.shake << 1) | (o.talk << 2) | (o.brow << 3), r2(Wd.hatT),
      r2(o.hand[0].x), r2(o.hand[0].y), r2(o.hand[0].z), r2(o.hand[1].x), r2(o.hand[1].y), r2(o.hand[1].z), o.hand[0].act, o.hand[1].act, r2(Wd.patT)],
    v: [Wd.dis.pts, Wd.dis.lvl, Wd.stats.fooled, Wd.stats.earned],
    it: Wd.items.map((it) => [it.id, r2(it.x), r2(it.y), r2(it.z), it.held]),
    w: Wd.people.map((p) => [p.id, r2(p.x), r2(p.z), r2(p.yaw), r2(p.sus), p.mode, p.say, p.greet, r2(p.peak || 0)]),
    d: [r2(Wd.dog.x), r2(Wd.dog.z), r2(Wd.dog.yaw)],
    k: Wd.kids.map((k) => [r2(k.x), r2(k.z), r2(k.yaw), k.caught, k.owner, k.color, k.lead ? 1 : 0]),
    x: [Wd.coins, Wd.props, Wd.errand.step, r2(Wd.errand.q), r2(Wd.errand.sign), Wd.errand.messy, r2(Wd.scatterT), Wd.end, Wd.errand.steady || 0, Wd.cones],
    er: [Wd.errand.id, RM.indexOf(r.mode), r.idx, r.done, r.scatters, r.list.join(','), r.extras.join(','), Wd.modList.join(','), r2(r.betweenT), r.added || '', r.why || ''],
    rs: r.results,
    car: c ? [r2(c.x), r2(c.z), r3(c.yaw), r2(c.v), r2(c.wheel), r2(c.slipT), c.slipKind, r2(c.ask)] : null,
    s: [Wd.stats.falls, Wd.stats.busts, Wd.stats.worst, Wd.stats.who],
    ts: Wd.coatSayT > 0 ? [Wd.coatSay, r2(Wd.coatSayT)] : null,
    e: Wd.ev,
  };
}

// Client: lay a snapshot over the local world. The body goes to "nb" so the client can blend towards it.
export function unpack(Wd, s) {
  Wd.phase = PH[s.p]; Wd.time = s.t; Wd.clock = s.c; Wd.money = s.m; Wd.rot = s.r;
  if (Wd.players.join() !== s.pl.join()) { Wd.players = s.pl; }
  Wd.seats = assignSeats(s.pl.length, s.r);
  // a new errand (or a different line-up of grown-ups) on the host: set ours up the same way
  const [eid, rm, idx, done, scat, list, extras, mods, bt, added, why] = s.er;
  const r = Wd.run;
  r.mode = RM[rm]; r.idx = idx; r.done = done; r.scatters = scat; r.list = list ? list.split(',') : []; r.extras = extras ? extras.split(',') : []; r.betweenT = bt; r.added = added; r.why = why; r.results = s.rs || [];
  if (Wd.errand.id !== eid || Wd.people.map((p) => p.id).join() !== s.w.map((a) => a[0]).join()) {
    r.extraMods = mods ? mods.split(',') : []; setupErrand(Wd, eid);
  }
  Wd.nb = { x: s.b[0], z: s.b[1], yaw: s.b[2], v: s.b[3] };
  const b = Wd.body;
  b.lx = s.b[4]; b.lz = s.b[5]; b.down = s.b[6]; b.count = s.b[7]; b.popped = s.b[8]; b.fl = [s.b[9], s.b[10]]; b.ph = s.b[11]; b.stum = s.b[12]; b.lift = s.b[13];
  for (let i = 0; i < 2; i++) { Wd.hands[i].x = s.h[i * 3]; Wd.hands[i].y = s.h[i * 3 + 1]; Wd.hands[i].z = s.h[i * 3 + 2]; }
  const o = Wd.ord;
  o.f = s.o[0]; o.t = s.o[1]; o.gait = s.o[2]; o.hy = s.o[3]; o.hp = s.o[4]; o.nod = s.o[5] & 1; o.shake = (s.o[5] >> 1) & 1; o.talk = (s.o[5] >> 2) & 1; o.brow = (s.o[5] >> 3) & 1; Wd.hatT = s.o[6];
  o.hand[0].act = s.o[13]; o.hand[1].act = s.o[14]; Wd.patT = s.o[15];
  Wd.dis.pts = s.v[0]; Wd.dis.lvl = s.v[1]; Wd.stats.fooled = s.v[2]; Wd.stats.earned = s.v[3];
  for (let i = 0; i < 2; i++) { o.hand[i].x = s.o[7 + i * 3]; o.hand[i].y = s.o[8 + i * 3]; o.hand[i].z = s.o[9 + i * 3]; }
  s.it.forEach((a) => { const it = Wd.items.find((x) => x.id === a[0]); if (it) Object.assign(it, { x: a[1], y: a[2], z: a[3], held: a[4] }); });
  s.w.forEach((a, i) => { if (Wd.people[i]) Object.assign(Wd.people[i], { x: a[1], z: a[2], yaw: a[3], sus: a[4], mode: a[5], say: a[6], greet: a[7], peak: a[8] }); });
  Object.assign(Wd.dog, { x: s.d[0], z: s.d[1], yaw: s.d[2] });
  Wd.kids = s.k.map((a) => ({ x: a[0], z: a[1], yaw: a[2], caught: a[3], owner: a[4], color: a[5], lead: a[6] }));
  Wd.coins = s.x[0]; Wd.props = s.x[1]; Wd.cones = s.x[9];
  Object.assign(Wd.errand, { step: s.x[2], q: s.x[3], sign: s.x[4], messy: s.x[5], steady: s.x[8] });
  Wd.scatterT = s.x[6]; Wd.end = s.x[7];
  if (s.car && Wd.car) { const c = Wd.car; [c.x, c.z, c.yaw, c.v, c.wheel, c.slipT, c.slipKind, c.ask] = s.car; Wd.nb = { x: c.x, z: c.z, yaw: c.yaw, v: c.v }; }
  Object.assign(Wd.stats, { falls: s.s[0], busts: s.s[1], worst: s.s[2], who: s.s[3] });
  if (s.ts) { Wd.coatSay = String(s.ts[0]); Wd.coatSayT = s.ts[1]; } else Wd.coatSayT = 0;
  Wd.ev = s.e;
}
