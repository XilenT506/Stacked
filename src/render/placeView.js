// Draws a place built by src/world/place.js: coloured floors per area, walls and furniture, the area
// signs, the icy freezer floor, the getaway gate, and a planning overlay (O) that shows the spots from the
// JSON: loot (gold stars), hiding spots (green rings), spawn points, and the Closing Time shutters (numbered).
import * as T from 'three';
import { staticMesh } from './meshes.js';
import { rectsOf } from '../world/place.js';

function label(text, { w = 512, h = 128, bg = '#33201a', fg = '#fff3e2', size = 64 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 24); g.fill();
  g.fillStyle = fg; g.font = `bold ${size}px "Trebuchet MS", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let s = size; while (g.measureText(text).width > w - 40 && s > 20) { s -= 4; g.font = `bold ${s}px "Trebuchet MS", sans-serif`; }
  g.fillText(text, w / 2, h / 2 + 4);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export class PlaceView {
  constructor(scene, place, fade) {
    this.g = new T.Group(); scene.add(this.g);
    const D = place.data;
    for (const s of place.statics) {
      if (s.kind === 'ground' || s.invisible) continue;
      const m = staticMesh(s); this.g.add(m); if (s.fade) fade.add(m);
      if (s.kind === 'shelf' || s.kind === 'sweetshelf') this.stock(s);
    }
    // floors: one flat plane per area rectangle (the ground under everything)
    const ground = new T.Mesh(new T.PlaneGeometry(D.bounds[2] - D.bounds[0], D.bounds[3] - D.bounds[1]), new T.MeshStandardMaterial({ color: D.ground.color, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set((D.bounds[0] + D.bounds[2]) / 2, 0, (D.bounds[1] + D.bounds[3]) / 2); ground.receiveShadow = true; this.g.add(ground);
    place.areas.forEach((a, i) => {
      for (const r of rectsOf(a)) {
        const m = new T.Mesh(new T.PlaneGeometry(r[2] - r[0], r[3] - r[1]), new T.MeshStandardMaterial({ color: a.floor, roughness: 0.9 }));
        m.rotation.x = -Math.PI / 2; m.position.set((r[0] + r[2]) / 2, 0.002 + (a.outside ? 0 : 0.002) + i * 0.0002, (r[1] + r[3]) / 2); m.receiveShadow = true; this.g.add(m);
      }
      if (a.sign) {
        const sign = new T.Mesh(new T.PlaneGeometry(2.6, 0.65), new T.MeshBasicMaterial({ map: label(a.name), transparent: true }));
        sign.position.set(a.sign[0], a.outside ? 2.2 : 2.75, a.sign[1]); sign.rotation.x = -0.35; this.g.add(sign);
        (this.signs ??= []).push(sign);
      }
    });
    // the freezer ice: shiny pale blue
    for (const r of place.slippery) {
      const m = new T.Mesh(new T.PlaneGeometry(r[2] - r[0], r[3] - r[1]), new T.MeshStandardMaterial({ color: 0xa9dcf5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }));
      m.rotation.x = -Math.PI / 2; m.position.set((r[0] + r[2]) / 2, 0.012, (r[1] + r[3]) / 2); this.g.add(m);
    }
    this.gate(D);
    this.overlay = this.makeOverlay(D); this.overlay.visible = false; this.g.add(this.overlay);
  }

  // rows of coloured packets on both faces of a shelf
  // the area name signs fade away while a coat (or loot someone carries) is near one, so they never cover you
  // (and while one would sit under the money line at the top of the screen: M1-F5)
  fadeSigns(points, dt, camera = null) {
    for (const sg of this.signs ?? []) {
      const p = sg.position, v = camera ? (this.v ??= p.clone()).copy(p).project(camera) : null, underTop = v && v.y > 0.78 && v.z < 1;
      const near = underTop || points.some((q) => Math.abs(q.x - p.x) < 2.2 && q.z > p.z - 2.6 && q.z < p.z + 1.6);
      const o = sg.material.opacity + ((near ? 0.12 : 1) - sg.material.opacity) * Math.min(1, dt * 8);
      sg.material.opacity = o;
    }
  }

  stock(s) {
    const colors = s.kind === 'sweetshelf' ? [0xe2694f, 0xf4c542, 0x8e5bc4, 0x4fc98c, 0xff8fb0] : [0x4f9fc9, 0xe0a83a, 0x7fbf5f, 0xc4553d, 0xd9d0c0];
    const geo = new T.BoxGeometry(0.22, 0.3, 0.5), n = Math.floor(s.size[2] / 0.6), per = [];
    for (let i = 0; i < colors.length; i++) per.push(new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: colors[i], roughness: 0.7 }), n * 3 * 2));
    const cnt = per.map(() => 0), m = new T.Matrix4();
    for (const side of [-1, 1]) for (let lvl = 0; lvl < 3; lvl++) for (let i = 0; i < n; i++) {
      const k = (i * 7 + lvl * 3 + (side > 0 ? 1 : 0)) % colors.length;
      m.makeTranslation(s.pos[0] + side * (s.size[0] / 2 + 0.06), 0.35 + lvl * 0.6, s.pos[2] - s.size[2] / 2 + 0.3 + i * 0.6);
      per[k].setMatrixAt(cnt[k]++, m);
    }
    per.forEach((im, i) => { im.count = cnt[i]; im.castShadow = false; this.g.add(im); });
  }

  // two posts and a banner over the gap in the car-park fence
  gate(D) {
    const door = D.doors.find((d) => d.id === 'gate'); if (!door) return;
    const [x0, z0, x1] = door.span, post = new T.MeshStandardMaterial({ color: 0xf4c542 });
    for (const x of [x0, x1]) { const p = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 3, 12), post); p.position.set(x, 1.5, z0); p.castShadow = true; this.g.add(p); }
    const b = new T.Mesh(new T.PlaneGeometry(x1 - x0, 0.9), new T.MeshBasicMaterial({ map: label('GETAWAY!', { bg: '#c4553d' }), side: T.DoubleSide }));
    b.position.set((x0 + x1) / 2, 2.6, z0); b.rotation.x = -0.3; this.g.add(b);
    const ring = new T.Mesh(new T.RingGeometry(D.getaway.radius - 0.15, D.getaway.radius, 40), new T.MeshBasicMaterial({ color: 0xf4c542 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(D.getaway.at[0], 0.02, D.getaway.at[1]); this.g.add(ring);
  }

  makeOverlay(D) {
    const o = new T.Group();
    const star = new T.MeshBasicMaterial({ color: 0xf4c542 }), starBig = new T.MeshBasicMaterial({ color: 0xff9f1c });
    const sg = new T.OctahedronGeometry(0.18);
    for (const l of D.loot.list) { const m = new T.Mesh(sg, l.kind === 'big' ? starBig : star); m.scale.setScalar(l.kind === 'big' ? 1.8 : 1); m.position.set(l.at[0], Math.max(0.3, l.at[1] + 0.25), l.at[2]); o.add(m); }
    const ring = (x, z, r, color) => { const m = new T.Mesh(new T.RingGeometry(r - 0.08, r, 28), new T.MeshBasicMaterial({ color })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); o.add(m); };
    for (const h of D.hiding.list) ring(h.at[0], h.at[1], 0.7, 0x4fc98c);
    const spawnColor = { players: 0x4f9fc9, guard: 0x33201a, caretaker: 0x8e5bc4 };
    for (const [k, list] of Object.entries(D.spawns)) if (Array.isArray(list)) for (const [x, z] of list) ring(x, z, 0.35, spawnColor[k] ?? 0xe2694f);
    // the Closing Time shutters: red lines on the floor, numbered in the order they close
    D.closingTime.sections.forEach((s, i) => {
      for (const [x0, z0, x1, z1] of s.shutters) {
        const len = Math.hypot(x1 - x0, z1 - z0), m = new T.Mesh(new T.PlaneGeometry(len, 0.25), new T.MeshBasicMaterial({ color: 0xc4553d }));
        m.rotation.x = -Math.PI / 2; m.rotation.z = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 0 : Math.PI / 2; m.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2); o.add(m);
        const n = new T.Mesh(new T.PlaneGeometry(0.8, 0.8), new T.MeshBasicMaterial({ map: label(String(i + 1), { w: 128, h: 128, bg: '#c4553d', size: 90 }), transparent: true }));
        n.rotation.x = -Math.PI / 2; n.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2); o.add(n);
      }
    });
    return o;
  }
}
