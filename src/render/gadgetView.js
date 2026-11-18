// Gadgets on screen: water drops and slingshot stones in flight, banana peels on the floor.
import * as T from 'three';

export class GadgetView {
  constructor(scene, gadgets) {
    this.scene = scene; this.g = gadgets; this.pool = []; this.bananas = new Map(); this.mats = new Map();
    this.ball = new T.SphereGeometry(1, 10, 8);
    this.peel = new T.TorusGeometry(0.16, 0.05, 6, 12, Math.PI * 1.3);
  }

  mat(color) { if (!this.mats.has(color)) this.mats.set(color, new T.MeshStandardMaterial({ color, roughness: 0.4 })); return this.mats.get(color); }

  update() {
    const P = this.g.projectiles;
    while (this.pool.length < P.length) { const m = new T.Mesh(this.ball); m.castShadow = true; this.scene.add(m); this.pool.push(m); }
    this.pool.forEach((m, i) => {
      const p = P[i]; m.visible = !!p; if (!p) return;
      m.material = this.mat(p.def.projectile.color || '#ffffff'); m.scale.setScalar(p.def.projectile.radius ?? 0.06);
      m.position.set(p.x, p.y, p.z);
    });
    const live = new Set(this.g.items);
    for (const it of this.g.items) if (!this.bananas.has(it)) {
      const m = new T.Mesh(this.peel, this.mat(it.def.item.color || '#f4d03f'));
      m.rotation.set(-Math.PI / 2, 0, Math.random() * 6); m.position.set(it.x, 0.05, it.z); m.castShadow = true;
      this.scene.add(m); this.bananas.set(it, m);
    }
    for (const [it, m] of this.bananas) if (!live.has(it)) { this.scene.remove(m); this.bananas.delete(it); }
  }
}
