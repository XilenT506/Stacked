import { start } from '../lib.mjs';
const k = await start(8409);
const S = (p, f, a) => p.evaluate(f, a);
const wait = async (page, secs) => { const t0 = await S(page, () => __stacked.W.time); for (let i = 0; i < 300; i++) { await page.waitForTimeout(100); if (await S(page, () => __stacked.W.time) - t0 >= secs) return; } };
{ const { page, ctx } = await k.open('?errand=shop');
  await page.click('#solo'); await wait(page, 4);
  // shop: at the stall, step 2 = grab milk
  await S(page, () => { const W = __stacked.W; Object.assign(W.body, { x: -8.3, z: 2.0, yaw: 0, v: 0 }); W.errand.step = 2; });
  await page.keyboard.press('Digit2'); await wait(page, 1);
  await page.screenshot({ path: 'test/play4/a1_grab.png' });
  await page.keyboard.down('w'); await wait(page, 0.6); await page.keyboard.up('w'); await wait(page, 0.4);
  await page.screenshot({ path: 'test/play4/a2_reach.png' });
  console.log(await S(page, () => [__stacked.cue, __stacked.W.items.map((i) => i.held)]));
  await ctx.close(); }
{ const { page, ctx } = await k.open('?errand=bank');
  await page.click('#solo'); await wait(page, 4);
  const st = await S(page, () => __stacked.W.errand);
  const steps = await S(page, () => 0);
  await S(page, () => { const W = __stacked.W; const i = 3; Object.assign(W.body, { x: 0.3, z: 7.78, yaw: 0, v: 0 }); });
  await S(page, () => { const W = __stacked.W; const st = (window.__E = W.errand); });
  // jump to the sign step
  await S(page, () => { const W = __stacked.W; W.errand.step = 2; });
  console.log(await S(page, () => document.getElementById('objective').innerText));
  await page.keyboard.press('Digit2'); await wait(page, 1);
  await page.screenshot({ path: 'test/play4/a3_bank_arms.png' });
  await ctx.close(); }
await k.stop();
