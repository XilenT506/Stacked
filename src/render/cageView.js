// The Lost & Found cage: a steel frame with bars, and a barred gate that swings open when a friend opens it.
import * as T from 'three';

export class CageView {
  constructor(scene, rescue) {
    this.r = rescue; const C = rescue.C, [x0, z0, x1, z1] = C.rect, h = C.height;
    const metal = new T.MeshStandardMaterial({ color: 0x5f6a72, roughness: 0.5, metalness: 0.4 });
    const g = this.g = new T.Group(); scene.add(g);
    const bars = (ax, az, bx, bz, into) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / 0.22));
      for (let i = 0; i <= n; i++) { const t = i / n, b = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, h, 6), metal); b.position.set(ax + (bx - ax) * t, h / 2, az + (bz - az) * t); b.castShadow = true; into.add(b); }
      for (const y of [0.05, h - 0.05]) { const r = new T.Mesh(new T.BoxGeometry(Math.abs(bx - ax) + 0.06, 0.06, Math.abs(bz - az) + 0.06), metal); r.position.set((ax + bx) / 2, y, (az + bz) / 2); into.add(r); }
    };
    const [gx0, , gx1] = C.gate;
    bars(x0, z0, x1, z0, g); bars(x0, z0, x0, z1, g); bars(x1, z0, x1, z1, g); bars(x0, z1, gx0, z1, g); bars(gx1, z1, x1, z1, g);
    // the gate swings on its left post
    this.gate = new T.Group(); this.gate.position.set(gx0, 0, z1); g.add(this.gate);
    const inner = new T.Group(); this.gate.add(inner); bars(0, 0, gx1 - gx0, 0, inner);
    const roof = new T.Mesh(new T.BoxGeometry(x1 - x0, 0.05, z1 - z0), new T.MeshStandardMaterial({ color: 0x5f6a72, transparent: true, opacity: 0.25 })); roof.position.set((x0 + x1) / 2, h, (z0 + z1) / 2); g.add(roof);
    // the sign
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#c4553d'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#fff3e2'; x.font = 'bold 64px "Trebuchet MS", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LOST & FOUND', 256, 68);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const sign = new T.Mesh(new T.PlaneGeometry(2, 0.5), new T.MeshBasicMaterial({ map: tex })); sign.position.set((x0 + x1) / 2, h + 0.35, z1); sign.rotation.x = -0.3; g.add(sign);
    this.k = 0;
  }

  update(dt) { this.k += ((this.r.open ? 1 : 0) - this.k) * Math.min(1, dt * 5); this.gate.rotation.y = this.k * 1.7; }
}
