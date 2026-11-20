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

// a coat's arm reaching out to the loot it carries: a sleeve from its chest to the loot's edge
const SLEEVE = new T.MeshStandardMaterial({ color: '#6b4a33', roughness: 0.9 }), UP = new T.Vector3(0, 1, 0);
function placeArm(m, from, to) {
  const d = new T.Vector3().subVectors(to, from), len = d.length();
  m.visible = len > 0.05; if (!m.visible) return;
  m.position.copy(from).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(UP, d.normalize());
}

export class LootView {
  constructor(scene, loot, job = null) {
    this.loot = loot; this.t = 0; const tex = star();
    this.views = loot.items.map((it) => {
      const s = it.look.shape || [0.2, 0.2, 0.2];
      const m = new T.Mesh(new T.BoxGeometry(...s), new T.MeshStandardMaterial({ color: it.look.color || '#f4c542', roughness: 0.5 })); m.castShadow = true;
      const st = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); st.scale.setScalar(it.kind === 'big' ? 0.55 : 0.35); st.renderOrder = 9;
      const arms = [0, 1].map(() => { const a = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 1, 6), SLEEVE); a.visible = false; a.castShadow = true; scene.add(a); return a; });
      scene.add(m, st); return { it, m, st, h: s[1], w: Math.max(s[0], s[2]) / 2, arms };
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
      const cs = it.state === 'carried' ? it.carriers : [];
      v.arms.forEach((a, i) => { a.visible = !!cs[i]; });
      if (!show) continue;
      v.m.position.set(it.x, it.y + v.h / 2, it.z);
      if (cs.length === 1) v.m.rotation.y = cs[0].walker.yaw;
      // carried together: the loot sits between the two coats, turned to face along the line between them,
      // with both coats' arms reaching for it (so both players can see who is holding it)
      if (cs.length === 2) { const a = cs[0].walker.feet, b = cs[1].walker.feet; v.m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2; }
      cs.forEach((c, i) => {
        const f = c.walker.feet, h = (c.state?.height ?? 2.2), chest = new T.Vector3(f.x, f.y + h * 0.55, f.z), mid = new T.Vector3(it.x, it.y + v.h / 2, it.z);
        const toward = new T.Vector3(f.x - it.x, 0, f.z - it.z); const l = toward.length();
        if (l > 0.01) mid.addScaledVector(toward, Math.min(v.w, l * 0.5) / l);
        placeArm(v.arms[i], chest, mid);
      });
      v.st.position.set(it.x, it.y + v.h + 0.35 + Math.sin(this.t * 3 + it.n) * 0.06, it.z);
    }
    if (this.sign) {
      const it = this.sign.v.it; this.sign.sg.visible = it.state === 'lying';
      this.sign.sg.position.set(it.x, it.y + this.sign.v.h + 1.25 + Math.sin(this.t * 2.2) * 0.12, it.z);
    }
  }
}
