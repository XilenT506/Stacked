// Little bursts of stuff for the juice pass: confetti, water and ketchup splashes, dust puffs, dizzy
// stars, sparkles, coins, a ring on the floor, a "!" pop, paper scraps, a whoosh, and a bouncing arrow
// for pointing. One InstancedMesh per shape, so hundreds of bits cost a handful of draw calls.
import * as T from 'three';

const SHAPES = {
  cube: () => new T.BoxGeometry(1, 1, 1),
  flake: () => new T.PlaneGeometry(1, 0.6),
  ball: () => new T.SphereGeometry(0.5, 8, 6),
  star: () => { const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.22 : 0.5; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new T.ShapeGeometry(s); },
  coin: () => new T.CylinderGeometry(0.5, 0.5, 0.15, 12),
};
const CONFETTI = ['#e2557a', '#f4c542', '#4f9fc9', '#7fbf5f', '#e08a3a', '#9a6fd1'];
const rnd = (a, b) => a + Math.random() * (b - a);

export class Particles {
  constructor(scene, max = 600) {
    this.scene = scene; this.max = max; this.list = []; this.meshes = {}; this.rings = []; this.pings = [];
    for (const [k, make] of Object.entries(SHAPES)) {
      const m = new T.InstancedMesh(make(), new T.MeshBasicMaterial({ side: T.DoubleSide, transparent: true }), max);
      m.count = 0; m.frustumCulled = false; m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      scene.add(m); this.meshes[k] = m;
    }
    this.dummy = new T.Object3D(); this.col = new T.Color();
  }

  add(p) { if (this.list.length < this.max * 3) this.list.push(p); }

  // one burst of a kind at (x, z), in a colour
  burst(kind, x, z, color = null) {
    const n = (k) => Math.round(k);
    switch (kind) {
      case 'confetti': for (let i = 0; i < 90; i++) this.add({ shape: 'flake', x: x + rnd(-0.3, 0.3), y: 1.4, z: z + rnd(-0.3, 0.3), vx: rnd(-3, 3), vy: rnd(4, 8), vz: rnd(-3, 3), g: 6, drag: 1.6, spin: rnd(4, 12), size: 0.28, life: rnd(1.6, 2.6), color: CONFETTI[i % CONFETTI.length] }); break;
      case 'burst': for (let i = 0; i < 40; i++) this.add({ shape: 'flake', x, y: 1.5, z, vx: rnd(-5, 5), vy: rnd(3, 7), vz: rnd(-5, 5), g: 9, drag: 1, spin: 10, size: 0.3, life: 1.4, color: CONFETTI[i % 6] }); this.burst('dust', x, z); this.burst('stars', x, z); break;
      case 'splash': for (let i = 0; i < 26; i++) this.add({ shape: 'ball', x, y: 0.3, z, vx: rnd(-2.5, 2.5), vy: rnd(2, 5), vz: rnd(-2.5, 2.5), g: 12, size: rnd(0.12, 0.22), life: 0.8, color: color ?? '#7fc8ff', floor: true }); this.ring(x, z, color ?? '#7fc8ff', 1.4); break;
      case 'splashSmall': for (let i = 0; i < 10; i++) this.add({ shape: 'ball', x, y: 1, z, vx: rnd(-1.5, 1.5), vy: rnd(1, 3), vz: rnd(-1.5, 1.5), g: 12, size: rnd(0.08, 0.14), life: 0.6, color: color ?? '#7fc8ff', floor: true }); break;
      case 'dust': for (let i = 0; i < n(10); i++) this.add({ shape: 'ball', x: x + rnd(-0.3, 0.3), y: 0.15, z: z + rnd(-0.3, 0.3), vx: rnd(-1, 1), vy: rnd(0.3, 1), vz: rnd(-1, 1), g: -0.3, drag: 2, size: rnd(0.35, 0.55), grow: 1.2, life: 0.7, color: color ?? '#d8c8b0', fade: true }); break;
      case 'puff': for (let i = 0; i < 7; i++) this.add({ shape: 'ball', x, y: 1.1, z, vx: rnd(-1, 1), vy: rnd(0.2, 1), vz: rnd(-1, 1), g: -0.5, drag: 2.5, size: 0.35, grow: 1.5, life: 0.5, color: color ?? '#ffffff', fade: true }); break;
      case 'stars': for (let i = 0; i < 6; i++) this.add({ shape: 'star', x, y: 1.6, z, vx: rnd(-1.6, 1.6), vy: rnd(2, 3.5), vz: rnd(-1.6, 1.6), g: 6, spin: 6, size: 0.45, life: 0.9, color: '#f4c542', face: true }); break;
      case 'sparkle': for (let i = 0; i < 8; i++) this.add({ shape: 'star', x: x + rnd(-0.4, 0.4), y: rnd(0.8, 2), z: z + rnd(-0.4, 0.4), vx: 0, vy: rnd(0.4, 1.2), vz: 0, g: 0, spin: 4, size: rnd(0.25, 0.4), shrink: true, life: 0.7, color: color ?? '#fff3a0', face: true }); break;
      case 'coins': for (let i = 0; i < 14; i++) this.add({ shape: 'coin', x, y: 1.2, z, vx: rnd(-2, 2), vy: rnd(3, 6), vz: rnd(-2, 2), g: 12, spin: 12, size: 0.35, life: 1.1, color: '#f4c542', floor: true }); break;
      case 'paper': for (let i = 0; i < 6; i++) this.add({ shape: 'flake', x, y: 1.6, z, vx: rnd(-1, 1), vy: rnd(1, 2), vz: rnd(-1, 1), g: 2, drag: 2, spin: 5, size: 0.35, life: 1, color: '#fbf6ea' }); break;
      case 'whoosh': for (let i = 0; i < 8; i++) this.add({ shape: 'flake', x: x + rnd(-0.5, 0.5), y: rnd(0.8, 1.8), z: z + rnd(-0.5, 0.5), vx: rnd(-3, 3), vy: 0, vz: rnd(-3, 3), g: 0, drag: 4, size: 0.5, life: 0.35, color: '#ffffff', fade: true }); break;
      case 'exclaim': this.add({ shape: 'star', x, y: 2.8, z, vx: 0, vy: 1.5, vz: 0, g: 3, size: 0.9, grow: 0.5, life: 0.6, color: '#d0453a', face: true }); this.burst('sparkle', x, z, '#ffd0c8'); break;
      case 'ring': this.ring(x, z, color ?? '#ffffff', 3); break;
      case 'ping': this.pings.push({ x, z, t: 0, life: 2.2, color: color ?? '#f4c542' }); this.ring(x, z, '#f4c542', 1); break;
      default: break;
    }
  }

  ring(x, z, color, size) {
    const m = new T.Mesh(new T.RingGeometry(0.8, 1, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); this.scene.add(m); this.rings.push({ m, t: 0, size, life: 0.6 });
  }

  update(dt, camera) {
    for (const p of this.list) {
      p.t = (p.t ?? 0) + dt; p.vy -= (p.g ?? 0) * dt;
      const d = Math.max(0, 1 - (p.drag ?? 0) * dt); p.vx *= d; p.vz *= d; if (p.drag) p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy = p.floor ? 0 : Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.vz *= 0.6; }
    }
    this.list = this.list.filter((p) => p.t < p.life);
    const counts = {};
    for (const k of Object.keys(this.meshes)) counts[k] = 0;
    for (const p of this.list) {
      const m = this.meshes[p.shape], i = counts[p.shape]; if (i >= this.max) continue;
      const k = p.t / p.life, s = p.size * (p.grow ? 1 + p.grow * k : 1) * (p.shrink ? 1 - k : 1) * (p.fade ? 1 - k * 0.5 : 1);
      this.dummy.position.set(p.x, p.y, p.z);
      if (p.face) this.dummy.quaternion.copy(camera.quaternion); else this.dummy.rotation.set((p.spin ?? 0) * p.t, (p.spin ?? 0) * p.t * 0.7, 0);
      if (p.face && p.spin) this.dummy.rotateZ(p.spin * p.t);
      this.dummy.scale.setScalar(Math.max(0.001, s)); this.dummy.updateMatrix();
      m.setMatrixAt(i, this.dummy.matrix); m.setColorAt(i, this.col.set(p.color)); counts[p.shape]++;
    }
    for (const [k, m] of Object.entries(this.meshes)) { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    for (const r of this.rings) { r.t += dt; const k = r.t / r.life; r.m.scale.setScalar(0.2 + k * r.size); r.m.material.opacity = 0.8 * (1 - k); }
    for (const r of this.rings.filter((x) => x.t >= x.life)) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); }
    this.rings = this.rings.filter((x) => x.t < x.life);
    this.updatePings(dt);
  }

  // a bouncing arrow where someone pointed
  updatePings(dt) {
    for (const p of this.pings) {
      p.t += dt;
      if (!p.m) { p.m = new T.Mesh(new T.ConeGeometry(0.3, 0.7, 4), new T.MeshBasicMaterial({ color: p.color })); p.m.rotation.x = Math.PI; this.scene.add(p.m); }
      p.m.position.set(p.x, 1.2 + Math.abs(Math.sin(p.t * 6)) * 0.5, p.z); p.m.rotation.y = p.t * 3;
    }
    for (const p of this.pings.filter((x) => x.t >= x.life)) { this.scene.remove(p.m); p.m.geometry.dispose(); }
    this.pings = this.pings.filter((x) => x.t < x.life);
  }
}
