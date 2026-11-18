import { start } from '../lib.mjs';
const k = await start(8419, { page: 'dist/next.html' });
const S = (p, f, a) => p.evaluate(f, a);
const { page, errors } = await k.open('?errand=drive');
await page.click('#solo'); await page.waitForTimeout(2500);
await S(page, () => { const W = __stacked.W; W.car.x = -2; W.car.z = 0.35; W.car.yaw = 1.5708; });
await page.waitForTimeout(800);
const b = await S(page, () => [__stacked.W.body.x, __stacked.W.body.z]);
for (const [n, p, l] of [['side', [b[0] + 0.2, 1.7, b[1] - 3.6], [b[0], 1.2, b[1]]], ['front3q', [b[0] + 3.2, 1.9, b[1] - 2.0], [b[0], 1.2, b[1]]], ['chase', [b[0] - 4.5, 2.6, b[1] - 1.0], [b[0] + 1.5, 1.2, b[1]]]]) {
  await S(page, ([p, l]) => __setCam({ p, l, fov: 50 }), [p, l]); await page.waitForTimeout(700);
  await page.screenshot({ path: `test/play4/car_${n}.png` });
}
console.log(errors()); await k.stop();
