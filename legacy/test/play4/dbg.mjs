import { start } from '../lib.mjs';
const k = await start(8421, { page: 'dist/next.html' });
const { page, logs, errors } = await k.open('?errand=shop');
await page.click('#solo'); await page.waitForTimeout(5000);
console.log(logs.filter((l) => /model|webp|quant|GLTF|THREE/i.test(l)).slice(0, 10), errors());
await k.stop();
