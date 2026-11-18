// The little drawings on the crayon map: grown-ups (each type its own doodle, with how they were when last
// seen: upside down with stars after a slip, dripping when soaked, X eyes when blinded, a tiny devil for a
// toddler), the team's coats, event bursts, the stickers and the arrows players draw.
import { line, ring, star, write, scribbleFill, hash } from './crayon.js';

const INK = '#3a2a20';
const LOOK = {
  shopper: { body: '#5fae4f' }, granny: { body: '#9a6fd1', bun: true, stick: true }, shelf_stacker: { body: '#e08a3a', cap: '#e08a3a' },
  guard: { body: '#3d5fa8', cap: '#22335e' }, cashier: { body: '#d0453a', cap: null }, baker: { body: '#f4efe6', chef: true },
  caretaker: { body: '#7a5634', keys: true }, toddler: { body: '#e2694f', devil: true },
};

// "?" from yellow to red as it fills; "!" once they know
function meter(ctx, x, y, s, sus, hostile, seed) {
  if (hostile) { write(ctx, '!', x, y, s * 1.3, '#d0453a', seed, { outline: '#fff8e8' }); return; }
  if (sus < 0.08) return;
  const col = sus > 0.66 ? '#d0453a' : sus > 0.33 ? '#e08a3a' : '#c9a227';
  write(ctx, sus > 0.66 ? '???' : sus > 0.33 ? '??' : '?', x, y, s * (0.8 + sus * 0.6), col, seed, { outline: '#fff8e8' });
}

// a grown-up: x, y = where their feet are on the map; s = how big (pixels for a 1.8 m grown-up)
export function grownup(ctx, x, y, s, p, t = 0, faded = false) {
  const L = LOOK[p.type] ?? LOOK.shopper, seed = (typeof p.id === 'number' ? p.id : String(p.id).length) * 11 + 3;
  ctx.save(); ctx.globalAlpha = faded ? 0.45 : 1;
  ctx.translate(x, y);
  const slipped = p.state === 'slipped' || p.state === 'stunned';
  if (slipped) ctx.rotate(Math.PI);                      // flat on their back, legs in the air: drawn upside down
  if (L.devil) s *= 0.6;
  const head = s * 0.17, by = -s * 0.42, sh = s * 0.32;
  // legs and arms (sticks)
  line(ctx, [[-s * 0.1, 0], [-s * 0.05, by + sh * 0.5]], INK, 2.4, seed, { passes: 2 });
  line(ctx, [[s * 0.1, 0], [s * 0.05, by + sh * 0.5]], INK, 2.4, seed + 1, { passes: 2 });
  const angry = p.hostile || p.state === 'chase';
  const arm = angry ? -s * 0.2 : 0;
  line(ctx, [[-s * 0.12, by - sh * 0.15], [-s * 0.3, by + arm]], INK, 2.2, seed + 2, { passes: 2 });
  line(ctx, [[s * 0.12, by - sh * 0.15], [s * 0.3, by + arm]], INK, 2.2, seed + 3, { passes: 2 });
  // body: a triangle dress-ish coat
  const body = [[0, by - sh * 0.7], [s * 0.18, by + sh * 0.6], [-s * 0.18, by + sh * 0.6]];
  scribbleFill(ctx, body, L.body, seed, { gap: Math.max(2.5, s * 0.06), alpha: 0.85 });
  line(ctx, body, INK, 2.2, seed + 4, { closed: true, passes: 2, amp: 0.8 });
  // head
  const hy = by - sh * 0.7 - head;
  scribbleFill(ctx, [[-head, hy - head], [head, hy - head], [head, hy + head], [-head, hy + head]].map(([a, b]) => [a * 0.9, b]), '#f0c8a0', seed + 5, { gap: 3, alpha: 0.7 });
  ring(ctx, 0, hy, head, INK, 2, seed + 6, { passes: 2 });
  // face
  if (p.blinded) { for (const e of [-1, 1]) { line(ctx, [[e * head * 0.45 - 3, hy - 3], [e * head * 0.45 + 3, hy + 3]], INK, 1.6, seed + 7 + e, { passes: 1 }); line(ctx, [[e * head * 0.45 - 3, hy + 3], [e * head * 0.45 + 3, hy - 3]], INK, 1.6, seed + 9 + e, { passes: 1 }); } }
  else { ctx.fillStyle = INK; for (const e of [-1, 1]) { ctx.beginPath(); ctx.arc(e * head * 0.42, hy - head * 0.1, Math.max(1.2, head * 0.13), 0, 7); ctx.fill(); } }
  if (angry) for (const e of [-1, 1]) line(ctx, [[e * head * 0.7, hy - head * 0.55], [e * head * 0.15, hy - head * 0.3]], INK, 1.8, seed + 11 + e, { passes: 1 });
  // hats and extras
  if (L.cap) { const c = [[-head * 1.1, hy - head * 0.6], [head * 1.1, hy - head * 0.6], [head * 0.8, hy - head * 1.3], [-head * 0.8, hy - head * 1.3]]; scribbleFill(ctx, c, L.cap, seed + 12, { gap: 2.5, alpha: 0.95 }); line(ctx, c, INK, 1.6, seed + 13, { closed: true, passes: 1 }); }
  if (L.chef) { ring(ctx, 0, hy - head * 1.5, head * 0.8, INK, 1.8, seed + 14, { passes: 1 }); }
  if (L.bun) ring(ctx, 0, hy - head * 1.15, head * 0.45, '#9aa0a8', 2.4, seed + 15, { passes: 2 });
  if (L.stick) line(ctx, [[s * 0.3, by], [s * 0.36, 0]], '#7a5634', 2.4, seed + 16, { passes: 1 });
  if (L.keys) { ring(ctx, s * 0.3, by + 4, 4, '#c9a227', 2, seed + 17, { passes: 1 }); }
  if (L.devil) {
    for (const e of [-1, 1]) line(ctx, [[e * head * 0.5, hy - head * 0.8], [e * head * 0.85, hy - head * 1.6], [e * head * 0.2, hy - head * 0.95]], '#d0453a', 2.2, seed + 18 + e, { passes: 2 });
    line(ctx, [[s * 0.15, by + sh * 0.5], [s * 0.35, by + sh * 0.2], [s * 0.42, by + sh * 0.35]], '#d0453a', 2, seed + 21, { passes: 1 });
  }
  if (p.soaked) for (let i = 0; i < 3; i++) { const dx = (i - 1) * s * 0.16, dy = by + sh * 0.9 + ((t * 30 + i * 9) % 12); line(ctx, [[dx, dy], [dx - 1.5, dy + 4], [dx + 1.5, dy + 4], [dx, dy]], '#4f9fc9', 2, seed + 22 + i, { passes: 1, amp: 0.3 }); }
  ctx.restore();
  // dizzy stars go round the head of someone flat on the floor (the right way up, so after the restore)
  if (slipped) for (let i = 0; i < 3; i++) { const a = t * 3 + (i * Math.PI * 2) / 3; star(ctx, x + Math.cos(a) * s * 0.28, y + s * 0.62 + Math.sin(a) * s * 0.1, s * 0.07, '#f4c542', seed + i); }
  if (!faded || p.hostile) meter(ctx, x + s * 0.32, y - (slipped ? s * 0.1 : s * 1.05), s * 0.42, p.sus ?? 0, p.hostile, seed);
}

// a team coat: a tall tan trench coat with three tiny heads poking out of the collar (or fewer), in the player's colour
export function coat(ctx, x, y, s, color, label, { kids = 3, mapOpen = false, caged = false, seed = 1 } = {}) {
  const h = s * (kids >= 3 ? 1 : kids === 2 ? 0.8 : 0.45), w = s * 0.32;
  const body = [[-w * 0.6, y - h * 0.85], [w * 0.6, y - h * 0.85], [w, y], [-w, y]].map(([a, b]) => [x + a, b]);
  scribbleFill(ctx, body, '#a77b52', seed, { gap: 3, alpha: 0.9 });
  line(ctx, body, color, 3.2, seed + 1, { closed: true, passes: 3, amp: 0.9 });
  const hy = y - h * 0.85 - s * 0.1;
  ring(ctx, x, hy, s * 0.11, INK, 2, seed + 2, { passes: 2 });
  // the hat
  line(ctx, [[x - s * 0.2, hy - s * 0.07], [x + s * 0.2, hy - s * 0.07]], INK, 3, seed + 3, { passes: 2 });
  line(ctx, [[x - s * 0.1, hy - s * 0.07], [x - s * 0.1, hy - s * 0.2], [x + s * 0.1, hy - s * 0.2], [x + s * 0.1, hy - s * 0.07]], INK, 2.6, seed + 4, { passes: 2 });
  if (mapOpen) { const p = [[x - s * 0.3, hy - s * 0.02], [x + s * 0.3, hy - s * 0.02], [x + s * 0.3, hy + s * 0.32], [x - s * 0.3, hy + s * 0.32]]; scribbleFill(ctx, p, '#fffdf4', seed + 5, { gap: 2, alpha: 1 }); line(ctx, p, INK, 1.6, seed + 6, { closed: true, passes: 1 }); }
  if (caged) for (let i = -2; i <= 2; i++) line(ctx, [[x + i * s * 0.12, y + 2], [x + i * s * 0.12, hy - s * 0.25]], '#555', 1.8, seed + 7 + i, { passes: 1 });
  if (label) write(ctx, label, x, y + s * 0.2, Math.max(13, s * 0.32), color, seed + 9, { outline: '#fffdf4' });
}

// an event: a spiky burst with its name
export function burst(ctx, x, y, r, text, seed = 1, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.6 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  scribbleFill(ctx, pts, '#f4c542', seed, { gap: 4, alpha: 0.75 });
  line(ctx, pts, '#d0453a', 2.4, seed + 1, { closed: true, passes: 2 });
  write(ctx, '!', x, y + 1, r * 1.1, '#d0453a', seed + 2);
  if (text) write(ctx, text, x, y + r + 12, 17, '#d0453a', seed + 3, { outline: '#fffdf4' });
  ctx.restore();
}

// a sticker: a slightly tilted label with a white border, like the ones from a sticker book
export function sticker(ctx, x, y, text, color, seed = 1, size = 22) {
  ctx.save(); ctx.font = `700 ${size}px Gaegu, cursive`;
  const w = ctx.measureText(text).width + size * 0.9, h = size * 1.35, rot = (hash(seed) - 0.5) * 0.3;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(60,40,20,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 10); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = color; roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
  ctx.restore();
  write(ctx, text, x, y + 1, size, '#ffffff', seed, { rot, outline: 'rgba(0,0,0,0.25)' });
}

export function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// an arrow head at the end of a drawn line (pixels)
export function arrowHead(ctx, pts, color, width, seed) {
  if (pts.length < 2) return;
  const [bx, by] = pts[pts.length - 1];
  let k = pts.length - 2; while (k > 0 && Math.hypot(pts[k][0] - bx, pts[k][1] - by) < 14) k--;
  const [ax, ay] = pts[k], a = Math.atan2(by - ay, bx - ax), L = 10 + width * 3;
  line(ctx, [[bx - Math.cos(a - 0.5) * L, by - Math.sin(a - 0.5) * L], [bx, by], [bx - Math.cos(a + 0.5) * L, by - Math.sin(a + 0.5) * L]], color, width, seed, { passes: 2 });
}
