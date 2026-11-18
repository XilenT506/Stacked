// Retakes: shop greeting answered wrong; drive swerve and Mr Price looking away. Port 8320.
import { start } from '../../lib.mjs';
const OUT = 'test/critics/r3/';
const k = await start(8320, { page: 'dist/critic.html' });
const ev = (p, f, a) => p.evaluate(f, a);
async function waitGame(page, secs) { const t0 = await ev(page, () => globalThis.__stacked.W.time); const until = Date.now() + secs * 9000 + 4000;
  while (Date.now() < until) { if ((await ev(page, () => globalThis.__stacked.W.time)) - t0 >= secs) return; await page.waitForTimeout(120); } }
const st = (page) => ev(page, () => { const W = globalThis.__stacked.W; return JSON.stringify({ t: +W.time.toFixed(1), step: W.errand.step, phase: W.phase,
  ppl: W.people.map((p) => p.id + ':' + p.sus.toFixed(2) + ' say' + p.say + ' greet' + p.greet), car: W.car && [W.car.x, W.car.z, W.car.v, W.car.wheel, W.car.slipT].map((v) => +(+v).toFixed(2)),
  sees: document.getElementById('sees')?.innerText, keys: (document.getElementById('keys')?.innerText || '').replace(/\s+/g, ' '), info: (document.getElementById('info')?.innerText || '').replace(/\s+/g, ' ') }); });
async function open(e) { const r = await k.open('?errand=' + e); await r.page.waitForSelector('#solo', { state: 'visible' }); await r.page.click('#solo'); await r.page.waitForTimeout(1500); return r; }

{ // SHOP: Mabel asks "Are you lost, sir?" and the head nods
  const { page } = await open('shop');
  await waitGame(page, 4.5);   // let the intro banner fade
  await ev(page, () => { const W = globalThis.__stacked.W; Object.assign(W.body, { x: -8.3, z: 1.95, yaw: 0, v: 0, lx: 0, lz: 0 }); W.errand.step = 1; });
  await ev(page, () => globalThis.__setCam({ p: [-6.2, 1.5, -0.6], l: [-8.3, 1.8, 2.6], fov: 52 }));
  await page.keyboard.press('3');
  await waitGame(page, 0.5);
  await ev(page, () => { const W = globalThis.__stacked.W; const i = W.people.findIndex((p) => p.id === 'mabel'); const p = W.people[i]; p.greet = 2; p.greetT = 4.5; p.say = 1; p.sayT = 4.5; W.greetAt = W.time; });
  await waitGame(page, 0.6); console.log('asked', await st(page));
  await page.screenshot({ path: OUT + 'shop1_are_you_lost.png' });
  await waitGame(page, 0.7);
  await page.keyboard.down('n'); await waitGame(page, 0.5); await page.keyboard.up('n');
  await waitGame(page, 0.3); console.log('nodded', await st(page));
  await page.screenshot({ path: OUT + 'shop1b_nodded_lost.png' });
  await page.context().close();
}
{ // DRIVE: swerve at speed, then Mr Price looking away
  const { page } = await open('drive');
  await waitGame(page, 4.5);
  console.log('drive keys', await st(page));
  await page.keyboard.press('2'); console.log('arms keys', await st(page));
  await page.keyboard.press('3'); console.log('head keys', await st(page));
  await ev(page, () => { const W = globalThis.__stacked.W; W.errand.step = 2; Object.assign(W.car, { x: -1.5, z: 0.35, yaw: 1.5708, v: 3.4 }); });
  await ev(page, () => globalThis.__setCam({ p: [4.8, 2.0, 3.0], l: [1.5, 0.9, 0.2], fov: 55 }));
  await page.keyboard.press('2'); await page.keyboard.down('a'); await waitGame(page, 0.5); await page.keyboard.up('a');
  await page.keyboard.down('d'); await waitGame(page, 0.5); await page.keyboard.up('d');
  console.log('swerve', await st(page));
  await page.screenshot({ path: OUT + 'drive1_swerve_cones.png' });
  await waitGame(page, 0.8);
  await ev(page, () => { const W = globalThis.__stacked.W; Object.assign(W.car, { x: -3, z: 0.35, yaw: 1.5708, v: 1.0, wheel: 0, slipT: 4, slipKind: 1 }); });
  const c = await ev(page, () => [globalThis.__stacked.W.car.x, globalThis.__stacked.W.car.z]);
  await ev(page, (c) => globalThis.__setCam({ p: [c[0] + 2.6, 1.9, c[1] + 2.4], l: [c[0], 1.0, c[1] + 0.2], fov: 55 }), c);
  await waitGame(page, 0.5); console.log('away', await st(page));
  await page.screenshot({ path: OUT + 'drive3_price_away.png' });
  await page.context().close();
}
await k.stop();
