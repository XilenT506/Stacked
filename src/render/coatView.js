// Draws one Coat (src/entities/coat.js): the bending trench coat for 3 and 2 kids, a single kid in a far
// too big hat for 1, the loose kids running around, and the coat lying on the floor like laundry after R.
// M1-F2: each loose kid gets a bobbing marker in their colour (seen through shelves), and when grown-ups
// pile on a coat (or carry it off) its outline shows through them, so you never lose yourself.
import * as T from 'three';
import { bubble } from './peopleView.js';
import { makeMapSheet, updateMapSheet } from './mapSheet.js';
import { DrinkFx } from './drinkFx.js';
import { loadHero, bendUniforms, bendMaterial, bendPoint, HERO_S, HEAD_Y } from './heroModel.js';

export const KID_COLORS = { sid: 0xe2694f, mo: 0x4f9fc9, tank: 0x7fbf5f, pip: 0xe0a83a, kit: 0xd94f8a, bo: 0x4fc9b8, ziggy: 0xf4c542, nell: 0x8a6fd1, ash: 0x9aa7b0, dot: 0xe07a3a, rex: 0x3f8a3a, flo: 0xff8fb0, spare1: 0xc9a8d8, spare2: 0x8e5bc4 };
export const PLAYER_COLORS = [0xe2694f, 0x4f9fc9, 0xf4c542, 0x7fbf5f];
const COAT = 0x6b4838, SKIN = 0xf0c8a0;
const ease = (dt, r) => 1 - Math.exp(-dt * r);
const lam = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.8 });

// a little kid (0.9 m) in their own colour, wearing a grown-up's hat that is far too big
export function kidFigure(color) {
  const g = new T.Group(), body = lam(color), dark = lam(0x2d2a33);
  const legs = [-0.08, 0.08].map((x) => { const l = new T.Mesh(new T.CapsuleGeometry(0.055, 0.22, 3, 8), dark); l.position.set(x, 0.17, 0); g.add(l); return l; });
  const torso = new T.Mesh(new T.CapsuleGeometry(0.15, 0.18, 4, 10), body); torso.position.y = 0.46; g.add(torso);
  const arms = [-1, 1].map((s) => { const a = new T.Mesh(new T.CapsuleGeometry(0.045, 0.2, 3, 8), body); a.position.set(s * 0.2, 0.48, 0); a.rotation.z = s * 0.4; g.add(a); return a; });
  const head = new T.Mesh(new T.SphereGeometry(0.15, 16, 12), lam(SKIN)); head.position.y = 0.76; g.add(head);
  for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), lam(0x1a1a1a)); e.position.set(s * 0.055, 0.79, 0.135); g.add(e); }
  const hat = new T.Group(), hm = lam(COAT);
  const brim = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.025, 20), hm), crown = new T.Mesh(new T.CylinderGeometry(0.16, 0.19, 0.2, 18), hm);
  crown.position.y = 0.1; hat.add(brim, crown); hat.position.y = 0.88; hat.rotation.z = 0.12; g.add(hat);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { legs, arms, torso, head, hat };
  return g;
}

// the marker over a loose kid: a fat down-arrow in their colour with a dark rim, always facing the camera
// and drawn on top of everything
function kidMarker(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.beginPath(); g.moveTo(8, 10); g.lineTo(56, 10); g.lineTo(32, 56); g.closePath();
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.strokeStyle = '#33201a'; g.lineWidth = 6; g.lineJoin = 'round'; g.fill(); g.stroke();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false })); s.scale.setScalar(0.55); s.renderOrder = 9;
  return s;
}

// a music note (♪ or ♫) floating up from a whistling coat
function noteSprite(i) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 54px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#fff3e2'; g.fillStyle = '#33201a';
  const ch = i % 2 ? '\u266B' : '\u266A'; g.strokeText(ch, 32, 34); g.fillText(ch, 32, 34);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.renderOrder = 11; return s;
}

// run or wave the kid's arms and legs; phase in seconds
function animateKid(k, t, running, waving) {
  const { legs, arms, torso, hat } = k.userData, s = running ? Math.sin(t * 16) : 0;
  legs[0].rotation.x = s * 0.7; legs[1].rotation.x = -s * 0.7;
  torso.position.y = 0.46 + Math.abs(s) * 0.03;
  arms.forEach((a, i) => { a.rotation.x = running ? (i ? s : -s) * 0.9 : 0; a.rotation.z = (i ? 1 : -1) * (waving ? 2.6 + Math.sin(t * 12 + i) * 0.3 : 0.4); });
  hat.rotation.z = 0.12 + (running ? Math.sin(t * 8) * 0.15 : 0);
}

export class CoatView {
  constructor(scene, coat, lines = []) {
    this.coat = coat; this.scene = scene; this.lines = lines;
    this.root = new T.Group(); scene.add(this.root);
    this.coatG = new T.Group(); this.root.add(this.coatG);           // the coat model (standing or lying)
    this.kid = kidFigure(KID_COLORS[coat.stack[0]]); this.root.add(this.kid);   // shown when only one kid is left
    this.looseG = new Map();
    this.pileG = new T.Group(); scene.add(this.pileG); this.pileG.visible = false;
    this.sway = 0; this.pop = 0; this.lean = new T.Vector2(); this.scale = new T.Vector3(1, 1, 1); this.t = 0;
    this.lastCount = coat.count;
    // the see-through outline: a dark rim and a coloured ghost, drawn only where something stands in front of the coat
    this.ghost = new T.Group(); scene.add(this.ghost); this.ghost.visible = false;
    const rim = new T.Mesh(new T.CapsuleGeometry(0.5, 1.2, 4, 14), new T.MeshBasicMaterial({ color: 0x33201a, side: T.BackSide, depthFunc: T.GreaterDepth, depthWrite: false, transparent: true, opacity: 0.9 }));
    const fill = new T.Mesh(new T.CapsuleGeometry(0.43, 1.2, 4, 14), new T.MeshBasicMaterial({ color: PLAYER_COLORS[(coat.slot ?? 0) % 4], depthFunc: T.GreaterDepth, depthWrite: false, transparent: true, opacity: 0.6 }));
    rim.renderOrder = 6; fill.renderOrder = 7; this.ghost.add(rim, fill); this.ghostParts = [rim, fill];
    this.sheet = makeMapSheet(); this.root.add(this.sheet);
    this.drinkFx = new DrinkFx(this.root);                                 // Sugar Rush sparks, Burp Blaster shockwave              // the crayon map, held up while it is open
    // a plain stand-in until the model is ready
    this.stand = new T.Mesh(new T.CapsuleGeometry(0.4, 1.4, 4, 12), lam(COAT)); this.stand.position.y = 1.1; this.stand.castShadow = true; this.coatG.add(this.stand);
    loadHero().then((p) => this.useHero(p), (e) => console.warn('coat model did not load', e));
  }

  // which player this is, as a coloured ring and a tag (only when more than one is playing)
  setTag(n, show) {
    if (!this.tag) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#' + PLAYER_COLORS[n % 4].toString(16).padStart(6, '0'); g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 34px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P' + (n + 1), 32, 35);
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
      this.tag = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); this.tag.scale.setScalar(0.45); this.tag.renderOrder = 12; this.root.add(this.tag);
      this.ring = new T.Mesh(new T.RingGeometry(0.5, 0.6, 32), new T.MeshBasicMaterial({ color: PLAYER_COLORS[n % 4], transparent: true, opacity: 0.8 })); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.03; this.root.add(this.ring);
    }
    this.tag.visible = this.ring.visible = show;
  }

  remove() { this.scene.remove(this.root); this.scene.remove(this.pileG); this.scene.remove(this.ghost); for (const m of this.looseG.values()) this.scene.remove(m, m.userData.marker); this.looseG.clear(); }

  useHero(p) {
    this.coatG.remove(this.stand);
    this.U = bendUniforms(p.shoulder);
    const mats = p.material.map((m) => bendMaterial(m.clone(), this.U, false));
    const body = new T.Mesh(p.body, mats); body.castShadow = true;
    body.customDepthMaterial = bendMaterial(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }), this.U, true);
    p.body.boundingSphere.radius += 1.5;
    this.head = new T.Mesh(p.head, p.material); this.head.castShadow = true;
    this.hands = p.hands.map((g, i) => { const m = new T.Mesh(g, p.material); m.castShadow = true; m.userData.sh = [i ? -p.shoulder[0] : p.shoulder[0], p.shoulder[1]]; return m; });
    this.model = new T.Group(); this.model.add(body, this.head, ...this.hands); this.coatG.add(this.model);
    // the laundry pile: the same coat, flattened on its back, with two pairs of eyes peeking out of the collar
    this.pileModel = new T.Group();
    const flat = new T.Group(); flat.add(new T.Mesh(p.body, p.material), ...p.hands.map((g, i) => { const m = new T.Mesh(g, p.material); m.position.set(i ? -p.shoulder[0] : p.shoulder[0], p.shoulder[1], 0); m.rotation.z = (i ? -1 : 1) * 0.9; return m; }));
    flat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    flat.rotation.x = -Math.PI / 2; flat.scale.set(0.9, 0.85, 0.5); flat.position.set(0, 0.12, 0.95);
    this.pileModel.add(flat);
    const eye = new T.MeshBasicMaterial({ color: 0xffffff }), pupil = new T.MeshBasicMaterial({ color: 0x111111 });
    this.peeks = [-0.14, 0.14].map((x, i) => {
      const e = new T.Group();
      for (const s of [-1, 1]) { const w = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), eye); w.position.x = s * 0.05; const pp = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), pupil); pp.position.set(s * 0.05, 0.02, 0.03); e.add(w, pp); }
      e.position.set(x, 0.32, -0.62 + i * 0.05); this.pileModel.add(e); return e;
    });
    const hat = kidFigure(0).userData.hat.clone(); hat.scale.setScalar(1.3); hat.position.set(0.35, 0.05, -0.95); hat.rotation.set(0.2, 0.4, 0.5); this.pileModel.add(hat);
    this.pileG.add(this.pileModel);
  }

  // events: what the coat reported since the last frame (spill, restack, unstack, hit...)
  update(dt, events = [], { crowd = 0, mine = false } = {}) {
    const c = this.coat, w = c.walker, f = w.feet;
    // Act Natural: a grown-up remark in a bubble, a new one each time you start
    if (c.actingNatural && !this.natBubble && this.lines?.length) {
      this.natBubble = bubble(this.lines[(this.lineN = ((this.lineN ?? -1) + 1) % this.lines.length)]);
      this.natBubble.position.set(0, c.state.height + 0.9, 0); this.root.add(this.natBubble);
    } else if (!c.actingNatural && this.natBubble) { this.root.remove(this.natBubble); this.natBubble = null; }
    if (this.natBubble) this.natBubble.position.y = c.state.height + 0.9;
    // acting natural: little music notes float up while the coat whistles (and it strolls with a bounce)
    if (!this.notes) { this.notes = [0, 1, 2].map((i) => { const n = noteSprite(i); n.visible = false; this.root.add(n); return n; }); }
    this.notes.forEach((n, i) => {
      n.visible = !!c.actingNatural; if (!n.visible) return;
      const k = (this.t * 0.9 + i / 3) % 1;
      n.position.set(0.35 + Math.sin(k * 6 + i) * 0.18, c.state.height + 0.15 + k * 0.9, 0.1); n.material.opacity = 1 - k; n.scale.setScalar(0.32 + k * 0.12);
    });
    this.coatG.position.y = c.actingNatural && w.flatSpeed > 0.5 ? Math.abs(Math.sin(this.t * 7)) * 0.06 : 0;
    if (this.tag) this.tag.position.y = c.state.height + 0.55;
    this.t += dt;
    for (const e of events) if (e.type === 'spill' || e.type === 'restack' || e.type === 'unstack' || e.type === 'hit' || e.type === 'burp') this.pop = 1;
    if (events.some((e) => e.type === 'burp')) { this.drinkFx.burp(); this.burpBubble = 2.2; }
    this.drinkFx.update(dt, c, c.state.height);
    if (this.burpBubble > 0 && !this.burpB) { this.burpB = bubble('BUUUURP!'); this.root.add(this.burpB); }
    if (this.burpB) { this.burpBubble -= dt; this.burpB.position.set(0, c.state.height + 1.2, 0); if (this.burpBubble <= 0) { this.root.remove(this.burpB); this.burpB = null; } }
    this.pop = Math.max(0, this.pop - dt * 3);
    this.root.position.set(f.x, f.y, f.z);
    this.root.visible = c.hidden?.mode !== 'inside' && !c.grabbedBy;     // in a box, or held up by a grown-up (drawn in their arms)                    // climbed into a box: only the box shows
    this.root.rotation.y = w.yaw;
    const n = c.count;
    updateMapSheet(this.sheet, dt, !!c.mapOpen && n >= 1, n === 1 ? 1.1 : c.state.height);
    // 3 kids: the full coat; 2 kids: the same coat, squashed shorter; 1 kid: just a kid
    this.coatG.visible = n >= 2; this.kid.visible = n === 1;
    if (n === 1) {
      this.kid.userData.torso.material.color.setHex(KID_COLORS[c.stack[0]] ?? 0xffffff);
      animateKid(this.kid, this.t, w.flatSpeed > 0.5, false);
      this.kid.scale.setScalar(1 + this.pop * 0.25 * Math.sin(this.pop * 12));
    } else {
      const h = c.state.height, want = n === 3 ? [h / HERO_S, h / HERO_S] : [0.82 * 2.2 / HERO_S, h / HERO_S];
      this.scale.x += (want[0] - this.scale.x) * ease(dt, 10); this.scale.y += (want[1] - this.scale.y) * ease(dt, 10);
      const squash = 1 + this.pop * 0.18 * Math.sin(this.pop * 14);
      this.coatG.scale.set(this.scale.x / Math.sqrt(squash), this.scale.y * squash, this.scale.x / Math.sqrt(squash));
      this.bend(dt, c, w);
    }
    // loose kids: run around, then wave to be picked up
    const seen = new Set();
    for (const k of c.loose) {
      if (k.carriedBy) continue;                                          // drawn in the grown-up's arms
      let m = this.looseG.get(k); if (!m) { m = kidFigure(KID_COLORS[k.id] ?? 0xffffff); m.userData.marker = kidMarker(KID_COLORS[k.id] ?? 0xffffff); this.scene.add(m, m.userData.marker); this.looseG.set(k, m); }
      const mk = m.userData.marker; mk.visible = !k.caged; mk.position.set(k.x, f.y + 1.55 + Math.abs(Math.sin(this.t * 4 + k.x)) * 0.25, k.z); 
      seen.add(k);
      m.position.set(k.x, f.y + (k.waiting ? 0 : Math.abs(Math.sin(this.t * 16)) * 0.05), k.z);
      if (!k.waiting) m.rotation.y = Math.atan2(k.vx, k.vz);
      animateKid(m, this.t + k.x, !k.waiting, k.waiting);
    }
    for (const [k, m] of this.looseG) if (!seen.has(k)) { this.scene.remove(m, m.userData.marker); this.looseG.delete(k); }
    // the outline through a pile-on (two or more grown-ups on you, or being carried off)
    const h = c.count === 1 ? 1 : c.state.height, on = c.count > 0 && !c.inCage && (crowd >= 2 || !!c.caught || (!!c.grabbedBy && mine));
    this.ghost.visible = on;
    if (on) {
      const s = h / 2.2, pulse = 0.55 + Math.sin(this.t * 6) * 0.15;
      this.ghost.position.set(f.x, f.y + h / 2, f.z); this.ghost.scale.set(s, s, s); this.ghostParts[1].material.opacity = pulse;
      this.ghostParts[1].material.color.setHex(PLAYER_COLORS[(c.slot ?? 0) % 4]);
    }
    // the laundry pile
    this.pileG.visible = !!c.pile;
    if (c.pile) {
      this.pileG.position.set(c.pile.x, f.y, c.pile.z); this.pileG.rotation.y = c.pile.yaw;
      this.peeks?.forEach((e, i) => { e.position.x = (i ? 0.14 : -0.14) + Math.sin(this.t * 1.3 + i * 2) * 0.03; e.visible = Math.sin(this.t * 0.9 + i * 1.7) > -0.6; });
    }
  }

  // lean and sway: the more wobble, the more the coat sways; moving leans it into the walk
  bend(dt, c, w) {
    if (!this.U) return;
    const yaw = w.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
    // velocity in the coat's own frame (z forward, x to its left)
    const fwd = (w.vel.x * sn + w.vel.z * cs), side = (w.vel.x * cs - w.vel.z * sn);
    const sway = c.wobble * (0.18 + 0.22 * c.wobble) * Math.sin(this.t * (4 + c.wobble * 5));
    const tx = side * -0.02 + sway, tz = fwd * 0.035 + c.wobble * 0.08 * Math.sin(this.t * 3.1);
    this.lean.x += (tx - this.lean.x) * ease(dt, 8); this.lean.y += (tz - this.lean.y) * ease(dt, 8);
    const amt = Math.hypot(this.lean.x, this.lean.y), dir = amt > 1e-4 ? { x: this.lean.x / amt, y: this.lean.y / amt } : { x: 0, y: 1 };
    const top = HERO_S * 0.9, k = amt / top * 1.6, th0 = amt * 0.2;
    this.U.uLean.value.set(dir.x, dir.y); this.U.uTheta0.value = th0; this.U.uK.value = k;
    // the head and hands ride on the bent coat
    const hp = bendPoint({ x: 0, y: HEAD_Y, z: 0 }, dir, th0, k);
    this.head.position.set(hp.x, hp.y, hp.z);
    this.head.quaternion.setFromAxisAngle(new T.Vector3(dir.y, 0, -dir.x), hp.th);
    this.head.rotateY(Math.sin(this.t * 0.7) * 0.15 + c.wobble * 0.3 * Math.sin(this.t * 7));
    if (c.actingNatural) this.head.rotateX(Math.max(0, Math.sin(this.t * 5)) * 0.35);                  // Act Natural: a polite nod
    this.hands.forEach((m, i) => {
      const [sx, sy] = m.userData.sh, q = bendPoint({ x: sx, y: sy, z: 0 }, dir, th0, k);
      m.position.set(q.x, q.y, q.z);
      m.quaternion.setFromAxisAngle(new T.Vector3(dir.y, 0, -dir.x), q.th);
      m.rotateX(Math.sin(this.t * 9 + i * Math.PI) * Math.min(1, w.flatSpeed / 5) * 0.35);       // arms swing when walking
      m.rotateZ((i ? -1 : 1) * c.wobble * 0.5 * (1 + Math.sin(this.t * 10 + i)));               // flail when wobbly
      if (c.actingNatural && i === 0) { m.rotateZ(1.9 + Math.sin(this.t * 9) * 0.35); }              // ...and a cheery wave
      if (c.hidden?.mode === 'pose') { m.rotateZ((i ? -1 : 1) * 1.2); m.rotateX(i ? -0.5 : 0.3); }   // a stiff mannequin pose
    });
  }
}
