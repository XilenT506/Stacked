import { start } from '../lib.mjs';
const k = await start(8404);
const O = 'test/play4/';
const wait = async (page, secs) => { const t0 = await page.evaluate(() => __stacked.W.time); for (let i = 0; i < 200; i++) { await page.waitForTimeout(120); if (await page.evaluate(() => __stacked.W.time) - t0 >= secs) return; } };
async function open(errand) { const r = await k.open('?errand=' + errand); await r.page.click('#solo'); await r.page.waitForTimeout(1200); return r; }
// 1. shop: the coat walks up to Mabel, she greets
{ const { page } = await open('shop');
  await wait(page, 5);
  await page.evaluate(() => { const W = __stacked.W; Object.assign(W.body, { x: -8.0, z: 0.9, yaw: -0.3, v: 0 }); W.errand.step = 1; });
  await wait(page, 1.5); await page.screenshot({ path: O + 's1_mabel.png' });
  // bust: tip the coat over in front of her
  await page.evaluate(() => { const W = __stacked.W; W.people.forEach((p) => p.sus = 0.95); W.body.lz = 0.7; });
  for (let i = 0; i < 5; i++) { await wait(page, 0.45); await page.screenshot({ path: O + `s2_pop${i}.png` }); }
}
// 2. bank: in the queue / at the counter
{ const { page } = await open('bank');
  await wait(page, 4);
  await page.evaluate(() => { const W = __stacked.W; Object.assign(W.body, { x: 0.4, z: 6.3, yaw: 0, v: 0 }); });
  await wait(page, 1.5); await page.screenshot({ path: O + 's3_bank.png' });
}
// 3. the car
{ const { page } = await open('drive');
  await wait(page, 5); await page.keyboard.down('w'); await wait(page, 2); await page.keyboard.up('w');
  await page.screenshot({ path: O + 's4_car.png' });
}
await k.stop();
