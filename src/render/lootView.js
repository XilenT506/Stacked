// Loot on screen: each piece as a little coloured box (big ones bigger), a gold star bobbing over loot
// that is lying about, carried loot in the coat's arms, nothing for loot in pockets or already banked.
import * as T from 'three';

function star() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#f4c542'; g.strokeStyle = '#33201a'; g.lineWidth = 4; g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export class LootView {
  constructor(scene, loot) {
    this.loot = loot; this.t = 0; const tex = star();
    this.views = loot.items.map((it) => {
      const s = it.look.shape || [0.2, 0.2, 0.2];
      const m = new T.Mesh(new T.BoxGeometry(...s), new T.MeshStandardMaterial({ color: it.look.color || '#f4c542', roughness: 0.5 })); m.castShadow = true;
      const st = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); st.scale.setScalar(it.kind === 'big' ? 0.55 : 0.35); st.renderOrder = 9;
      scene.add(m, st); return { it, m, st, h: s[1] };
    });
  }

  update(dt) {
    this.t += dt;
    for (const v of this.views) {
      const it = v.it, show = it.state === 'lying' || it.state === 'carried';
      v.m.visible = show; v.st.visible = it.state === 'lying';
      if (!show) continue;
      v.m.position.set(it.x, it.y + v.h / 2, it.z);
      if (it.state === 'carried') v.m.rotation.y = it.carriers[0].walker.yaw;
      v.st.position.set(it.x, it.y + v.h + 0.35 + Math.sin(this.t * 3 + it.n) * 0.06, it.z);
    }
  }
}
