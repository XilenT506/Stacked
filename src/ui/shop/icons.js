// Little crayon pictures of what Del sells, for the shop cards. A thing without a picture gets a gold star.
import { line, ring, scribbleFill, star } from '../crayonmap/crayon.js';

const INK = '#3a2a20';
const box = (x, y, w, h) => [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]];
const fill = (ctx, pts, col, seed, s) => { scribbleFill(ctx, pts, col, seed, { gap: Math.max(2, s * 0.08), alpha: 0.9 }); line(ctx, pts, INK, Math.max(1.5, s * 0.05), seed + 1, { closed: true, passes: 2 }); };

// a fizzy drink can with a label colour, bubbles rising
function can(ctx, x, y, s, col, t, seed) {
  fill(ctx, box(x, y, s * 0.6, s * 1.1), col, seed, s);
  line(ctx, [[x - s * 0.3, y - s * 0.38], [x + s * 0.3, y - s * 0.38]], '#fffdf4', s * 0.08, seed + 2, { passes: 1 });
  for (let i = 0; i < 3; i++) ring(ctx, x + (i - 1) * s * 0.18, y - s * 0.7 - ((t * 30 + i * 13) % (s * 0.4)), s * 0.05, '#7fc8ff', 2, seed + 3 + i, { passes: 1 });
}

export function icon(ctx, id, x, y, s, t = 0) {
  switch (id) {
    case 'water_pistol': fill(ctx, [[x - s * 0.6, y - s * 0.2], [x + s * 0.5, y - s * 0.2], [x + s * 0.5, y + s * 0.1], [x - s * 0.1, y + s * 0.1], [x - s * 0.2, y + s * 0.5], [x - s * 0.5, y + s * 0.5], [x - s * 0.4, y + s * 0.1], [x - s * 0.6, y + s * 0.1]], '#5fb0ff', 1, s); line(ctx, [[x + s * 0.55, y - s * 0.05], [x + s * 0.9, y + s * 0.05]], '#7fc8ff', 4, 3, { passes: 2 }); break;
    case 'slingshot': line(ctx, [[x, y + s * 0.6], [x, y], [x - s * 0.35, y - s * 0.5]], '#7a5634', s * 0.12, 4, { passes: 2 }); line(ctx, [[x, y], [x + s * 0.35, y - s * 0.5]], '#7a5634', s * 0.12, 5, { passes: 2 }); line(ctx, [[x - s * 0.35, y - s * 0.5], [x, y - s * 0.2], [x + s * 0.35, y - s * 0.5]], '#d0453a', 3, 6, { passes: 1 }); break;
    case 'banana_peel': fill(ctx, [[x - s * 0.6, y + s * 0.3], [x - s * 0.2, y - s * 0.3], [x, y + s * 0.1], [x + s * 0.2, y - s * 0.35], [x + s * 0.6, y + s * 0.3], [x, y + s * 0.45]], '#f4d03f', 7, s); break;
    case 'water_balloon': { const pts = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; pts.push([x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.55 - (Math.sin(a) < 0 ? s * 0.05 : 0)]); } fill(ctx, pts, '#5fb0ff', 8, s); line(ctx, [[x, y + s * 0.55], [x - s * 0.08, y + s * 0.72], [x + s * 0.08, y + s * 0.72], [x, y + s * 0.55]], INK, 2, 9, { passes: 1 }); break; }
    case 'whoopee_cushion': { const pts = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; pts.push([x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.35]); } fill(ctx, pts, '#e2557a', 10, s); fill(ctx, box(x + s * 0.7, y, s * 0.25, s * 0.15), '#e2557a', 12, s); break; }
    case 'bubble_wrap': fill(ctx, box(x, y, s * 1.3, s * 0.9), '#d8eef7', 13, s); for (let i = 0; i < 12; i++) ring(ctx, x - s * 0.45 + (i % 4) * s * 0.3, y - s * 0.28 + Math.floor(i / 4) * s * 0.28, s * 0.1, '#7fa8c0', 2, 14 + i, { passes: 1 }); break;
    case 'stink_bomb': { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; pts.push([x + Math.cos(a) * s * 0.42, y + s * 0.1 + Math.sin(a) * s * 0.42]); } fill(ctx, pts, '#8fbf3f', 26, s); for (let i = 0; i < 3; i++) line(ctx, [[x + (i - 1) * s * 0.25, y - s * 0.35], [x + (i - 1) * s * 0.25 + Math.sin(t * 3 + i) * 6, y - s * 0.6], [x + (i - 1) * s * 0.25, y - s * 0.85]], '#7a9a3a', 3, 27 + i, { passes: 1 }); break; }
    case 'sugar_rush': can(ctx, x, y, s, '#e2557a', t, 30); line(ctx, [[x - s * 0.1, y - s * 0.15], [x + s * 0.1, y - s * 0.15], [x - s * 0.08, y + s * 0.2], [x + s * 0.1, y + s * 0.2]], '#fffdf4', 3, 34, { passes: 1 }); break;
    case 'burp_blaster': can(ctx, x, y, s, '#7fbf5f', t, 40); for (let i = 1; i <= 2; i++) ring(ctx, x + s * 0.65, y, s * 0.15 * i, '#7fbf5f', 2, 44 + i, { passes: 1 }); break;
    default: star(ctx, x, y, s * 0.5, '#f4c542', 50);
  }
}
