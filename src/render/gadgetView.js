// Gadgets on screen: water drops, stones, balloons and stink bombs in flight; banana peels, whoopee
// cushions and bubble wrap on the floor.
import * as T from 'three';

export class GadgetView {
  constructor(scene, gadgets) {
    this.scene = scene; this.g = gadgets; this.pool = []; this.bananas = new Map(); this.mats = new Map();
    this.ball = new T.SphereGeometry(1, 10, 8);
    this.peel = new T.TorusGeometry(0.16, 0.05, 6, 12, Math.PI * 1.3);
    this.cushion = new T.SphereGeometry(0.28, 12, 8); this.sheet = new T.BoxGeometry(1.1, 0.02, 0.8);
  }

  mat(color) { if (!this.mats.has(color)) this.mats.set(color, new T.MeshStandardMaterial({ color, roughness: 0.4 })); return this.mats.get(color); }

  update() {
    const P = this.g.projectiles;
    // (things in flight cast no shadow: a fast stone's shadow may be what drew the long dark lines testers saw
    // with the slingshot; and anything at a broken position is not drawn at all)
    while (this.pool.length < P.length) { const m = new T.Mesh(this.ball); m.castShadow = false; this.scene.add(m); this.pool.push(m); }
    this.pool.forEach((m, i) => {
      const p = P[i]; m.visible = !!p && [p.x, p.y, p.z].every(Number.isFinite) && p.y > -1 && p.y < 30; if (!m.visible) return;
      m.material = this.mat(p.def.projectile.color || '#ffffff'); m.scale.setScalar(p.def.projectile.radius ?? 0.06);
      m.position.set(p.x, p.y, p.z);
    });
    const live = new Set(this.g.items);
    for (const it of this.g.items) if (!this.bananas.has(it)) {
      const shape = it.def.item.shape, m = new T.Mesh(shape === 'cushion' ? this.cushion : shape === 'sheet' ? this.sheet : this.peel, this.mat(it.def.item.color || '#f4d03f'));
      if (shape === 'cushion') { m.scale.set(1.2, 0.35, 0.9); m.position.set(it.x, 0.08, it.z); }            // a whoopee cushion
      else if (shape === 'sheet') { m.rotation.y = Math.random() * 6; m.position.set(it.x, 0.02, it.z); }   // bubble wrap
      else { m.rotation.set(-Math.PI / 2, 0, Math.random() * 6); m.position.set(it.x, 0.05, it.z); }       // a banana peel
      m.castShadow = true;
      this.scene.add(m); this.bananas.set(it, m);
    }
    for (const [it, m] of this.bananas) if (!live.has(it)) { this.scene.remove(m); this.bananas.delete(it); }
  }
}
