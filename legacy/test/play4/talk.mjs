// Talking out loud (typed here; no Claude in the test browser, so the word list judges)
import { start } from '../lib.mjs';
const k = await start(8405);
const { page, errors } = await k.open('?errand=shop');
await page.click('#solo'); await page.waitForTimeout(1500);
const st = () => page.evaluate(() => { const W = __stacked.W; const m = W.people.find((p) => p.id === 'mabel'); return { say: m.say, sus: +m.sus.toFixed(2), coat: W.coatSay, coatT: +(W.coatSayT || 0).toFixed(1), step: W.errand.step, log: W.talkLog }; });
await page.evaluate(() => { const W = __stacked.W; Object.assign(W.body, { x: -8.1, z: 1.4, yaw: -0.15, v: 0 }); W.people.find((p) => p.id === 'mabel').sus = 0.5; });
await page.waitForTimeout(1200);
await page.keyboard.press('Digit3');
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
console.log('bar open:', await page.evaluate(() => !document.getElementById('talkbar').hidden), await page.evaluate(() => document.getElementById('talkwho').textContent));
await page.keyboard.type('Good afternoon madam, dreadful traffic today.'); await page.keyboard.press('Enter');
await page.waitForTimeout(1500); console.log('adult:', JSON.stringify(await st()));
await page.screenshot({ path: 'test/play4/t1_adult.png' });
await page.waitForTimeout(3000);
await page.keyboard.press('Enter'); await page.waitForTimeout(200); console.log(await page.evaluate(() => [document.activeElement.id, document.getElementById('talkbar').hidden])); await page.keyboard.type('my mum says we can have sweets after school'); await page.keyboard.press('Enter');
await page.waitForTimeout(1500); console.log('kid:', JSON.stringify(await st()));
await page.screenshot({ path: 'test/play4/t2_kid.png' });
// legs cannot talk
await page.keyboard.press('Digit1'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
console.log('legs bar open (should be false in solo? solo owns head so true):', await page.evaluate(() => !document.getElementById('talkbar').hidden));
await page.keyboard.press('Escape');
console.log('errors', errors());
await k.stop();
