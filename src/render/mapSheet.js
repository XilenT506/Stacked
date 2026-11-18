// While a player has the crayon map open, their coat holds up a big sheet of paper with tiny kid hands
// poking out at the corners (it rustles a bit). Everyone sees it, grown-ups included.
import * as T from 'three';
import { paper, line, ring, star, write, scribbleFill, loadFont } from '../ui/crayonmap/crayon.js';

let tex = null;
function sheetTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const draw = () => { const g = c.getContext('2d'); drawSheet(g); if (tex) tex.needsUpdate = true; };
  draw(); loadFont().then(draw);                // again once the crayon handwriting font is in
  tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function drawSheet(g) {
  paper(g, 256, 192);
  // a crayon map seen from behind: a box for the shop, scribbles, a star and a big arrow
  line(g, [[30, 40], [220, 40], [220, 160], [30, 160]], '#3a2a20', 5, 3, { closed: true });
  scribbleFill(g, [[40, 50], [120, 50], [120, 100], [40, 100]], '#7fbf5f', 5, { gap: 7, alpha: 0.4 });
  line(g, [[60, 140], [110, 120], [170, 130], [195, 70]], '#e2694f', 5, 8);
  line(g, [[180, 82], [195, 70], [204, 86]], '#e2694f', 5, 9);
  ring(g, 160, 70, 18, '#4f9fc9', 4, 4); star(g, 80, 130, 13, '#f4c542', 2);
  write(g, 'MAP', 128, 22, 26, '#3a2a20', 7);
}

export function makeMapSheet() {
  const g = new T.Group();
  const geo = new T.PlaneGeometry(1.5, 1.1, 6, 4), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 4) * 0.03 + Math.cos(pos.getY(i) * 5) * 0.02);   // a bit crumpled
  geo.computeVertexNormals();
  const sheet = new T.Mesh(geo, new T.MeshStandardMaterial({ map: sheetTexture(), side: T.DoubleSide, roughness: 1 }));
  sheet.castShadow = true; g.add(sheet);
  const skin = new T.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.8 });
  const hands = [-1, 1].map((s) => {
    const h = new T.Group(), palm = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), skin); palm.scale.set(1, 0.8, 0.6); h.add(palm);
    for (let f = 0; f < 3; f++) { const fi = new T.Mesh(new T.CapsuleGeometry(0.014, 0.04, 3, 6), skin); fi.position.set((f - 1) * 0.025, 0.06, 0.02); h.add(fi); }
    h.position.set(s * 0.78, -0.42, 0.05); g.add(h); return h;
  });
  g.userData = { sheet, hands, t: 0 };
  g.visible = false;
  return g;
}

// k: 0 (put away) to 1 (held up). height: the coat's height
export function updateMapSheet(g, dt, open, height) {
  const u = g.userData; u.t += dt;
  u.k = (u.k ?? 0) + ((open ? 1 : 0) - (u.k ?? 0)) * Math.min(1, dt * 10);
  g.visible = u.k > 0.03;
  if (!g.visible) return;
  g.position.set(0, height * 0.8 - (1 - u.k) * 0.6, 0.45);
  g.scale.setScalar(0.4 + 0.6 * u.k);
  g.rotation.set(-0.12 + Math.sin(u.t * 2.1) * 0.03, Math.sin(u.t * 1.3) * 0.05, Math.sin(u.t * 1.7) * 0.04);
  u.hands.forEach((h, i) => { h.position.y = -0.42 + Math.sin(u.t * 6 + i * 2) * 0.015; });
}
