// The town: one street, a bank, a hidden alley and a few things to bump into.
// TOWN is plain data used by the simulation. buildTown() makes the three.js meshes.
import { T, PAL, dist } from './config.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import carGlb from '../assets/hero/car.glb';
import { smoothNormals } from './hero.js';

const W = (x0, z0, x1, z1, h, kind = 'wall', color = PAL.cream) => ({ x0, z0, x1, z1, h, kind, color });

export const TOWN = {
  start: { x: -7.6, z: -5.0, yaw: 0 },
  alley: { x0: -8.85, z0: -6.85, x1: -5.15, z1: -2.75 },
  bank: { x0: -3.85, z0: 3.65, x1: 3.85, z1: 10.85 },
  queue: { x: 0, z: 6.3, r: 0.6 },
  counterSpot: { x: 0.3, z: 7.8, r: 0.9 },
  exit: { x: 8.5, z: 0.2, r: 1.4 },
  bench: { x: 5.5, z: -3.3 },
  wet: { x: 0.45, z: 4.65, r: 0.65 },
  paper: { x0: 0.2, x1: -0.3, y: 1.02, z: 8.45, hx: 0.27, hz: 8.57 },   // signed from x0 to x1 (left to right for the signer); hx, hz: where the other hand holds it flat
  bagHome: { x: 0.8, y: 1.13, z: 8.45 },
  coins: [{ x: -2, z: 0.9 }, { x: -2.2, z: 5.6 }, { x: 2.3, z: 6.6 }],
  kidCoin: { x: -1.6, z: 8.6 },
  walls: [
    // bank
    W(-4.15, 10.85, 4.15, 11.15, 3), W(-4.15, 3.5, -3.85, 11, 3), W(3.85, 3.5, 4.15, 11, 3),
    W(-4.15, 3.35, -1.1, 3.65, 3), W(1.1, 3.35, 4.15, 3.65, 3),
    W(-3, 8.2, 3, 9.0, 1.0, 'counter', PAL.wood),
    // Mabel's corner stall and the cinema snack cart
    W(-9.1, 2.55, -7.5, 2.95, 1.0, 'counter', PAL.wood), W(1.5, -3.95, 3.25, -3.55, 1.0, 'counter', 0xc9694a),
    W(2.9, 4.0, 3.5, 4.6, 1.3, 'plant', PAL.teal),
    // alley: walls on three sides and a half wall across the mouth
    W(-9.15, -7, -8.85, -2.6, 2.6, 'wall', PAL.peach), W(-5.15, -7, -4.85, -2.6, 2.6, 'wall', PAL.peach),
    W(-9.15, -7.15, -4.85, -6.85, 2.6, 'wall', PAL.peach), W(-9.15, -2.75, -6.4, -2.45, 2.6, 'wall', PAL.peach),
    // other buildings
    W(-4.6, -9, 11.7, -4.2, 3.6, 'shop', PAL.peach), W(-12, -9, -9.4, -2.6, 3.4, 'shop', PAL.cream),
    W(-12, 3.5, -4.6, 10, 3.4, 'shop', PAL.terracotta), W(4.6, 3.5, 12, 10, 3.8, 'shop', PAL.mustard),
    // edges of the world
    W(-12.4, -9, -12, 11, 0, 'edge'), W(12, -9, 12.4, 11, 0, 'edge'),
  ],
  props: [
    { name: 'bin', x: -3.2, z: 2.7, r: 0.3 }, { name: 'crates', x: -4.3, z: -3.0, r: 0.45 },
    { name: 'bucket', x: 1.35, z: 4.2, r: 0.25 }, { name: 'rope post', x: -0.95, z: 6.3, r: 0.12 },
    { name: 'rope post', x: 0.95, z: 6.3, r: 0.12 }, { name: 'traffic cone', x: 3, z: -1.9, r: 0.22 },
  ],
};

export const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
export const inAlley = (x, z) => inRect(TOWN.alley, x, z);
export const inBank = (x, z) => inRect(TOWN.bank, x, z);
export const inZone = (zn, x, z) => dist(zn.x, zn.z, x, z) < zn.r;

// Push a circle out of every wall. Kids are short enough to go under the counter.
export function collide(x, z, r, kid) {
  let hit = false;
  for (const w of TOWN.walls) {
    if (kid && w.kind === 'counter') continue;
    const cx = x < w.x0 ? w.x0 : x > w.x1 ? w.x1 : x;
    const cz = z < w.z0 ? w.z0 : z > w.z1 ? w.z1 : z;
    let dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r; z = cz + (dz / d) * r;
    } else {
      // centre is inside the box: leave by the nearest side
      const l = x - w.x0, rr = w.x1 - x, b = z - w.z0, t = w.z1 - z;
      const m = Math.min(l, rr, b, t);
      if (m === l) x = w.x0 - r; else if (m === rr) x = w.x1 + r; else if (m === b) z = w.z0 - r; else z = w.z1 + r;
    }
  }
  return { x, z, hit };
}

// Can a grown-up at A see point B? They see over the counter and the props.
export function los(ax, az, bx, bz, cam = false) {
  const dx = bx - ax, dz = bz - az;
  for (const w of TOWN.walls) {
    if (w.kind === 'counter' || w.kind === 'plant' || (w.kind === 'edge' && !cam)) continue;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (ax < w.x0 || ax > w.x1) continue; } else {
      let a = (w.x0 - ax) / dx, b = (w.x1 - ax) / dx; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (az < w.z0 || az > w.z1) continue; } else {
      let a = (w.z0 - az) / dz, b = (w.z1 - az) / dz; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue;
    }
    return false;
  }
  return true;
}

// ---------- view ----------
export const LAYER = { HEAD: 1, LEGS: 2 };

// Soft, matte "toy" materials, as in the key art. One material per colour is shared.
const mats = new Map();
export function mat(color, opts = {}) {
  const plain = !Object.keys(opts).length;
  if (plain && mats.has(color)) return mats.get(color);
  const m = new T.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts });
  if (plain) mats.set(color, m);
  return m;
}
// a fresh material (for things whose colour or glow changes at run time)
export const ownMat = (color, opts = {}) => new T.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts });

// A box with rounded edges: the key art has no sharp corners anywhere.
const rbCache = new Map();
export function roundedBox(sx, sy, sz, r = Math.min(0.06, Math.min(sx, sy, sz) * 0.3), seg = Math.min(sx, sy, sz) < 0.12 ? 1 : 2) {
  r = Math.min(r, Math.min(sx, sy, sz) * 0.49);
  const key = [sx, sy, sz, r, seg].map((v) => v.toFixed(3)).join();
  if (rbCache.has(key)) return rbCache.get(key);
  const n = seg * 2 + 1, geo = new T.BoxGeometry(1, 1, 1, n, n, n);
  const pos = geo.attributes.position, nor = geo.attributes.normal, half = [sx / 2, sy / 2, sz / 2];
  const v = [0, 0, 0], d = [0, 0, 0], p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    v[0] = pos.getX(i); v[1] = pos.getY(i); v[2] = pos.getZ(i);
    for (let a = 0; a < 3; a++) {
      const t = v[a] * 2, s = Math.sign(t) || 1, at = Math.abs(t), mid = 1 / n;
      if (at <= mid + 1e-6) { p[a] = (t / mid) * (half[a] - r) * (1 / 1); d[a] = 0; if (at < mid - 1e-6) p[a] = (t / mid) * (half[a] - r); }
      else { const u = (at - mid) / (1 - mid); p[a] = s * (half[a] - r); d[a] = s * u; }
    }
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    for (let a = 0; a < 3; a++) { d[a] /= L; p[a] += d[a] * r; }
    pos.setXYZ(i, p[0], p[1], p[2]); nor.setXYZ(i, d[0], d[1], d[2]);
  }
  geo.computeBoundingSphere(); rbCache.set(key, geo);
  return geo;
}

export function box(parent, x, y, z, sx, sy, sz, color, shadow = true, r) {
  const m = new T.Mesh(roundedBox(sx, sy, sz, r), mat(color));
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}

export function label(text, opts = {}) {
  const c = document.createElement('canvas');
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: opts.depthTest ?? true }));
  s.userData.canvas = c; s.userData.opts = opts; setLabel(s, text); return s;
}

export function setLabel(s, text) {
  if (s.userData.text === text) return;
  s.userData.text = text;
  const o = s.userData.opts, c = s.userData.canvas, g = c.getContext('2d');
  const px = 64, font = `700 ${px}px Fredoka, "Trebuchet MS", sans-serif`, lh = px * 1.12;
  g.font = font;
  // long bubbles (free speech) wrap onto a few lines
  const lines = [];
  if (o.bubble && text && text.length > 26) {
    let cur = '';
    for (const w of text.split(' ')) { if (cur && (cur + ' ' + w).length > 24) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    if (cur) lines.push(cur);
  } else lines.push(text || ' ');
  const w = Math.max(8, ...lines.map((l) => Math.ceil(g.measureText(l).width))) + 48;
  const H = Math.round(lh * lines.length + 40 - (lh - px));
  const resized = c.width !== w || c.height !== H;
  c.width = w; c.height = H;
  // a texture cannot change size once it is on the graphics card: a new size needs a new texture
  if (resized && s.userData.drawn) { const old = s.material.map; s.material.map = new T.CanvasTexture(c); s.material.map.colorSpace = old.colorSpace; old.dispose(); }
  s.userData.drawn = 1;
  g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center';
  if (o.bubble && text) {
    g.fillStyle = '#fff7ea'; g.strokeStyle = '#33201a'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(4, 4, w - 8, H - 8, 26); g.fill(); g.stroke();
  }
  lines.forEach((l, i) => {
    const y = 20 + px / 2 + 4 + i * lh;
    if (o.outline) { g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = o.outline; g.strokeText(l, w / 2, y); }
    g.fillStyle = o.color || '#33201a'; g.fillText(l, w / 2, y);
  });
  s.material.map.needsUpdate = true;
  const h = (o.size || 0.5) * (H / (px + 40));
  s.scale.set((h * w) / H, h, 1); s.userData.base = [(h * w) / H, h];
  s.center.set(0.5, 0.5 * (px + 40) / H);            // grows upwards: the bottom stays where a one-line bubble's would be
  s.visible = !!text;
}

// speech bubbles keep about the same size on screen however near or far the camera is
const _bp = new T.Vector3();
export function fitBubble(s, cam, ref = 5) {
  if (!s.visible || !s.userData.base) return;
  const d = cam.position.distanceTo(s.getWorldPosition(_bp)), k = Math.max(0.45, Math.min(1.6, d / ref));
  s.scale.set(s.userData.base[0] * k, s.userData.base[1] * k, 1);
}

// ---------- little builders for the look of the key art ----------
// things that give off light are brighter than white, so the glow pass picks them up
const glows = new Map();
export function glowMat(hex, k, opts = {}) { const key = hex + '/' + k + JSON.stringify(opts); if (!glows.has(key)) { const m = new T.MeshBasicMaterial({ color: hex, ...opts }); m.color.multiplyScalar(k); glows.set(key, m); } return glows.get(key); }
export function shade(hex, f) { const c = new T.Color(hex); c.multiplyScalar(f); return c.getHex(); }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
function texFlat(g, x, z, sx, sz, tex, tile, y) {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(sx / tile, sz / tile);
  const m = new T.Mesh(new T.PlaneGeometry(sx, sz), mat(0xffffff, { map: t })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m;
}
const stripeCache = new Map();
function stripeTex(col) {                // awning stripes: colour and cream
  if (stripeCache.has(col)) return stripeCache.get(col);
  const hex = '#' + new T.Color(col).getHexString();
  const t = canvasTex(140, 8, (c) => { for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#fff3e2' : hex; c.fillRect(i * 20, 0, 20, 8); } });
  stripeCache.set(col, t); return t;
}
let tileTex = null;
function roofTex() {                     // rows of rounded clay tiles
  if (!tileTex) tileTex = canvasTex(128, 128, (c) => {
    c.fillStyle = '#9c4a33'; c.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
      c.fillStyle = `hsl(14, 52%, ${44 + ((x + y * 3) % 4) * 2.5}%)`;
      c.beginPath(); c.roundRect(x * 26 - (y % 2) * 13 + 1, y * 32 + 2, 24, 30, [2, 2, 12, 12]); c.fill();
    }
  });
  return tileTex;
}
const FLOWERS = [0xf4c542, 0xe8604a, 0xf29ab0, 0xfff3e2];
function flowerBox(g, x, y, z) {
  box(g, x, y, z, 0.62, 0.17, 0.2, PAL.terracotta, true, 0.04);
  for (let k = 0; k < 5; k++) {
    const b = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), mat(PAL.leaf)); b.position.set(x - 0.24 + k * 0.12, y + 0.1, z); g.add(b);
    const f = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), mat(FLOWERS[(k + Math.round(x * 3)) % 4])); f.position.set(x - 0.24 + k * 0.12, y + 0.17, z + 0.04); g.add(f);
  }
}
// a pitched clay-tile roof over a building, ridge along the street, with gable ends and a chimney
function gable(g, w, color, chimney = true) {
  const sx = w.x1 - w.x0, sz = w.z1 - w.z0, cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, rh = Math.min(1.7, sz * 0.32);
  const shape = new T.Shape([new T.Vector2(-sz / 2, 0), new T.Vector2(sz / 2, 0), new T.Vector2(0, rh)]);
  const geo = new T.ExtrudeGeometry(shape, { depth: sx, bevelEnabled: false }); geo.rotateY(Math.PI / 2); geo.translate(-sx / 2, 0, 0);
  const end = new T.Mesh(geo, mat(color)); end.position.set(cx, w.h, cz); end.castShadow = true; g.add(end);
  const ang = Math.atan2(rh, sz / 2), len = Math.hypot(sz / 2, rh) + 0.35;
  for (const sd of [-1, 1]) {
    const t = roofTex().clone(); t.needsUpdate = true; t.repeat.set(sx / 0.62, len / 0.62);
    const slab = new T.Mesh(roundedBox(sx + 0.4, 0.12, len, 0.05), mat(0xffffff, { map: t }));
    slab.position.set(cx, w.h + rh / 2 + 0.06, cz + sd * (sz / 4 + 0.08)); slab.rotation.x = sd * ang; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  }
  box(g, cx, w.h + rh + 0.05, cz, sx + 0.45, 0.14, 0.2, 0x8a3f2c, true, 0.06);          // ridge
  if (chimney) {
    const chx = w.x0 + sx * 0.72, chz = cz + sz * 0.18;
    box(g, chx, w.h + rh * 0.62 + 0.45, chz, 0.5, 1.0, 0.5, 0xb85c40, true, 0.05);
    box(g, chx, w.h + rh * 0.62 + 0.98, chz, 0.62, 0.1, 0.62, 0x8a3f2c, true, 0.04);
  }
}
// where the trees stand: cameras keep out of their leaves
export const TREES = [[-11, 2.6, 1], [11, -2.2, 1.05], [10.6, 2.8, 0.95], [-3.9, -3.0, 0.8]];
// does the line from a to b pass through a tree's leaves (or a lamp)?
export function leafy(ax, az, bx, bz, r = 1.25) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
  for (const [x, z, sc] of TREES) {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < r * sc) return true;
  }
  return false;
}
// a fluffy round tree, several soft balls of leaves
function tree(g, x, z, s = 1) {
  const tr = new T.Mesh(new T.CylinderGeometry(0.1 * s, 0.17 * s, 1.6 * s, 10), mat(0x8a5a3a)); tr.position.set(x, 0.8 * s, z); tr.castShadow = true; g.add(tr);
  for (const [dx, dy, dz, r, c] of [[0, 2.15, 0, 0.82, 0x86ad55], [-0.5, 1.8, 0.15, 0.58, 0x7a9f4c], [0.52, 1.85, -0.1, 0.6, 0x8fb65c], [0.1, 2.65, 0.1, 0.55, 0x96bd63], [0.05, 1.75, 0.5, 0.5, 0x82a851]]) {
    const b = new T.Mesh(new T.SphereGeometry(r * s, 16, 12), mat(c)); b.position.set(x + dx * s, dy * s, z + dz * s); b.castShadow = true; b.receiveShadow = true; g.add(b);
  }
}
// a small house at the far end of the street
function house(g, x, z, w, h, d, color, face) {
  const W = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h };
  box(g, x, h / 2, z, w, h, d, color, true, 0.06);
  gable(g, W, color, true);
  const fz = z + face * (d / 2 + 0.03);
  for (const [dx, dy] of [[-w * 0.25, h * 0.68], [w * 0.25, h * 0.68], [-w * 0.25, h * 0.3]]) {
    box(g, x + dx, dy, fz, 0.6, 0.72, 0.06, PAL.cream, false, 0.03);
    const gl = new T.Mesh(new T.PlaneGeometry(0.46, 0.58), (dy < h / 2 ? glowMat(PAL.glow, 1.7) : mat(0x9fc2c4))); gl.position.set(x + dx, dy, fz + face * 0.035); if (face < 0) gl.rotation.y = Math.PI; g.add(gl);
  }
  box(g, x + w * 0.25, 0.9, fz, 0.8, 1.8, 0.08, shade(color, 0.6), false, 0.04);
}

// A terracotta pot with a round bush: decoration only, tucked against the walls.
function plant(g, x, z, s = 1) {
  const pot = new T.Mesh(new T.CylinderGeometry(0.26 * s, 0.2 * s, 0.4 * s, 12), mat(PAL.pot)); pot.position.set(x, 0.2 * s, z); pot.castShadow = true; g.add(pot);
  for (const [dx, dy, r] of [[0, 0.62, 0.3], [-0.16, 0.5, 0.22], [0.17, 0.52, 0.2]]) {
    const b = new T.Mesh(new T.SphereGeometry(r * s, 10, 8), mat(PAL.leaf)); b.position.set(x + dx * s, dy * s, z); b.castShadow = true; g.add(b);
  }
}

// Static town pieces that share a material are baked into one mesh: hundreds of small parts become a few dozen draws.
function mergeStatic(g, keep) {
  g.updateMatrixWorld(true);
  const groups = new Map(), drop = [];
  g.traverse((o) => {
    if (!o.isMesh || keep.has(o) || o.isInstancedMesh || o.layers.mask !== 1 || o.material.transparent) return;
    for (let p = o.parent; p && p !== g; p = p.parent) if (keep.has(p)) return;
    const k = o.material.uuid + (o.castShadow ? 's' : '') + (o.receiveShadow ? 'r' : '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const parts = list.map((o) => { let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); return geo; });
    if (!parts.every((p) => p.attributes.uv && p.attributes.normal)) continue;
    const n = parts.reduce((a, p) => a + p.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let at = 0;
    for (const p of parts) { pos.set(p.attributes.position.array, at * 3); nor.set(p.attributes.normal.array, at * 3); uv.set(p.attributes.uv.array, at * 2); at += p.attributes.position.count; }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const m = new T.Mesh(geo, list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
    g.add(m); drop.push(...list);
  }
  for (const o of drop) o.parent.remove(o);
}

// the examiner's little open-top car: the coat stands up in the driver's seat
function buildCar() {
  const c = new T.Group(); c.visible = false;
  const red = mat(0xd8553e), cream = mat(0xfff3e2), dark = mat(0x2a2220);
  const body = new T.Mesh(roundedBox(1.45, 0.5, 2.6, 0.2), red); body.position.y = 0.45; body.castShadow = true; c.add(body);
  const hood = new T.Mesh(roundedBox(1.35, 0.25, 0.9, 0.12), red); hood.position.set(0, 0.75, 0.85); hood.castShadow = true; c.add(hood);
  const tail = new T.Mesh(roundedBox(1.35, 0.25, 0.6, 0.12), red); tail.position.set(0, 0.75, -1.0); tail.castShadow = true; c.add(tail);
  for (const sd of [-1, 1]) { const door = new T.Mesh(roundedBox(0.1, 0.32, 1.0, 0.04), red); door.position.set(sd * 0.68, 0.82, -0.05); c.add(door); }
  const screen = new T.Mesh(roundedBox(1.25, 0.32, 0.04, 0.02), new T.MeshStandardMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.5, roughness: 0.2 })); screen.position.set(0, 1.05, 0.38); screen.rotation.x = -0.3; c.add(screen);
  for (const [x, z] of [[-0.68, 0.85], [0.68, 0.85], [-0.68, -0.85], [0.68, -0.85]]) {
    const w = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.22, 18), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.27, z); w.castShadow = true; c.add(w);
    const hub = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.24, 12), cream); hub.rotation.z = Math.PI / 2; hub.position.set(x, 0.27, z); c.add(hub);
  }
  for (const sd of [-1, 1]) { const l = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), glowMat(0xfff3c0, 1.6)); l.position.set(sd * 0.45, 0.62, 1.31); c.add(l);
    const mir = new T.Mesh(roundedBox(0.16, 0.1, 0.04, 0.02), cream); mir.position.set(sd * 0.82, 1.0, 0.3); c.add(mir); }
  const L = label('L', { size: 0.32, color: '#d8553e', bubble: true }); L.position.set(0, 0.95, 1.36); c.add(L);
  const seat = new T.Mesh(roundedBox(0.6, 0.6, 0.15, 0.06), mat(0x5a3626)); seat.position.set(0.32, 0.85, -0.45); c.add(seat);
  const wheel = new T.Group(); wheel.position.set(-0.3, 1.0, 0.25); wheel.rotation.x = -0.9; c.add(wheel);
  const rim = new T.Mesh(new T.TorusGeometry(0.17, 0.025, 8, 22), dark); wheel.add(rim);
  const spoke = new T.Mesh(roundedBox(0.32, 0.03, 0.03, 0.01), dark); wheel.add(spoke);
  c.userData = { wheel, body: [body, hood, tail, screen] };
  // the key-art car model (Higgsfield image -> SAM 3 3D) replaces the simple shapes once it has loaded
  const buf = carGlb.buffer.slice(carGlb.byteOffset, carGlb.byteOffset + carGlb.byteLength);
  new GLTFLoader().parse(buf, '', (gl) => {
    let src = null; gl.scene.traverse((o) => { if (o.isMesh && !src) src = o; }); if (!src) return;
    const geo = src.geometry.clone(); smoothNormals(geo); geo.computeBoundingBox();
    const bb = geo.boundingBox, len = bb.max.x - bb.min.x, s = 2.75 / len;
    const m = new T.Mesh(geo, src.material); m.material.metalness = 0; m.material.roughness = 0.8;
    if (m.material.map) { m.material.map.colorSpace = T.SRGBColorSpace; m.material.map.generateMipmaps = false; m.material.map.minFilter = T.LinearFilter; m.material.map.needsUpdate = true; }
    m.scale.setScalar(s); m.rotation.y = Math.PI / 2;                     // the model's nose points along -x; ours along +z
    m.position.set(-(bb.min.z + bb.max.z) / 2 * s, -bb.min.y * s, (bb.min.x + bb.max.x) / 2 * s);
    m.castShadow = true; c.add(m);
    for (const o of [...c.children]) if (o !== m && !o.isSprite) o.visible = false;
    for (const o of c.children) if (o.isSprite) o.visible = false;
    c.userData.body = [m];
  }, () => {});
  return c;
}

export function buildTown(scene) {
  const g = new T.Group(); scene.add(g);
  const flat = (x, z, sx, sz, color, y = 0.01, layer = 0) => {
    const m = new T.Mesh(new T.PlaneGeometry(sx, sz), mat(color));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; m.layers.set(layer); g.add(m); return m;
  };
  const disc = (x, z, r, color, y, layer = 0, opacity = 1) => {
    const m = new T.Mesh(new T.CircleGeometry(r, 28), mat(color, { transparent: opacity < 1, opacity }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; m.layers.set(layer); g.add(m); return m;
  };

  flat(0, 1, 60, 50, PAL.ground, 0);
  // paving slabs on the pavement, small cobbles on the road, a chequered stone floor in the bank
  const pave = canvasTex(256, 256, (c) => {
    c.fillStyle = '#e9c9a2'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const l = 88 + ((x * 7 + y * 13) % 5) * 1.6; c.fillStyle = `hsl(32, 62%, ${l - 4}%)`;
      c.beginPath(); c.roundRect(x * 64 + 3 + (y % 2) * 0, y * 64 + 3, 58, 58, 8); c.fill();
    }
  });
  const cob = canvasTex(256, 256, (c) => {          // worn rectangular setts in rows, drawn wrapped so the tiles meet without seams
    c.fillStyle = '#8c6352'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = -1; x < 6; x++) {
      const l = 50 + ((x * 5 + y * 11 + 40) % 7) * 1.8, w = 34 + ((x * 3 + y + 3) % 3) * 2.5;
      c.fillStyle = `hsl(${16 + ((x + y) % 3) * 4}, 30%, ${l}%)`;
      for (const ox of [0, 256]) { c.beginPath(); c.roundRect(x * 256 / 6 + (y % 2) * 21 + 3 - ox, y * 32 + 3, w, 26, 9); c.fill(); }
    }
  });
  const floor = canvasTex(128, 128, (c) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { c.fillStyle = (x + y) % 2 ? '#e9d6b6' : '#d9bf98'; c.fillRect(x * 64, y * 64, 64, 64); } });
  texFlat(g, 0, 0.35, 24.8, 5.9, pave, 2, 0.005);
  texFlat(g, 0, 0.35, 24.8, 3.2, cob, 2.2, 0.01);
  for (const z of [-1.25, 1.95]) box(g, 0, 0.04, z, 24.8, 0.1, 0.16, 0xd8b48e, false, 0.04);       // kerbs
  texFlat(g, 0, 7.25, 7.7, 7.2, floor, 1.2, 0.012);              // bank floor
  flat(-7, -4.8, 3.7, 4.1, PAL.alley, 0.012);                    // the alley reads as "safe" to everyone

  for (const w of TOWN.walls) {
    if (w.kind === 'edge') continue;
    const sx = w.x1 - w.x0, sz = w.z1 - w.z0;
    box(g, (w.x0 + w.x1) / 2, w.h / 2, (w.z0 + w.z1) / 2, sx, w.h, sz, w.color);
    if (w.kind === 'shop') {
      const front = w.z0 > 0 ? w.z0 : w.z1, dir = w.z0 > 0 ? -1 : 1, cx = (w.x0 + w.x1) / 2;
      const trim = shade(w.color, 0.82), awn = [PAL.terracotta, PAL.teal, PAL.mustard];
      box(g, cx, 0.22, front + dir * 0.05, sx + 0.06, 0.44, 0.12, trim, false, 0.04);                        // plinth
      box(g, cx, w.h - 0.12, front + dir * 0.1, sx + 0.2, 0.24, 0.24, PAL.cream, false, 0.06);                 // cornice
      box(g, cx, 1.95, front + dir * 0.06, sx + 0.04, 0.12, 0.14, trim, false, 0.04);                         // string course between the floors
      let i = 0;
      for (let x = w.x0 + 1.4; x < w.x1 - 1; x += 3.2, i++) {
        // shop window with warm light inside, a striped awning with a scalloped edge
        box(g, x, 1.1, front + dir * 0.03, 1.8, 1.55, 0.1, PAL.frame, false, 0.04);
        const glass = new T.Mesh(new T.PlaneGeometry(1.5, 1.25), glowMat(PAL.glow, 1.6)); glass.position.set(x, 1.1, front + dir * 0.085); if (dir < 0) glass.rotation.y = Math.PI; g.add(glass);
        box(g, x, 1.1, front + dir * 0.1, 0.06, 1.25, 0.03, PAL.frame, false, 0.01); box(g, x, 1.3, front + dir * 0.1, 1.5, 0.06, 0.03, PAL.frame, false, 0.01);
        box(g, x, 0.32, front + dir * 0.13, 1.95, 0.08, 0.22, PAL.cream, false, 0.03);                          // sill
        const col = awn[(i + Math.round(w.x0)) % 3 + 0] ?? PAL.teal;
        const a = new T.Mesh(roundedBox(2.1, 0.06, 1.0, 0.03), mat(0xffffff, { map: stripeTex(col) }));
        a.position.set(x, 2.2, front + dir * 0.48); a.rotation.x = dir * 0.38; a.castShadow = true; g.add(a);
        for (let k = 0; k < 7; k++) {
          const sc = new T.Mesh(new T.CircleGeometry(0.15, 12, Math.PI, Math.PI), mat(k % 2 ? 0xfff3e2 : col, { side: T.DoubleSide }));
          sc.position.set(x - 0.9 + k * 0.3, 2.03, front + dir * 0.955); if (dir < 0) sc.rotation.y = Math.PI; g.add(sc);
        }
        // upstairs: two small windows with shutters, and a flower box
        for (const dx of [-0.7, 0.7]) {
          const ux = x + dx;
          box(g, ux, 2.75, front + dir * 0.03, 0.62, 0.78, 0.08, PAL.cream, false, 0.03);
          const ug = new T.Mesh(new T.PlaneGeometry(0.48, 0.64), mat(0x7fa6a8)); ug.position.set(ux, 2.75, front + dir * 0.075); if (dir < 0) ug.rotation.y = Math.PI; g.add(ug);
          box(g, ux, 2.75, front + dir * 0.09, 0.04, 0.64, 0.02, PAL.cream, false, 0.01);
          for (const sd of [-1, 1]) box(g, ux + sd * 0.42, 2.75, front + dir * 0.06, 0.2, 0.78, 0.05, PAL.frame, false, 0.02);
          if ((i + (dx > 0 ? 1 : 0)) % 2 === 0 && w.h > 3.2) flowerBox(g, ux, 2.3, front + dir * 0.18);
        }
        // a door between the windows
        if (x + 1.6 < w.x1 - 0.6) {
          box(g, x + 1.6, 1.0, front + dir * 0.04, 0.95, 2.0, 0.1, PAL.cream, false, 0.04);
          box(g, x + 1.6, 0.95, front + dir * 0.08, 0.78, 1.85, 0.06, shade(awn[(i + 1) % 3], 0.9), false, 0.04);
          const kn = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), mat(PAL.coin)); kn.position.set(x + 1.85, 0.95, front + dir * 0.13); g.add(kn);
          box(g, x + 1.6, 0.04, front + dir * 0.25, 1.05, 0.08, 0.35, PAL.stone, false, 0.03);
        }
        if (i % 2 === 1) plant(g, x - 1.25, front + dir * 0.45);
      }
      gable(g, w, w.color);
    }
  }
  // bank dressing: cream stone, columns, a sign plaque, an open wooden door with warm light inside
  box(g, 0, 3.3, 3.5, 8.9, 0.6, 0.6, PAL.stone);
  box(g, 0, 3.75, 3.5, 6.5, 0.35, 0.5, PAL.stone);
  box(g, 0, 2.75, 3.5, 2.2, 0.5, 0.3, PAL.cream);
  box(g, 0, 3.32, 3.17, 2.7, 0.62, 0.08, PAL.pave, false); box(g, 0, 3.32, 3.14, 2.5, 0.46, 0.06, PAL.white, false);
  for (const x of [-1.45, 1.45, -3.7, 3.7]) {
    const col = new T.Mesh(new T.CylinderGeometry(0.2, 0.22, 3, 14), mat(PAL.stone)); col.position.set(x, 1.5, 3.2); col.castShadow = true; g.add(col);
    box(g, x, 0.08, 3.2, 0.56, 0.16, 0.56, PAL.stone); box(g, x, 2.95, 3.2, 0.56, 0.14, 0.56, PAL.stone);
  }
  // a triangular pediment with a gold coin emblem, wide stone steps and flower beds, like a proper town bank
  const tri = (w, h, d, color, y, z) => {
    const geo = new T.ExtrudeGeometry(new T.Shape([new T.Vector2(-w / 2, 0), new T.Vector2(w / 2, 0), new T.Vector2(0, h)]), { depth: d, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    geo.translate(0, 0, -d / 2); const m = new T.Mesh(geo, mat(color)); m.position.set(0, y, z); m.castShadow = true; g.add(m); return m;
  };
  tri(7.0, 1.05, 0.5, PAL.stone, 3.93, 3.5); tri(5.6, 0.72, 0.1, 0xe8d3b0, 4.02, 3.22);
  const emb = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.06, 24), mat(PAL.coin, { metalness: 0.3, roughness: 0.45 })); emb.rotation.x = Math.PI / 2; emb.position.set(0, 4.3, 3.04); g.add(emb);
  for (let k = 0; k < 3; k++) box(g, 0, 0.03 + k * 0.0, 3.05 - k * 0.32, 3.6 - k * 0.0 + k * 0.4, 0.06 + (2 - k) * 0.03, 0.34, PAL.stone, false, 0.03);
  for (const x of [-2.6, 2.6]) { box(g, x, 0.18, 2.95, 1.5, 0.36, 0.45, PAL.stone, true, 0.05); for (let k = 0; k < 6; k++) { const f = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), mat(k % 2 ? PAL.leaf : 0xf4c542)); f.position.set(x - 0.6 + k * 0.24, 0.42, 2.95 + (k % 2) * 0.08 - 0.04); g.add(f); } }
  const door = box(g, -1.02, 1.25, 2.95, 0.08, 2.5, 0.95, PAL.wood); door.rotation.y = 0.25;
  const knob = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), mat(PAL.coin)); knob.position.set(-1.13, 1.2, 2.6); g.add(knob);
  const warm = new T.PointLight(PAL.glow, 6, 9, 1.6); warm.position.set(0, 2.4, 5.2); g.add(warm);
  for (const x of [0, -2.4, 2.4]) {            // hanging lamps inside
    box(g, x, 2.75, 6.6, 0.03, 0.5, 0.03, PAL.lamp, false);
    const sh = new T.Mesh(new T.ConeGeometry(0.26, 0.22, 12, 1, true), glowMat(PAL.glow, 2.6, { side: T.DoubleSide })); sh.position.set(x, 2.42, 6.6); g.add(sh);
  }
  plant(g, 3.25, 2.9, 1.25); plant(g, -3.25, 2.9, 1.1);
  // the word on the plaque is flat on the wall (only the head can read it)
  const word = label('BANK', { size: 0.7, color: '#5a3626' });
  const sign = new T.Mesh(new T.PlaneGeometry(1.5, 0.48), new T.MeshBasicMaterial({ map: word.material.map, transparent: true }));
  sign.rotation.y = Math.PI; sign.position.set(0, 3.31, 3.1); sign.layers.set(LAYER.HEAD); g.add(sign);
  const qs = label('QUEUE HERE', { size: 0.32, bubble: true }); qs.position.set(0, 2.3, 6.3); qs.layers.set(LAYER.HEAD); g.add(qs);
  const cs = label('CORNER', { size: 0.3, bubble: true }); cs.position.set(8.5, 3.0, 0.2); cs.layers.set(LAYER.HEAD); g.add(cs);
  const al = label('ALLEY', { size: 0.4, bubble: true }); al.position.set(-8.4, 3.2, -2.6); al.layers.set(LAYER.HEAD); g.add(al);
  box(g, 8.5, 1.3, 1.6, 0.1, 2.6, 0.1, PAL.lamp);
  // paper, signature line
  const paper = new T.Group(); g.add(paper);
  box(paper, -0.05, 1.005, 8.45, 0.7, 0.01, 0.32, PAL.white, false);
  box(paper, -0.05, 1.012, 8.45, 0.5, 0.004, 0.012, PAL.coat, false);
  box(paper, TOWN.paper.hx, 1.013, TOWN.paper.hz, 0.12, 0.003, 0.08, 0xe7d3b3, false);   // a thumb mark where it is held
  // bench where caught kids sit
  box(g, TOWN.bench.x, 0.3, TOWN.bench.z - 0.35, 2.4, 0.12, 0.6, PAL.wood);
  box(g, TOWN.bench.x, 0.6, TOWN.bench.z - 0.62, 2.4, 0.5, 0.08, PAL.wood);
  // lamps
  for (const [x, z] of [[-9.5, 3.0], [-2.6, 3.0], [6.5, 3.0], [-1.5, -2.3], [9.5, -2.3]]) {     // black street lamps with a glowing lantern
    const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.08, 2.9, 8), mat(PAL.lamp)); post.position.set(x, 1.45, z); post.castShadow = true; g.add(post);
    box(g, x, 0.12, z, 0.3, 0.24, 0.3, PAL.lamp);
    const lantern = new T.Mesh(new T.CylinderGeometry(0.16, 0.11, 0.34, 6), glowMat(0xffe2a0, 3.2)); lantern.position.set(x, 3.05, z); g.add(lantern);
    const cap = new T.Mesh(new T.ConeGeometry(0.24, 0.18, 6), mat(PAL.lamp)); cap.position.set(x, 3.31, z); g.add(cap);
  }
  // round trees, a pigeon, and houses closing off both ends of the street
  for (const [x, z, sc] of TREES) tree(g, x, z, sc);
  const pig = new T.Group(); pig.position.set(-2.2, 0, -2.1); pig.rotation.y = 0.8; g.add(pig);
  const pb = new T.Mesh(new T.SphereGeometry(0.13, 10, 8), mat(0x9aa3ad)); pb.position.y = 0.16; pb.scale.set(1, 0.9, 1.4); pig.add(pb);
  const ph = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), mat(0x8a94a0)); ph.position.set(0, 0.3, 0.13); pig.add(ph);
  const pk = new T.Mesh(new T.ConeGeometry(0.025, 0.07, 6), mat(PAL.mustard)); pk.rotation.x = Math.PI / 2; pk.position.set(0, 0.29, 0.22); pig.add(pk);
  const hc = [0xe8a07a, 0xf2c46b, 0xf6e2c2, 0xe98f72, 0xf0b08a];
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const hx = side * (14.5 + (i % 2) * 2.2), hz = -7 + i * 4.2, hh = 3 + (i % 3) * 0.7;
    house(g, hx, hz, 3.2, hh, 3.6, hc[(i + (side > 0 ? 2 : 0)) % 5], 1);
  }
  // more houses closing the view past the ends of the street, getting hazier with distance
  for (let i = 0; i < 7; i++) house(g, -14 + i * 4.6, -15.5 - (i % 2) * 1.5, 3.6, 3.4 + (i % 3) * 0.8, 3.2, hc[i % 5], 1);
  for (let i = 0; i < 7; i++) house(g, -14 + i * 4.6, 16 + (i % 2) * 1.5, 3.6, 3.4 + (i % 3) * 0.8, 3.2, hc[(i + 2) % 5], -1);
  // things only the legs can see: they are flat on the floor
  disc(TOWN.queue.x, TOWN.queue.z, 0.6, PAL.teal, 0.02, LAYER.LEGS, 0.55);
  for (const s of [-0.16, 0.16]) disc(TOWN.queue.x + s, TOWN.queue.z, 0.11, PAL.white, 0.025, LAYER.LEGS);
  disc(TOWN.wet.x, TOWN.wet.z, TOWN.wet.r, PAL.wet, 0.02, LAYER.LEGS, 0.7);
  {   // a yellow "wet floor" A-frame sign, so everyone watching can see the slippery patch
    const sign = new T.Group(), y = mat(0xf4c542);
    for (const sd of [-1, 1]) { const b = new T.Mesh(new T.BoxGeometry(0.36, 0.62, 0.025), y); b.position.set(0, 0.3, sd * 0.09); b.rotation.x = sd * 0.28; b.castShadow = true; sign.add(b); }
    const word = label('WET!', { size: 0.13, color: '#33201a' }); word.position.set(0, 0.36, -0.15); sign.add(word);
    sign.position.set(TOWN.wet.x + 0.85, 0, TOWN.wet.z - 0.35); sign.rotation.y = 0.5; g.add(sign);
  }
  disc(TOWN.exit.x, TOWN.exit.z, TOWN.exit.r, PAL.teal, 0.02, LAYER.LEGS, 0.5);
  disc(TOWN.counterSpot.x, TOWN.counterSpot.z, 0.35, PAL.mustard, 0.02, LAYER.LEGS, 0.6);

  const coins = TOWN.coins.map((c) => {
    const m = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.03, 14), mat(PAL.coin));
    m.position.set(c.x, 0.03, c.z); m.layers.set(LAYER.LEGS); g.add(m); return m;
  });
  const kc = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.03, 14), mat(PAL.coin));
  kc.position.set(TOWN.kidCoin.x, 0.03, TOWN.kidCoin.z); g.add(kc); coins.push(kc);

  const propColors = [PAL.teal, PAL.wood, 0x7a8fa0, PAL.mustard, PAL.mustard, PAL.terracotta];
  const props = TOWN.props.map((p, i) => {
    const h = p.name === 'crates' ? 1.0 : p.name === 'rope post' ? 0.95 : 0.6;
    const pivot = new T.Group(); pivot.position.set(p.x, 0, p.z); g.add(pivot);
    const geo = p.name === 'crates' ? new T.BoxGeometry(0.8, h, 0.8)
      : p.name === 'traffic cone' ? new T.ConeGeometry(p.r, h, 12) : new T.CylinderGeometry(p.r, p.r * 0.85, h, 14);
    const m = new T.Mesh(geo, mat(propColors[i])); m.position.y = h / 2; m.castShadow = true; pivot.add(m);
    return pivot;
  });
  // things the hands can carry, one mesh per kind (the errand decides which are out)
  const items = {
    cash: (() => { const m = new T.Mesh(new T.SphereGeometry(0.15, 16, 12), ownMat(PAL.bag)); m.scale.set(1, 1.05, 0.95);
      const tie = new T.Mesh(new T.ConeGeometry(0.07, 0.12, 8), mat(PAL.bag)); tie.position.y = 0.17; tie.rotation.x = Math.PI; m.add(tie);
      const knot = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.03, 8), mat(PAL.mustard)); knot.position.y = 0.13; m.add(knot); return m; })(),
    milk: (() => { const m = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.24, 14), ownMat(0xfff7ea));
      const cap = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.05, 12), mat(0x4f9fc9)); cap.position.y = 0.14; m.add(cap);
      const lab = new T.Mesh(new T.CylinderGeometry(0.082, 0.082, 0.08, 14), mat(0x4f9fc9)); m.add(lab); return m; })(),
    popcorn: (() => { const m = new T.Mesh(new T.CylinderGeometry(0.12, 0.085, 0.24, 14, 1, false), ownMat(0xfff3e2, { map: stripeTex(0xd8553e) }));
      for (let k = 0; k < 9; k++) { const c = new T.Mesh(new T.SphereGeometry(0.045, 6, 5), mat(0xfff0b0)); c.position.set(Math.cos(k * 2.4) * 0.07 * (k % 3) / 2, 0.13 + (k % 2) * 0.03, Math.sin(k * 2.4) * 0.07 * (k % 3) / 2); m.add(c); }
      return m; })(),
    drink: (() => { const m = new T.Mesh(new T.CylinderGeometry(0.075, 0.06, 0.22, 14), ownMat(0x4f8a8b));
      const lid = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.02, 14), mat(0xfff3e2)); lid.position.y = 0.11; m.add(lid);
      const straw = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.16, 6), mat(0xd8553e)); straw.position.set(0.02, 0.18, 0); straw.rotation.z = 0.2; m.add(straw); return m; })(),
  };
  for (const m of Object.values(items)) { m.castShadow = true; m.visible = false; g.add(m); }
  // Mabel's stall: a striped canopy over a wooden counter with milk crates
  box(g, -8.3, 0.5, 2.75, 1.6, 1.0, 0.4, PAL.wood, true, 0.05);
  for (const x of [-9.0, -7.6]) box(g, x, 1.35, 2.95, 0.08, 1.7, 0.08, PAL.wood, true, 0.03);
  { const a = new T.Mesh(roundedBox(1.9, 0.06, 0.9, 0.03), mat(0xffffff, { map: stripeTex(0x4f8a8b) })); a.position.set(-8.3, 2.2, 2.8); a.rotation.x = -0.25; a.castShadow = true; g.add(a); }
  const stallSign = label('MABEL\'S', { size: 0.28, bubble: true }); stallSign.position.set(-8.3, 2.55, 2.65); g.add(stallSign);
  // the snack cart in front of the cinema
  box(g, 2.37, 0.5, -3.75, 1.75, 1.0, 0.4, 0xc9694a, true, 0.05);
  for (const x of [1.7, 3.0]) { const w = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.06, 14), mat(0x2a2220)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.16, -3.52); g.add(w); }
  { const a = new T.Mesh(roundedBox(1.9, 0.06, 0.8, 0.03), mat(0xffffff, { map: stripeTex(0xd8553e) })); a.position.set(2.37, 2.0, -3.7); a.rotation.x = 0.2; a.castShadow = true; g.add(a); }
  for (const x of [1.55, 3.2]) box(g, x, 1.25, -3.9, 0.07, 1.5, 0.07, 0x2a2220, true, 0.03);
  const snack = label('SNACKS', { size: 0.26, bubble: true }); snack.position.set(2.37, 2.35, -3.6); g.add(snack);
  // the cinema: a marquee with bulbs over a double door, posters, and the usher's measuring board
  box(g, 9.2, 3.0, -4.05, 3.6, 0.8, 0.5, 0xb8423a, true, 0.08);
  const marq = label('PICTURE HOUSE', { size: 0.42, color: '#fff3c0' }); const mq = new T.Mesh(new T.PlaneGeometry(3.2, 0.5), new T.MeshBasicMaterial({ map: marq.material.map, transparent: true })); mq.position.set(9.2, 3.0, -3.79); g.add(mq);
  for (let k = 0; k < 12; k++) { const bl = new T.Mesh(new T.SphereGeometry(0.04, 6, 5), glowMat(0xffe2a0, 2.6)); bl.position.set(7.5 + k * 0.31, 3.42, -3.8); g.add(bl); }
  box(g, 9.2, 1.15, -4.17, 1.4, 2.3, 0.1, 0x6a2a24, false, 0.04);
  box(g, 9.2, 1.15, -4.12, 0.04, 2.2, 0.04, 0xe0a83a, false, 0.01);
  for (const x of [7.5, 10.9]) { box(g, x, 1.4, -4.15, 0.9, 1.3, 0.06, 0x2a2220, false, 0.03); box(g, x, 1.4, -4.11, 0.78, 1.16, 0.02, x < 9 ? 0x4f9fc9 : 0xe0a83a, false, 0.01); }
  { box(g, 10.0, 1.1, -3.9, 0.12, 2.2, 0.06, 0xfff3e2, true, 0.02);
    const line = new T.Mesh(roundedBox(0.4, 0.04, 0.04, 0.015), glowMat(0xd8553e, 1.4)); line.position.set(9.88, 2.05, -3.86); g.add(line);
    const tall = label('YOU MUST BE THIS TALL', { size: 0.2, bubble: true }); tall.position.set(10.0, 1.55, -3.7); g.add(tall); }
  // the driving test: cones, and markings only the legs can see (a stop line and a parking box)
  const cones = [[0.0, 1.05], [2.6, -0.35], [5.2, 1.05]].map(([x, z]) => {
    const pv = new T.Group(); pv.position.set(x, 0, z); g.add(pv);
    const c = new T.Mesh(new T.ConeGeometry(0.2, 0.5, 14), ownMat(0xf07a3a)); c.position.y = 0.27; c.castShadow = true; pv.add(c);
    const st = new T.Mesh(new T.CylinderGeometry(0.115, 0.135, 0.07, 14), mat(0xfff7ea)); st.position.y = 0.3; pv.add(st);
    const bs = new T.Mesh(roundedBox(0.42, 0.04, 0.42, 0.02), mat(0xf07a3a)); bs.position.y = 0.02; pv.add(bs);
    pv.visible = false; return pv;
  });
  const marks = new T.Group(); marks.visible = false; g.add(marks);
  { const ln = new T.Mesh(new T.PlaneGeometry(0.35, 3.2), new T.MeshBasicMaterial({ color: 0xfff7ea })); ln.rotation.x = -Math.PI / 2; ln.position.set(-3.1, 0.03, 0.35); ln.layers.set(LAYER.LEGS); marks.add(ln);
    for (const [x, z, w, d] of [[8.2, 0.35, 0.12, 1.8], [11.0, 0.35, 0.12, 1.8], [9.6, -0.55, 2.9, 0.12], [9.6, 1.25, 2.9, 0.12]]) {
      const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: 0xf4c542 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.layers.set(LAYER.LEGS); marks.add(m); }
    const P = label('P', { size: 0.9, color: '#f4c542' }); P.position.set(9.6, 0.5, 0.35); P.layers.set(LAYER.LEGS); marks.add(P); }
  const car = buildCar(); g.add(car);
  const dog = new T.Group(); g.add(dog);
  {  // a little sausage dog: round body, big head, floppy ears, stubby legs, a tail that sticks up
    const fur = mat(0xb0703c), dark = mat(0x7a4626);
    const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.x = rx; o.castShadow = true; dog.add(o); return o; };
    add(new T.CapsuleGeometry(0.12, 0.34, 4, 12), fur, 0, 0.24, 0, 1, 1, 1, Math.PI / 2);
    add(new T.SphereGeometry(0.13, 14, 10), fur, 0, 0.36, 0.3);
    add(new T.SphereGeometry(0.07, 10, 8), fur, 0, 0.33, 0.42, 1, 0.8, 1.1);
    add(new T.SphereGeometry(0.03, 8, 6), mat(0x2a1a14), 0, 0.35, 0.5);
    for (const sd of [-1, 1]) {
      add(new T.SphereGeometry(0.06, 10, 8), dark, sd * 0.11, 0.33, 0.27, 0.6, 1.4, 0.9);
      add(new T.SphereGeometry(0.025, 8, 6), mat(0x2a1a14), sd * 0.055, 0.4, 0.4);
      for (const z of [-0.16, 0.16]) add(new T.CylinderGeometry(0.035, 0.035, 0.14, 8), fur, sd * 0.07, 0.07, z);
    }
    add(new T.CapsuleGeometry(0.025, 0.14, 4, 8), fur, 0, 0.36, -0.28, 1, 1, 1, -0.6);
  }

  // ink: a small pool of dots laid down wherever the pen touches the paper
  const ink = new T.InstancedMesh(new T.BoxGeometry(0.014, 0.003, 0.014), new T.MeshBasicMaterial({ color: PAL.ink }), 300);
  ink.count = 0; g.add(ink);
  // aim help for the arms: a pulsing ring where the hand should go
  const ring = new T.Mesh(new T.RingGeometry(0.07, 0.1, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 5; g.add(ring);
  mergeStatic(g, new Set([...coins, ...props, ...Object.values(items), ...cones, marks, car, dog, ink, ring, paper]));
  return { group: g, coins, props, items, cones, marks, car, dog, ink, inkLast: null, ring, paper };
}

export function updateTown(view, Wd, dt, cue, part) {
  const signing = Wd.errand.id === 'bank' && Wd.errand.step === 2;
  const slide = signing && !Wd.errand.steady && Wd.errand.sign > 0.02;
  view.paper.position.set(slide ? Math.sin(Wd.time * 13) * 0.025 : 0, 0, slide ? Math.cos(Wd.time * 9) * 0.02 : 0);
  view.paper.rotation.y = slide ? Math.sin(Wd.time * 7) * 0.05 : 0;
  // the thing the hand can use lights up; green when it is in reach
  const lit = cue && cue.kind === 'grab' ? (cue.state === 'on' ? 0.9 : cue.state === 'near' || cue.state === 'other' ? 0.3 + Math.sin(Wd.time * 6) * 0.15 : 0) : 0;
  view.ring.visible = !!cue && cue.state !== 'far' && cue.state !== 'other';
  if (cue && cue.kind === 'hold') { cue = { ...cue }; }
  if (view.ring.visible) {
    view.ring.position.set(cue.x, cue.y + 0.02, cue.z); const sc = 1 + Math.sin(Wd.time * 7) * 0.18; view.ring.scale.set(sc, sc, sc);
    view.ring.material.color.setHex(cue.state === 'on' ? 0x8fe36a : 0xffd84a);
  }
  const m = Wd.coins;
  view.coins.forEach((c, i) => { c.visible = !(m & (1 << i)); c.rotation.y += dt * 2; });
  view.props.forEach((p, i) => {
    const tipped = Wd.props & (1 << i) ? 1 : 0;
    p.rotation.z += ((tipped ? 1.45 : 0) - p.rotation.z) * Math.min(1, dt * 9);
  });
  for (const [k, m] of Object.entries(view.items)) {
    const it = Wd.items.find((x) => x.kind === k);
    m.visible = !!it; if (!it) continue;
    m.position.set(it.x, it.y + (k === 'cash' ? 0 : 0.02), it.z);
    const near = cue && cue.kind === 'grab' && Math.hypot(cue.x - it.x, cue.z - it.z) < 0.05;
    m.material.emissive.setRGB(near ? lit * 0.9 : 0, near ? lit : 0, near ? lit * 0.4 : 0);
  }
  // the driving test: cones, markings and the car
  const drive = !!Wd.car;
  view.cones.forEach((c, i) => { c.visible = drive; const down = Wd.cones & (1 << i); c.rotation.z += ((down ? 1.5 : 0) - c.rotation.z) * Math.min(1, dt * 9); });
  view.marks.visible = drive; view.car.visible = drive;
  if (drive) {
    const c = Wd.car, cv = view.car;
    cv.position.set(c.x, 0, c.z); cv.rotation.y = c.yaw;
    cv.userData.wheel.rotation.z = -c.wheel * 1.6;
    for (const m of cv.userData.body) m.visible = part !== 'legs';           // the legs look out under the dashboard
  }
  const d = Wd.dog; view.dog.position.x += (d.x - view.dog.position.x) * Math.min(1, dt * 12);
  view.dog.position.z += (d.z - view.dog.position.z) * Math.min(1, dt * 12); view.dog.rotation.y = d.yaw;
  // signature
  if (signing && view.ink.count < 300) {
    for (const h of Wd.hands) {
      const P = TOWN.paper;
      if (Math.abs(h.y - P.y) < 0.09 && h.x < P.x0 + 0.12 && h.x > P.x1 - 0.12 && Math.abs(h.z - P.z) < 0.2) {
        const l = view.inkLast;
        if (!l || Math.hypot(l[0] - h.x, l[1] - h.z) > 0.012) {
          const mtx = new T.Matrix4().makeTranslation(h.x, P.y + 0.004, h.z);
          view.ink.setMatrixAt(view.ink.count++, mtx); view.ink.instanceMatrix.needsUpdate = true; view.inkLast = [h.x, h.z];
        }
      }
    }
  }
  if (!(Wd.errand.id === 'bank' && Wd.errand.step >= 2) && view.ink.count) { view.ink.count = 0; view.inkLast = null; }
}
