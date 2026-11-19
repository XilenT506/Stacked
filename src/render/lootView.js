// Loot on screen: each piece as a little coloured box (big ones bigger), a gold star bobbing over loot
// that is lying about, carried loot in the coat's arms, nothing for loot in pockets or already banked.
// The job's target gets a big floating sign ("NAN'S CAKE") that shows through shelves until it is banked.
import * as T from 'three';

function star() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#f4c542'; g.strokeStyle = '#33201a'; g.lineWidth = 4; g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

function signTex(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); g.font = '900 64px "Trebuchet MS", sans-serif'; const w = Math.min(500, g.measureText(text).width + 60);
  g.fillStyle = '#c4553d'; g.strokeStyle = '#33201a'; g.lineWidth = 8; g.beginPath(); g.roundRect(256 - w / 2, 14, w, 92, 26); g.fill(); g.stroke();
  g.fillStyle = '#fff3e2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 62);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export class LootView {
  constructor(scene, loot, job = null) {
    this.loot = loot; this.t = 0; const tex = star();
    this.views = loot.items.map((it) => {
      const s = it.look.shape || [0.2, 0.2, 0.2];
      const m = new T.Mesh(new T.BoxGeometry(...s), new T.MeshStandardMaterial({ color: it.look.color || '#f4c542', roughness: 0.5 })); m.castShadow = true;
      const st = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); st.scale.setScalar(it.kind === 'big' ? 0.55 : 0.35); st.renderOrder = 9;
      scene.add(m, st); return { it, m, st, h: s[1] };
    });
    const target = job?.targetLoot && this.views.find((v) => v.it.id === job.targetLoot);
    if (target) {
      const sg = new T.Sprite(new T.SpriteMaterial({ map: signTex(job.sign ?? target.it.name), depthTest: false, transparent: true }));
      sg.scale.set(2.4, 0.6, 1); sg.renderOrder = 10; scene.add(sg); this.sign = { v: target, sg };
    }
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
    if (this.sign) {
      const it = this.sign.v.it; this.sign.sg.visible = it.state === 'lying';
      this.sign.sg.position.set(it.x, it.y + this.sign.v.h + 1.25 + Math.sin(this.t * 2.2) * 0.12, it.z);
    }
  }
}
