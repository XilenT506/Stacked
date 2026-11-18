import { start } from '../lib.mjs';
const k = await start(8410);
const S = (p, f, a) => p.evaluate(f, a);
const wait = async (page, secs) => { const t0 = await S(page, () => __stacked.W.time); for (let i = 0; i < 300; i++) { await page.waitForTimeout(100); if (await S(page, () => __stacked.W.time) - t0 >= secs) return; } };
{ const { page, ctx } = await k.open('?errand=cinema');
  await page.click('#solo'); await wait(page, 4);
  await page.screenshot({ path: 'test/play4/c0_start.png' });
  await S(page, () => { const W = __stacked.W; Object.assign(W.body, { x: 9.2, z: -2.9, yaw: Math.PI, v: 0 }); W.errand.step = 3; W.items.forEach((i) => i.held = W.items.indexOf(i) % 2); });
  await page.keyboard.down('Shift'); await wait(page, 1.6); await page.screenshot({ path: 'test/play4/c1_tall.png' }); await page.keyboard.up('Shift');
  await ctx.close(); }
{ const { page, ctx } = await k.open('?errand=drive');
  await page.click('#solo'); await wait(page, 5);
  await page.screenshot({ path: 'test/play4/d0_start.png' });
  await page.keyboard.down('w'); await wait(page, 2.5); await page.keyboard.up('w');
  await page.screenshot({ path: 'test/play4/d1_drive.png' });
  await ctx.close(); }
if (0) { const { page, ctx } = await k.open('?mode=survival');
  await page.click('#solo'); await wait(page, 3);
  await page.screenshot({ path: 'test/play4/v0_survival.png' });
  await ctx.close(); }
await k.stop();
