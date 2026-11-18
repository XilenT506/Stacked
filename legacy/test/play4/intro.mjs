import { start } from '../lib.mjs';
const k = await start(8413, { page: 'dist/next.html' });
const S = (p, f, a) => p.evaluate(f, a);
const { page, errors } = await k.open('');
await page.click('#solo'); await page.waitForTimeout(2500);
await page.screenshot({ path: 'test/play4/i1_intro.png' });
await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w');
await page.screenshot({ path: 'test/play4/i2_walk.png' });
console.log(errors()); await k.stop();
