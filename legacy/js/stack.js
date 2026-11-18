// The shared body: three kids in one coat. Walks, wobbles like a broom on a hand, falls and gets up.
import { T, PAL, CFG, E, GAIT, clamp, ease, fwd, rgt } from './config.js';
import { TOWN, collide, mat, roundedBox } from './town.js';
import { loadHero } from './hero.js';
import { stepCar } from './drive.js';

export function newBody() {
  return { x: TOWN.start.x, z: TOWN.start.z, yaw: TOWN.start.yaw, v: 0, lx: 0, lz: 0, lvx: 0, lvz: 0,
    down: 0, downT: 0, count: 3, popped: 0, still: 0, stum: 0, ph: 0, fl: [0, 0], ix: 0, iz: 0, bumpT: 0, lift: 0 };
}

// gait: how the legs walk. hand.act: 0 free, 1 wave, 2 point. brow: eyebrows raised.
export const newOrders = () => ({ f: 0, t: 0, gait: 0, hand: [{ x: 0, y: 0, z: 0, act: 0 }, { x: 0, y: 0, z: 0, act: 0 }], hy: 0, hp: 0, nod: 0, shake: 0, talk: 0, brow: 0 });

const GAITS = [[CFG.walkSpeed, CFG.walkAccel], [CFG.tipSpeed, CFG.tipAccel], [CFG.strideSpeed, CFG.strideAccel], [CFG.shuffleSpeed, CFG.shuffleAccel]];

// Movement only. The client also runs this for its own legs so walking feels instant.
export function walkStep(b, o, dt) {
  const g = GAITS[o.gait] || GAITS[0];
  const max = g[0] * (b.stum ? 0.55 : 1), acc = g[1] * (b.accel || 1);      // slippery shoes: slow to start and stop
  const v0 = b.v, f = clamp(o.f, -1, 1);
  const target = f * max * (f < 0 ? 0.6 : 1);
  b.v += clamp(target - b.v, -acc * dt, acc * dt);
  const yr = -clamp(o.t, -1, 1) * CFG.turnRate * (o.gait === GAIT.STRIDE ? 0.75 : 1);   // big strides turn wider
  b.yaw += yr * dt;
  const [fx, fz] = fwd(b.yaw);
  b.x += fx * b.v * dt; b.z += fz * b.v * dt;
  const c = collide(b.x, b.z, CFG.bodyR, false);
  b.x = c.x; b.z = c.z;
  for (const p of TOWN.props) {                      // props are solid too
    const d = Math.hypot(b.x - p.x, b.z - p.z), min = p.r + CFG.bodyR;
    if (d < min && d > 1e-6) { b.x = p.x + ((b.x - p.x) / d) * min; b.z = p.z + ((b.z - p.z) / d) * min; }
  }
  return { a: (b.v - v0) / dt, yr, hit: c.hit };
}

export const armIndex = (b) => (b.count >= 3 ? 1 : Math.max(0, b.count - 1));
export const shiftAt = (b, i) => { const up = b.count <= 1 ? 0 : i / (b.count - 1); return up * up; };

// Where a point given in body space (right, up, forward) is in the world, leaning included.
export function bodyPoint(b, right, y, forward, leanF) {
  const [fx, fz] = fwd(b.yaw), [rx, rz] = rgt(b.yaw);
  const lr = right + b.lx * leanF, lf = forward + b.lz * leanF;
  return { x: b.x + rx * lr + fx * lf, y, z: b.z + rz * lr + fz * lf };
}
export const armsY = (b) => CFG.kidH * (armIndex(b) + 0.5) + 0.12 + (b.lift || 0);
export const headY = (b) => CFG.kidH * b.count + 0.22 + (b.lift || 0);
export function handTarget(b, i, o) {
  return bodyPoint(b, (i === 0 ? -0.26 : 0.26) + o.x, armsY(b) + o.y, 0.22 + o.z, shiftAt(b, armIndex(b)));
}

// Where a hand is really heading: a wave, a point and a pocket-pat all take over from the free hand.
export function effHand(o, i, time, patT) {
  const h = o.hand[i], side = i === 0 ? -1 : 1;
  if (patT > 0) return { x: -side * 0.14, y: -0.12 + Math.sin(time * 22) * 0.04, z: 0 };
  if (h.act === 1) { const w = Math.sin(time * 7); return { x: side * 0.16 + w * 0.26, y: 0.86 - Math.abs(w) * 0.1, z: 0.1 }; }   // high over the hat, a big swing
  if (h.act === 2) return { x: clamp(-Math.sin(o.hy) * 0.6 - side * 0.26, -0.55, 0.55), y: 0.36, z: clamp(Math.cos(o.hy) * 0.7, 0, 0.75) };
  return h;
}

export function stepBody(Wd, dt, api) {
  const b = Wd.body, o = Wd.ord;
  if (b.popped) return;
  b.bumpT = Math.max(0, b.bumpT - dt);
  if (b.down) {
    b.downT += dt; b.v = 0;
    if (b.downT > CFG.downTime && Wd.phase === 'play') {
      b.down = 0; b.lx = b.lz = b.lvx = b.lvz = 0; b.stum = 0; api.ev(E.UP); api.banner(2);
    }
  } else {
    const { a, yr, hit } = Wd.car ? stepCar(Wd, dt, api) : walkStep(b, o, dt);
    if (o.pos && !Wd.car) { const k = ease(dt, 10); b.x += (o.pos.x - b.x) * k; b.z += (o.pos.z - b.z) * k; b.yaw += Math.atan2(Math.sin(o.pos.yaw - b.yaw), Math.cos(o.pos.yaw - b.yaw)) * k; }
    if (hit && !Wd.car && Math.abs(b.v) > 1.3 && b.bumpT <= 0) { b.iz += 0.9 * Math.sign(b.v); b.bumpT = 1; api.ev(E.BUMP); }
    // what throws the stack: speeding up, stopping, turning while moving, reaching, heavy hands, wriggling
    const throwK = CFG.accelToLean * (Wd.car ? 0.55 : o.gait === GAIT.STRIDE ? CFG.strideWobble : o.gait === GAIT.TIPTOE ? 0.7 : 1) * (Wd.mods?.handLean > 1 ? 1.12 : 1);
    let dx = yr * b.v * throwK, dz = -a * throwK;
    // a hand resting on the counter top (holding the form flat, say) leans on it: it adds no lean and steadies the stack
    const P = TOWN.paper, rest = (h) => h && Math.abs(h.y - P.y) < 0.1 && h.x > -0.55 && h.x < 0.6 && h.z > P.z - 0.2 && h.z < P.hz + 0.15;
    let resting = 0;
    for (let i = 0; i < 2; i++) {
      if (rest(Wd.hands[i])) { resting = 1; continue; }
      const it = Wd.items?.find((x) => x.held === i), heavy = it ? 1 + 0.6 * Math.min(1, (it.heldT || 0) / 1.5) : 1;
      const k = heavy * 0.8 * CFG.handToLean * (Wd.mods?.handLean || 1) * (Wd.car ? 0.35 : 1), e = effHand(o, i, Wd.time, Wd.patT);
      dx += e.x * k; dz += e.z * k;
    }
    const t = Wd.time;
    if (o.nod) dz += Math.sin(t * 9) * 0.55;            // the head is the top of the broom: it moves, everything moves
    if (o.shake) dx += Math.sin(t * 11) * 0.65;
    if (o.gait === GAIT.TIPTOE && Math.abs(b.v) < 0.2) { const n = (Wd.items?.filter((x) => x.held >= 0).length || 0) * (Wd.players?.length === 1 ? 0.55 : 1); dx += Math.sin(t * 1.7) * (0.35 + 0.45 * n); dz += Math.sin(t * 1.1 + 1) * 0.25 * n; }   // one player doing everything gets a gentler sway   // tiptoe on the spot with full hands: a slow sway
    dx += Math.sin(t * 2.3 + 1) * Math.sin(t * 0.7) * CFG.giggle; dz += Math.sin(t * 1.9) * Math.cos(t * 0.9 + 2) * CFG.giggle;
    b.lvx += b.ix; b.lvz += b.iz; b.ix = b.iz = 0;
    const steady = (b.count >= 3 ? 1 : 0.7) * (o.gait === GAIT.SHUFFLE ? CFG.shuffleSteady : 1) * (b.lift > 0 ? CFG.platformSteady : 1) * (resting ? 1.6 : 1) * (Wd.players?.length === 1 ? 1.25 : 1);   // one player doing everything gets a steadier stack
    const mag = Math.hypot(b.lx, b.lz);
    const tip = clamp((mag - CFG.safeLean) / (CFG.fallLean - CFG.safeLean), 0, 1);
    const k = -CFG.restore * steady * (1 - tip) + CFG.tipForce * tip;
    b.lvx += (b.lx * k + dx) * dt; b.lvz += (b.lz * k + dz) * dt;
    const damp = Math.exp(-CFG.damping * dt); b.lvx *= damp; b.lvz *= damp;
    b.lx += b.lvx * dt; b.lz += b.lvz * dt;
    const m2 = Math.hypot(b.lx, b.lz);
    const st = m2 > CFG.stumLean ? 1 : 0;
    if (st && !b.stum) api.ev(E.STUMBLE);
    b.stum = st;
    if (m2 >= CFG.fallLean) { b.down = 1; b.downT = 0; b.v = 0; api.fell(); }
    b.still = Math.abs(b.v) < 0.1 && Math.abs(yr) < 0.1 ? b.still + dt : 0;
    if (!Wd.car) b.ph += Math.abs(b.v) * dt * 5;
  }
  // hands chase their targets; how fast they wave about is a "tell"
  for (let i = 0; i < 2; i++) {
    const h = Wd.hands[i], tg = handTarget(b, i, effHand(o, i, Wd.time, Wd.patT));
    if (b.down) tg.y = 0.15;
    const k = ease(dt, 18), px = h.x, py = h.y, pz = h.z;
    h.x += (tg.x - h.x) * k; h.y += (tg.y - h.y) * k; h.z += (tg.z - h.z) * k;
    const sp = Math.hypot(h.x - px, h.y - py, h.z - pz) / dt;
    b.fl[i] += (Math.max(0, sp - Math.abs(b.v) - 0.3) - b.fl[i]) * ease(dt, 4);
  }
}

// ---------- view ----------
// The coat is drawn as a chain: each kid's piece of coat starts where the one below ends and leans a little
// more than it, so the coat bends like one body instead of splitting into separate tubes. The pieces overlap,
// and a belt and a collar cover the joins. The head sits on top of the chain and tilts with it.
const SEG_R = [[0.54, 0.4], [0.4, 0.37], [0.37, 0.4]];        // bottom and top radius per piece (used for the sleeves and hands)
const OVER = 0.14;                                              // how far each piece reaches into the one above
const HEM = 0.27;                                               // the coat stops above the ankles, so the striped socks and sneakers show
// the coat's outline per piece, as [height from the piece's base, radius]: a wide swinging hem,
// a slightly nipped waist, then broad rounded shoulders that close in to the neck, like the key art
const PROFILE = [
  [[0.27, 0.54], [0.33, 0.5], [0.45, 0.46], [0.57, 0.43], [0.69, 0.4]],
  [[0, 0.4], [0.2, 0.375], [0.4, 0.37], [0.69, 0.38]],
  [[0, 0.38], [0.22, 0.4], [0.4, 0.425], [0.5, 0.42], [0.57, 0.39], [0.63, 0.32], [0.67, 0.22], [0.69, 0.15]],
];
export function coatR(i, y) {
  const P = PROFILE[i];
  if (y <= P[0][0]) return P[0][1];
  for (let k = 1; k < P.length; k++) if (y <= P[k][0]) { const t = (y - P[k - 1][0]) / (P[k][0] - P[k - 1][0]), u = t * t * (3 - 2 * t); return P[k - 1][1] + (P[k][1] - P[k - 1][1]) * u; }
  return P[P.length - 1][1];
}
// the coat piece: a lathe with soft cloth folds, and on the bottom piece a split at the front that shows the legs
function coatGeo(i) {
  const P = PROFILE[i], y0 = P[0][0], y1 = P[P.length - 1][0], pts = [];
  for (let k = 0; k <= 16; k++) { const y = y0 + (y1 - y0) * (k / 16); pts.push(new T.Vector2(coatR(i, y), y)); }
  const geo = new T.LatheGeometry(pts, 40), pos = geo.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), r = Math.hypot(x, z), a = Math.atan2(x, z);
    const low = i === 0 ? 1 - Math.min(1, (y - y0) / 0.42) : 0;
    const fold = 1 + Math.sin(a * 7 + 0.6) * (0.012 + low * 0.03) * (i === 2 && y > 0.5 ? 0 : 1);
    let ny = y;
    if (i === 0) { const front = Math.max(0, 1 - Math.abs(a) / 0.42); ny = y + 0.16 * front * front * Math.max(0, 1 - (y - y0) / 0.3); }
    const k = r > 1e-5 ? fold : 1;
    pos.setXYZ(v, x * k, ny, z * k);
  }
  geo.computeVertexNormals(); return geo;
}
// a striped sock texture, like the kid's socks in the key art
function stripes(a, b) {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(0, i * 8, 8, 8); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

// The coat model bends as one piece: every point is carried along a smooth curve whose angle grows from the
// bottom (theta0) by k per metre of height, in the lean direction. No slices, so no gaps or torn edges.
const BEND = `uniform vec2 uLean; uniform float uTheta0; uniform float uK;
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
function bendMaterial(m, U, depth) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = BEND + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = bendP(armP(transformed));');
    if (!depth) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = bendN(armN(objectNormal), armP(position));');
  };
  m.customProgramCacheKey = () => 'bend' + (depth ? 'd' : '');
  return m;
}

export class StackView {
  constructor(scene) {
    this.g = new T.Group(); scene.add(this.g);
    this.seg = []; this.buttons = []; this.platforms = []; this.coats = [];
    const H = CFG.kidH;
    const coatM = mat(PAL.coat, { side: T.DoubleSide }); this.coatM = coatM;
    for (let i = 0; i < 3; i++) {
      const s = new T.Group();                                   // origin at the bottom of this piece
      const [r0] = SEG_R[i];
      const kid = new T.Mesh(new T.CapsuleGeometry(0.2, H - 0.4, 4, 10), mat(PAL.kids[i])); kid.position.y = H / 2 + (i === 0 ? 0.3 : 0); kid.castShadow = true;
      const coat = new T.Mesh(coatGeo(i), coatM); coat.castShadow = true;
      s.add(kid, coat); this.coats.push(coat); (this.kidsIn ||= []).push(kid);
      if (i === 0) {                         // hem: a soft rolled edge
        // pocket flaps on both sides, like a real trench coat
        for (const sd of [-1, 1]) { const pk = new T.Mesh(roundedBox(0.2, 0.07, 0.04, 0.02), mat(0x6a3e2b)); const a = sd * 0.95, y = 0.5, r = coatR(0, y) + 0.01; pk.position.set(Math.sin(a) * r, y, Math.cos(a) * r); pk.rotation.y = a; pk.castShadow = true; s.add(pk); }
      }
      const front = (y) => coatR(i, y) + 0.01;
      if (i === 1) {                         // a kid peeking out between the buttons, like the key art
        const peek = new T.Group(); peek.position.set(0, H * 0.55, front(H * 0.55) - 0.08);
        const face = new T.Mesh(new T.SphereGeometry(0.135, 16, 12), mat(PAL.skin));
        const hair = new T.Mesh(new T.SphereGeometry(0.142, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(PAL.hair)); hair.position.y = 0.015; hair.rotation.x = -0.25;
        const gap = new T.Mesh(new T.TorusGeometry(0.15, 0.03, 8, 20), mat(0x6a3e2b)); gap.position.z = 0.04; gap.scale.set(1.15, 0.85, 1);   // the coat opening around the face
        peek.add(face, hair, gap);
        for (const x of [-0.052, 0.052]) {
          const w = new T.Mesh(new T.SphereGeometry(0.038, 10, 8), mat(0xffffff)); w.position.set(x, -0.005, 0.105); w.scale.z = 0.7;
          const pu = new T.Mesh(new T.SphereGeometry(0.02, 8, 6), mat(0x2a1a14)); pu.position.set(x, -0.008, 0.13);
          const hi = new T.Mesh(new T.SphereGeometry(0.007, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); hi.position.set(x + 0.008, 0.002, 0.148);
          peek.add(w, pu, hi);
        }
        s.add(peek); this.peek = peek;
      }
      // big round buttons, light brown with a rim and four holes, as in the key art
      for (const y of (i === 0 ? [] : i === 1 ? [H * 0.12, H * 0.98] : [H * 0.62])) {
        const btn = new T.Group(); btn.position.set(0, y, front(y));
        const disc = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.03, 18), mat(0xb97a4c)); disc.rotation.x = Math.PI / 2;
        const rim = new T.Mesh(new T.TorusGeometry(0.068, 0.014, 6, 18), mat(0x9a6038)); rim.position.z = 0.016;
        btn.add(disc, rim);
        for (const [hx, hy] of [[-0.02, -0.02], [0.02, -0.02], [-0.02, 0.02], [0.02, 0.02]]) { const h = new T.Mesh(new T.SphereGeometry(0.009, 6, 4), mat(0x5a3626)); h.position.set(hx, hy, 0.014); btn.add(h); }
        btn.rotation.x = i === 0 ? -0.2 : 0; s.add(btn); this.buttons.push(btn);
      }
      if (i === 0) {                         // legs poke out under the hem: striped socks and green sneakers, like the key art
        for (const [x, a, b] of [[-0.15, '#e8b23e', '#fff3dc'], [0.15, '#d8553e', '#fff3dc']]) {
          const sock = new T.Mesh(new T.CylinderGeometry(0.075, 0.07, 0.36, 14), mat(0xffffff, { map: stripes(a, b) })); sock.position.set(x, 0.26, 0.05); sock.castShadow = true;
          const shoe = new T.Mesh(roundedBox(0.19, 0.12, 0.33, 0.055), mat(0x5f9a5a)); shoe.position.set(x, 0.07, 0.12); shoe.castShadow = true;
          const sole = new T.Mesh(roundedBox(0.2, 0.05, 0.34, 0.02), mat(0xfff3e2)); sole.position.set(x, 0.022, 0.12);
          const toe = new T.Mesh(new T.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xfff3e2)); toe.position.set(x, 0.05, 0.25); toe.scale.set(1.05, 0.6, 0.8);
          const lace = new T.Mesh(roundedBox(0.1, 0.02, 0.1, 0.008), mat(0xfff3e2)); lace.position.set(x, 0.135, 0.1);
          s.add(sock, shoe, sole, toe, lace);
          // platform shoes (disguise level 2): a thick sole under each foot
          const plat = new T.Mesh(roundedBox(0.22, CFG.platform, 0.36, 0.04), mat(PAL.terracotta)); plat.position.set(x, -CFG.platform / 2, 0.12); plat.castShadow = true;
          s.add(plat); this.platforms.push(plat);
        }
      }
      this.g.add(s); this.seg.push(s);
    }
    // head: big and round, with big eyes, a red nose, bushy brows, a fedora and a tall turned-up collar, as in the key art
    this.head = new T.Group(); this.g.add(this.head);
    const face = new T.Mesh(new T.SphereGeometry(0.22, 22, 16), mat(PAL.skin)); face.position.y = 0.17; face.scale.set(1, 0.98, 0.95); face.castShadow = true;
    const nose = new T.Mesh(new T.SphereGeometry(0.06, 12, 10), mat(0xe8906c)); nose.position.set(0, 0.13, 0.21);
    const cheeks = [-1, 1].map((sd) => { const c = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), mat(0xf0a080)); c.position.set(sd * 0.13, 0.1, 0.16); c.scale.z = 0.5; return c; });
    const hairSide = [-1, 1].map((sd) => { const h = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), mat(0x6b3a26)); h.position.set(sd * 0.19, 0.26, 0.02); h.scale.set(0.7, 1, 1); return h; });
    // fedora: a soft brim that curls up at the sides, a pinched crown and a tan band
    const brimPts = [[0.0, 0.0], [0.2, 0.0], [0.36, 0.01], [0.45, 0.04], [0.48, 0.07], [0.47, 0.085], [0.43, 0.06], [0.33, 0.035], [0.2, 0.03], [0, 0.03]].map(([r, y]) => new T.Vector2(r, y));
    const brim = new T.Mesh(new T.LatheGeometry(brimPts, 32), mat(PAL.hat, { side: T.DoubleSide })); brim.position.y = 0.3; brim.scale.set(1, 1, 0.92); brim.castShadow = true;
    const crownPts = [[0.235, 0], [0.24, 0.06], [0.235, 0.14], [0.215, 0.2], [0.17, 0.235], [0.08, 0.215], [0, 0.2]].map(([r, y]) => new T.Vector2(r, y));
    const top = new T.Mesh(new T.LatheGeometry(crownPts, 28), mat(PAL.hat)); top.position.y = 0.32; top.scale.set(1, 1, 0.88); top.castShadow = true;
    const dent = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), mat(0x4a2a1c)); dent.position.set(0, 0.53, 0.13); dent.scale.set(1.4, 0.5, 0.6);
    const band = new T.Mesh(new T.CylinderGeometry(0.245, 0.243, 0.06, 28), mat(PAL.band)); band.position.y = 0.36; band.scale.set(1, 1, 0.88);
    // moustache (disguise level 1): two curled bushy halves
    const tache = new T.Group(); tache.position.set(0, 0.075, 0.2);
    for (const sd of [-1, 1]) { const m = new T.Mesh(new T.CapsuleGeometry(0.035, 0.1, 4, 10), mat(0x4a2a1c)); m.rotation.z = Math.PI / 2 + sd * 0.35; m.position.set(sd * 0.065, 0, 0); tache.add(m);
      const curl = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), mat(0x4a2a1c)); curl.position.set(sd * 0.13, 0.02, -0.01); tache.add(curl); }
    // a tall collar turned up around the chin, with wide lapels
    const colPts = [[0.17, 0.0], [0.22, 0.05], [0.27, 0.1], [0.31, 0.15], [0.32, 0.165], [0.29, 0.14], [0.24, 0.09], [0.18, 0.03]].map(([r, y]) => new T.Vector2(r, y));
    const collar = new T.Mesh(new T.LatheGeometry(colPts, 28, Math.PI * 0.25, Math.PI * 1.5), mat(PAL.collar, { side: T.DoubleSide })); collar.scale.set(1.18, 1.25, 1.18); collar.castShadow = true;     // the open side of the collar faces forward, so the face shows
    const lapels = [-1, 1].map((sd) => { const m = new T.Mesh(roundedBox(0.24, 0.3, 0.045, 0.035), mat(PAL.collar)); m.position.set(sd * 0.15, -0.02, 0.31); m.rotation.set(-0.75, sd * 0.3, sd * 0.55); m.castShadow = true; return m; });
    for (const x of [-0.08, 0.08]) {
      const w = new T.Mesh(new T.SphereGeometry(0.068, 16, 12), mat(0xffffff)); w.position.set(x * 1.1, 0.2, 0.165); w.scale.set(0.9, 1.15, 0.65);
      const pu = new T.Mesh(new T.SphereGeometry(0.034, 12, 10), mat(0x2a1a14)); pu.position.set(x * 1.1, 0.192, 0.205);
      const hi = new T.Mesh(new T.SphereGeometry(0.01, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); hi.position.set(x * 1.1 + 0.013, 0.207, 0.236);
      this.head.add(w, pu, hi);
    }
    this.tache = tache;
    this.brows = [-0.085, 0.085].map((x) => { const m = new T.Mesh(new T.CapsuleGeometry(0.027, 0.09, 4, 8), mat(0x4a2a1c)); m.rotation.z = Math.PI / 2; m.position.set(x * 1.1, 0.27, 0.185); return m; });
    const smile = new T.Mesh(new T.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), mat(0x7a3a2a)); smile.rotation.z = Math.PI; smile.position.set(0, 0.06, 0.2);
    const ears = [-1, 1].map((sd) => { const e = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), mat(PAL.skin)); e.position.set(sd * 0.215, 0.17, 0); e.scale.set(0.55, 1, 0.8); return e; });
    this.head.add(nose, smile, ...ears, ...cheeks, ...hairSide);
    const scope = new T.Group();                       // periscope (disguise level 3)
    const tube = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.34, 8), mat(PAL.teal)); tube.position.set(0.12, 0.66, 0);
    const eye = new T.Mesh(new T.BoxGeometry(0.09, 0.08, 0.14), mat(PAL.teal)); eye.position.set(0.12, 0.84, 0.05);
    scope.add(tube, eye); this.scope = scope;
    this.hat = new T.Group(); this.hat.add(brim, top, dent, band, scope); this.hat.scale.setScalar(1.12);
    this.head.add(face, tache, ...this.brows, this.hat);
    this.collarG = new T.Group(); this.collarG.add(collar, ...lapels); this.g.add(this.collarG);
    // chunky sleeves from the shoulders, mitten hands
    this.hands = [0, 1].map((i) => { const m = new T.Mesh(new T.SphereGeometry(0.095, 14, 10), mat(PAL.skin)); m.scale.set(1, 0.9, 1.1); m.castShadow = true;
      const th = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), mat(PAL.skin)); th.position.set(i ? -0.08 : 0.08, 0.03, 0.03); m.add(th); this.g.add(m); return m; });
    this.arms = [0, 1].map(() => { const m = new T.Mesh(new T.CylinderGeometry(0.1, 0.125, 1, 14), mat(PAL.coat)); m.geometry.rotateX(Math.PI / 2); m.castShadow = true; this.g.add(m); return m; });
    this.cuffs = [0, 1].map(() => { const m = new T.Mesh(new T.TorusGeometry(0.1, 0.032, 8, 18), mat(PAL.collar)); this.g.add(m); return m; });
    loadHero((p) => this.useHero(p));      // the key-art model replaces the simple shapes once it is ready
    this.sx = TOWN.start.x; this.sz = TOWN.start.z; this.syaw = 0; this.slx = 0; this.slz = 0; this.fall = 0; this.fallV = 0;
    this.q = new T.Quaternion(); this.qy = new T.Quaternion(); this.qh = new T.Quaternion(); this.e = new T.Euler();
    this.up = new T.Vector3(0, 1, 0); this.v = new T.Vector3(); this.p = new T.Vector3(); this.d = new T.Vector3();
    this.joints = [0, 1, 2, 3].map(() => new T.Vector3()); this.dirs = [0, 1, 2].map(() => new T.Vector3());
  }

  startPop() {
    this.popT = 0;
    if (!this.flyHat) { this.flyHat = this.hat.clone(); this.flyHat.scale.setScalar(1.15); this.g.parent.add(this.flyHat); }
    this.hat.getWorldPosition(this.v); this.flyHat.position.copy(this.v); this.flyHat.visible = true;
    const a = Math.random() * Math.PI * 2;
    this.hatV = { x: Math.cos(a) * 1.2, y: 4.2, z: Math.sin(a) * 1.2 };
    this.hat.visible = false;
  }
  stepPop(dt) {
    this.popT += dt; const t = this.popT;
    // puff out wide for a moment, then slump into an empty coat on the floor
    const puff = t < 0.18 ? 1 + t / 0.18 * 0.45 : Math.max(0, 1.45 - (t - 0.18) * 3);
    const squash = t < 0.18 ? 1 : Math.max(0.12, 1 - (t - 0.18) * 2.4);
    this.g.visible = t < 2.2;
    this.g.scale.set(Math.max(1, 0.6 + puff), squash, Math.max(1, 0.6 + puff));
    const h = this.flyHat, V = this.hatV;
    if (h.position.y > 0.06 || V.y > 0) {
      V.y -= 9.8 * dt; h.position.x += V.x * dt; h.position.y = Math.max(0.06, h.position.y + V.y * dt); h.position.z += V.z * dt;
      h.rotation.x += dt * 9; h.rotation.z += dt * 5;
      if (h.position.y <= 0.06 && V.y < 0) { V.y = 0; h.rotation.set(0, h.rotation.y, 0); }
    }
    h.visible = t < 6;
  }

  // swap the simple shapes for the key-art model parts
  useHero(p) {
    const keep = new Set(this.platforms);
    this.seg.forEach((s, i) => {
      for (const c of [...s.children]) if (!keep.has(c)) s.remove(c);
      const m = new T.Mesh(p.seg[i], p.material); m.castShadow = true; s.add(m); (this.heroSeg ||= [])[i] = m;     // (no self-shadow: it streaks on the lumpy cloth)
    });
    // the whole coat as one bending piece (used while all three kids are in it)
    const U = this.bendU = { uLean: { value: new T.Vector2(0, 1) }, uTheta0: { value: 0 }, uK: { value: 0 },
      uArm0: { value: new T.Matrix3() }, uArm1: { value: new T.Matrix3() }, uSh0: { value: new T.Vector3(p.shoulderX, p.shoulderY, 0) }, uSh1: { value: new T.Vector3(-p.shoulderX, p.shoulderY, 0) } };
    const mats = p.material.map((m) => bendMaterial(m.clone(), U, false));
    const depthM = bendMaterial(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }), U, true);
    this.bendG = new T.Group(); this.g.add(this.bendG);
    const bg = p.body; bg.computeBoundingSphere(); bg.boundingSphere.radius += 1.5;
    this.bodyM = new T.Mesh(bg, mats); this.bodyM.castShadow = true; this.bodyM.customDepthMaterial = depthM; this.bendG.add(this.bodyM);
    this.armRestL = p.armRest;
    this.buttons = []; this.kidsIn = []; this.coats = []; this.peek = null;
    for (const c of [...this.head.children]) if (c !== this.hat) this.head.remove(c);
    for (const c of [...this.hat.children]) if (c !== this.scope) c.visible = false;
    const hm = new T.Mesh(p.head, p.material); hm.castShadow = true; this.head.add(hm);
    for (const c of [...this.collarG.children]) this.collarG.remove(c);
    const sleeve = mat(p.coatColor);
    this.arms.forEach((a) => { a.material = sleeve; a.scale.x = a.scale.y = 1.25; });
    // hand i is on the body's +x side for the left hand (i = 0), which is the model's right-hand part
    this.heroHands = [1, 0].map((k) => { const m = new T.Mesh(p.hands[k], p.material); m.castShadow = true; m.userData.rest = p.armRest[k]; this.g.add(m); return m; });
    this.armLen = p.armLen; this.heroSh = [p.shoulderX, p.shoulderY];
    this.hero = true;
  }

  // viewer: which part's camera is active, so we can hide what would block it
  update(Wd, dt, viewer, own) {
    const b = Wd.body, H = CFG.kidH;
    // the bust: the coat bursts and slumps to a heap, the hat flies up and lands (about 1.5 s)
    if (b.popped && !this.wasPopped) this.startPop();
    this.wasPopped = !!b.popped;
    if (b.popped) { this.stepPop(dt); return; }
    this.g.scale.set(1, 1, 1); if (this.flyHat) this.flyHat.visible = false;
    this.g.visible = true;
    const k = ease(dt, 16);
    this.sx += (b.x - this.sx) * k; this.sz += (b.z - this.sz) * k;
    this.syaw += Math.atan2(Math.sin(b.yaw - this.syaw), Math.cos(b.yaw - this.syaw)) * k;
    this.slx += (b.lx - this.slx) * k; this.slz += (b.lz - this.slz) * k;
    // a fall speeds up as it goes, like a real topple (about half a second); getting up is a quick scramble
    if (b.down) { this.fallV += 7 * dt; this.fall = Math.min(1, this.fall + this.fallV * dt); }
    else { this.fallV = 0; this.fall += (0 - this.fall) * ease(dt, 6); }
    const f = this.fall, scramble = !b.down && f > 0.02 ? Math.sin(f * Math.PI) * 0.12 : 0;
    const lvl = Wd.dis ? Wd.dis.lvl : 0, lift = b.lift || 0;
    this.tache.visible = lvl >= 1; this.scope.visible = lvl >= 3; for (const m of this.platforms) m.visible = lift > 0;
    const sb = { x: this.sx, z: this.sz, yaw: this.syaw, lx: this.slx, lz: this.slz, count: b.count, lift };
    const [fx, fz] = fwd(sb.yaw), [rx, rz] = rgt(sb.yaw);
    const lm = Math.hypot(sb.lx, sb.lz), ln = lm || 1;
    let ldx = (rx * sb.lx + fx * sb.lz) / ln, ldz = (rz * sb.lx + fz * sb.lz) / ln;
    if (lm < 1e-4) { ldx = fx; ldz = fz; }
    const bob = Math.abs(Math.sin(b.ph)) * 0.03;
    const tremble = b.stum ? Math.sin(Wd.time * 34) * 0.035 : 0;      // a stumble shakes before it falls
    this.qy.setFromAxisAngle(this.up, sb.yaw);
    // walk the chain from the floor up
    const J = this.joints; J[0].set(sb.x, lift * (1 - f) + 0.3 * f + bob + scramble, sb.z);
    const n = b.count;
    const bend = this.hero && n >= 3 && viewer !== 'arms';
    // one smooth curve for the whole coat: the angle grows with height (k per metre) from theta0 at the floor
    let th0 = lm * 0.21 + tremble * 0.3, kk = lm * 0.42 / H + tremble * 0.5 / H;
    th0 += (1.52 - th0) * f; kk *= 1 - f;
    const arc = (y) => { const th = th0 + kk * y; if (Math.abs(kk) < 1e-3) return [y * Math.sin(th0), y * Math.cos(th0)]; return [(Math.cos(th0) - Math.cos(th)) / kk, (Math.sin(th) - Math.sin(th0)) / kk]; };
    for (let i = 0; i < 3; i++) {
      const s = this.seg[i]; s.visible = i < n; if (!s.visible) continue;
      let a;
      if (bend) a = th0 + kk * (i + 0.5) * H;
      else {
        const up = n <= 1 ? 1 : (i + 1) / n;
        a = lm * 1.25 * up + (i > 0 ? tremble * up : 0);
        a = a + (1.52 + (i - 1) * 0.04 - a) * f;                          // fallen: lying flat along the lean
      }
      const D = this.dirs[i].set(ldx * Math.sin(a), Math.cos(a), ldz * Math.sin(a)).normalize();
      this.q.setFromUnitVectors(this.up, D);
      s.position.copy(J[i]); s.quaternion.copy(this.qy).premultiply(this.q);
      if (bend) { const [u, v] = arc((i + 1) * H); J[i + 1].set(J[0].x + ldx * u, J[0].y + v, J[0].z + ldz * u); }
      else J[i + 1].copy(J[i]).addScaledVector(D, H);
    }
    if (bend) {   // the top of the coat points along the curve's end, so the head and collar sit on it
      const tth = th0 + kk * 3 * H; this.dirs[2].set(ldx * Math.sin(tth), Math.cos(tth), ldz * Math.sin(tth)).normalize();
    }
    if (this.bendG) {
      this.bendG.visible = bend; this.bendG.position.copy(J[0]); this.bendG.quaternion.copy(this.qy);
      // lean direction in the coat's own frame
      const iq = (this.iq ||= new T.Quaternion()).copy(this.qy).invert(), lv = this.v.set(ldx, 0, ldz).applyQuaternion(iq);
      const ll = Math.hypot(lv.x, lv.z) || 1;
      this.bendU.uLean.value.set(lv.x / ll, lv.z / ll); this.bendU.uTheta0.value = th0; this.bendU.uK.value = kk;
      this.bendArc = { th0, kk, arc };
      this.heroSeg.forEach((m) => { m.visible = !bend; });
    }
    const topD = this.dirs[n - 1];
    this.q.setFromUnitVectors(this.up, topD);
    // collar and head ride on top of the chain and tilt with it
    this.collarG.position.copy(J[n]).addScaledVector(topD, 0.1); this.collarG.quaternion.copy(this.qy).premultiply(this.q);
    this.head.position.copy(J[n]).addScaledVector(topD, 0.2);
    const o = Wd.ord, tt = Wd.time;
    const nod = o.nod ? Math.sin(tt * 9) * 0.25 : 0, shake = o.shake ? Math.sin(tt * 11) * 0.35 : 0, talk = o.talk ? Math.sin(tt * 17) * 0.05 : 0;
    this.e.set(-(o.hp) * (1 - f) + nod, sb.yaw + (o.hy + shake + talk) * (1 - f), 0, 'YXZ');
    this.head.quaternion.setFromEuler(this.e).premultiply(this.q);
    this.hat.visible = true;
    this.hat.rotation.x = Wd.hatT > 0 ? -0.6 * Math.sin(Math.min(1, Wd.hatT) * Math.PI) : 0;
    this.hat.position.set(0, f * 0.05, f * -0.25);                    // the hat slips off in a fall
    this.browUp = (this.browUp || 0) + ((o.brow ? 1 : 0) - (this.browUp || 0)) * ease(dt, 18);
    this.brows.forEach((m, i) => { m.position.y = 0.265 + this.browUp * 0.05; m.rotation.z = Math.PI / 2 + (i ? -1 : 1) * this.browUp * 0.25; });
    this.head.visible = viewer !== 'head' && viewer !== 'arms';
    this.collarG.visible = viewer !== 'arms' && viewer !== 'head';
    for (const bt of this.buttons) bt.visible = viewer !== 'arms';
    // the arms look down from inside the coat: hide its inside and the kids in it, so they see their hands and the world
    const side = viewer === 'arms' ? T.FrontSide : T.DoubleSide;
    if (this.coatM.side !== side) { this.coatM.side = side; this.coatM.needsUpdate = true; }
    for (const k of this.kidsIn) k.visible = viewer !== 'arms';
    // the arms look down from inside the top of the coat: hide the coat around them so the hands and the world show
    if (this.heroSeg) this.heroSeg.forEach((m, i) => { m.visible = !(viewer === 'arms' && i >= 1) && !(this.bendG && this.bendG.visible); });
    if (this.peek) this.peek.visible = viewer !== 'arms' && n >= 3;
    // arms: from the shoulders of the arms kid's piece to the hands
    const ai = armIndex(b), aD = this.dirs[ai];
    for (let i = 0; i < 2; i++) {
      const src = own && own[i] ? own[i] : Wd.hands[i], h = this.hands[i];
      const fast = own && own[i] ? 40 : 20;
      h.position.x += (src.x - h.position.x) * ease(dt, fast); h.position.y += (src.y - h.position.y) * ease(dt, 20); h.position.z += (src.z - h.position.z) * ease(dt, fast);
      if (f > 0.05) h.position.lerp(this.p.copy(J[ai]).addScaledVector(aD, H * 0.6).add(this.d.set(rx * (i ? 0.45 : -0.45), 0.05, rz * (i ? 0.45 : -0.45))), f);
      // the sleeve starts at the coat's real shoulder (the top piece), wherever the arms kid is
      const side = i === 0 ? -1 : 1, top = n - 1, tD = this.dirs[top] || aD, full = n >= 3 && viewer !== 'arms', sr = full ? 0.36 : SEG_R[ai][1] + 0.02;
      // (the arms player looks down from inside, so their sleeves start lower and never hide the hands)
      const sh = this.p.copy(full ? J[top] : J[ai]).addScaledVector(full ? tD : aD, full ? H * 0.88 : H * 0.92).add(this.d.set(rx * side * sr, 0, rz * side * sr));
      // keep the hand outside the coat, so it never sinks into it
      const ax = J[ai].x + aD.x * (h.position.y - J[ai].y), az = J[ai].z + aD.z * (h.position.y - J[ai].y);
      const hd = Math.hypot(h.position.x - ax, h.position.z - az), minR = SEG_R[ai][0] + 0.06;
      if (hd < minR && hd > 1e-4) { h.position.x = ax + ((h.position.x - ax) / hd) * minR; h.position.z = az + ((h.position.z - az) / hd) * minR; }
      const a = this.arms[i], len = Math.max(0.05, sh.distanceTo(h.position) - 0.06);
      a.position.copy(sh).lerp(h.position, 0.5 * (len / (len + 0.06))); a.scale.set(1, 1, len); a.lookAt(h.position);
      const c = this.cuffs[i]; c.visible = viewer !== 'arms'; c.position.copy(sh).lerp(h.position, len / (len + 0.06)); c.lookAt(h.position);
      if (this.hero) {
        // the model's whole arm swings from its shoulder on the top coat piece to point at the hand, stretching a little
        const hm = this.heroHands[i], topS = this.seg[n - 1];
        const shW = (this.t2 ||= new T.Vector3()).set(i === 0 ? this.heroSh[0] : -this.heroSh[0], this.heroSh[1] - (n - 1) * H, 0);
        topS.localToWorld(shW); if (this.g.parent) this.g.worldToLocal(shW);
        const dir = (this.t1 ||= new T.Vector3()).copy(h.position).sub(shW); const dl = dir.length() || 1; dir.divideScalar(dl);
        const restW = (this.t3 ||= new T.Vector3()).copy(hm.userData.rest).applyQuaternion(topS.quaternion);
        (this.qa ||= new T.Quaternion()).setFromUnitVectors(restW, dir);
        hm.quaternion.copy(topS.quaternion).premultiply(this.qa); hm.position.copy(shW);
        const st = Math.max(0.75, Math.min(1.35, dl / this.armLen)); hm.scale.setScalar(1); hm.scale.y = 1; hm.scale.set(st, st, st);
        hm.visible = n >= 3 || viewer === 'out';
        a.visible = !hm.visible; c.visible = false; h.visible = !hm.visible;

      }
    }
  }
}
