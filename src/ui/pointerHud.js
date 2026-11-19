// The small arrow at the screen edge that points the way (src/systems/pointer.js says where to): to the
// job's target while you don't hold it, to the getaway gate once you do. Hidden while the place is on
// screen (the floating sign over the target, or the gate's own sign, shows it then).
//   arrowFor(sx, sy, behind, w, h) -> { on, x, y, angle }   (pure, for the tests)
import * as T from 'three';

// how far from each edge the arrow sits: clear of the quota bar (top), the hint line and the coat HUD
// (bottom); and it slides out of the Heat / Closing Time / Giggles boxes in the top right corner
const M = { top: 92, bottom: 120, side: 60 };

export function arrowFor(sx, sy, behind, w, h) {
  if (!behind && sx >= M.side && sx <= w - M.side && sy >= M.top && sy <= h - M.bottom) return { on: true, x: sx, y: sy, angle: 0 };
  const cx = w / 2, cy = (M.top + h - M.bottom) / 2; let dx = sx - cx, dy = sy - cy;
  if (behind) { dx = -dx; dy = -dy; }
  if (!dx && !dy) dy = 1;
  const k = Math.min((w / 2 - M.side) / Math.abs(dx || 1e-6), (dy < 0 ? cy - M.top : h - M.bottom - cy) / Math.abs(dy || 1e-6));
  let x = cx + dx * k, y = cy + dy * k;
  if (x > w - 320 && y < 200) { if (dx > 0 && Math.abs(dx) * 0.6 > Math.abs(dy)) y = 200; else x = w - 320; }
  return { on: false, x, y, angle: Math.atan2(dy, dx) };
}

export class PointerHud {
  constructor(el) { this.el = el; this.v = new T.Vector3(); this.last = ''; }

  update(ptr, camera, w, h) {
    if (!ptr) { this.el.style.display = 'none'; this.state = null; return; }
    const p = this.v.set(ptr.x, 1, ptr.z).project(camera), behind = p.z > 1;
    const a = arrowFor((p.x + 1) / 2 * w, (1 - p.y) / 2 * h, behind, w, h);
    this.state = { ...a, to: ptr.to };
    if (a.on) { this.el.style.display = 'none'; return; }
    this.el.style.display = 'block';
    if (this.last !== ptr.label) { this.el.innerHTML = `<i>➤</i><span>${ptr.label}</span>`; this.last = ptr.label; }
    this.el.querySelector('i').style.transform = `rotate(${a.angle}rad)`;
    this.el.className = ptr.to;
    this.el.style.transform = `translate(${a.x - 18}px, ${a.y - 18}px)`;
  }
}
