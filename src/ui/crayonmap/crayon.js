// Crayon drawing on a 2D canvas: wobbly lines drawn in a few passes with a grainy texture, scribbled
// fills, a kid's handwriting (the free Gaegu font, OFL), and the paper itself. Every wobble comes from a
// seed, so a line looks the same every frame instead of fizzing.
import GAEGU from '../../../assets/fonts/gaegu-bold.woff2';

export const FONT = 'Gaegu, "Comic Sans MS", "Chalkboard SE", cursive';
let fontReady = null;
export function loadFont() {
  if (fontReady) return fontReady;
  try { const f = new FontFace('Gaegu', `url(${GAEGU})`, { weight: '700' }); document.fonts.add(f); fontReady = f.load().catch(() => null); } catch { fontReady = Promise.resolve(null); }
  return fontReady;
}

// a tiny repeatable random number from a seed
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// a grainy crayon texture in one colour (cached): the colour with little gaps where the paper shows
const grains = new Map();
export function grain(ctx, color) {
  if (grains.has(color)) return grains.get(color);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 64, 64);
  const img = g.getImageData(0, 0, 64, 64), d = img.data;
  for (let i = 0; i < 64 * 64; i++) { const r = hash(i * 1.7 + color.length * 13 + color.charCodeAt(1)); d[i * 4 + 3] = r < 0.18 ? 0 : r < 0.4 ? 150 : 255; }
  g.putImageData(img, 0, 0);
  const p = ctx.createPattern(c, 'repeat'); grains.set(color, p); return p;
}

// split a polyline into short pieces, each nudged sideways a little (smoothly, from the seed)
function wobble(pts, seed, amp, step = 7) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
    const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n, j = (out.length + seed * 7.3) * 0.37, w = (Math.sin(j) * 0.6 + (hash(j) - 0.5) * 0.8) * amp;
      out.push([ax + (bx - ax) * t + nx * w, ay + (by - ay) * t + ny * w]);
    }
  }
  const [lx, ly] = pts[pts.length - 1]; out.push([lx + (hash(seed) - 0.5) * amp, ly + (hash(seed + 1) - 0.5) * amp]);
  return out;
}

// a crayon line: 3 passes, slightly apart, with grain. pts in canvas pixels
export function line(ctx, pts, color, width = 4, seed = 1, { passes = 3, amp = 1.6, alpha = 0.85, closed = false } = {}) {
  if (pts.length < 2) return;
  const P = closed ? [...pts, pts[0]] : pts;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = grain(ctx, color);
  for (let p = 0; p < passes; p++) {
    const w = wobble(P, seed + p * 17, amp * (1 + p * 0.4));
    ctx.globalAlpha = alpha * (p === 0 ? 1 : 0.55); ctx.lineWidth = width * (p === 0 ? 1 : 0.7);
    ctx.beginPath(); w.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  ctx.restore();
}

// coloured in like a kid does it: zigzag strokes inside the shape, never quite to the edge
export function scribbleFill(ctx, poly, color, seed = 1, { gap = 9, alpha = 0.35, angle = 0.7 } = {}) {
  ctx.save(); ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), span = Math.hypot(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ca = Math.cos(angle), sa = Math.sin(angle);
  const pts = [];
  for (let k = -span / 2, i = 0; k <= span / 2; k += gap, i++) {
    const s = (i % 2 ? 1 : -1) * span / 2, j = (hash(seed + i) - 0.5) * gap * 0.8;
    pts.push([cx + ca * s - sa * (k + j), cy + sa * s + ca * (k + j)]);
  }
  ctx.strokeStyle = grain(ctx, color); ctx.globalAlpha = alpha; ctx.lineWidth = gap * 0.9; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.restore();
}

// handwriting: letters a little up and down and tilted
export function write(ctx, text, x, y, size, color, seed = 1, { align = 'center', outline = null, rot = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot + (hash(seed) - 0.5) * 0.08);
  ctx.font = `700 ${size}px ${FONT}`; ctx.textBaseline = 'middle';
  const widths = [...text].map((ch) => ctx.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? -total / 2 : align === 'right' ? -total : 0;
  [...text].forEach((ch, i) => {
    ctx.save(); ctx.translate(cx + widths[i] / 2, (hash(seed + i * 3.1) - 0.5) * size * 0.12); ctx.rotate((hash(seed + i * 5.7) - 0.5) * 0.18);
    if (outline) { ctx.lineWidth = size * 0.22; ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.strokeText(ch, -widths[i] / 2, 0); }
    ctx.fillStyle = color; ctx.fillText(ch, -widths[i] / 2, 0); ctx.restore();
    cx += widths[i];
  });
  ctx.restore();
  return total;
}

// a wobbly circle or ring
export function ring(ctx, x, y, r, color, width = 3, seed = 1, opts = {}) {
  const n = Math.max(10, Math.round(r * 0.8)), pts = [];
  for (let i = 0; i <= n + 1; i++) { const a = (i / n) * Math.PI * 2 + hash(seed) * 6, rr = r * (1 + (hash(seed + i) - 0.5) * 0.08); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  line(ctx, pts, color, width, seed, { ...opts, amp: opts.amp ?? 0.8 });
}

// a five-point star (gold stars for loot, dizzy stars)
export function star(ctx, x, y, r, color, seed = 1, outline = '#7a4b12') {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  scribbleFill(ctx, pts, color, seed, { gap: Math.max(2, r * 0.3), alpha: 0.95 });
  line(ctx, pts, outline, Math.max(1.5, r * 0.14), seed, { closed: true, amp: 0.6, passes: 2 });
}

// the sheet of paper: warm off-white, faint blue lines like an exercise book, soft grain
export function paper(ctx, w, h) {
  ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#4a7fc0'; ctx.lineWidth = 1;
  for (let y = 40; y < h; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = '#d0453a'; ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(70, h); ctx.stroke();
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#7b6a4a';
  for (let i = 0; i < 2600; i++) ctx.fillRect(hash(i) * w, hash(i + 0.5) * h, 1.5, 1.5);
  ctx.restore();
}
