// The coat seen from outside, still and leaning: does it hold together?
import { start } from '../lib.mjs';
const k = await start(8472, { page: process.env.PAGE || 'dist/next.html' });
const { page, errors } = await k.open('?hq=1&cam=out&errand=' + (process.env.ERR || 'bank') + '');
await page.click('#solo'); await page.waitForTimeout(3000);
await page.evaluate(() => { const B = __stacked.W.body; B.x = -2.5; B.z = 1.2; B.yaw = 0.6; }); await page.waitForTimeout(2500);
await page.screenshot({ path: 'test/play4/coat_0.png' });
for (const [i, lx, lz] of [[1, 0.35, 0], [2, 0, 0.45], [3, -0.3, -0.3]]) {
  await page.evaluate(([a, b]) => { const B = __stacked.W.body; __stacked.__hold = setInterval(() => { B.lx = a; B.lz = b; B.lvx = B.lvz = 0; }, 5); }, [lx, lz]);
  await page.waitForTimeout(1500); await page.screenshot({ path: `test/play4/coat_${i}.png` });
  await page.evaluate(() => clearInterval(__stacked.__hold));
}
await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.screenshot({ path: 'test/play4/coat_4.png' }); await page.keyboard.up('w');
console.log(errors()); await k.stop();
