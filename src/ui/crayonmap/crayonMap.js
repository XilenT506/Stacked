// The crayon map screen (Tab, or Back on a gamepad): a big sheet of paper over the game with the live map
// (mapDraw.js) and a box of crayons and stickers down the side. Drag on the map to draw a line, an arrow or
// a circle; click to put a sticker down. Everything you draw goes to the whole team (onScribble) and shows
// up on the floor of the shop in chalk. Gamepad: left stick moves the crayon, A draws or presses,
// LB / RB change crayon, X rubs out your own drawings, B or Back closes.
import { paper, write, line, loadFont } from './crayon.js';
import { MapView, drawBase, drawLive, drawScribble } from './mapDraw.js';
import { sticker, roundRect } from './doodles.js';

const TOOLS = [{ id: 'line', label: 'Draw' }, { id: 'arrow', label: 'Arrow' }, { id: 'circle', label: 'Circle' }];

export class CrayonMap {
  // place: the place's JSON; cfg: data/crayonmap.json; onScribble(s) with s = { kind, pts: [[x, z]...], text }
  constructor(place, cfg, onScribble) {
    this.D = place; this.cfg = cfg; this.onScribble = onScribble; this.open = false; this.t = 0;
    this.tools = [...TOOLS, ...cfg.stickers.map((text) => ({ id: 'sticker', text, label: text })), { id: 'clear', label: 'Rub out mine' }, { id: 'close', label: 'Close (Tab)' }];
    this.tool = 0; this.cursor = { x: 300, y: 300, pad: false }; this.stroke = null; this.buttons = [];
    const c = this.canvas = document.createElement('canvas');
    Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '40', display: 'none', cursor: 'crosshair' });
    document.body.appendChild(c);
    this.ctx = c.getContext('2d');
    this.base = document.createElement('canvas');
    loadFont().then(() => { this.baseKey = null; });
    c.addEventListener('mousedown', (e) => { if (e.button === 0) this.down(e.clientX, e.clientY); });
    addEventListener('mousemove', (e) => { if (this.open) { this.cursor = { x: e.clientX, y: e.clientY, pad: false }; this.drag(e.clientX, e.clientY); } });
    addEventListener('mouseup', (e) => { if (this.open && e.button === 0) this.up(); });
    addEventListener('keydown', (e) => { if (this.open && e.code === 'Escape') this.onClose?.(); });
  }

  show(on) {
    if (on === this.open) return;
    this.open = on; this.canvas.style.display = on ? 'block' : 'none'; this.stroke = null; this.padA = false;
  }

  layout() {
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) { this.canvas.width = this.base.width = Math.round(W * dpr); this.canvas.height = this.base.height = Math.round(H * dpr); this.baseKey = null; }
    this.dpr = dpr; this.W = W; this.H = H;
    const side = Math.min(250, Math.max(190, W * 0.2));
    this.mapBox = { x: 30, y: 58, w: W - side - 56, h: H - 70 };
    this.side = { x: W - side - 18, y: 26, w: side, h: H - 52 };
    this.V = new MapView(this.D.bounds, this.mapBox);
  }

  // a tool's button rectangles (the side panel)
  panel(ctx, colors, myColor) {
    const S = this.side; this.buttons = [];
    const k = this.k = Math.min(1, S.h / 640);                            // a small window squeezes the crayon box
    let y = S.y + 22 * k;
    write(ctx, 'CRAYONS', S.x + S.w / 2, y, 24 * k, '#3a2a20', 3); y += 24 * k;
    this.tools.forEach((t, i) => {
      if (t.id === 'sticker' && this.tools[i - 1]?.id !== 'sticker') { y += 10 * k; write(ctx, 'STICKERS', S.x + S.w / 2, y + 6 * k, 24 * k, '#3a2a20', 4); y += 26 * k; }
      if (t.id === 'clear') y += 12 * k;
      const h = (t.id === 'sticker' ? 36 : 32) * k, r = { x: S.x + 10, y, w: S.w - 20, h, i };
      this.buttons.push(r);
      const sel = i === this.tool, hot = this.hit(this.cursor.x, this.cursor.y) === r;
      if (t.id === 'sticker') sticker(ctx, r.x + r.w / 2, r.y + h / 2, t.text, myColor, 100 + i, 19 * k);
      else {
        ctx.save(); ctx.fillStyle = hot ? '#fff0c8' : '#fffdf4'; roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.restore();
        line(ctx, [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], '#3a2a20', 2, 200 + i, { closed: true, passes: 1 });
        if (t.id === 'line' || t.id === 'arrow' || t.id === 'circle') line(ctx, [[r.x + 14, r.y + h / 2], [r.x + 40, r.y + h / 2]], myColor, 8, 300 + i, { passes: 2 });
        write(ctx, t.label, r.x + (t.id === 'clear' || t.id === 'close' ? r.w / 2 : r.w / 2 + 16), r.y + h / 2 + 1, 21 * k, '#3a2a20', 400 + i);
      }
      if (sel) line(ctx, [[r.x - 4, r.y - 3], [r.x + r.w + 4, r.y - 3], [r.x + r.w + 4, r.y + h + 3], [r.x - 4, r.y + h + 3]], '#d0453a', 3.5, 500 + i, { closed: true, passes: 2, amp: 1.4 });
      y += h + 6 * k;
    });
    // who is who
    y += 14 * k;
    const cw = (S.w - 20) / 4;
    colors.forEach((c, i) => { if (i >= this.players) return; const x = S.x + 10 + i * cw; line(ctx, [[x + 4, y], [x + cw * 0.45, y]], c, 7, 600 + i, { passes: 2 }); write(ctx, `P${i + 1}`, x + cw * 0.5, y, 18, '#3a2a20', 610 + i, { align: 'left' }); });
  }

  hit(x, y) { return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null; }
  inMap(x, y) { const b = this.mapBox; return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

  down(x, y) {
    const b = this.hit(x, y);
    if (b) { const t = this.tools[b.i]; if (t.id === 'clear') this.onScribble({ kind: 'clear', pts: [] }); else if (t.id === 'close') this.onClose?.(); else this.tool = b.i; return; }
    if (!this.inMap(x, y) || !this.V) return;
    const t = this.tools[this.tool], w = this.V.world(x, y);
    if (t.id === 'sticker') { this.onScribble({ kind: 'sticker', pts: [w], text: t.text }); return; }
    this.stroke = { kind: t.id, pts: [w], step: this.cfg.minStep };
  }

  drag(x, y) {
    const s = this.stroke; if (!s || !this.V) return;
    const w = this.V.world(Math.max(this.mapBox.x, Math.min(x, this.mapBox.x + this.mapBox.w)), Math.max(this.mapBox.y, Math.min(y, this.mapBox.y + this.mapBox.h)));
    if (s.kind === 'circle') { s.pts[1] = w; return; }
    const last = s.pts[s.pts.length - 1];
    if (Math.hypot(w[0] - last[0], w[1] - last[1]) < s.step) return;
    s.pts.push(w);
    if (s.pts.length >= this.cfg.maxPoints) { s.pts = s.pts.filter((_, i) => i % 2 === 0 || i === s.pts.length - 1); s.step *= 2; }    // long lines get fewer points
  }

  up() {
    const s = this.stroke; this.stroke = null; if (!s) return;
    if (s.kind === 'circle' && s.pts[1] && Math.hypot(s.pts[1][0] - s.pts[0][0], s.pts[1][1] - s.pts[0][1]) > 0.4) this.onScribble({ kind: 'circle', pts: s.pts });
    else if (s.kind !== 'circle' && s.pts.length >= 2) this.onScribble({ kind: s.kind, pts: s.pts });
  }

  // a gamepad steers the crayon: left stick moves, A draws or presses, LB/RB change crayon, X rubs out, B closes
  padStep(dt, pad) {
    if (!pad) return;
    const ax = pad.axes?.[0] ?? 0, ay = pad.axes?.[1] ?? 0, m = Math.hypot(ax, ay), btn = (i) => !!pad.buttons?.[i]?.pressed;
    if (m > 0.2) { const sp = 650 * Math.min(1, (m - 0.2) / 0.8) / m; this.cursor = { x: Math.max(0, Math.min(this.W, this.cursor.x + ax * sp * dt)), y: Math.max(0, Math.min(this.H, this.cursor.y + ay * sp * dt)), pad: true }; this.drag(this.cursor.x, this.cursor.y); }
    const was = this.padPrev ?? {}, now = { a: btn(0), b: btn(1), x: btn(2), lb: btn(4), rb: btn(5) };
    if (now.a && !was.a) this.down(this.cursor.x, this.cursor.y);
    if (!now.a && was.a) this.up();
    if (now.lb && !was.lb) this.tool = (this.tool + this.tools.length - 3) % (this.tools.length - 2);
    if (now.rb && !was.rb) this.tool = (this.tool + 1) % (this.tools.length - 2);
    if (now.x && !was.x) this.onScribble({ kind: 'clear', pts: [] });
    if (now.b && !was.b) this.onClose?.();
    this.padPrev = now;
  }

  // draw one frame. model: Game or Mirror; me: this screen's player id; pad: the gamepad steering the crayon (if any)
  draw(dt, model, me, pad = null) {
    if (!this.open) return;
    this.t += dt; this.layout(); this.padStep(dt, pad);
    const colors = this.cfg.playerColors, mine = model.coats.find((c) => c.pid === me), myColor = colors[(mine?.slot ?? 0) % colors.length];
    this.players = Math.max(1, model.coats.length);
    const ctx = this.ctx, M = model.map;
    // the still part is drawn once and kept until someone sees somewhere new
    const key = `${model.jobNo}|${[...M.seenAreas].join(',')}|${model.mess.patches.length}|${this.W}x${this.H}`;
    if (key !== this.baseKey) {
      const b = this.base.getContext('2d'); b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paper(b, this.W, this.H); drawBase(b, this.V, this.D, model);
      const tw = write(b, this.D.name, 40, 34, 34, '#d0453a', 9, { align: 'left', outline: '#fbf6ea' });
      if (model.job?.target) write(b, `Job: ${model.job.target}`, 40 + tw + 22, 38, 20, '#6b4a2e', 10, { align: 'left' });
      this.baseKey = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.base, 0, 0); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawLive(ctx, this.V, this.D, model, { me, colors, time: this.t });
    if (this.stroke) drawScribble(ctx, this.V, { ...this.stroke, id: 999 }, myColor, true);
    // the crayon box down the side
    ctx.save(); ctx.fillStyle = 'rgba(255,253,244,0.92)'; roundRect(ctx, this.side.x, this.side.y, this.side.w, this.side.h, 16); ctx.fill(); ctx.restore();
    line(ctx, [[this.side.x, this.side.y], [this.side.x + this.side.w, this.side.y], [this.side.x + this.side.w, this.side.y + this.side.h], [this.side.x, this.side.y + this.side.h]], '#b0866a', 3, 77, { closed: true, passes: 2 });
    this.panel(ctx, colors, myColor);
    const hint = this.cursor.pad ? 'Stick: move · A: draw · LB/RB: crayon · X: rub out · B: close' : 'Drag to draw · click a sticker, then the map · Tab: close';
    const hy = this.side.y + this.side.h - 16;
    (this.k < 0.8 ? [hint.split(' · ').pop()] : hint.split(' · ')).forEach((h, i, all) => write(ctx, h, this.side.x + this.side.w / 2, hy - (all.length - 1 - i) * 19, 16, '#6b4a2e', 88 + i));
    // a crayon for a gamepad cursor
    if (this.cursor.pad) { const { x, y } = this.cursor; line(ctx, [[x, y], [x + 22, y - 22]], myColor, 9, 90, { passes: 2 }); line(ctx, [[x, y], [x + 5, y - 5]], '#3a2a20', 4, 91, { passes: 1 }); }
  }
}
