// Small arrows at the screen edge that point the way (src/systems/pointer.js says where to): to the job's
// target while you don't hold it, to the getaway gate once you do, and (M1-F2) to each of your loose kids
// in their own colour. An arrow hides while its place is on screen (the floating sign, the gate's own
// sign or the kid's marker shows it then).
//   arrowFor(sx, sy, behind, w, h) -> { on, x, y, angle }   (pure, for the tests)
import * as T from 'three';

// how far from each edge the arrow sits: clear of the quota bar (top), the hint line and the coat HUD
// (bottom); and it slides out of the Heat / Closing Time / Giggles boxes (top right) and the Online panel (bottom left)
const M = { top: 92, bottom: 120, side: 60 };

export function arrowFor(sx, sy, behind, w, h) {
  if (!behind && sx >= M.side && sx <= w - M.side && sy >= M.top && sy <= h - M.bottom) return { on: true, x: sx, y: sy, angle: 0 };
  const cx = w / 2, cy = (M.top + h - M.bottom) / 2; let dx = sx - cx, dy = sy - cy;
  if (behind) { dx = -dx; dy = -dy; }
  if (!dx && !dy) dy = 1;
  const k = Math.min((w / 2 - M.side) / Math.abs(dx || 1e-6), (dy < 0 ? cy - M.top : h - M.bottom - cy) / Math.abs(dy || 1e-6));
  let x = cx + dx * k, y = cy + dy * k;
  if (x > w - 320 && y < 200) { if (dx > 0 && Math.abs(dx) * 0.6 > Math.abs(dy)) y = 200; else x = w - 320; }
  if (x < 270 && y > h - 230) { if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 0.6) x = 270; else y = h - 230; }   // the Online panel and coat HUD, bottom left
  return { on: false, x, y, angle: Math.atan2(dy, dx) };
}

export class PointerHud {
  constructor(el) { this.el = el; this.v = new T.Vector3(); this.els = []; this.state = null; this.states = []; }

  // list: [{ x, z, label, to: 'target' | 'gate' | 'kid', color? }]; the first one is the way to go
  update(list, camera, w, h) {
    list = (Array.isArray(list) ? list : [list]).filter(Boolean);
    while (this.els.length < list.length) { const e = document.createElement('div'); e.className = 'pointer'; this.el.appendChild(e); this.els.push({ e, label: '' }); }
    this.states = list.map((p, i) => {
      const q = this.v.set(p.x, p.to === 'kid' ? 0.5 : 1, p.z).project(camera), a = arrowFor((q.x + 1) / 2 * w, (1 - q.y) / 2 * h, q.z > 1, w, h), E = this.els[i];
      E.e.style.display = a.on ? 'none' : 'block';
      if (!a.on) {
        if (E.label !== p.label + p.to) { E.e.innerHTML = `<i>➤</i><span>${p.label}</span>`; E.label = p.label + p.to; }
        E.e.className = 'pointer ' + p.to; E.e.querySelector('i').style.color = p.color ?? '';
        E.e.querySelector('i').style.transform = `rotate(${a.angle}rad)`;
        E.e.style.transform = `translate(${a.x - 18}px, ${a.y - 18}px)`;
      }
      return { ...a, to: p.to };
    });
    for (let i = list.length; i < this.els.length; i++) this.els[i].e.style.display = 'none';
    this.el.style.display = 'block';
    this.state = this.states.find((s) => s.to !== 'kid') ?? null;
  }
}
