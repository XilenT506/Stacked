// The team's crayon-map scribbles, drawn on the shop floor in chalk (a little tinted with each player's
// colour), so a teammate who hasn't opened the map still sees "RUN" and the arrow pointing at the door.
import * as T from 'three';

const Y = 0.025;
let grainTex = null;
function grain() {
  if (grainTex) return grainTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), img = g.createImageData(64, 64);
  for (let i = 0; i < 64 * 64; i++) { const v = Math.random(); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = v < 0.25 ? 40 : 200 + v * 55; }
  g.putImageData(img, 0, 0); grainTex = new T.CanvasTexture(c); grainTex.wrapS = grainTex.wrapT = T.RepeatWrapping;
  return grainTex;
}
const chalkColor = (hex) => new T.Color(hex).lerp(new T.Color(0xffffff), 0.2);
const mat = (hex) => new T.MeshBasicMaterial({ color: chalkColor(hex), map: grain(), transparent: true, opacity: 0.92, side: T.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

// a flat ribbon along a line of [x, z] points
function ribbon(pts, w) {
  const pos = [], uv = [], idx = [];
  pts.forEach(([x, z], i) => {
    const [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
    pos.push(x + nx, Y, z + nz, x - nx, Y, z - nz); uv.push(i * 0.7, 0, i * 0.7, 1);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

function stickerMesh(text, hex) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.font = '700 104px Gaegu, "Comic Sans MS", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = '#' + new T.Color(hex).getHexString(); g.lineJoin = 'round'; g.strokeText(text, 256, 84);
  g.fillStyle = '#ffffff'; g.fillText(text, 256, 84);
  g.globalCompositeOperation = 'destination-out';                       // chalky gaps
  for (let i = 0; i < 900; i++) g.fillRect(Math.random() * 512, Math.random() * 160, 2, 2);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const w = Math.min(4.2, 0.9 + text.length * 0.32);
  const m = new T.Mesh(new T.PlaneGeometry(w, w * 160 / 512), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;                                           // lying on the floor, readable from the camera
  return m;
}

export class ChalkView {
  constructor(scene, colors) { this.scene = scene; this.colors = colors; this.group = new T.Group(); scene.add(this.group); this.key = ''; }

  update(map) {
    const list = map?.scribbles ?? [], key = list.map((s) => s.id).join(',');
    if (key === this.key) return;
    this.key = key;
    for (const o of [...this.group.children]) { this.group.remove(o); o.traverse((m) => { m.geometry?.dispose(); m.material?.map?.dispose?.(); }); }
    for (const s of list) this.group.add(this.mesh(s));
  }

  mesh(s) {
    const hex = this.colors[s.slot % this.colors.length], g = new T.Group();
    if (s.kind === 'sticker') { const m = stickerMesh(s.text, hex); m.position.set(s.pts[0][0], Y, s.pts[0][1]); g.add(m); return g; }
    let pts = s.pts;
    if (s.kind === 'circle') { const [cx, cz] = s.pts[0], r = s.pts[1] ? Math.hypot(s.pts[1][0] - cx, s.pts[1][1] - cz) : 1; pts = Array.from({ length: 33 }, (_, i) => [cx + Math.cos(i / 32 * Math.PI * 2) * r, cz + Math.sin(i / 32 * Math.PI * 2) * r]); }
    const m = mat(hex); g.add(new T.Mesh(ribbon(pts, 0.22), m));
    if (s.kind === 'arrow' && pts.length > 1) {
      const [bx, bz] = pts[pts.length - 1]; let k = pts.length - 2; while (k > 0 && Math.hypot(pts[k][0] - bx, pts[k][1] - bz) < 0.6) k--;
      const a = Math.atan2(bz - pts[k][1], bx - pts[k][0]), L = 1.0;
      for (const d of [-0.5, 0.5]) g.add(new T.Mesh(ribbon([[bx - Math.cos(a + d) * L, bz - Math.sin(a + d) * L], [bx, bz]], 0.22), m));
    }
    return g;
  }
}
