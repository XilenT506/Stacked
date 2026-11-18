// The hero, made from the key art: a 3D model lifted from a clean front view of the character
// (Higgsfield image -> SAM 3 3D). It is cut into the parts the game moves on its own:
// the three coat pieces (one per kid), the head with hat and collar, and the two hands with their cuffs.
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { T, CFG } from './config.js';
import glb from '../assets/hero/sam.glb';
import backJpg from '../assets/hero/back_tex.jpg';

export const HERO_S = 2.5;            // model height in metres (the model is 1 unit tall, centred on 0)
const NECK = 0.15;                     // above this (model units) is the head part: face, hat and collar
// each arm (sleeve, cuff and hand) is cut out along its own axis, from the shoulder to the wrist
export const SHOULDER = [0.16, 0.15], WRIST = [0.255, -0.08], HANDC = [0.25, -0.17];
function isArm(x, y) {
  const ax = Math.abs(x);
  if (ax < 0.135 || y > 0.2) return false;
  if (y < -0.03) return ax > 0.19;                                  // cuff and hand hang clear of the coat
  const dx = WRIST[0] - SHOULDER[0], dy = WRIST[1] - SHOULDER[1], L = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((ax - SHOULDER[0]) * dx + (y - SHOULDER[1]) * dy) / L));
  return Math.hypot(ax - (SHOULDER[0] + dx * t), y - (SHOULDER[1] + dy * t)) < 0.062;
}
// smooth shading: average the normals of every face that shares a corner position (the model splits corners at texture seams)
export function smoothNormals(geo) {
  const pos = geo.attributes.position, idx = geo.index, acc = new Map(), key = (i) => `${Math.round(pos.getX(i) * 2e4)},${Math.round(pos.getY(i) * 2e4)},${Math.round(pos.getZ(i) * 2e4)}`;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3();
  const tri = idx ? idx.count : pos.count, get = (k) => (idx ? idx.getX(k) : k);
  for (let t = 0; t < tri; t += 3) {
    const i0 = get(t), i1 = get(t + 1), i2 = get(t + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    n.subVectors(c, b).cross(a.sub(b));                                 // area-weighted
    for (const i of [i0, i1, i2]) { const k = key(i); const v = acc.get(k) || [0, 0, 0]; v[0] += n.x; v[1] += n.y; v[2] += n.z; acc.set(k, v); }
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const v = acc.get(key(i)); const l = Math.hypot(v[0], v[1], v[2]) || 1; out[i * 3] = v[0] / l; out[i * 3 + 1] = v[1] / l; out[i * 3 + 2] = v[2] / l; }
  geo.setAttribute('normal', new T.BufferAttribute(out, 3));
}

// load and cut; calls done(parts) with { seg: [geo x3], head: geo, hands: [geo x2], material, coatColor }
export function loadHero(done) {
  const buf = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
  new GLTFLoader().parse(buf, '', (g) => {
    let src = null; g.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    if (!src) return;
    const geo0 = src.geometry.clone(); smoothNormals(geo0);
    const geo = geo0.index ? geo0.toNonIndexed() : geo0;
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    const H = CFG.kidH, headO = 3 * H + 0.2;
    const buckets = { s0: [], s1: [], s2: [], head: [], h0: [], h1: [] };
    // The model was lifted from a front view only, so its back is guessed and looks torn. A matching back view
    // (assets/hero/back.png, same framing) is projected straight onto every triangle that faces away.
    const back = new Set(), BACK_SIGN = -1;
    for (let t = 0; t < pos.count; t += 3) {
      let nz = 0; for (let k = 0; k < 3; k++) nz += nor.getZ(t + k);
      if (nz * BACK_SIGN > 3 * 0.25) back.add(t);
    }
    for (let t = 0; t < pos.count; t += 3) {
      let cx = 0, cy = 0;
      for (let k = 0; k < 3; k++) { cx += pos.getX(t + k); cy += pos.getY(t + k); }
      cx /= 3; cy /= 3;
      let key;
      if (cy > NECK && Math.abs(cx) < 0.17) key = 'head';
      else if (isArm(cx, cy)) key = cx < 0 ? 'h0' : 'h1';
      else { const wy = (cy + 0.5) * HERO_S; key = 's' + Math.max(0, Math.min(2, Math.floor(wy / H))); }
      buckets[key].push(t);
    }
    // build one geometry per part, moved so each part's own pivot is at its origin
    // back view framing: the figure spans the whole cropped picture; x is mirrored (we look at its back)
    const BX = 855 - 178, BW = 1354, BS = 2219;
    const part = (list0, ox, oy, oz) => {
      const front = list0.filter((t) => !back.has(t)), behind = list0.filter((t) => back.has(t)), list = [...front, ...behind];
      const n = list.length * 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
      let w = 0;
      for (const t of list) for (let k = 0; k < 3; k++, w++) {
        const v = t + k, x = pos.getX(v), y = pos.getY(v);
        P[w * 3] = x * HERO_S - ox; P[w * 3 + 1] = (y + 0.5) * HERO_S - oy; P[w * 3 + 2] = pos.getZ(v) * HERO_S - oz;
        N[w * 3] = nor.getX(v); N[w * 3 + 1] = nor.getY(v); N[w * 3 + 2] = nor.getZ(v);
        if (back.has(t)) { U[w * 2] = (BX + BACK_SIGN * -x * BS) / BW; U[w * 2 + 1] = y + 0.5; }
        else if (uv) { U[w * 2] = uv.getX(v); U[w * 2 + 1] = uv.getY(v); }
      }
      const b = new T.BufferGeometry();
      b.setAttribute('position', new T.BufferAttribute(P, 3)); b.setAttribute('normal', new T.BufferAttribute(N, 3)); b.setAttribute('uv', new T.BufferAttribute(U, 2));
      b.addGroup(0, front.length * 3, 0); b.addGroup(front.length * 3, behind.length * 3, 1);
      b.computeBoundingSphere(); return b;
    };
    // the whole body in one piece (everything but the head), for the coat that bends and swings its arms without seams.
    // Each corner carries how much it belongs to each arm (armW: x = the +x arm, y = the -x arm), fading in from the shoulder.
    const bodyGeo = (() => {
      const all = [...buckets.s0, ...buckets.s1, ...buckets.s2];   // (the arms stay their own pieces: skinning them dragged the cloth into flaps)
      const g = part(all, 0, 0, 0), P = g.attributes.position, W = new Float32Array(P.count * 2);
      const dx = HANDC[0] - SHOULDER[0], dy = HANDC[1] - SHOULDER[1], L = Math.hypot(dx, dy);
      const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
      for (let v = 0; v < P.count; v++) {
        const x = P.getX(v) / HERO_S, y = P.getY(v) / HERO_S - 0.5, ax = Math.abs(x);
        const t = ((ax - SHOULDER[0]) * dx + (y - SHOULDER[1]) * dy) / (L * L);
        const off = Math.abs((ax - SHOULDER[0]) * dy - (y - SHOULDER[1]) * dx) / L;
        const w = 0; void t; void off; void ax; void sm;
        W[v * 2 + (x > 0 ? 0 : 1)] = w;
      }
      g.setAttribute('armW', new T.BufferAttribute(W, 2));
      return g;
    })();
    const sy = (SHOULDER[1] + 0.5) * HERO_S;
    const material = src.material.clone(); material.metalness = 0; material.roughness = 0.85;
    if (material.map) { material.map.colorSpace = T.SRGBColorSpace; material.map.generateMipmaps = false; material.map.minFilter = T.LinearFilter; material.map.needsUpdate = true; }   // no mipmaps: they bleed pale gaps at the texture seams
    const backTex = new T.TextureLoader().load(backJpg); backTex.colorSpace = T.SRGBColorSpace;
    const backMat = material.clone(); backMat.map = backTex; backMat.color.setRGB(0.66, 0.54, 0.42);   // the back picture is lighter and pinker than the model's own texture
    done({
      seg: [0, 1, 2].map((i) => part(buckets['s' + i], 0, i * H, 0)), body: bodyGeo,
      head: part(buckets.head, 0, headO, 0),
      // arms have their pivot at the shoulder; rest direction points from the shoulder to the middle of the hand
      hands: [part(buckets.h0, -SHOULDER[0] * HERO_S, sy, 0), part(buckets.h1, SHOULDER[0] * HERO_S, sy, 0)],
      armRest: [[-(HANDC[0] - SHOULDER[0]), HANDC[1] - SHOULDER[1]], [HANDC[0] - SHOULDER[0], HANDC[1] - SHOULDER[1]]].map(([x, y]) => new T.Vector3(x, y, 0).normalize()),
      armLen: Math.hypot(HANDC[0] - SHOULDER[0], HANDC[1] - SHOULDER[1]) * HERO_S,
      shoulderX: SHOULDER[0] * HERO_S, shoulderY: sy,
      material: [material, backMat], coatColor: 0x7b5a49,
    });
  }, (e) => console.warn('hero model did not load', e));
}
