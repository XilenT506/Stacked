// Draws the interactive things and the mess: a mesh per thing (added as things spawn, removed when they
// splat), fog in front of open freezer doors, a wiggling box when someone hides in it, and the puddles.
import * as T from 'three';
import { shapeMesh, follow } from './meshes.js';

export class ThingsView {
  constructor(scene, things, mess) {
    this.scene = scene; this.things = things; this.mess = mess;
    this.meshes = new Map(); this.puddles = new Map(); this.fog = new Map(); this.t = 0;
    for (const t of things.list) this.add(t);
    const prev = things.onSpawn;
    things.onSpawn = (t) => { prev?.(t); this.add(t); };
    this.fogMat = new T.MeshStandardMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.35, depthWrite: false, roughness: 1 });
    this.fogGeo = new T.SphereGeometry(0.5, 10, 8);
  }

  add(t) {
    if (!t.def.shape || this.meshes.has(t)) return;
    const m = shapeMesh(t.def.shape, t.def.color); this.scene.add(m); this.meshes.set(t, m);
    follow(m, t.body);
  }

  update(dt) {
    this.t += dt;
    for (const [t, m] of this.meshes) {
      if (t.gone) { this.scene.remove(m); this.meshes.delete(t); continue; }
      if (t.def.body !== 'fixed' || !m.userData.placed) { follow(m, t.body); m.userData.placed = true; }
      // somebody inside the box: it shuffles about a little
      if (t.occupant && t.mode === 'inside') { m.rotation.y = t.yaw + Math.sin(this.t * 7) * 0.05; m.position.y = t.position.y + Math.abs(Math.sin(this.t * 7)) * 0.03; }
      if (t.def.use?.whileOn?.fog) this.fogFor(t, t.state === 'on', dt);
    }
    this.drawMess();
  }

  // cold fog rolling out of an open freezer door
  fogFor(t, on, dt) {
    let g = this.fog.get(t);
    if (!g) { g = new T.Group(); this.scene.add(g); this.fog.set(t, g); g.userData.k = 0; for (let i = 0; i < 8; i++) g.add(new T.Mesh(this.fogGeo, this.fogMat)); }
    g.userData.k += ((on ? 1 : 0) - g.userData.k) * Math.min(1, dt * 1.5);
    const k = g.userData.k; g.visible = k > 0.02;
    if (!g.visible) return;
    const p = t.position, f = t.front;
    g.children.forEach((b, i) => {
      const a = this.t * 0.4 + i * 0.8, d = 0.4 + ((this.t * 0.3 + i * 0.13) % 1) * 1.6;
      b.position.set(p.x + f.x * d + Math.sin(a) * 0.4 * f.z, 0.25 + Math.sin(a * 1.3) * 0.1, p.z + f.z * d + Math.cos(a) * 0.5 * Math.abs(f.x));
      b.scale.set(1.3 * k, 0.5 * k, 1.3 * k);
    });
  }

  // puddles and splats: flat discs in the colour of what was spilled; slippery ones shine
  drawMess() {
    for (const p of this.mess.patches) {
      let m = this.puddles.get(p);
      if (!m) {
        m = new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshStandardMaterial({ color: p.color, roughness: p.slippery ? 0.08 : 0.9, transparent: true, opacity: 0.8 }));
        m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.012 + (this.puddles.size % 20) * 0.0004, p.z); m.receiveShadow = true;
        this.scene.add(m); this.puddles.set(p, m);
      }
      m.scale.setScalar(p.r);
    }
  }
}
