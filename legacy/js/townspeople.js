// Three grown-ups. Each has a view cone and a "?" meter that fills when the coat gives itself away.
// Everything the kids do is read by whoever can see them: how they walk, what the hands and head do.
import { T, PAL, CFG, E, GAIT, LINES, clamp, ease, wrap, dist, yawTo } from './config.js';
import { TOWN, collide, los, inAlley, inBank, inZone, mat, roundedBox, label, setLabel, LAYER } from './town.js';
import { PDEF, ZONES, heldItem } from './errands.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { smoothNormals } from './hero.js';
import mabelGlb from '../assets/people/small/mabel.glb';
import ruthGlb from '../assets/people/small/ruth.glb';
import haleGlb from '../assets/people/small/hale.glb';
import pipGlb from '../assets/people/small/pip.glb';
import gusGlb from '../assets/people/small/gus.glb';
import priceGlb from '../assets/people/small/price.glb';
import dotGlb from '../assets/people/small/dot.glb';

// Key-art models of the townspeople (Higgsfield picture -> SAM 3 3D). Anyone without one keeps the simple toy figure.
const MODELS = { mabel: mabelGlb, ruth: ruthGlb, hale: haleGlb, pip: pipGlb, gus: gusGlb, price: priceGlb, dot: dotGlb };
const HEIGHT = { mabel: 1.78, ruth: 1.88, hale: 2.05, pip: 1.86, price: 1.98, gus: 1.86, dot: 1.72 };
const loaded = new Map();
function loadModel(id) {
  if (!MODELS[id]) return null;
  if (!loaded.has(id)) loaded.set(id, new Promise((res) => {
    const b = MODELS[id], buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    new GLTFLoader().parse(buf, '', (gl) => { try {
      let src = null; gl.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      if (!src) return res(null);
      const geo = new T.BufferGeometry(), sg = src.geometry;
      // quantised models store small integers: turn every attribute back into plain numbers first
      for (const [name, a] of Object.entries(sg.attributes)) {
        const out = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i);
        geo.setAttribute(name, new T.BufferAttribute(out, a.itemSize));
      }
      if (sg.index) geo.setIndex(sg.index.clone());
      // and keep their scale on the node: bake it into the vertices
      src.updateWorldMatrix(true, false); geo.applyMatrix4(src.matrixWorld);
      const ng = geo.index ? geo.toNonIndexed() : geo; smoothNormals(ng); ng.computeBoundingBox();
      const m = src.material.clone(); m.metalness = 0; m.roughness = 0.85;
      if (m.map) { m.map.colorSpace = T.SRGBColorSpace; m.map.needsUpdate = true; }
      res({ geo: ng, mat: m });
    } catch (e) { console.warn('model', id, e); res(null); } }, (e) => { console.warn('model load', id, e); res(null); });
  }));
  return loaded.get(id);
}

// clothes for each grown-up, as in the key art
const PEOPLE_LOOK = {
  teller: { shirt: 0xfaf1e2, sleeve: 0xfaf1e2, skirt: 0x7a4a33, apron: 0xe8b23e, legs: 0xf2b98c, shoes: 0x6b3f2a, hair: 0x6b4630, collar: 0xffffff },
  walker: { shirt: 0xf3e6c8, sleeve: 0xf3e6c8, overalls: 0x4f8a8b, legs: 0x4f8a8b, shoes: 0x7a4a2e, hair: 0x5a3a28 },
  guard: { shirt: 0x34506e, sleeve: 0x34506e, legs: 0x2a3f55, shoes: 0x2a2220, hair: 0x4a3628, belt: 0x1c1c22, collar: 0x2a3f55 },
  shop: { shirt: 0xf3d9d0, sleeve: 0xf3d9d0, skirt: 0x5f7d99, apron: 0x7fae4e, legs: 0xf2b98c, shoes: 0x6b3f2a, hair: 0xb8b2aa, collar: 0xffffff, style: 'bun' },
  usher: { shirt: 0xb8423a, sleeve: 0xb8423a, legs: 0x2a2220, shoes: 0x1c1c22, hair: 0x2a1a14, belt: 0xe0a83a, collar: 0xe0a83a, style: 'usher' },
  nosy: { shirt: 0x8c5aa0, sleeve: 0x8c5aa0, skirt: 0x5a3a6a, legs: 0xf2b98c, shoes: 0x3a2a2a, hair: 0xd0c8c0, style: 'hat', hat: 0xe29ab0 },
  paper: { shirt: 0xe0a83a, sleeve: 0xe0a83a, legs: 0x4f7f9f, shoes: 0xfff3e2, hair: 0xb5482e, style: 'paper', hat: 0x4f8a8b },
  nan: { shirt: 0xc9a8d8, sleeve: 0xc9a8d8, skirt: 0x7a6a8a, legs: 0xf2b98c, shoes: 0x6b3f2a, hair: 0xe8e4e0, collar: 0xffffff, style: 'bun' },
  worker: { shirt: 0xf3e6c8, sleeve: 0xf3e6c8, overalls: 0x3f6aa0, legs: 0x3f6aa0, shoes: 0x2a2220, hair: 0x6b4630, style: 'cap', hat: 0xe0a83a },
  examiner: { shirt: 0x8a8f96, sleeve: 0x8a8f96, legs: 0x5a5f66, shoes: 0x2a2220, hair: 0x3a2a22, belt: 0x2a2220, collar: 0xffffff, style: 'examiner' },
};
const STYLE = { teller: 'bun', walker: 'cap', guard: 'police' };

// the grown-ups in town come from data/people.json; an errand lists who is around
export function newPeople(ids) {
  return ids.map((id) => { const p = PDEF[id]; return { id, x: p.x, z: p.z, yaw: p.yaw, sus: 0, peak: 0, mode: 0, say: -1, sayT: 0, greet: 0, greetT: 0,
    cool: 6 + Math.random() * 4, calmCd: 0, dir: 1, bumpCd: 0, lookT: 0, lookYaw: 0, lookCd: 0, browCd: 0, patCd: 0, up: 0, carry: -1 }; });
}

export function sees(p, x, z) {
  const d = dist(p.x, p.z, x, z);
  if (d > CFG.sightRange) return false;
  if (d > 0.6 && Math.abs(wrap(yawTo(x - p.x, z - p.z) - p.yaw)) > CFG.sightHalf) return false;
  return los(p.x, p.z, x, z);
}

function say(p, line, t = 3) { p.say = line; p.sayT = t; }

// A noise or a mishap: everyone close enough gets a bit more suspicious.
export function tell(Wd, x, z, amount, radius) {
  if (inAlley(x, z)) return;
  for (const p of Wd.people) {
    const d = dist(p.x, p.z, x, z);
    if (d < radius && (d < 4 || los(p.x, p.z, x, z))) p.sus = clamp(p.sus + amount, 0, 1);
  }
}

// Walk around corners: out through the bank door, along the street, then to the target.
function nav(p, tx, tz) {
  if (los(p.x, p.z, tx, tz)) return [tx, tz];
  const pin = inBank(p.x, p.z), tin = inBank(tx, tz);
  if (pin && !tin) return dist(p.x, p.z, 0, 4.3) > 0.5 && !los(p.x, p.z, 0, 2.4) ? [0, 4.3] : [0, 2.4];
  if (!pin && tin) return los(p.x, p.z, 0, 4.3) ? [0, 4.3] : [0, 2.4];
  if (Math.abs(p.z - 0.6) > 0.8) return [p.x, 0.6];
  return [tx, 0.6];
}

function walk(p, tx, tz, speed, dt) {
  const [nx, nz] = nav(p, tx, tz);
  const dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  p.yaw += wrap(yawTo(dx, dz) - p.yaw) * ease(dt, 8);
  const c = collide(p.x + (dx / d) * speed * dt, p.z + (dz / d) * speed * dt, 0.3, false);
  p.x = c.x; p.z = c.z;
}

export function stepPeople(Wd, dt, api) {
  const b = Wd.body, o = Wd.ord, lvl = Wd.dis.lvl;
  const hidden = b.popped || inAlley(b.x, b.z);
  const free = (i) => !heldItem(Wd, i);
  const waving = [0, 1].some((i) => free(i) && (o.hand[i].act === 1 || o.hand[i].y > 0.35)) && Wd.patT <= 0;
  const pointing = [0, 1].some((i) => o.hand[i].act === 2) && Wd.patT <= 0;
  const pointYaw = b.yaw + o.hy;
  const moving = Math.abs(b.v) > 0.25;
  const fool = (lvl >= 1 ? CFG.disguiseFool : 1) * (lvl >= 2 ? CFG.disguiseFool : 1);      // a better disguise is harder to see through
  Wd.browT = o.brow ? (Wd.browT || 0) + dt : 0;

  Wd.people.forEach((p, i) => {
    const def = PDEF[p.id];
    if (def.kind === 'examiner') { if (p.sayT > 0) { p.sayT -= dt; if (p.sayT <= 0) p.say = -1; } return; }   // he rides in the car (drive.js)
    if (p.sayT > 0) { p.sayT -= dt; if (p.sayT <= 0) p.say = -1; }
    for (const k of ['calmCd', 'bumpCd', 'lookT', 'lookCd', 'browCd', 'patCd']) p[k] = Math.max(0, p[k] - dt);

    if (Wd.phase === 'scatter') {
      if (def.kind === 'clerk') { p.sus = 1; return; }
      // a caught kid is marched to the bench: while a grown-up is doing that, they cannot catch anyone else
      const seat = (k, n) => { k.x = TOWN.bench.x - 0.8 + (n % 3) * 0.8; k.z = TOWN.bench.z; k.seat = 1; };
      const held = p.carry >= 0 ? Wd.kids[p.carry] : null;
      if (held && held.caught && !held.seat) {
        if (Wd.scatterT <= 0 || dist(p.x, p.z, TOWN.bench.x, TOWN.bench.z + 0.9) < 0.7) { seat(held, p.carry); p.carry = -1; }
        else { walk(p, TOWN.bench.x, TOWN.bench.z + 0.9, 2.5, dt); const [hx, hz] = [Math.sin(p.yaw), Math.cos(p.yaw)]; held.x = p.x + hx * 0.45; held.z = p.z + hz * 0.45; held.yaw = p.yaw; p.mode = 1; return; }
      } else p.carry = -1;
      if (Wd.scatterT <= 0) { p.mode = 2; walk(p, def.x, def.z, 1.6, dt); return; }
      p.mode = 1; p.sus = 1;
      if (Wd.scatterT > CFG.scatterTime - CFG.shock) return;   // a moment of pure shock before they give chase: run!
      let best = null, bd = 1e9;
      for (const k of Wd.kids) {
        if (k.caught || inAlley(k.x, k.z)) continue;
        const d = dist(p.x, p.z, k.x, k.z); if (d < bd) { bd = d; best = k; }
      }
      if (!best) return;
      if (bd < 0.8) { best.caught = 1; best.seat = 0; p.carry = Wd.kids.indexOf(best); say(p, 10, 2); api.caught(); return; }
      walk(p, best.x, best.z, CFG.chaseSpeed, dt);
      return;
    }

    const canSee = !hidden && sees(p, b.x, b.z);
    const near = dist(p.x, p.z, b.x, b.z);
    // movement
    if (p.lookT > 0 && p.mode !== 2) {
      p.yaw += wrap(p.lookYaw - p.yaw) * ease(dt, 7);          // "where?" They look where the coat pointed.
    } else if (p.mode === 2) {
      walk(p, def.x, def.z, 1.6, dt);
      if (dist(p.x, p.z, def.x, def.z) < 0.3) { p.mode = 0; p.yaw = def.yaw; }
    } else if (def.kind === 'clerk') {
      const want = canSee ? yawTo(b.x - p.x, b.z - p.z) : def.yaw;
      p.yaw += wrap(want - p.yaw) * ease(dt, 5);
    } else if (def.kind === 'guard') {
      p.yaw += wrap(def.yaw + Math.sin(Wd.time * 0.45 + i) * (def.sweep ?? 0.95) - p.yaw) * ease(dt, 4);
    } else if (!(p.greet && near < 3.5) && !(p.ask > 0)) {
      const [pa, pb] = def.patrol || [-10.5, 10.5], tx = p.dir > 0 ? Math.max(pa, pb) : Math.min(pa, pb);
      if (Math.abs(p.x - tx) < 0.4) p.dir = -p.dir;
      const ahead = (b.x - p.x) * p.dir;
      if (!(near < 1.2 && ahead > 0 && !hidden)) walk(p, tx, def.z, CFG.strollSpeed, dt);
    } else p.yaw += wrap(yawTo(b.x - p.x, b.z - p.z) - p.yaw) * ease(dt, 6);

    // ---- what gives the coat away ----
    let rate = 0, soothe = 0.02;
    if (canSee) {
      const L = Math.hypot(b.lx, b.lz) / CFG.fallLean;
      if (b.down) rate += (p.fallGain || 0) < (Wd.errand.id === 'shop' ? 0.3 : 0.42) ? 0.45 : 0;   // the "?" grows, but one fall alone is not quite enough to bust you
      else if (L > 0.5) rate += Math.min(0.5, (L - 0.5) * 1.1);
      if (Math.max(b.fl[0], b.fl[1]) > 1.8 && !waving && Wd.patT <= 0) rate += 0.22;      // flailing hands
      if (b.count < 3) rate += 0.05;
      const waiting = ['queue', 'counter', 'shopFront', 'cartFront', 'check'].some((k) => inZone(ZONES[k], b.x, b.z));
      if (b.still > 6 && !waiting) rate += 0.05;
      // how the legs walk is read too
      if (moving && o.gait === GAIT.TIPTOE && !inBank(b.x, b.z)) rate += 0.035;           // sneaking in the street
      if (moving && o.gait === GAIT.SHUFFLE) rate += 0.02;                                 // an odd little walk
      if (moving && o.gait === GAIT.STRIDE && L < 0.4) soothe = 0.05;                      // a confident stride looks grown-up
      if (Wd.browT > 3) rate += 0.04;                                                      // nobody is surprised for that long
      if (waving && !o.nod && !p.greet && p.calmCd <= 0 && near > 3.5) rate += 0.02;       // waving at nobody in particular
      if (near < 0.75 && p.bumpCd <= 0) { p.bumpCd = 3; p.sus = clamp(p.sus + 0.15, 0, 1); say(p, 11, 2); api.ev(E.BUMP); }
    }
    for (const k of Wd.kids) if (!inAlley(k.x, k.z) && sees(p, k.x, k.z)) rate += 0.15;
    const before = p.sus;
    if (b.down && canSee) p.fallGain = (p.fallGain || 0) + Math.max(0, rate) * dt * Wd.notice; else if (!b.down) p.fallGain = 0;
    p.sus = clamp(p.sus + (rate > 0 ? rate * fool * Wd.notice : -soothe) * dt, 0, 1);
    if (before < 0.6 && p.sus >= 0.6) { api.ev(E.GASP); if (p.say < 0) say(p, 15, 2); }

    // ---- bluffs: acting adult calms them down ----
    if (canSee && !b.down) {
      // the big one: a nod and a wave at the same moment
      if (o.nod && waving && p.calmCd <= 0) {
        api.calm(i, 0.3); p.calmCd = 4; say(p, 2, 2.5);
        if (p.greet === 1) { p.greet = 0; p.cool = Wd.time + 16; }
      }
      // an innocent look answers a "Hm?"
      if (o.brow && p.sus >= 0.45 && p.browCd <= 0 && Wd.browT < 3) { api.calm(i, 0.15); p.browCd = 6; }
      // patting your pockets: every grown-up does that
      if (Wd.patT > 0.6 && p.patCd <= 0 && near < 7) { p.patCd = 8; if (p.sus > 0.05) { api.calm(i, 0.1); say(p, 19, 2); } }
      // pointing: they look where you point. Pointing straight at them is rude.
      if (pointing && p.lookCd <= 0 && near < 8) {
        p.lookCd = 9;
        const at = Math.abs(wrap(yawTo(p.x - b.x, p.z - b.z) - pointYaw));
        if (at < 0.4) { p.sus = clamp(p.sus + 0.1, 0, 1); say(p, 18, 2.5); }
        else { p.lookT = 3; p.lookYaw = pointYaw; say(p, 17, 2); api.ev(E.LOOK, i); }
      }
    }
    // a straight question: a suspicious grown-up stops the coat and wants an answer. The head talks back (T or Enter);
    // a nod just about gets you off, saying nothing at all makes it worse.
    if (p.ask > 0) {
      p.ask -= dt;
      if (o.nod && canSee) p.askNod = 1;
      if (p.ask <= 0) {
        p.ask = 0; p.cool = Wd.time + 14;
        if (p.askNod) { api.calm(i, 0.05, true); say(p, 'Hm. Not much of a talker, are you?', 3); }
        else { p.sus = clamp(p.sus + 0.2 * Wd.notice, 0, 1); say(p, 'Well?! Cat got your tongue?', 3); }
      }
    } else if (Wd.asks && canSee && near < 3.8 && p.sus >= 0.45 && p.mode === 0 && !p.greet && !b.down && def.asks
      && Wd.time > (p.askCool || 0) && Wd.time > (Wd.askAt ?? -99) + 14) {
      Wd.askAt = Wd.time; p.askCool = Wd.time + 30; p.ask = 10; p.askNod = 0;
      p.askN = ((p.askN ?? -1) + 1) % def.asks.length;
      say(p, def.asks[p.askN], 10); api.ev(E.ASK, i);
    }
    // saying hello: the head has to answer
    if (!(p.ask > 0)) {
      if (p.greet) {
        p.greetT -= dt;
        const yes = o.nod, no = o.shake;
        if (canSee && ((p.greet === 1 && yes) || (p.greet === 2 && no))) {
          api.calm(i, 0.15); say(p, p.greet === 1 ? 2 : 13, 2.5); p.greet = 0; p.cool = Wd.time + 16;
        } else if (canSee && p.greet === 1 && waving && p.greetT < 3.8) {
          api.calm(i, 0.08); say(p, 2, 2.5); p.greet = 0; p.cool = Wd.time + 16;       // a wave will do, just about
        } else if (canSee && p.greet === 2 && yes && p.greetT < 3.4) {
          p.sus = clamp(p.sus + 0.15, 0, 1); say(p, 16, 3); p.greet = 0; p.cool = Wd.time + 16;
        } else if (p.greetT <= 0) {
          p.sus = clamp(p.sus + 0.2, 0, 1); say(p, 3, 2.5); p.greet = 0; p.cool = Wd.time + 16;
        }
      } else if (canSee && near < (def.kind === 'clerk' ? 4.2 : 3.2) && Wd.time > p.cool && Wd.time > (Wd.greetAt || 0) + CFG.greetGap && !b.down && Math.hypot(b.lx, b.lz) < CFG.fallLean * 0.45 && p.mode === 0 && p.lookT <= 0) {
        Wd.greetAt = Wd.time;
        p.greet = Math.random() < 0.3 ? 2 : 1; p.greetT = 4.5; say(p, p.greet === 1 ? 0 : 1, 4.5);
      }
    }
    // fooled them: a meter that was well up and is back to nothing earns a disguise point
    if (p.sus >= 0.5) p.up = 1;
    if (p.up && p.sus <= 0.001) { p.up = 0; api.fooled(i); }
    p.peak = Math.max(p.peak, p.sus);
    if (p.sus >= 1) api.bust(i);
  });
}

// ---------- view ----------
export class PeopleView {
  constructor(scene) { this.scene = scene; this.m = []; this.key = ''; }
  // the line-up changes between errands: build the grown-ups who are in town now
  sync(Wd) {
    const key = Wd.people.map((p) => p.id).join();
    if (key === this.key) return;
    this.key = key;
    for (const v of this.m) this.scene.remove(v.g);
    this.m = Wd.people.map((p) => { const v = this.build(PDEF[p.id]); this.useModel(v, p.id); return v; });
  }
  build(def) {
    {
      const g = new T.Group(); this.scene.add(g);
      // toy people as in the key art: big round head, pear body, short legs, big shoes, chunky arms and hands
      const P = PEOPLE_LOOK[def.look] || PEOPLE_LOOK.walker, hairM = mat(P.hair), style = P.style || STYLE[def.look];
      const lathe = (pts, color, seg = 20) => { const m = new T.Mesh(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg), mat(color)); m.castShadow = true; return m; };
      const legs = [-1, 1].map((sd) => {
        const leg = new T.Group(); leg.position.set(sd * 0.13, 0.46, 0);
        const shin = new T.Mesh(new T.CylinderGeometry(0.095, 0.085, 0.36, 12), mat(P.legs)); shin.position.y = -0.2; shin.castShadow = true;
        const shoe = new T.Mesh(roundedBox(0.2, 0.13, 0.32, 0.06), mat(P.shoes)); shoe.position.set(0, -0.39, 0.05); shoe.castShadow = true;
        leg.add(shin, shoe); g.add(leg); return leg;
      });
      const body = new T.Group(); g.add(body);
      const torso = lathe([[0, 0.4], [0.27, 0.42], [0.36, 0.6], [0.37, 0.84], [0.33, 1.06], [0.22, 1.23], [0.1, 1.3], [0, 1.31]], P.shirt);
      body.add(torso);
      if (P.skirt) { const sk = lathe([[0.25, 0.3], [0.42, 0.34], [0.4, 0.5], [0.36, 0.72], [0.34, 0.76]], P.skirt); body.add(sk); }
      if (P.apron) {
        const ap = new T.Mesh(roundedBox(0.46, 0.6, 0.05, 0.04), mat(P.apron)); ap.position.set(0, 0.62, 0.33); ap.rotation.x = -0.08; ap.castShadow = true;
        const pocket = new T.Mesh(roundedBox(0.2, 0.12, 0.03, 0.02), mat(0xd09530)); pocket.position.set(0, 0.55, 0.36);
        body.add(ap, pocket);
      }
      if (P.overalls) {
        const ov = lathe([[0.3, 0.42], [0.37, 0.6], [0.375, 0.82], [0.3, 0.84]], P.overalls); body.add(ov);
        const bib = new T.Mesh(roundedBox(0.36, 0.3, 0.06, 0.04), mat(P.overalls)); bib.position.set(0, 0.95, 0.3); bib.rotation.x = 0.12; body.add(bib);
        for (const sd of [-1, 1]) { const st = new T.Mesh(roundedBox(0.06, 0.42, 0.04, 0.02), mat(P.overalls)); st.position.set(sd * 0.15, 1.08, 0.27 - 0.02); st.rotation.x = 0.35; body.add(st);
          const bt = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), mat(PAL.coin)); bt.position.set(sd * 0.15, 0.98, 0.34); body.add(bt); }
      }
      if (P.belt) { const bl = lathe([[0.37, 0.62], [0.375, 0.69], [0.36, 0.7]], P.belt); const bk = new T.Mesh(roundedBox(0.1, 0.08, 0.03, 0.015), mat(PAL.coin)); bk.position.set(0, 0.655, 0.37); body.add(bl, bk); }
      if (P.collar) for (const sd of [-1, 1]) { const c = new T.Mesh(roundedBox(0.16, 0.05, 0.14, 0.02), mat(P.collar)); c.position.set(sd * 0.09, 1.25, 0.15); c.rotation.set(0.3, sd * -0.5, sd * 0.35); body.add(c); }
      // arms hang from the shoulders and swing when walking; each person has a pose
      const arms = [-1, 1].map((sd) => {
        const arm = new T.Group(); arm.position.set(sd * 0.36, 1.12, 0);
        const up = new T.Mesh(new T.CapsuleGeometry(0.085, 0.36, 4, 10), mat(P.sleeve)); up.position.y = -0.24; up.castShadow = true;
        const hand = new T.Mesh(new T.SphereGeometry(0.095, 12, 10), mat(PAL.skin)); hand.position.y = -0.5; hand.castShadow = true;
        arm.add(up, hand); arm.rotation.z = sd * 0.16; body.add(arm); return arm;
      });
      if (def.look === 'walker' || def.look === 'nan') {          // folded arms, like Gus in the key art
        arms.forEach((a, k) => { a.rotation.set(-1.25, 0, (k ? 1 : -1) * -0.75); });
      } else if (def.look === 'teller' || def.look === 'shop' || def.look === 'nosy') {   // one hand at the chin, wondering
        arms[1].rotation.set(-2.35, 0, -0.55);
      } else if (def.look === 'examiner') {      // a clipboard held in front
        arms[0].rotation.set(-1.1, 0, 0.35);
        const cb = new T.Mesh(roundedBox(0.34, 0.44, 0.03, 0.015), mat(0x9a6038)); cb.position.set(-0.05, 0.98, 0.42); cb.rotation.x = -0.5; body.add(cb);
        const pg = new T.Mesh(roundedBox(0.28, 0.34, 0.01, 0.005), mat(0xfff7ea)); pg.position.set(-0.05, 0.985, 0.44); pg.rotation.x = -0.5; body.add(pg);
      }
      const head = new T.Mesh(new T.SphereGeometry(0.32, 22, 16), mat(PAL.skin)); head.position.y = 1.58; head.scale.set(1.04, 0.97, 1); head.castShadow = true;
      for (const sd of [-1, 1]) { const ear = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), mat(PAL.skin)); ear.position.set(sd * 0.32, 1.57, 0); ear.scale.set(0.6, 1, 0.8); g.add(ear); }
      const nose = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), mat(0xeea27c)); nose.position.set(0, 1.53, 0.31); nose.scale.set(1, 0.85, 0.9);
      const mouth = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), mat(0x5a2a22)); mouth.position.set(0, 1.4, 0.285); mouth.scale.set(1, 0.28, 0.4);
      const brow = new T.Group(); brow.position.set(0, 1.74, 0.27);
      for (const x of [-0.115, 0.115]) {
        const w = new T.Mesh(new T.SphereGeometry(0.075, 14, 10), mat(0xffffff)); w.position.set(x, 1.63, 0.255); w.scale.set(0.95, 1.1, 0.6);
        const pu = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), mat(0x2a1a14)); pu.position.set(x, 1.62, 0.3);
        const hi = new T.Mesh(new T.SphereGeometry(0.013, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); hi.position.set(x + 0.015, 1.64, 0.338);
        const br = new T.Mesh(new T.CapsuleGeometry(0.022, 0.1, 4, 8), mat(P.hair)); br.rotation.z = Math.PI / 2; br.position.x = x;
        g.add(w, pu, hi); brow.add(br);
      }
      g.add(head, nose, mouth, brow);
      if (style === 'bun') {                // a bun
        const hair = new T.Mesh(new T.SphereGeometry(0.335, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), hairM); hair.position.set(0, 1.6, -0.03); hair.rotation.x = -0.18;
        const bun = new T.Mesh(new T.SphereGeometry(0.16, 14, 10), hairM); bun.position.set(0, 1.97, -0.1);
        g.add(hair, bun);
      } else if (style === 'cap' || style === 'paper') {   // a flat cap (and a big moustache for the grown men)
        const cap = new T.Mesh(new T.SphereGeometry(0.345, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(P.hat || 0x5f7d99)); cap.position.set(0, 1.62, 0); cap.scale.set(1, 0.9, 1.05);
        const peak = new T.Mesh(roundedBox(0.36, 0.05, 0.2, 0.02), mat(0x4f6a85)); peak.position.set(0, 1.79, 0.3); peak.rotation.x = 0.2;
        const tache = new T.Mesh(new T.CapsuleGeometry(0.045, 0.2, 4, 8), hairM); tache.rotation.z = Math.PI / 2; tache.position.set(0, 1.46, 0.3);
        g.add(cap, peak); if (style === 'cap') g.add(tache);
        if (style === 'paper') { const bag = new T.Mesh(roundedBox(0.3, 0.32, 0.12, 0.04), mat(0xc97850)); bag.position.set(0.38, 0.75, 0); body.add(bag); }
      } else if (style === 'hat') {         // a flowery hat
        const hair = new T.Mesh(new T.SphereGeometry(0.335, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), hairM); hair.position.set(0, 1.6, -0.03);
        const brim = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.04, 22), mat(P.hat)); brim.position.y = 1.86;
        const crown = new T.Mesh(new T.SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(P.hat)); crown.position.y = 1.86;
        const flower = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), mat(0xf4c542)); flower.position.set(0.22, 1.95, 0.12);
        g.add(hair, brim, crown, flower);
      } else if (style === 'usher') {       // a round usher's cap with a gold band
        const cap = new T.Mesh(new T.CylinderGeometry(0.24, 0.26, 0.16, 18), mat(P.shirt)); cap.position.y = 1.9;
        const band = new T.Mesh(new T.CylinderGeometry(0.265, 0.265, 0.05, 18), mat(P.belt)); band.position.y = 1.85;
        for (let k = 0; k < 3; k++) { const bt = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), mat(PAL.coin)); bt.position.set(0, 0.75 + k * 0.17, 0.36); body.add(bt); }
        g.add(cap, band);
      } else if (style === 'examiner') {    // neat hair and big round glasses
        const hair = new T.Mesh(new T.SphereGeometry(0.335, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), hairM); hair.position.set(0, 1.62, -0.02);
        g.add(hair);
        for (const sd of [-1, 1]) { const gl = new T.Mesh(new T.TorusGeometry(0.085, 0.014, 6, 16), mat(0x2a2220)); gl.position.set(sd * 0.115, 1.63, 0.33); g.add(gl); }
      } else {                              // Officer Hale: a police cap and a moustache
        const cap = new T.Mesh(new T.CylinderGeometry(0.29, 0.31, 0.17, 18), mat(0x2a3f55)); cap.position.y = 1.9;
        const top = new T.Mesh(new T.CylinderGeometry(0.33, 0.29, 0.06, 18), mat(0x2a3f55)); top.position.y = 2.0;
        const peak = new T.Mesh(roundedBox(0.36, 0.035, 0.2, 0.015), mat(0x1c2a3a)); peak.position.set(0, 1.82, 0.3); peak.rotation.x = 0.15;
        const badge = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), mat(PAL.coin)); badge.position.set(0, 1.92, 0.3);
        const tache = new T.Mesh(new T.CapsuleGeometry(0.04, 0.18, 4, 8), hairM); tache.rotation.z = Math.PI / 2; tache.position.set(0, 1.46, 0.3);
        const badge2 = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), mat(PAL.coin)); badge2.position.set(-0.17, 1.0, 0.33); badge2.scale.z = 0.5;
        g.add(cap, top, peak, badge, tache); body.add(badge2);
      }
      // view cone on the floor: only the head can see it
      const cone = new T.Mesh(new T.CircleGeometry(CFG.sightRange * 0.55, 20, -Math.PI / 2 - CFG.sightHalf, CFG.sightHalf * 2),
        new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
      cone.rotation.x = -Math.PI / 2; cone.position.y = 0.04; cone.layers.set(LAYER.HEAD); g.add(cone);
      const mark = label('?', { size: 0.6, color: '#33201a', outline: '#ffffff' }); mark.position.set(0.42, 2.12, 0); mark.layers.set(LAYER.HEAD); g.add(mark);
      const bubble = label('', { size: 0.34, bubble: true }); bubble.position.y = 2.32; bubble.layers.set(LAYER.HEAD); g.add(bubble);
      // "phew": everyone sees this one, whatever part they play
      const phew = label('phew', { size: 0.42, bubble: true, color: '#3f7f80' }); phew.visible = false; g.add(phew);
      const drop = label('?', { size: 0.5, color: '#7fbf5f' }); drop.visible = false; g.add(drop);
      g.position.set(def.x, 0, def.z);
      return { g, def, cone, mark, bubble, brow, body, phew, drop, legs, arms, mouth, pose: arms.map((a) => a.rotation.clone()), walkPh: 0, lastX: def.x, lastZ: def.z, phewT: 0, shown: 0 };
    }
  }
  // swap the toy figure for the key-art model once it has loaded
  useModel(v, id) {
    const pr = loadModel(id); if (!pr) return;
    pr.then((md) => {
      if (!md || !this.m.includes(v)) return;
      const bb = md.geo.boundingBox, h = bb.max.y - bb.min.y, s = (HEIGHT[id] || 1.75) / h;
      // the model is one solid piece, so the walk is drawn in the shader: legs swing from the hips (left and right
      // half of the figure in turn, feet lifting), the arms swing the other way, and the shoulders breathe
      const U = { uC: { value: new T.Vector4((bb.min.x + bb.max.x) / 2, bb.min.y, h, (bb.min.z + bb.max.z) / 2) }, uPh: { value: 0 }, uAmp: { value: 0 }, uT: { value: 0 } };
      const mat = md.mat.clone();
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = 'uniform vec4 uC; uniform float uPh; uniform float uAmp; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float yy = (transformed.y - uC.y) / uC.z, dx = (transformed.x - uC.x) / uC.z, side = dx < 0.0 ? -1.0 : 1.0;
          float leg = smoothstep(0.46, 0.06, yy) * smoothstep(0.0, 0.03, abs(dx));
          transformed.z += side * sin(uPh) * leg * uAmp * uC.z * 0.16;
          transformed.y += max(0.0, side * cos(uPh)) * leg * leg * uAmp * uC.z * 0.035;
          float arm = smoothstep(0.42, 0.55, yy) * smoothstep(0.78, 0.66, yy) * smoothstep(0.13, 0.2, abs(dx));
          transformed.z -= side * sin(uPh) * arm * uAmp * uC.z * 0.07 * (0.66 - yy) * 4.0;
          transformed.y += smoothstep(0.6, 0.85, yy) * sin(uT * 1.7) * uC.z * 0.004;`);
      };
      mat.customProgramCacheKey = () => 'walker';
      const mesh = new T.Mesh(md.geo, mat); mesh.castShadow = true; v.figU = U;
      mesh.scale.setScalar(s); mesh.position.set(-(bb.min.x + bb.max.x) / 2 * s, -bb.min.y * s, -(bb.min.z + bb.max.z) / 2 * s);
      const fig = new T.Group(); fig.add(mesh); v.g.add(fig);
      for (const c of v.g.children) if (c !== fig && c !== v.cone && !c.isSprite) c.visible = false;
      v.fig = fig;
    });
  }
  // a bluff landed on person i
  phew(i) { const v = this.m[i]; if (v) v.phewT = 1.6; }
  update(Wd, dt) {
    this.sync(Wd);
    Wd.people.forEach((p, i) => {
      const v = this.m[i], e = ease(dt, 14); if (!v) return;
      // the examiner sits in the car: no walking legs, and while his attention slips he looks down at his lap
      const seated = v.def.kind === 'examiner', lapse = seated && Wd.car && Wd.car.slipT > 0;
      v.g.position.y = seated ? (v.fig ? -0.42 : 0.3) : 0;
      v.g.position.x += (p.x - v.g.position.x) * e; v.g.position.z += (p.z - v.g.position.z) * e;
      v.g.rotation.y += wrap(p.yaw - v.g.rotation.y) * e;
      // walking: legs and arms swing with how fast they move; a person carrying a kid holds both arms out
      const spd = Math.hypot(p.x - v.lastX, p.z - v.lastZ) / Math.max(dt, 1e-3); v.lastX = p.x; v.lastZ = p.z;
      const sw = Math.min(1, spd / 1.4); v.walkPh += dt * (4 + spd * 4) * (sw > 0.05 ? 1 : 0);
      const swing = Math.sin(v.walkPh) * 0.55 * sw;
      v.legs[0].rotation.x = swing; v.legs[1].rotation.x = -swing;
      v.arms.forEach((a, k) => {
        const base = v.pose[k], carry = p.carry >= 0;
        const tx = carry ? -1.3 : sw > 0.1 ? (k ? swing : -swing) * 0.8 : base.x, tz = carry ? (k ? -0.2 : 0.2) : sw > 0.1 ? (k ? -0.16 : 0.16) : base.z;
        a.rotation.x += (tx - a.rotation.x) * ease(dt, 10); a.rotation.z += (tz - a.rotation.z) * ease(dt, 10);
      });
      v.body.position.y = Math.abs(Math.sin(v.walkPh)) * 0.04 * sw;
      v.shown += (p.sus - v.shown) * ease(dt, 6);                 // the meter slides, so a drop is something you can watch
      const s = v.shown;
      v.mark.visible = s > 0.08;
      v.mark.material.color.setRGB(1, 1 - s * 0.55, 1 - s * 0.6);                // the white outline warms to red
      v.mark.material.rotation = s > 0.5 ? Math.sin(Wd.time * 14) * 0.25 * (s - 0.4) : 0;   // and it wobbles when it is nearly full
      if (Wd.phase === 'scatter' && p.mode === 1) setLabel(v.mark, '!'); else setLabel(v.mark, lapse ? 'zz' : '?');
      if (lapse) { v.mark.visible = true; v.mark.material.color.setRGB(0.6, 1, 0.6); }     // not looking: everyone can see it
      const sc = 0.7 + s * 0.7; v.mark.scale.set(sc * 0.62, sc, 1);
      v.cone.material.color.setRGB(1, 1 - s * 0.7, 1 - s * 0.8); v.cone.material.opacity = 0.1 + s * 0.2;
      const o = Math.max(0, (s - 0.45) * 2); v.mouth.scale.set(1 - o * 0.35, 0.28 + o * 0.9, 0.4 + o * 0.2);   // the jaw drops as they get suspicious
      v.brow.position.y = 1.74 + s * 0.07; v.brow.children[0].rotation.z = Math.PI / 2 - s * 0.5; v.brow.children[1].rotation.z = Math.PI / 2 + s * 0.5;   // eyebrows go up as suspicion does
      setLabel(v.bubble, typeof p.say === 'string' ? p.say : p.say >= 0 ? LINES[p.say] || '' : '');
      // phew pop: rises and fades, with a green "?" falling away, and the shoulders drop
      v.phewT = Math.max(0, v.phewT - dt);
      const k = v.phewT / 1.6, on = v.phewT > 0;
      v.phew.visible = on; v.drop.visible = on;
      if (on) {
        v.phew.position.set(-0.6, 1.8 + (1 - k) * 0.3, 0); v.phew.material.opacity = Math.min(1, k * 2.5);
        v.drop.position.set(0.42, 2.1 - (1 - k) * 1.2, 0); v.drop.material.opacity = k; v.drop.material.rotation = (1 - k) * 1.5;
      }
      v.body.scale.y = 1 - (on ? Math.sin(k * Math.PI) * 0.1 : 0);                 // shoulders slump with relief
      if (v.fig) {
        // the model cannot move its limbs: it waddles, bobs, leans back in suspicion and sags with relief instead
        v.fig.position.y = Math.abs(Math.sin(v.walkPh)) * 0.03 * sw;
        v.fig.rotation.z = Math.sin(v.walkPh) * 0.035 * sw;
        if (v.figU) { v.figU.uPh.value = v.walkPh; v.figU.uAmp.value += (sw - v.figU.uAmp.value) * Math.min(1, dt * 8); v.figU.uT.value = Wd.time + i; }
        v.fig.rotation.x = p.carry >= 0 ? 0.18 : -Math.max(0, s - 0.3) * 0.16 + (lapse ? 0.25 : 0);
        v.fig.scale.y = 1 - (on ? Math.sin(k * Math.PI) * 0.06 : 0) + (s > 0.6 ? Math.sin(Wd.time * 9) * 0.012 : 0);
      }
    });
  }
}
