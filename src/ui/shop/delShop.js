// Dodgy Del's stall in the alley, between two jobs: a full-screen crayon drawing of a brick alley, Del
// (a 12-year-old in sunglasses) behind a pram full of stock, his speech bubble, 6 cards (4 gadgets and the
// 2 drinks), the team's sweet jar, Reroll and Next. Each player on this screen has a coloured ring they
// move with the arrows / stick (or the mouse for player 1); E / A buys or presses. Orders go out through
// onOrder(localIndex, { a, i }); the game (or the host) decides.
import { paper, write, line, ring, scribbleFill, star, loadFont } from '../crayonmap/crayon.js';
import { roundRect } from '../crayonmap/doodles.js';
import { icon } from './icons.js';

const INK = '#3a2a20';

export class DelShop {
  constructor(D, colors, onOrder) {
    this.D = D; this.colors = colors; this.onOrder = onOrder; this.open = false; this.t = 0; this.focus = [];
    const c = this.canvas = document.createElement('canvas');
    Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '45', display: 'none' });
    document.body.appendChild(c); this.ctx = c.getContext('2d'); loadFont();
    c.addEventListener('mousemove', (e) => { const b = this.hit(e.clientX, e.clientY); if (b) this.focus[0] = b.i; });
    c.addEventListener('mousedown', (e) => { const b = this.hit(e.clientX, e.clientY); if (b && e.button === 0) { this.focus[0] = b.i; this.press(0, b.i); } });
  }

  show(on) { if (on !== this.open) { this.open = on; this.canvas.style.display = on ? 'block' : 'none'; this.focus = []; this.held = []; } }

  hit(x, y) { return (this.boxes || []).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null; }

  press(li, i) {
    if (i < 6) this.onOrder(li, { a: 'buy', i });
    else if (i === 6) this.onOrder(li, { a: 'reroll' });
    else this.onOrder(li, { a: 'ready' });
  }

  // keyboard / pad: move the ring (cards in 2 rows of 3, then Reroll and Next), E / A to press
  nav(li, inp) {
    const m = inp.move ?? { x: 0, z: 0 }, dir = Math.abs(m.x) > 0.5 ? [Math.sign(m.x), 0] : Math.abs(m.z) > 0.5 ? [0, Math.sign(m.z)] : null;
    const was = this.held[li]; this.held[li] = dir ? dir.join() : null;
    let f = this.focus[li] ?? 0;
    if (dir && dir.join() !== was) {
      const pos = f < 6 ? [f % 3, Math.floor(f / 3)] : [f === 6 ? 0 : 2, 2];
      let [cx, cy] = [pos[0] + dir[0], pos[1] + dir[1]];
      cy = Math.max(0, Math.min(2, cy)); cx = Math.max(0, Math.min(2, cx));
      if (cy === 2) cx = dir[0] > 0 ? 2 : dir[0] < 0 ? 0 : pos[0] >= 1 ? 2 : 0;          // the bottom row: Reroll, Next
      f = cy < 2 ? cy * 3 + cx : cx === 0 ? 6 : 7;
    }
    this.focus[li] = f;
    if (inp.pressed('grab')) this.press(li, f);
    if (inp.pressed('shopNext')) this.press(li, 7);
  }

  // model: Game or Mirror (phase 'shop'); locals: [{ pid, slot }] the players on this screen
  draw(dt, model, locals, inputs = []) {
    if (!this.open || !model.shop) return;                     // (the job may have just started this frame)
    this.t += dt;
    locals.forEach((l, i) => { if (inputs[i]) this.nav(i, inputs[i]); });
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1), c = this.canvas;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = model.shop, run = model.run, k = Math.min(1, W / 1280, H / 720);
    paper(ctx, W, H);
    this.alley(ctx, W, H, k);
    // Del and his pram, left
    const dx = W * 0.2, dy = H * 0.62;
    this.del(ctx, dx, dy, 150 * k);
    this.bubble(ctx, 30 * k, H * 0.1, W * 0.4 - 60 * k, S.say || '', k, dx - 30 * k);
    // the sweet jar, top right
    this.jar(ctx, W * 0.32, H * 0.5, 50 * k, run.sweets);
    // the 6 cards
    this.boxes = [];
    const cw = 240 * k, ch = 180 * k, gx = W * 0.4, gy = 40 * k, gap = 18 * k;
    S.stock.forEach((s, i) => {
      const x = gx + (i % 3) * (cw + gap), y = gy + Math.floor(i / 3) * (ch + gap);
      this.card(ctx, x, y, cw, ch, s, S, model, locals, i, k);
      this.boxes.push({ x, y, w: cw, h: ch, i });
    });
    // Reroll and Next
    const by = gy + 2 * (ch + gap) + 4 * k, bw = 220 * k, bh = 54 * k;
    this.button(ctx, gx, by, bw, bh, `Reroll (${S.rerollPrice})`, '#f4c542', 6, k, run.sweets < S.rerollPrice);
    const n = model.coats.length, ready = [...S.ready].length;
    this.button(ctx, gx + 2 * (cw + gap) + cw - bw, by, bw, bh, `Next job! (${ready}/${n})`, '#7fbf5f', 7, k, false);
    this.boxes.push({ x: gx, y: by, w: bw, h: bh, i: 6 }, { x: gx + 2 * (cw + gap) + cw - bw, y: by, w: bw, h: bh, i: 7 });
    // who is ready, and what everyone carries
    this.bags(ctx, model, locals, W, H, k);
    // each local player's ring
    locals.forEach((l, li) => { const b = this.boxes.find((q) => q.i === (this.focus[li] ?? 0)); if (!b) return; const pad = (4 + li * 5) * k; line(ctx, [[b.x - pad, b.y - pad], [b.x + b.w + pad, b.y - pad], [b.x + b.w + pad, b.y + b.h + pad], [b.x - pad, b.y + b.h + pad]], this.colors[l.slot % 4], 5 * k, 900 + li, { closed: true, passes: 2, amp: 1.5 }); });
    write(ctx, 'Arrows / stick: choose · E / A: buy or press · Enter / Start: next job', W / 2, H - 16 * k, 17 * k, '#6b4a2e', 77);
  }

  alley(ctx, W, H, k) {
    // brick wall along the top, puddly cobbles at the bottom
    const bh = 26 * k, bw = 64 * k;
    for (let r = 0; r * bh < H * 0.55; r++) for (let x = -((r % 2) * bw) / 2; x < W; x += bw) {
      const pts = [[x + 3, r * bh + 3], [x + bw - 3, r * bh + 3], [x + bw - 3, (r + 1) * bh - 3], [x + 3, (r + 1) * bh - 3]];
      scribbleFill(ctx, pts, '#d98a6a', r * 31 + x, { gap: 6 * k, alpha: 0.18 });
    }
    line(ctx, [[0, H * 0.72], [W, H * 0.7]], '#8a7f77', 4 * k, 5, { passes: 2 });
    write(ctx, "DODGY DEL'S", W * 0.2, H * 0.7 + 50 * k, 42 * k, '#d0453a', 11, { outline: '#fbf6ea', rot: -0.04 });
    write(ctx, 'no refunds · no questions', W * 0.2, H * 0.7 + 88 * k, 20 * k, '#6b4a2e', 12);
  }

  // Del: a kid in sunglasses and a cap, behind a pram piled with stuff
  del(ctx, x, y, s, seed = 3) {
    const head = s * 0.2, hy = y - s * 1.05;
    // body and arms
    const body = [[x - s * 0.22, y - s * 0.75], [x + s * 0.22, y - s * 0.75], [x + s * 0.26, y - s * 0.25], [x - s * 0.26, y - s * 0.25]];
    scribbleFill(ctx, body, '#4f9fc9', seed, { gap: 4, alpha: 0.85 }); line(ctx, body, INK, 2.5, seed + 1, { closed: true, passes: 2 });
    const wave = Math.sin(this.t * 4) * 0.25;
    line(ctx, [[x + s * 0.2, y - s * 0.7], [x + s * 0.45, y - s * (0.95 + wave)]], INK, 3, seed + 2, { passes: 2 });
    line(ctx, [[x - s * 0.2, y - s * 0.7], [x - s * 0.4, y - s * 0.45]], INK, 3, seed + 3, { passes: 2 });
    // head, cap, sunglasses, grin
    scribbleFill(ctx, [[x - head, hy - head], [x + head, hy - head], [x + head, hy + head], [x - head, hy + head]], '#f0c8a0', seed + 4, { gap: 3, alpha: 0.8 });
    ring(ctx, x, hy, head, INK, 2.5, seed + 5, { passes: 2 });
    const cap = [[x - head * 1.05, hy - head * 0.35], [x + head * 1.6, hy - head * 0.35], [x + head * 0.9, hy - head * 1.1], [x - head * 0.9, hy - head * 1.1]];
    scribbleFill(ctx, cap, '#d0453a', seed + 6, { gap: 3, alpha: 0.95 }); line(ctx, cap, INK, 2, seed + 7, { closed: true, passes: 1 });
    for (const e of [-1, 1]) { const g = [[x + e * head * 0.75, hy - head * 0.15], [x + e * head * 0.12, hy - head * 0.15], [x + e * head * 0.15, hy + head * 0.25], [x + e * head * 0.7, hy + head * 0.25]]; scribbleFill(ctx, g, '#1d1d1d', seed + 8 + e, { gap: 2, alpha: 1 }); }
    line(ctx, [[x - head * 0.2, hy - head * 0.1], [x + head * 0.2, hy - head * 0.1]], '#1d1d1d', 2, seed + 10, { passes: 1 });
    line(ctx, [[x - head * 0.4, hy + head * 0.5], [x, hy + head * 0.65], [x + head * 0.45, hy + head * 0.45]], INK, 2, seed + 11, { passes: 1 });
    // the pram: a big tub on wheels, full of stuff
    const px = x - s * 0.15, py = y - s * 0.3, pw = s * 1.3, ph = s * 0.55;
    const tub = [[px - pw / 2, py], [px + pw / 2, py], [px + pw * 0.42, py + ph], [px - pw * 0.42, py + ph]];
    scribbleFill(ctx, tub, '#7a5634', seed + 12, { gap: 5, alpha: 0.85 }); line(ctx, tub, INK, 3, seed + 13, { closed: true, passes: 2 });
    line(ctx, [[px + pw / 2, py], [px + pw / 2 + s * 0.25, py - s * 0.3]], INK, 3, seed + 14, { passes: 2 });
    for (const wx of [-0.3, 0.3]) ring(ctx, px + wx * pw, py + ph + s * 0.12, s * 0.12, INK, 3, seed + 15 + wx * 10, { passes: 2 });
    star(ctx, px - pw * 0.25, py - s * 0.06, s * 0.09, '#f4c542', seed + 20); ring(ctx, px + pw * 0.05, py - s * 0.08, s * 0.08, '#5fb0ff', 4, seed + 21, { passes: 2 });
    line(ctx, [[px + pw * 0.25, py], [px + pw * 0.28, py - s * 0.2]], '#e2557a', 6, seed + 22, { passes: 2 });
    write(ctx, 'DEL', px, py + ph * 0.5, 26 * (s / 150), '#f4c542', seed + 23, { outline: INK });
  }

  bubble(ctx, x, y, w, text, k, tail = 30) {
    const size = 22 * k, words = text.split(' '), lines = []; let cur = '';
    ctx.font = `700 ${size}px Gaegu, cursive`;
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > w - 30 * k && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur);
    const h = lines.length * size * 1.15 + 24 * k;
    ctx.save(); ctx.fillStyle = '#ffffff'; roundRect(ctx, x, y, w, h, 18 * k); ctx.fill(); ctx.restore();
    line(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], INK, 2.5, 44, { closed: true, passes: 2 });
    line(ctx, [[x + tail - 20 * k, y + h], [x + tail, y + h + 34 * k], [x + tail + 20 * k, y + h]], INK, 2.5, 45, { passes: 2 });
    lines.forEach((l, i) => write(ctx, l, x + 16 * k, y + 12 * k + size * 0.6 + i * size * 1.15, size, INK, 50 + i, { align: 'left' }));
  }

  jar(ctx, x, y, r, sweets) {
    const pts = [[x - r * 0.7, y - r], [x + r * 0.7, y - r], [x + r, y - r * 0.5], [x + r, y + r], [x - r, y + r], [x - r, y - r * 0.5]];
    scribbleFill(ctx, pts.map(([a, b]) => [a, Math.max(b, y - r * 0.2)]), '#f2a6c0', 61, { gap: 5, alpha: 0.6 });
    for (let i = 0; i < 7; i++) ring(ctx, x - r * 0.6 + (i % 4) * r * 0.4, y + r * 0.7 - Math.floor(i / 4) * r * 0.35, r * 0.13, ['#e2557a', '#f4c542', '#7fbf5f', '#4f9fc9'][i % 4], 4, 62 + i, { passes: 2 });
    line(ctx, pts, INK, 3, 70, { closed: true, passes: 2 });
    write(ctx, String(sweets), x, y + r * 0.05, r * 0.6, INK, 71, { outline: '#fbf6ea' });
    write(ctx, 'sweet jar', x, y + r + 20, r * 0.32, '#6b4a2e', 72);
  }

  card(ctx, x, y, w, h, s, S, model, locals, i, k) {
    const isDrink = s.kind === 'drink', def = isDrink ? this.D.shop.drinks[s.id] : this.D.gadgets.gadgets[s.id], price = S.price(s.id);
    const me = locals[0] ? model.run.of(locals[0].pid) : null, have = me && !isDrink ? me.gadgets.find((g) => g.id === s.id) : null;
    const tilt = (((i * 37) % 7) - 3) * 0.006;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(tilt); ctx.translate(-x - w / 2, -y - h / 2);
    ctx.fillStyle = isDrink ? '#fde6ee' : '#fffdf4'; roundRect(ctx, x, y, w, h, 14 * k); ctx.fill();
    line(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], INK, 2.5, 100 + i, { closed: true, passes: 2 });
    icon(ctx, s.id, x + w / 2, y + h * 0.3, h * 0.24, this.t);
    write(ctx, def?.name ?? s.id, x + w / 2, y + h * 0.58, 24 * k, INK, 110 + i);
    const blurb = isDrink ? def.blurb : (def?.useful ?? '').split(/[.:;,]/)[0];
    // the blurb fits between the name and the price (M1-F5: it used to run into the price on short cards)
    this.small(ctx, blurb, x + w / 2, y + h * 0.58 + 15 * k, w - 20 * k, 15 * k, (y + h - 38 * k) - (y + h * 0.58 + 15 * k));
    (this.layout ??= [])[i] = { blurbBottom: this.lastLines.bottom, priceTop: y + h - 35 * k };       // (the screenshot check reads this)
    // price, with a little sweet
    ring(ctx, x + w / 2 - 36 * k, y + h - 22 * k, 8 * k, '#e2557a', 4 * k, 120 + i, { passes: 2 });
    write(ctx, `${price}`, x + w / 2 + 4 * k, y + h - 22 * k, 26 * k, model.run.sweets >= price ? '#3f8a3a' : '#d0453a', 130 + i);
    if (isDrink && s.left > 0) write(ctx, `${s.left} left`, x + w - 40 * k, y + h - 22 * k, 16 * k, '#6b4a2e', 140 + i);
    if (have) write(ctx, `got ×${have.copies}`, x + 44 * k, y + 20 * k, 16 * k, '#4f9fc9', 150 + i);
    ctx.restore();
    if (s.left <= 0) write(ctx, 'SOLD!', x + w / 2, y + h / 2, 52 * k, '#d0453a', 160 + i, { rot: -0.3, outline: '#fbf6ea' });
  }

  // small wrapped text in the box from top (y) down maxH: shrinks a little to fit, then cuts with "..."
  small(ctx, text, x, y, w, size, maxH = size * 2.2) {
    const wrap = (sz) => {
      ctx.font = `700 ${sz}px Gaegu, cursive`;
      const words = text.split(' '), lines = []; let cur = '';
      for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; }
      if (cur) lines.push(cur);
      return lines;
    };
    let sz = size, lines = wrap(sz);
    while (sz > size * 0.75 && lines.length * sz * 1.1 > maxH) lines = wrap(sz -= 1);
    const fit = Math.max(1, Math.floor(maxH / (sz * 1.1)));
    if (lines.length > fit) { lines = lines.slice(0, fit); lines[fit - 1] = lines[fit - 1].replace(/\s*\S*$/, '') + '...'; }
    this.lastLines = { lines, sz, bottom: y + lines.length * sz * 1.1 };                  // (the tests read this)
    lines.forEach((l, i) => write(ctx, l, x, y + sz * 0.55 + i * sz * 1.1, sz, '#6b4a2e', 170 + i));
  }

  button(ctx, x, y, w, h, label, color, i, k, off) {
    ctx.save(); ctx.globalAlpha = off ? 0.45 : 1; ctx.fillStyle = '#fffdf4'; roundRect(ctx, x, y, w, h, 14 * k); ctx.fill();
    scribbleFill(ctx, [[x + 6, y + 6], [x + w - 6, y + 6], [x + w - 6, y + h - 6], [x + 6, y + h - 6]], color, 180 + i, { gap: 6 * k, alpha: 0.7 });
    line(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], INK, 3, 190 + i, { closed: true, passes: 2 });
    write(ctx, label, x + w / 2, y + h / 2 + 2, 26 * k, INK, 195 + i); ctx.restore();
  }

  // a strip along the bottom: each player's colour, ready tick, gadgets and drinks
  bags(ctx, model, locals, W, H, k) {
    const S = model.shop, n = model.coats.length, w = Math.min(300 * k, (W * 0.58) / Math.max(1, n)), y = H - 124 * k;
    model.coats.forEach((c, i) => {
      const x = W * 0.4 + i * (w + 10 * k), col = this.colors[(c.slot ?? 0) % 4], kit = model.run.of(c.pid), ready = S.ready.has(c.pid);
      const me = locals.some((l) => l.pid === c.pid);
      write(ctx, `${me ? 'YOU' : 'P' + ((c.slot ?? 0) + 1)}${ready ? ' ✔ ready' : ''}`, x, y, 20 * k, col, 300 + i, { align: 'left', outline: '#fbf6ea' });
      const gs = kit.gadgets.map((g) => `${this.D.gadgets.gadgets[g.id]?.name ?? g.id}${g.copies > 1 ? ' ×' + g.copies : ''}`).join(', ');
      const ds = kit.drinks.map((d) => this.D.shop.drinks[d]?.name ?? d).join(', ');
      // (M1-F6: the lists wrap inside this player's column, so they never run into the next player's label)
      const room = w - 12 * k, bottom = H - 30 * k;                                   // (above the help line at the bottom)
      let yy = this.wrapLeft(ctx, gs, x, y + 14 * k, room, 15 * k, ds ? (bottom - y - 14 * k) * 0.62 : bottom - y - 14 * k, INK, 310 + i);
      if (ds) yy = this.wrapLeft(ctx, `Drinks: ${ds}`, x, yy + 2 * k, room, 15 * k, bottom - yy - 2 * k, '#c4553d', 320 + i);
      (this.bagLayout ??= [])[i] = { x, right: x + this.lastWidth, next: W * 0.4 + (i + 1) * (w + 10 * k), last: i === n - 1, bottom: yy, H };
    });
    if (this.bagLayout) this.bagLayout.length = n;
  }

  // left-aligned wrapped text from (x, y) down, at most maxH tall: shrinks a little to fit, then cuts with "..."
  wrapLeft(ctx, text, x, y, w, size, maxH, color, seed) {
    const wrap = (sz) => {
      ctx.font = `700 ${sz}px Gaegu, cursive`;
      const words = text.split(' '), lines = []; let cur = '';
      for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; }
      if (cur) lines.push(cur);
      return lines;
    };
    let sz = size, lines = wrap(sz);
    while (sz > size * 0.75 && lines.length * sz * 1.1 > maxH) lines = wrap(sz -= 1);
    const fit = Math.max(1, Math.floor(maxH / (sz * 1.1)));
    if (lines.length > fit) { lines = lines.slice(0, fit); lines[fit - 1] = lines[fit - 1].replace(/\s*\S*$/, '') + '...'; }
    this.lastWidth = 0;
    lines.forEach((l, i) => { this.lastWidth = Math.max(this.lastWidth, write(ctx, l, x, y + sz * 0.55 + i * sz * 1.1, sz, color, seed + i, { align: 'left' })); });
    return y + lines.length * sz * 1.1;
  }
}
