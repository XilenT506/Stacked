// Townspeople walking at full quality: frames of a grown-up in the background, to see the legs and arms swing.
import { start } from '../lib.mjs';
const k = await start(8474, { page: 'dist/next.html' });
const { page, errors } = await k.open('?hq=1&cam=out&errand=bank');
await page.click('#solo'); await page.waitForTimeout(3000);
await page.evaluate(() => { const B = __stacked.W.body; B.x = -2.5; B.z = 1.2; B.yaw = 0.6; }); await page.waitForTimeout(2000);
for (let n = 0; n < 6; n++) { await page.waitForTimeout(140); await page.screenshot({ path: `test/play4/wk_${n}.png`, clip: { x: 300, y: 60, width: 260, height: 300 } }); }
console.log(errors()); await k.stop();
