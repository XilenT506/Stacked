// Who controls which part of the body, what each part sees, and the kids when they are out of the coat.
import { T, PAL, CFG, E, clamp, ease, fwd, dist, yawTo } from './config.js';
import { TOWN, collide, los, leafy, inAlley, mat, ownMat, LAYER } from './town.js';
import { bodyPoint, armsY, headY } from './stack.js';

// Seat owners by player count. 1: solo drives everything. 2: legs / head+arms. 3: legs / arms / head.
// 4: legs / left arm / right arm / head. "rot" turns the table so friends can swap places in the alley.
export function assignSeats(n, rot) {
  n = Math.max(1, Math.min(4, n));
  const base = n === 1 ? [0, 0, 0, 0] : n === 2 ? [0, 1, 1, 1] : n === 3 ? [0, 1, 1, 2] : [0, 1, 2, 3];
  const s = base.map((p) => (p + rot) % n);
  return { legs: s[0], armL: s[1], armR: s[2], head: s[3] };
}

export function myParts(seats, pid) {
  const p = [];
  if (seats.legs === pid) p.push('legs');
  if (seats.armL === pid || seats.armR === pid) p.push('arms');
  if (seats.head === pid) p.push('head');
  return p;
}

// Each kid in a Scatter belongs to the player who had that seat.
export function kidOwners(seats, players) {
  const o = [seats.legs, seats.armL, seats.head];
  if (players >= 4) o.push(seats.armR);
  return o;
}

// l: forward, turn, gait. h: per hand x, y, z, gesture. hd: yaw, pitch, flags. k: kid. n: counters (grab L, grab R, hop, swap, hat, pat).
export const emptyPacket = () => ({ l: [0, 0, 0], h: [[0, 0, 0, 0], [0, 0, 0, 0]], hd: [0, 0, 0], k: [0, 0, 0], n: [0, 0, 0, 0, 0, 0] });

// Host: copy what each player ordered into the shared body. Counters turn key presses into one-off actions.
export function applyInputs(Wd, inputs, last, api) {
  const s = Wd.seats, o = Wd.ord;
  o.pos = null;
  for (let pid = 0; pid < Wd.players.length; pid++) {
    const P = inputs[pid]; if (!P) continue;
    const L = last[pid] || (last[pid] = P.n.slice());
    if (s.legs === pid) { o.f = clamp(P.l[0], -1, 1); o.t = clamp(P.l[1], -1, 1); o.gait = clamp(P.l[2] | 0, 0, 3);
      if (P.l[6]) o.pos = { x: P.l[3], z: P.l[4], yaw: P.l[5] }; }
    for (let i = 0; i < 2; i++) {
      if ((i === 0 ? s.armL : s.armR) !== pid) continue;
      const h = o.hand[i];
      h.x = clamp(P.h[i][0], -0.55, 0.55); h.y = clamp(P.h[i][1], -0.35, 0.6); h.z = clamp(P.h[i][2], 0, 0.75); h.act = clamp(P.h[i][3] | 0, 0, 2);
      if (P.n[i] !== L[i]) api.grab(i);
      if (P.n[5] !== L[5]) api.pat();
    }
    if (s.head === pid) {
      o.hy = clamp(P.hd[0], -1.9, 1.9); o.hp = clamp(P.hd[1], -0.9, 0.7);
      o.nod = P.hd[2] & 1; o.shake = P.hd[2] & 2 ? 1 : 0; o.talk = P.hd[2] & 4 ? 1 : 0; o.brow = P.hd[2] & 8 ? 1 : 0;
      if (P.n[4] !== L[4]) api.hat();
    }
    if (P.n[2] !== L[2]) api.hop(pid);
    if (P.n[3] !== L[3]) api.swap();
    last[pid] = P.n.slice();
  }
}

export function spawnKid(Wd, x, z, owner, color) {
  const c = collide(x, z, CFG.kidR, true);
  Wd.kids.push({ x: c.x, z: c.z, yaw: 0, caught: 0, owner, color });
}

// Kids run where their player points. A player's other kids follow the one they are driving.
export function stepKids(Wd, inputs, dt, api) {
  const byOwner = new Map();
  Wd.kids.forEach((k, i) => { if (!k.caught) { if (!byOwner.has(k.owner)) byOwner.set(k.owner, []); byOwner.get(k.owner).push(i); } });
  for (const [owner, list] of byOwner) {
    const P = inputs[owner] || emptyPacket();
    const lead = list[((P.k[2] | 0) % list.length + list.length) % list.length];
    const L = Wd.kids[lead];
    let mx = -clamp(P.k[0], -1, 1), mz = clamp(P.k[1], -1, 1);    // screen right is world -x for the kid camera
    const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
    moveKid(L, mx * CFG.kidSpeed, mz * CFG.kidSpeed, dt);
    L.lead = 1;
    let prev = L;
    for (const i of list) {
      if (i === lead) continue;
      const k = Wd.kids[i]; k.lead = 0;
      const d = dist(k.x, k.z, prev.x, prev.z);
      if (d > 0.75) moveKid(k, ((prev.x - k.x) / d) * CFG.kidSpeed, ((prev.z - k.z) / d) * CFG.kidSpeed, dt);
      prev = k;
    }
  }
  // a free kid frees a caught one by touching them
  for (const c of Wd.kids) {
    if (!c.caught || !c.seat) continue;         // only a kid sitting on the bench can be tagged free
    for (const f of Wd.kids) if (!f.caught && dist(c.x, c.z, f.x, f.z) < 1.1) { c.caught = 0; c.seat = 0; api.ev(E.FREED); break; }
  }
}

function moveKid(k, vx, vz, dt) {
  if (Math.abs(vx) + Math.abs(vz) < 0.01) return;
  const c = collide(k.x + vx * dt, k.z + vz * dt, CFG.kidR, true);
  k.x = c.x; k.z = c.z; k.yaw = yawTo(vx, vz);
}

// ---------- cameras: each part sees something the others cannot ----------
// The shared camera: everyone watches the coat from outside, like a sitcom. It follows from behind and to the side,
// and cuts to a front view of the coat and the grown-up whenever someone near is talking to it.
const SC = { p: new T.Vector3(), l: new T.Vector3(), mode: '', init: 0, side: 0 };
function sharedCamera(cam, Wd, dt, focus) {
  const b = Wd.body, [fx, fz] = fwd(b.yaw), rx = fz, rz = -fx;
  // the alley is a dead end behind a half wall: watch it from up in the street, looking in at the coat's front
  if (inAlley(b.x, b.z) && !Wd.car) {
    const px = -6.4, py = 6.2, pz = -0.9, lx = b.x, ly = 1.6, lz = b.z + 0.4;
    if (SC.mode !== 'alley') { SC.p.set(px, py, pz); SC.l.set(lx, ly, lz); }
    else { const a = 1 - Math.exp(-dt * 4); SC.p.lerp({ x: px, y: py, z: pz }, a); SC.l.lerp({ x: lx, y: ly, z: lz }, a); }
    SC.mode = 'alley'; SC.init = 1;
    cam.layers.enable(LAYER.LEGS); cam.layers.enable(LAYER.HEAD);
    cam.fov = 52; cam.position.copy(SC.p); cam.lookAt(SC.l); cam.updateProjectionMatrix();
    return;
  }
  // the start of an errand: a front-on establishing shot of the coat, until the legs start walking
  if (focus && focus.intro) {
    for (const [d, sd] of [[3.4, 0.9], [3.4, -0.9], [2.6, 0.6], [2.6, -0.6], [2.0, 0.4]]) {
      const cx = b.x + fx * d + rx * sd, cz = b.z + fz * d + rz * sd;
      if (los(b.x, b.z, cx, cz, true) && !collide(cx, cz, 0.3).hit && !leafy(b.x, b.z, cx, cz)) {
        SC.p.set(cx, 1.85, cz); SC.l.set(b.x, 1.45, b.z); SC.mode = 'intro'; SC.init = 1;
        cam.layers.enable(LAYER.LEGS); cam.layers.enable(LAYER.HEAD);
        cam.fov = 50; cam.position.copy(SC.p); cam.lookAt(SC.l); cam.updateProjectionMatrix();
        return;
      }
    }
    focus = null;
  }
  // the arms at work: a close side-on shot of the hands and the counter
  if (focus) {
    const mx = (b.x + focus.x) / 2, mz = (b.z + focus.z) / 2;
    let got = null;
    for (const r of [2.7, 2.2, 1.7]) for (const sg of SC.fside ? [SC.fside, -SC.fside] : [1, -1]) {
      const cx = mx + rx * sg * r - fx * 0.35, cz = mz + rz * sg * r - fz * 0.35;
      if (!got && los(mx, mz, cx, cz, true) && !collide(cx, cz, 0.3).hit && !leafy(mx, mz, cx, cz)) got = { cx, cz, sg };
    }
    if (got) {
      SC.fside = got.sg;
      const px = got.cx, py = Math.max(1.6, focus.y + 0.75), pz = got.cz, lx = focus.x * 0.75 + b.x * 0.25, ly = focus.y - 0.05, lz = focus.z * 0.75 + b.z * 0.25;
      if (SC.mode !== 'work') { SC.p.set(px, py, pz); SC.l.set(lx, ly, lz); }
      else { const a = 1 - Math.exp(-dt * 6); SC.p.lerp({ x: px, y: py, z: pz }, a); SC.l.lerp({ x: lx, y: ly, z: lz }, a); }
      SC.mode = 'work'; SC.init = 1;
      cam.layers.enable(LAYER.LEGS); cam.layers.enable(LAYER.HEAD);
      cam.fov = 50; cam.position.copy(SC.p); cam.lookAt(SC.l); cam.updateProjectionMatrix();
      return;
    }
  }
  const car = !!Wd.car, slow = Math.abs(b.v) < 0.35 || car && Math.abs(Wd.car.v) < 0.5;
  let best = null, bd = 3.6;
  if (slow && !car) for (const p of Wd.people) {
    if (!(p.sayT > 0) && !(p.sus > 0.45)) continue;
    const d = dist(p.x, p.z, b.x, b.z); if (d < bd && los(b.x, b.z, p.x, p.z, true)) { bd = d; best = p; }
  }
  let px, py, pz, lx, ly, lz, mode;
  if (best) {
    // front three-quarter: the coat's face and the grown-up in one shot
    mode = 'talk:' + best.id;
    const mx = (b.x + best.x) / 2, mz = (b.z + best.z) / 2, dx = (best.x - b.x) / bd, dz = (best.z - b.z) / bd;
    let pick = null;
    for (const [s, r] of [[1, 3.9], [-1, 3.9], [1, 3.0], [-1, 3.0], [1, 2.3], [-1, 2.3]]) {
      const cx = mx + dz * s * r + fx * 0.6, cz = mz - dx * s * r + fz * 0.6;
      const front = (cx - b.x) * fx + (cz - b.z) * fz;
      const ok = los(b.x, b.z, cx, cz, true) && los(best.x, best.z, cx, cz, true) && !collide(cx, cz, 0.35).hit && !leafy(b.x, b.z, cx, cz) && !leafy(best.x, best.z, cx, cz);
      const score = (ok ? 10 : 0) + front;
      if (!pick || score > pick.s) pick = { x: cx, z: cz, s: score };
    }
    if (pick.s >= 10) { px = pick.x; py = 2.05; pz = pick.z; lx = mx; ly = 1.7; lz = mz; }
    else best = null;
  }
  if (!best) {
    mode = 'chase';
    // behind and well off to one side, so the coat shows its side and front more than its back.
    // In a tight spot the camera rises and looks down instead of pressing into the coat.
    const back = car ? 4.6 : 3.0, side = car ? 1.0 : 2.0, hgt = car ? 2.6 : 2.4;
    const sides = SC.side ? [SC.side, -SC.side] : [1, -1];
    let got = null;
    search: for (const kk of [1, 0.8, 0.6, 0.45, 0.3]) for (const sg of sides) {
      const cx = b.x - fx * back * kk + rx * side * sg * kk, cz = b.z - fz * back * kk + rz * side * sg * kk;
      if (los(b.x, b.z, cx, cz, true) && los(b.x + fx * 1.2, b.z + fz * 1.2, cx, cz, true) && !collide(cx, cz, 0.35).hit && !leafy(b.x, b.z, cx, cz)) { got = { cx, cz, kk, sg }; break search; }
    }
    // nowhere clear at eye height (the alley): a crane shot from above and behind, looking ahead to where you are going
    const crane = !got;
    if (crane) got = { cx: b.x - fx * 2.0, cz: b.z - fz * 2.0, kk: 0, sg: SC.side || 1 };
    SC.side = got.sg;
    px = got.cx; pz = got.cz; py = crane ? 5.0 : hgt + (1 - got.kk) * 1.6;
    if (crane) { mode = 'crane'; lx = b.x + fx * 3.5; ly = 0.4; lz = b.z + fz * 3.5; }
    if (mode !== 'crane') { lx = b.x + fx * 1.6; ly = 1.45; lz = b.z + fz * 1.6; }
  }
  px = clamp(px, -11.8, 11.8);                          // never past the houses at the ends of the street
  const glide = (m) => m === 'chase' || m === 'crane';
  const cut = !SC.init || mode !== SC.mode && !(glide(mode) && glide(SC.mode));
  if (cut) { SC.p.set(px, py, pz); SC.l.set(lx, ly, lz); SC.init = 1; }
  else { const a = 1 - Math.exp(-dt * 4.5); SC.p.lerp({ x: px, y: py, z: pz }, a); SC.l.lerp({ x: lx, y: ly, z: lz }, a); }
  SC.mode = mode;
  cam.layers.enable(LAYER.LEGS); cam.layers.enable(LAYER.HEAD);
  cam.fov = 55; cam.position.copy(SC.p); cam.lookAt(SC.l); cam.updateProjectionMatrix();
}
export const sharedMode = () => SC.mode;

export function placeCamera(cam, Wd, part, local, leadKid, dt = 1 / 60, shared = false, focus = null) {
  const b = Wd.body;
  cam.layers.set(0);
  if (shared && part !== 'kid' && !b.down) { sharedCamera(cam, Wd, dt, focus); return; }
  if (part !== 'kid') SC.init = 0;
  if (part === 'kid' && leadKid) {
    cam.layers.enable(LAYER.LEGS);
    cam.fov = 55; cam.position.set(leadKid.x, 5.2, leadKid.z - 4.4); cam.lookAt(leadKid.x, 0.5, leadKid.z + 0.6);
  } else {
    const [fx, fz] = fwd(b.yaw);
    const low = b.down ? 0.3 : 1;
    cam.rotation.order = 'YXZ';
    const lvl = Wd.dis ? Wd.dis.lvl : 0;
    if (b.down && part !== 'kid') {
      // a fall: everyone gets a quick outside look at the heap on the floor
      const rx = -Math.cos(b.yaw), rz = Math.sin(b.yaw);
      cam.layers.enable(LAYER.HEAD);
      // pick a spot with a clear view of the heap (try behind-left, behind-right, the sides, then closer)
      let px = b.x - fx * 2.6 + rx * 1.4, pz = b.z - fz * 2.6 + rz * 1.4;
      search: for (const d of [2.6, 1.8, 1.1]) for (const [a, c] of [[-1, 1], [-1, -1], [0, 1], [0, -1], [1, 1], [1, -1]]) {
        const tx = b.x + fx * d * a + rx * 1.4 * c * (d / 2.6), tz = b.z + fz * d * a + rz * 1.4 * c * (d / 2.6);
        if (los(b.x, b.z, tx, tz) && collide(tx, tz, 0.3).hit === false) { px = tx; pz = tz; break search; }
      }
      cam.fov = 58; cam.position.set(px, 2.3, pz); cam.lookAt(b.x + fx * 0.3, 0.3, b.z + fz * 0.3);
      cam.updateProjectionMatrix(); return;
    }
    if (part === 'legs' && local.scope && lvl >= 3 && !b.down) {
      // periscope hat: the legs peek out at head height and see what the head sees
      cam.layers.enable(LAYER.HEAD);
      const p = bodyPoint(b, 0, headY(b) + 0.42, 0.1, 1);
      cam.fov = 60; cam.position.set(p.x, p.y, p.z); cam.rotation.set(-0.12, b.yaw + Math.PI, b.lx * 0.6);
    } else if (part === 'legs' && Wd.car) {
      // on the pedals: a low look out under the dashboard at the road, where the lines are painted
      cam.layers.enable(LAYER.LEGS);
      cam.fov = 80; cam.position.set(b.x + fx * 0.9, 0.62, b.z + fz * 0.9);
      cam.rotation.set(-0.42, b.yaw + Math.PI, 0);
    } else if (part === 'legs') {
      cam.layers.enable(LAYER.LEGS); if (lvl >= 3) cam.layers.enable(LAYER.HEAD);
      cam.fov = 84; cam.position.set(b.x + fx * 0.6, 0.66 * low + 0.1, b.z + fz * 0.6);
      cam.rotation.set(-0.98, b.yaw + Math.PI, 0);
    } else if (part === 'arms') {
      const p = bodyPoint(b, 0, (headY(b) - 0.38) * low + 0.03, -0.04, 1);   // inside the top kid, looking down at the hands
      cam.fov = 74; cam.position.set(p.x, p.y, p.z);
      cam.rotation.set(-0.84, b.yaw + Math.PI, b.lx * 0.4);
    } else {
      cam.layers.enable(LAYER.HEAD);
      const p = bodyPoint(b, 0, headY(b) * low + 0.05, 0.1, 1);
      const nod = local.nod ? Math.sin(Wd.time * 9) * 0.2 : 0, shake = local.shake ? Math.sin(Wd.time * 11) * 0.25 : 0;
      cam.fov = 70; cam.position.set(p.x, p.y, p.z);
      cam.rotation.set(local.p - nod, b.yaw + local.y + shake + Math.PI, b.lx * 0.6);
    }
  }
  cam.updateProjectionMatrix();
}

// ---------- view of the loose kids ----------
export class KidsView {
  constructor(scene) { this.scene = scene; this.m = []; }
  update(Wd, dt) {
    while (this.m.length < Wd.kids.length) {
      const g = new T.Group();
      const body = new T.Mesh(new T.CapsuleGeometry(0.19, 0.22, 4, 10), ownMat(0xffffff)); body.position.y = 0.32; body.castShadow = true;
      const head = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), mat(PAL.skin)); head.position.y = 0.74; head.castShadow = true;
      const ring = new T.Mesh(new T.RingGeometry(0.3, 0.36, 20), new T.MeshBasicMaterial({ color: PAL.white }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
      // a kid face, as in the key art: red hair and two dot eyes
      const hair = new T.Mesh(new T.SphereGeometry(0.178, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(PAL.hair)); hair.position.y = 0.76; hair.rotation.x = -0.25;
      const eyes = [-1, 1].map((sd) => { const e = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), mat(0x2a1a14)); e.position.set(sd * 0.06, 0.76, 0.155); return e; });
      g.add(body, head, hair, ...eyes, ring); g.userData = { body, ring }; this.scene.add(g); this.m.push(g);
    }
    this.m.forEach((g, i) => {
      const k = Wd.kids[i]; g.visible = !!k; if (!k) { g.userData.tumble = undefined; return; }
      g.userData.body.material.color.setHex(PAL.kids[k.color % 4]);
      const e = ease(dt, 16);
      const U = g.userData;
      if (U.tumble === undefined) {
        // a new kid tumbles out of the coat: a hop and a roll from the middle of the stack
        U.tumble = Wd.phase === 'scatter' ? 0 : 9; U.ox = Wd.body.x; U.oz = Wd.body.z; U.roll = (i % 2 ? 1 : -1);
      }
      U.tumble += dt;
      if (U.tumble < 1.1) {
        const u = U.tumble / 1.1;
        g.position.set(U.ox + (k.x - U.ox) * u, 0.9 * (1 - u) + Math.sin(u * Math.PI) * 1.1, U.oz + (k.z - U.oz) * u);
        g.rotation.set(u * Math.PI * 3 * U.roll, k.yaw, u * Math.PI * 2 * -U.roll);
      } else {
        if (Math.hypot(k.x - g.position.x, k.z - g.position.z) > 3) g.position.set(k.x, 0, k.z);
        g.position.x += (k.x - g.position.x) * e; g.position.z += (k.z - g.position.z) * e; g.position.y = 0;
        g.rotation.set(0, k.yaw, 0);
      }
      g.rotation.y = k.yaw; g.scale.y = k.caught ? 0.7 : 1; g.userData.ring.visible = !!k.lead && !k.caught;
    });
  }
}
