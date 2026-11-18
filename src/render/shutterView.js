// Closing Time on screen: steel shutters rolling down over the doorways and aisle ends, and the next
// section's shutter lines flashing red on the floor while it is being warned about.
import * as T from 'three';

function stripes() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#9aa3ab'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) { g.fillStyle = '#7d868e'; g.fillRect(0, y, 64, 3); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t;
}

export class ShutterView {
  constructor(scene, closing, fade) {
    this.scene = scene; this.closing = closing; this.fade = fade; this.meshes = new Map(); this.warn = new Map(); this.t = 0;
    this.tex = stripes();
  }

  update(dt) {
    this.t += dt; const C = this.closing, h = C.C.shutterHeight;
    for (const s of C.shut) {
      let m = this.meshes.get(s);
      if (!m) {
        const [x0, z0, x1, z1] = s.seg, along = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = Math.hypot(x1 - x0, z1 - z0);
        const tex = this.tex.clone(); tex.needsUpdate = true; tex.repeat.set(len / 1.5, h / 1.5);
        m = new T.Mesh(new T.BoxGeometry(along ? len : 0.18, h, along ? 0.18 : len), new T.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 }));
        m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.castShadow = true; this.scene.add(m); this.meshes.set(s, m);
        this.fade?.add(m);
      }
      m.position.y = h / 2 + (1 - s.k) * h;
    }
    // flash the next section's shutter lines while it is being warned about
    const w = C.warning;
    for (const [seg, m] of this.warn) m.visible = false;
    if (w) for (const seg of w.shutters) {
      let m = this.warn.get(seg);
      if (!m) {
        const [x0, z0, x1, z1] = seg, len = Math.hypot(x1 - x0, z1 - z0);
        m = new T.Mesh(new T.PlaneGeometry(len, 0.35), new T.MeshBasicMaterial({ color: 0xe0392b, transparent: true }));
        m.rotation.x = -Math.PI / 2; m.rotation.z = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 0 : Math.PI / 2; m.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2);
        this.scene.add(m); this.warn.set(seg, m);
      }
      m.visible = true; m.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(this.t * 5));
    }
  }
}
