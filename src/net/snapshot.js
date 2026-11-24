// What the host sends 20 times a second, and the mirror a client draws from.
//   snapshot(game, events) -> a small plain object (numbers rounded) with everything a screen needs:
//     players' coats, grown-ups, interactive things, the mess, loot, gadgets in flight, shutters, the cage,
//     Heat, the job, and the presentation events since the last snapshot (sounds, voices, announcements).
//   new Mirror(data) .apply(snapshot) .update(dt): objects shaped like the real ones, so the same views
//   draw them; positions glide towards each new snapshot instead of jumping.
import { runState, MirrorRun, MirrorShop } from './shopState.js';
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const STATES = ['idle', 'wander', 'routine', 'investigate', 'crowd', 'flee', 'inspect', 'shout', 'chase', 'search', 'carry', 'grab', 'slipped', 'stunned', 'blinded', 'embarrassed'];
const LOOT = ['lying', 'pocket', 'carried', 'banked'];

export function snapshot(game, events = [], { withScribbles = true } = {}) {
  const ids = (cs) => cs.map((c) => c.pid);
  const coats = game.players.map((p) => {
    const c = p.coat, f = c.walker.feet, G = c.gadgets;
    return {
      id: p.id, s: c.slot, x: r2(f.x), y: r2(f.y), z: r2(f.z), yaw: r2(c.walker.yaw), vx: r2(c.walker.vel.x), vz: r2(c.walker.vel.z),
      st: c.stack, wb: r2(c.wobble), an: c.actingNatural ? 1 : 0, mo: c.mapOpen ? 1 : 0, sg: r2(c.sugar ?? 0), sp: c.superT > 0 ? 1 : 0, hd: c.hidden?.mode ?? null, gr: c.grabbedBy ? 1 : 0, cg: c.inCage ? 1 : 0, gate: c.atGate ? 1 : 0, sf: c.safe > 0 ? 1 : 0, wt: c.whyText ?? null, wf: c.fillText ?? null,
      pile: c.pile ? [r2(c.pile.x), r2(c.pile.z), r2(c.pile.yaw), c.pile.kids] : null,
      loose: c.loose.map((k) => [k.id, r2(k.x), r2(k.z), r2(k.vx), r2(k.vz), (k.waiting ? 1 : 0) | (k.caged ? 2 : 0) | (k.carriedBy ? 4 : 0)]),
      eff: { blinded: r2(c.effects?.blinded ?? 0), soaked: r2(c.effects?.soaked ?? 0) },
      gad: G ? [G.slots, G.i, G.slots.map((s) => G.ammo[s]), r2(G.charge)] : null,
      hint: game.hint(p.id),
    };
  });
  const things = game.things.list.map((t) => {
    if (t.gone) return [t.id, 0];
    const p = t.position, q = t.body.rotation();
    return [t.id, t.name, r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w), t.state === 'on' ? 1 : 0, t.occupant ? 1 : 0, r3(t.yaw)];
  });
  const people = game.people.list.map((g) => {
    const f = g.feet;
    return [g.id, g.model, g.typeName, r2(f.x), r2(f.z), r2(g.walker.yaw), r2(g.walker.flatSpeed), STATES.indexOf(g.state), g.carrying?.id ?? null, g.holding?.stack?.[0] ?? null,
      r2(g.effects?.soaked ?? 0), r2(g.effects?.blinded ?? 0), game.players.map((p) => r2(g.sus.get(p.coat) ?? 0)), ids([...g.hostile].filter((c) => c.pid !== undefined))];
  });
  return {
    job: game.jobNo, t: r2(game.time), order: game.order, waiting: game.waiting,
    coats, things, people,
    mess: game.mess.patches.map((p) => [r2(p.x), r2(p.z), r2(p.r), p.color, p.slippery ? 1 : 0]),
    loot: game.loot.items.map((it) => [LOOT.indexOf(it.state), r2(it.x), r2(it.y), r2(it.z), it.value, ids(it.carriers), it.owner?.pid ?? null]),
    proj: game.gadgets.projectiles.map((p) => [p.id, r2(p.x), r2(p.y), r2(p.z)]),
    items: game.gadgets.items.map((it) => [it.n ?? 0, it.id, r2(it.x), r2(it.z)]),
    heat: [game.sus.level], close: [r2(game.closing.time), game.closing.started ? 1 : 0, game.closing.next, r2(game.closing.warnT), game.closing.shut.map((s) => { const si = game.closing.sections.findIndex((x) => x.id === s.section); return [si, game.closing.sections[si].shutters.indexOf(s.seg), r2(s.k)]; })],
    cage: [game.rescue.open ? 1 : 0, game.rescue.spares, game.rescue.solo ? 1 : 0],
    jobState: [r2(game.job.time), game.job.over ? 1 : 0], result: game.job.result, banked: game.loot.bankedValue, inHand: game.loot.inHand(),
    lights: game.lightsOff ? 1 : 0, map: mapState(game.map, withScribbles), ...runState(game), gig: [game.giggles?.meter ?? 0, game.giggles?.total ?? 0], ev: events,
  };
}

// the crayon map: seen areas, grown-ups as last seen, events, the Caretaker's route, acks, and (when asked) the scribbles
function mapState(M, withScribbles) {
  const o = {
    a: [...M.seenAreas], ack: Object.fromEntries(M.acks), r: M.route, sv: M.sv,
    p: [...M.seenPeople.values()].map((v) => [v.id, v.type, r2(v.x), r2(v.z), STATES.indexOf(v.state), r2(v.sus), (v.hostile ? 1 : 0) | (v.soaked ? 2 : 0) | (v.blinded ? 4 : 0), r2(M.time - v.t)]),
    e: M.events.map((e) => [e.text, r2(e.x), r2(e.z), r2(M.time - e.t)]),
  };
  if (withScribbles) o.sc = M.scribbles.map((s) => [s.id, s.by, s.slot, s.kind, s.text, s.pts.flat()]);
  return o;
}

// the client's copy of the crayon map, shaped like TeamMap so the map screen draws either
export class MirrorMap {
  constructor() { this.seenAreas = new Set(); this.seenPeople = new Map(); this.scribbles = []; this.acks = new Map(); this.events = []; this.route = null; this.time = 0; this.sv = 0; }
  apply(o) {
    if (!o) return;
    this.seenAreas = new Set(o.a); this.acks = new Map(Object.entries(o.ack)); this.route = o.r; this.sv = o.sv;
    this.seenPeople = new Map(o.p.map(([id, type, x, z, st, sus, f, ago]) => [id, { id, type, x, z, state: STATES[st], sus, hostile: !!(f & 1), soaked: !!(f & 2), blinded: !!(f & 4), t: this.time - ago }]));
    this.events = o.e.map(([text, x, z, ago]) => ({ text, x, z, t: this.time - ago }));
    if (o.sc) this.scribbles = o.sc.map(([id, by, slot, kind, text, flat]) => ({ id, by, slot, kind, text, pts: Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i], flat[2 * i + 1]]) }));
  }
}

// ---------- the client's mirror ----------
const glide = (o, k) => { for (const key of ['x', 'y', 'z']) if (o.to?.[key] !== undefined) o[key] += (o.to[key] - o[key]) * k; };
const angle = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };

class MWalker {
  constructor() { this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.vel = { x: 0, z: 0 }; this.height = 2.2; this.half = 0.75; this.radius = 0.35; }
  get feet() { return { x: this.x, y: this.y, z: this.z }; }
  get position() { return { x: this.x, y: this.y + this.height / 2, z: this.z }; }
  get flatSpeed() { return Math.hypot(this.vel.x, this.vel.z); }
}

export class MCoat {
  constructor(B) { this.B = B; this.walker = new MWalker(); this.stack = []; this.loose = []; this.pile = null; this.hidden = null; this.wobble = 0; this.effects = {}; this.events = []; this.first = true; }
  get count() { return this.stack.length; }
  get state() { return this.B.heights[String(Math.max(1, this.count))]; }
  get position() { return this.walker.position; }
  set(s, gadgets) {
    const w = this.walker; this.pid = s.id; this.slot = s.s;
    w.to = { x: s.x, y: s.y, z: s.z }; w.toYaw = s.yaw; w.vel = { x: s.vx, z: s.vz };
    if (this.first) { Object.assign(w, w.to); w.yaw = s.yaw; this.first = false; }
    this.stack = s.st; w.height = this.state.height; this.wobble = s.wb; this.actingNatural = !!s.an;
    this.mapOpen = !!s.mo; this.sugar = s.sg ?? 0; this.superT = s.sp ? 1 : 0; this.hidden = s.hd ? { mode: s.hd } : null; this.grabbedBy = s.gr ? true : null; this.inCage = !!s.cg; this.atGate = !!s.gate; this.safe = s.sf ? 1 : 0; this.whyText = s.wt ?? null; this.fillText = s.wf ?? null;
    this.pile = s.pile ? { x: s.pile[0], z: s.pile[1], yaw: s.pile[2], kids: s.pile[3] } : null;
    const old = new Map(this.loose.map((k) => [k.id, k]));
    this.loose = s.loose.map(([id, x, z, vx, vz, f]) => { const k = old.get(id) || { id, x, z }; k.to = { x, z }; k.vx = vx; k.vz = vz; k.waiting = !!(f & 1); k.caged = !!(f & 2); k.carriedBy = f & 4 ? true : null; return k; });
    this.effects = s.eff; this.hint = s.hint;
    if (s.gad) this.gadgets = { slots: s.gad[0], i: s.gad[1], ammo: Object.fromEntries(s.gad[0].map((id, i) => [id, s.gad[2][i]])), charge: s.gad[3] };
  }
  update(k) { const w = this.walker; glide(w, k); if (w.toYaw !== undefined) w.yaw = angle(w.yaw, w.toYaw, k); for (const kd of this.loose) glide(kd, k); }
}

class MThing {
  constructor(def, name, id) { this.def = def; this.name = name; this.id = id; this.kind = def.kind; this.mode = def.hide?.mode; this.p = { x: 0, y: 0, z: 0 }; this.q = { x: 0, y: 0, z: 0, w: 1 }; this.first = true;
    this.body = { translation: () => this.p, rotation: () => this.q }; }
  get position() { return this.p; }
  get front() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }
  set(a) {
    this.p.to = { x: a[2], y: a[3], z: a[4] }; this.qTo = { x: a[5], y: a[6], z: a[7], w: a[8] };
    this.state = a[9] ? 'on' : 'off'; this.occupant = a[10] ? true : null; this.yaw = a[11];
    if (this.first) { Object.assign(this.p, this.p.to); Object.assign(this.q, this.qTo); this.first = false; }
  }
  update(k) {
    glide(this.p, k);
    const q = this.q, t = this.qTo; if (!t) return;
    const dot = q.x * t.x + q.y * t.y + q.z * t.z + q.w * t.w, s = dot < 0 ? -1 : 1;
    q.x += (t.x * s - q.x) * k; q.y += (t.y * s - q.y) * k; q.z += (t.z * s - q.z) * k; q.w += (t.w * s - q.w) * k;
    const l = Math.hypot(q.x, q.y, q.z, q.w) || 1; q.x /= l; q.y /= l; q.z /= l; q.w /= l;
  }
}

class MPerson {
  constructor(id, model, typeName, type) { this.id = id; this.model = model; this.typeName = typeName; this.type = type; this.walker = new MWalker(); this.effects = {}; this.sus = new Map(); this.hostile = new Set(); this.first = true; }
  get feet() { return this.walker.feet; }
  set(a, coatsById) {
    const w = this.walker; w.to = { x: a[3], y: 0, z: a[4] }; w.toYaw = a[5]; w.vel = { x: a[6], z: 0 };
    if (this.first) { Object.assign(w, w.to); w.yaw = a[5]; this.first = false; }
    this.state = STATES[a[7]]; this.carrying = a[8] ? { id: a[8] } : null; this.holding = a[9] ? { stack: [a[9]] } : null;
    this.effects = { soaked: a[10], blinded: a[11] };
    this.sus.clear(); a[12].forEach((v, i) => { const c = coatsById.order[i]; if (c) this.sus.set(c, v); });
    this.hostile = new Set(a[13].map((pid) => coatsById.get(pid)).filter(Boolean));
  }
  update(k) { const w = this.walker; glide(w, k); w.yaw = angle(w.yaw, w.toYaw, k); }
}

export class Mirror {
  // data: { things, grownups, gadgets, loot, place, balance }
  constructor(data) {
    this.data = data; this.B = data.balance; this.coatMap = new Map(); this.coats = [];
    this.thingMap = new Map(); this.things = { list: [] };
    this.personMap = new Map(); this.people = { list: [] };
    this.mess = { patches: [] };
    const looks = data.loot.items;
    this.loot = { items: data.place.loot.list.map((e, n) => ({ n, id: e.id, kind: e.kind, base: e.value, value: e.value, name: looks[e.id]?.name ?? e.id, look: looks[e.id] ?? {}, x: e.at[0], y: e.at[1], z: e.at[2], state: 'lying', carriers: [] })), bankedValue: 0, inHand: () => this.inHandV ?? 0 };
    this.gadgets = { projectiles: [], items: [] }; this.itemMap = new Map();
    const C = data.balance.closingTime;
    this.closing = { C, sections: data.place.closingTime.sections, shut: [], started: false, next: 0, warnT: 0, time: 0,
      get startsIn() { return Math.max(0, C.startsAt - this.time); }, get warning() { return this.started && this.next < this.sections.length && this.warnT > 0 ? this.sections[this.next] : null; } };
    this.rescue = { C: data.place.lostAndFound, B: data.balance.rescue, open: false, spares: 0, solo: false };
    this.sus = { level: 0, get name() { return data.balance.heat.names[this.level]; }, get chaosBonus() { return data.balance.heat.chaosBonus[this.level]; } };
    this.job = { quota: data.place.job.quota, target: data.place.job.target, over: false, result: null, time: 0 };
    this.lightsOff = false; this.jobNo = 0; this.got = 0; this.map = new MirrorMap();
    this.phase = 'job'; this.run = new MirrorRun(data); this.shop = null; this.giggles = { meter: 0, total: 0 };
  }

  apply(S) {
    this.got++;
    if (S.job !== this.jobNo) { this.newJob = this.jobNo !== 0; this.jobNo = S.job; }
    this.order = S.order; this.waiting = S.waiting;
    // coats
    const live = new Set();
    for (const s of S.coats) { let c = this.coatMap.get(s.id); if (!c || c.job !== S.job) { c = new MCoat(this.B); c.job = S.job; this.coatMap.set(s.id, c); } c.set(s); live.add(s.id); }
    for (const id of [...this.coatMap.keys()]) if (!live.has(id)) this.coatMap.delete(id);
    this.coats = S.coats.map((s) => this.coatMap.get(s.id));
    const byId = new Map(this.coats.map((c) => [c.pid, c])); byId.order = this.coats;
    // things (a new job starts a fresh list)
    if (this.newJob) { this.map = new MirrorMap(); this.thingMap.clear(); this.personMap.clear(); this.mess.patches = []; this.itemMap.clear(); this.newJob = false; this.reset = true; }
    const seenT = new Set();
    for (const a of S.things) {
      let t = this.thingMap.get(a[0]);
      if (a[1] === 0) { if (t) t.gone = true; continue; }
      if (!t) { t = new MThing(this.data.things.things[a[1]], a[1], a[0]); this.thingMap.set(a[0], t); }
      t.set(a); seenT.add(a[0]);
    }
    this.things.list = [...this.thingMap.values()];
    for (const t of this.things.list) if (!seenT.has(t.id)) t.gone = true;
    // people
    for (const a of S.people) { let g = this.personMap.get(a[0]); if (!g) { g = new MPerson(a[0], a[1], a[2], this.data.grownups.types[a[2]]); this.personMap.set(a[0], g); } g.set(a, byId); }
    this.people.list = [...this.personMap.values()];
    // the mess only ever grows during a job
    for (let i = this.mess.patches.length; i < S.mess.length; i++) { const [x, z, r, color, sl] = S.mess[i]; this.mess.patches.push({ x, z, r, color, slippery: !!sl }); }
    for (let i = 0; i < S.mess.length; i++) this.mess.patches[i].r = S.mess[i][2];
    // loot
    S.loot.forEach(([st, x, y, z, value, carriers, owner], i) => { const it = this.loot.items[i]; it.state = LOOT[st]; it.to = { x, y, z }; if (it.first === undefined) { Object.assign(it, it.to); it.first = false; } it.value = value; it.carriers = carriers.map((id) => byId.get(id)).filter(Boolean); it.owner = byId.get(owner) ?? null; });
    this.loot.bankedValue = S.banked; this.inHandV = S.inHand;
    // gadgets in flight and lying about
    this.gadgets.projectiles = S.proj.map(([id, x, y, z]) => ({ x, y, z, def: this.data.gadgets.gadgets[id] }));
    const liveI = new Set();
    for (const [n, id, x, z] of S.items) { let it = this.itemMap.get(n); if (!it) { it = { n, id, x, z, def: this.data.gadgets.gadgets[id] }; this.itemMap.set(n, it); } liveI.add(n); }
    for (const n of [...this.itemMap.keys()]) if (!liveI.has(n)) this.itemMap.delete(n);
    this.gadgets.items = [...this.itemMap.values()];
    // Heat, Closing Time, the cage, the job
    this.sus.level = S.heat[0];
    const cl = this.closing; [cl.time, cl.started, cl.next, cl.warnT] = [S.close[0], !!S.close[1], S.close[2], S.close[3]];
    while (cl.shut.length < S.close[4].length) { const [si, gi] = S.close[4][cl.shut.length]; cl.shut.push({ seg: cl.sections[si].shutters[gi], k: 0 }); }
    S.close[4].forEach(([, , k], i) => { cl.shut[i].k = k; });
    this.rescue.open = !!S.cage[0]; this.rescue.spares = S.cage[1]; this.rescue.solo = !!S.cage[2];
    this.job.time = S.jobState[0]; this.job.over = !!S.jobState[1]; this.job.result = S.result;
    this.lightsOff = !!S.lights;
    this.map.apply(S.map);
    this.phase = S.ph ?? 'job'; if (S.run) this.run.apply(S);
    if (S.gig) [this.giggles.meter, this.giggles.total] = S.gig;
    if (S.shop) (this.shop ??= new MirrorShop(this.data)).apply(S.shop); else this.shop = null;
    for (const c of this.coats) c.drinks = this.run.of(c.pid).drinks;
    return S.ev || [];
  }

  // glide everything towards the last snapshot
  update(dt) {
    const k = Math.min(1, dt * 14); this.map.time += dt;
    for (const c of this.coats) c.update(k);
    for (const t of this.things.list) t.update(k);
    for (const g of this.people.list) g.update(k);
    for (const it of this.loot.items) if (it.to) glide(it, k);
  }

  player(id) { return this.coatMap.has(id) ? { id, coat: this.coatMap.get(id) } : null; }
}
