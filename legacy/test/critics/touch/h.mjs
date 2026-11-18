import { start } from '../../lib.mjs';
export async function setup(vp = { width: 844, height: 390 }, path = '', extra = {}) {
  const k = await start(8305);
  const o = await k.open(path, { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 3, ...extra });
  const { page, ctx } = o;
  const cdp = await ctx.newCDPSession(page);
  const act = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...act.values()] });
  const T = {
    async down(id, x, y) { act.set(id, { x, y, id }); await send('touchStart'); },
    async move(id, x, y) { act.set(id, { x, y, id }); await send('touchMove'); },
    async up(id) { act.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [...act.values()] }); },
    async box(sel) { const b = await page.locator(sel).first().boundingBox(); return b; },
    async tap(sel, ms = 90, id = 9) { const b = await T.box(sel); await T.down(id, b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(ms); await T.up(id); await page.waitForTimeout(60); },
    async stick(dx, dy, ms = 400, keep = false, id = 1) { // dx,dy in -1..1 of stick radius; dy -1 = up
      const b = await T.box('#stick'); const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = b.width / 2;
      await T.down(id, cx, cy); await page.waitForTimeout(30);
      for (let i = 1; i <= 4; i++) { await T.move(id, cx + dx * r * i / 4, cy + dy * r * i / 4); await page.waitForTimeout(16); }
      await page.waitForTimeout(ms); if (!keep) await T.up(id);
    },
    act,
  };
  const S = (f, a) => page.evaluate(f, a);
  return { k, page, ctx, cdp, T, S, errors: o.errors };
}
export const btns = (page) => page.evaluate(() => [...document.querySelectorAll('#btns button')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [b.dataset.act, b.textContent.trim(), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
