// The trench-coat model from the old game (assets/hero/sam.glb, lifted from the key art), cut into
// the body (one piece, so it bends without seams), the head with hat and collar, and the two hands.
// Ported from legacy/js/hero.js. The model is HERO_S metres tall with its feet at y = 0, facing +z.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glb from '../../assets/hero/sam.glb';
import backJpg from '../../assets/hero/back_tex.jpg';

export const HERO_S = 2.5;
const NECK = 0.15;
export const SHOULDER = [0.16, 0.15], WRIST = [0.255, -0.08], HANDC = [0.25, -0.17];
export const HEAD_Y = 0.65 * HERO_S;   // where the head part pivots (just under the collar)

function isArm(x, y) {
  const ax = Math.abs(x);
  if (ax < 0.135 || y > 0.2) return false;
  if (y < -0.03) return ax > 0.19;
  const dx = WRIST[0] - SHOULDER[0], dy = WRIST[1] - SHOULDER[1], L = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((ax - SHOULDER[0]) * dx + (y - SHOULDER[1]) * dy) / L));
  return Math.hypot(ax - (SHOULDER[0] + dx * t), y - (SHOULDER[1] + dy * t)) < 0.062;
}

// smooth shading: average the normals of faces that share a corner (the model splits corners at texture seams)
function smoothNormals(geo) {
  const pos = geo.attributes.position, idx = geo.index, acc = new Map(), key = (i) => `${Math.round(pos.getX(i) * 2e4)},${Math.round(pos.getY(i) * 2e4)},${Math.round(pos.getZ(i) * 2e4)}`;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3();
  const tri = idx ? idx.count : pos.count, get = (k) => (idx ? idx.getX(k) : k);
  for (let t = 0; t < tri; t += 3) {
    const i0 = get(t), i1 = get(t + 1), i2 = get(t + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    n.subVectors(c, b).cross(a.sub(b));
    for (const i of [i0, i1, i2]) { const k = key(i); const v = acc.get(k) || [0, 0, 0]; v[0] += n.x; v[1] += n.y; v[2] += n.z; acc.set(k, v); }
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const v = acc.get(key(i)); const l = Math.hypot(v[0], v[1], v[2]) || 1; out[i * 3] = v[0] / l; out[i * 3 + 1] = v[1] / l; out[i * 3 + 2] = v[2] / l; }
  geo.setAttribute('normal', new T.BufferAttribute(out, 3));
}

let cached = null;
// resolves { body, head, hands: [+x hand, -x hand], material: [front, back], shoulder: [x, y] } (all geometry in metres)
export function loadHero() {
  if (cached) return cached;
  cached = new Promise((done, fail) => {
    const buf = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    new GLTFLoader().parse(buf, '', (g) => {
      let src = null; g.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      if (!src) return fail(new Error('no mesh in sam.glb'));
      const geo0 = src.geometry.clone(); smoothNormals(geo0);
      const geo = geo0.index ? geo0.toNonIndexed() : geo0;
      const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
      const buckets = { body: [], head: [], h0: [], h1: [] };
      // the model was lifted from a front view, so its back is guessed; a matching back picture is projected on
      const back = new Set();
      for (let t = 0; t < pos.count; t += 3) { let nz = 0; for (let k = 0; k < 3; k++) nz += nor.getZ(t + k); if (-nz > 0.75) back.add(t); }
      for (let t = 0; t < pos.count; t += 3) {
        let cx = 0, cy = 0; for (let k = 0; k < 3; k++) { cx += pos.getX(t + k); cy += pos.getY(t + k); }
        cx /= 3; cy /= 3;
        buckets[cy > NECK && Math.abs(cx) < 0.17 ? 'head' : isArm(cx, cy) ? (cx > 0 ? 'h0' : 'h1') : 'body'].push(t);
      }
      const BX = 855 - 178, BW = 1354, BS = 2219;
      const part = (list0, ox, oy) => {
        const front = list0.filter((t) => !back.has(t)), behind = list0.filter((t) => back.has(t)), list = [...front, ...behind];
        const n = list.length * 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
        let w = 0;
        for (const t of list) for (let k = 0; k < 3; k++, w++) {
          const v = t + k, x = pos.getX(v), y = pos.getY(v);
          P[w * 3] = x * HERO_S - ox; P[w * 3 + 1] = (y + 0.5) * HERO_S - oy; P[w * 3 + 2] = pos.getZ(v) * HERO_S;
          N[w * 3] = nor.getX(v); N[w * 3 + 1] = nor.getY(v); N[w * 3 + 2] = nor.getZ(v);
          if (back.has(t)) { U[w * 2] = (BX + x * BS) / BW; U[w * 2 + 1] = y + 0.5; }
          else if (uv) { U[w * 2] = uv.getX(v); U[w * 2 + 1] = uv.getY(v); }
        }
        const b = new T.BufferGeometry();
        b.setAttribute('position', new T.BufferAttribute(P, 3)); b.setAttribute('normal', new T.BufferAttribute(N, 3)); b.setAttribute('uv', new T.BufferAttribute(U, 2));
        b.addGroup(0, front.length * 3, 0); b.addGroup(front.length * 3, behind.length * 3, 1);
        b.computeBoundingSphere(); return b;
      };
      const body = part(buckets.body, 0, 0);
      body.setAttribute('armW', new T.BufferAttribute(new Float32Array(body.attributes.position.count * 2), 2));   // the bend shader expects it
      const sx = SHOULDER[0] * HERO_S, sy = (SHOULDER[1] + 0.5) * HERO_S;
      const material = src.material.clone(); material.metalness = 0; material.roughness = 0.85;
      if (material.map) { material.map.colorSpace = T.SRGBColorSpace; material.map.generateMipmaps = false; material.map.minFilter = T.LinearFilter; material.map.needsUpdate = true; }
      const backTex = new T.TextureLoader().load(backJpg); backTex.colorSpace = T.SRGBColorSpace;
      const backMat = material.clone(); backMat.map = backTex; backMat.color.setRGB(0.66, 0.54, 0.42);
      done({ body, head: part(buckets.head, 0, HEAD_Y), hands: [part(buckets.h0, sx, sy), part(buckets.h1, -sx, sy)], material: [material, backMat], shoulder: [sx, sy] });
    }, fail);
  });
  return cached;
}

// The one-piece bend from legacy/js/stack.js: the coat curves like a banana along a lean direction.
// uLean: lean direction in the coat's own frame (x, z); uTheta0: lean at the feet; uK: how much it curves per metre.
export const BEND = `uniform vec2 uLean; uniform float uTheta0; uniform float uK;
uniform mat3 uArm0; uniform mat3 uArm1; uniform vec3 uSh0; uniform vec3 uSh1; attribute vec2 armW;
vec3 armP(vec3 p) { vec3 a = mix(p, uArm0 * (p - uSh0) + uSh0, armW.x); return mix(a, uArm1 * (a - uSh1) + uSh1, armW.y); }
vec3 armN(vec3 n) { vec3 a = mix(n, uArm0 * n, armW.x); return normalize(mix(a, uArm1 * a, armW.y)); }
vec2 bendUV(float y) { float th = uTheta0 + uK * y;
  if (abs(uK) < 1e-3) return vec2(y * sin(uTheta0) + 0.5 * uK * y * y * cos(uTheta0), y * cos(uTheta0) - 0.5 * uK * y * y * sin(uTheta0));
  return vec2((cos(uTheta0) - cos(th)) / uK, (sin(th) - sin(uTheta0)) / uK); }
vec3 bendP(vec3 p) { float d = dot(p.xz, uLean); vec2 perp = p.xz - d * uLean; float th = uTheta0 + uK * p.y; vec2 uv = bendUV(p.y);
  float u = uv.x + d * cos(th), v = uv.y - d * sin(th); return vec3(perp.x + uLean.x * u, v, perp.y + uLean.y * u); }
vec3 bendN(vec3 n, vec3 p) { float th = uTheta0 + uK * p.y; float d = dot(n.xz, uLean); vec2 perp = n.xz - d * uLean;
  float nd = d * cos(th) + n.y * sin(th), ny = -d * sin(th) + n.y * cos(th); return vec3(perp.x + uLean.x * nd, ny, perp.y + uLean.y * nd); }
`;

export function bendUniforms(shoulder) {
  return { uLean: { value: new T.Vector2(0, 1) }, uTheta0: { value: 0 }, uK: { value: 0 },
    uArm0: { value: new T.Matrix3() }, uArm1: { value: new T.Matrix3() },
    uSh0: { value: new T.Vector3(shoulder[0], shoulder[1], 0) }, uSh1: { value: new T.Vector3(-shoulder[0], shoulder[1], 0) } };
}

export function bendMaterial(m, U, depth) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = BEND + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = bendP(armP(transformed));');
    if (!depth) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = bendN(armN(objectNormal), armP(position));');
  };
  m.customProgramCacheKey = () => 'bend' + (depth ? 'd' : '');
  return m;
}

// the same bend on the CPU, so the head and hands can ride on the curved coat. Returns [x, y, z] and the tilt angle.
export function bendPoint(p, lean, th0, k) {
  const d = p.x * lean.x + p.z * lean.y, px = p.x - d * lean.x, pz = p.z - d * lean.y, th = th0 + k * p.y;
  let u, v;
  if (Math.abs(k) < 1e-3) { u = p.y * Math.sin(th0) + 0.5 * k * p.y * p.y * Math.cos(th0); v = p.y * Math.cos(th0) - 0.5 * k * p.y * p.y * Math.sin(th0); }
  else { u = (Math.cos(th0) - Math.cos(th)) / k; v = (Math.sin(th) - Math.sin(th0)) / k; }
  u += d * Math.cos(th); v -= d * Math.sin(th);
  return { x: px + lean.x * u, y: v, z: pz + lean.y * u, th };
}
