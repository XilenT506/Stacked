import { start } from '../lib.mjs';
const k = await start(8412, { page: 'dist/next.html' });
const S = (p, f, a) => p.evaluate(f, a);
const wait = async (page, secs) => { const t0 = await S(page, () => __stacked.W.time); for (let i = 0; i < 300; i++) { await page.waitForTimeout(100); if (await S(page, () => __stacked.W.time) - t0 >= secs) return; } };
const { page, errors } = await k.open('?errand=shop', { acceptDownloads: true });
await page.click('#solo'); await wait(page, 3);
await S(page, () => { const W = __stacked.W; Object.assign(W.body, { x: -8.1, z: 1.4, yaw: -0.15, v: 0 }); });
await wait(page, 1);
for (const line of ['Good afternoon, madam. Dreadful traffic on the ring road.', 'hehe my mum lets me have sweets']) {
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); await page.fill('#say', line); await page.keyboard.press('Enter'); await wait(page, 1.5);
}
// finish: carry the milk into the alley
await S(page, () => { const W = __stacked.W; W.errand.step = 4; W.items[0].held = 1; Object.assign(W.body, { x: -7.6, z: -4.6, v: 0 }); });
await page.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 30000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'test/play4/e1_end.png', fullPage: true });
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#share')]);
await dl.saveAs('test/play4/share.png'); console.log('download', dl.suggestedFilename(), await S(page, () => document.getElementById('share').textContent));
console.log(errors());
await k.stop();
