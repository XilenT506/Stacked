// Draws the grown-ups: the seven key-art models from the old game (assets/people/small/*.glb) with the
// walk drawn in the shader (legs swing from the hips, arms the other way), a sight cone on the floor,
// a "?" or a red "!" over their heads, lying flat with stars after a slip, and a kid in their arms
// when they have grabbed one. Ported from legacy/js/townspeople.js.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { smoothNormals } from './heroModel.js';
import { kidFigure, KID_COLORS } from './coatView.js';
import mabel from '../../assets/people/small/mabel.glb';
import ruth from '../../assets/people/small/ruth.glb';
import hale from '../../assets/people/small/hale.glb';
import pip from '../../assets/people/small/pip.glb';
import gus from '../../assets/people/small/gus.glb';
import price from '../../assets/people/small/price.glb';
import dot from '../../assets/people/small/dot.glb';

const FILES = { mabel, ruth, hale, pip, gus, price, dot };
const loaded = new Map();
function loadModel(id) {
  if (!loaded.has(id)) loaded.set(id, new Promise((res) => {
    const b = FILES[id]; if (!b) return res(null);
    new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', (gl) => { try {
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
      src.updateWorldMatrix(true, false); geo.applyMatrix4(src.matrixWorld);
      const ng = geo.index ? geo.toNonIndexed() : geo; smoothNormals(ng); ng.computeBoundingBox();
      const m = src.material.clone(); m.metalness = 0; m.roughness = 0.85;
      if (m.map) { m.map.colorSpace = T.SRGBColorSpace; m.map.needsUpdate = true; }
      res({ geo: ng, mat: m });
    } catch (e) { console.warn('model', id, e); res(null); } }, () => res(null));
  }));
  return loaded.get(id);
}

function walkMaterial(base, U) {
  const mat = base.clone();
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
  return mat;
}

function mark(text, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = color; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 96px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); s.scale.setScalar(0.55); s.renderOrder = 10;
  return s;
}

// a white speech bubble with dark text
export function bubble(text, { size = 34, w = 640 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = 140;
  const g = c.getContext('2d'); g.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  const tw = Math.min(w - 40, g.measureText(text).width + 40), x0 = (w - tw) / 2;
  g.fillStyle = '#fff'; g.strokeStyle = '#33201a'; g.lineWidth = 6;
  g.beginPath(); g.roundRect(x0, 10, tw, 90, 26); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(w / 2 - 14, 98); g.lineTo(w / 2, 128); g.lineTo(w / 2 + 14, 98); g.fill();
  g.fillStyle = '#33201a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 56);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); s.scale.set(3.2, 0.7, 1); s.renderOrder = 13;
  return s;
}

const ALERT = new Set(['chase', 'shout', 'carry', 'grab']), CURIOUS = new Set(['investigate', 'inspect', 'search']);

export class PeopleView {
  constructor(scene, people, heights) {
    this.scene = scene; this.heights = heights; this.t = 0; this.watch = null;     // watch = the local player's coat (whose meters to show)
    this.views = people.list.map((g) => this.make(g, heights[g.model]?.height ?? 1.8));
    people.onAdd = (g) => this.views.push(this.make(g, (heights[g.model]?.height ?? 1.8) * (g.type.scale ?? 1)));
  }

  // a speech bubble over someone's head for a moment
  shout(g, text, sec = 2.5) {
    const v = this.views.find((x) => x.g === g); if (!v) return;
    if (v.bubble) v.root.remove(v.bubble);
    v.bubble = bubble(text); v.bubble.position.y = v.height + 1.1; v.root.add(v.bubble); v.bubbleT = sec;
  }

  make(g, height) {
    const root = new T.Group(); this.scene.add(root);
    const body = new T.Group(); root.add(body);
    // stand-in until the model has loaded
    const stand = new T.Mesh(new T.CapsuleGeometry(0.28, height - 0.56, 4, 10), new T.MeshStandardMaterial({ color: 0x9aa7b0 })); stand.position.y = height / 2; stand.castShadow = true; body.add(stand);
    // the sight cone, flat on the floor
    const fov = g.type.fov * Math.PI / 180, cone = new T.Mesh(new T.CircleGeometry(g.type.sight, 24, -Math.PI / 2 - fov / 2, fov),
      new T.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.16, depthWrite: false }));
    cone.rotation.x = -Math.PI / 2; cone.position.y = 0.03; root.add(cone);
    const q = mark('?', '#e0a83a'), ex = mark('!', '#c4553d'); q.position.y = ex.position.y = height + 0.45; root.add(q, ex);
    // the "?" meter for the player's coat: a bar under the "?" that fills from yellow to red
    const barBg = new T.Sprite(new T.SpriteMaterial({ color: 0x33201a, depthTest: false })), bar = new T.Sprite(new T.SpriteMaterial({ color: 0xe0a83a, depthTest: false }));
    barBg.scale.set(0.62, 0.11, 1); bar.center.set(0, 0.5); bar.scale.set(0.001, 0.07, 1);
    barBg.position.y = bar.position.y = height + 0.12; bar.position.x = -0.29; barBg.renderOrder = 11; bar.renderOrder = 12; root.add(barBg, bar);
    const stars = new T.Group(); for (let i = 0; i < 3; i++) { const s = mark('★', '#f4c542'); s.scale.setScalar(0.3); stars.add(s); } root.add(stars);
    const kid = kidFigure(0xffffff); kid.scale.setScalar(0.85); kid.visible = false; root.add(kid);
    const v = { g, root, body, stand, cone, q, ex, stars, kid, height, U: null, ph: 0, bar, barBg, bubble: null, bubbleT: 0 };
    loadModel(g.model).then((md) => {
      if (!md) return;
      const bb = md.geo.boundingBox, h = bb.max.y - bb.min.y, s = height / h;
      v.U = { uC: { value: new T.Vector4((bb.min.x + bb.max.x) / 2, bb.min.y, h, (bb.min.z + bb.max.z) / 2) }, uPh: { value: 0 }, uAmp: { value: 0 }, uT: { value: 0 } };
      const mesh = new T.Mesh(md.geo, walkMaterial(md.mat, v.U)); mesh.castShadow = true;
      if (g.type.hunts) mesh.material.color.setHex(0x8fa3c8);          // the Caretaker: same overalls, colder colours
      mesh.scale.setScalar(s); mesh.position.set(-(bb.min.x + bb.max.x) / 2 * s, -bb.min.y * s, -(bb.min.z + bb.max.z) / 2 * s);
      body.remove(stand); body.add(mesh);
    });
    return v;
  }

  update(dt) {
    this.t += dt;
    for (const v of this.views) {
      const g = v.g, f = g.feet, w = g.walker, st = g.state;
      v.root.position.set(f.x, f.y, f.z); v.root.rotation.y = w.yaw;
      // walking: legs and arms swing with speed
      const spd = st === 'slipped' ? 0 : w.flatSpeed, sw = Math.min(1, spd / 1.4);
      v.ph += dt * (4 + spd * 3.2) * (sw > 0.05 ? 1 : 0);
      if (v.U) { v.U.uPh.value = v.ph; v.U.uAmp.value += (sw - v.U.uAmp.value) * Math.min(1, dt * 8); v.U.uT.value = this.t + g.id; }
      // slipped: flat on their back with stars going round
      const down = st === 'slipped' ? 1 : 0;
      v.body.rotation.x += (-Math.PI / 2 * down - v.body.rotation.x) * Math.min(1, dt * (down ? 14 : 5));
      v.body.position.y = down * 0.25 + Math.abs(Math.sin(v.ph)) * 0.03 * sw;
      v.body.position.z = -down * 0.4;
      // stars go round their head when they are down or blinded (round where the head is)
      const blind = st === 'blinded';
      v.stars.visible = !!down || blind;
      v.stars.children.forEach((s, i) => { const a = this.t * 4 + i * 2.1; s.position.set(Math.sin(a) * 0.35, blind ? v.height + 0.1 : 0.5, (blind ? 0 : -1.2) + Math.cos(a) * 0.35); });
      // soaked: drips falling off them
      if (!v.drips) { v.drips = new T.Group(); for (let i = 0; i < 4; i++) { const d = new T.Mesh(new T.SphereGeometry(0.035, 6, 4), new T.MeshBasicMaterial({ color: 0x7fc8ff })); v.drips.add(d); } v.root.add(v.drips); }
      v.drips.visible = (g.effects?.soaked ?? 0) > 0;
      if (v.drips.visible) v.drips.children.forEach((d, i) => { const k = (this.t * 1.6 + i * 0.27) % 1; d.position.set(Math.sin(i * 2.4) * 0.28, v.height * (0.85 - k * 0.8), Math.cos(i * 2.4) * 0.2); });
      const sus = this.watch ? g.sus.get(this.watch) ?? 0 : 0, hostile = this.watch && g.hostile.has(this.watch);
      v.q.visible = (CURIOUS.has(st) || sus > 0.03) && !ALERT.has(st) && !hostile; v.ex.visible = ALERT.has(st) || (hostile && st !== 'slipped');
      v.bar.visible = v.barBg.visible = sus > 0.03 && !hostile;
      v.bar.scale.x = 0.58 * sus; v.bar.material.color.setHex(sus > 0.75 ? 0xc4553d : sus > 0.45 ? 0xe07a3a : 0xe0a83a);
      v.q.scale.setScalar(0.55 * (1 + sus * 0.5));
      if (v.bubble) { v.bubbleT -= dt; if (v.bubbleT <= 0) { v.root.remove(v.bubble); v.bubble = null; } }
      const pulse = 1 + Math.sin(this.t * 10) * 0.08; v.ex.scale.setScalar(0.55 * pulse);
      // the cone: red when they are after someone, hidden while they are down
      v.cone.visible = !down; v.cone.material.color.setHex(ALERT.has(st) ? 0xff7a6a : CURIOUS.has(st) ? 0xffd27a : 0xfff1a8);
      v.cone.material.opacity = ALERT.has(st) ? 0.13 : 0.08;
      // a kid held out in front, legs kicking
      const k = g.carrying || (g.holding ? { id: g.holding.stack[0] } : null);
      v.kid.visible = !!k;
      if (k) { v.kid.userData.torso.material.color.setHex(KID_COLORS[k.id] ?? 0xffffff); v.kid.position.set(0, 0.95 + Math.sin(this.t * 14) * 0.03, 0.45); v.kid.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 18 + i * Math.PI) * 0.8; }); }
    }
  }
}
