// Full-quality screenshots (shadows, glow, grade all on, no automatic back-off): what a real graphics card shows.
import { start } from '../lib.mjs';
const k = await start(8471, { page: process.env.PAGE || 'dist/next.html' });
const { page, errors } = await k.open('?hq=1&errand=' + (process.env.ERR || 'shop') + (process.env.Q || ''));
await page.click('#solo'); await page.waitForTimeout(6000);
await page.screenshot({ path: 'test/play4/hq_1.png' });
await page.keyboard.down('w'); await page.waitForTimeout(5000); await page.keyboard.up('w');
await page.screenshot({ path: 'test/play4/hq_2.png' });
await page.keyboard.press('p'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/play4/hq_3.png' });
console.log(await page.evaluate(() => ({ post: __stacked.post.on, ao: __stacked.post.ao, shadows: __stacked.renderer.shadowMap.enabled, fps: __stacked.fps })), errors());
await k.stop();
