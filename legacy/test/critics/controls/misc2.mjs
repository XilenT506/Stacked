// usage: node misc2.mjs [opts] [w] [h]   : short taps at this frame rate, blur, stride+Tab
import { start } from '../../lib.mjs';
import { install, clear, grab, sleep, stat, frameTimes } from './probe.mjs';
const opts = process.argv[2] || '', vw = +process.argv[3] || 1280, vh = +process.argv[4] || 720;
const k = await start(8301);
const { page, errors } = await k.open(opts, { viewport: { width: vw, height: vh } });
await page.click('#solo'); await page.waitForFunction(() => __stacked.mode === 'play');
await install(page); await sleep(5000);
await page.evaluate(() => setInterval(() => { for (const p of __stacked.W.people) p.sus = 0; }, 30));   // staged: nobody gets suspicious
const up = () => page.waitForFunction(() => !__stacked.W.body.down && __stacked.W.phase === 'play', null, { timeout: 20000 });
const stage = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const b = __stacked.W.body; b.x = x; b.z = z; b.yaw = yaw; b.v = 0; b.lx = b.lz = 0; b.lvx = b.lvz = 0; }, [x, z, yaw]);
const K = page.keyboard; const ft = [];
console.log(`MISC2 opts='${opts}' ${vw}x${vh} fps ${(await page.evaluate(() => __stacked.fps)).toFixed(1)}`);
const mode = process.argv[5] || 'taps,rest';
if (mode.includes('taps')) {
  // synthetic key events dispatched inside the page (keydown, then keyup after `dur` ms by timer), so the tap length is exact
  for (const dur of [20, 40, 60, 90]) {
    const res = {};
    for (const [key, field, part] of [['KeyN', 'inod', 'Digit3'], ['KeyE', 'ibrow', 'Digit3'], ['KeyC', 'iact', 'Digit2'], ['KeyW', 'lf', 'Digit1']]) {
      await K.press(part); await sleep(400);
      const r = await page.evaluate(async ([key, field, dur]) => {
        const zz = (ms) => new Promise((r) => setTimeout(r, ms)); let hit = 0; const real = [];
        for (let i = 0; i < 12; i++) {
          await zz((field === 'inod' ? 1000 : field === 'iact' ? 1400 : 200) + Math.random() * 80);
          __p.frames.length = 0; const t0 = performance.now();
          dispatchEvent(new KeyboardEvent('keydown', { code: key }));
          await zz(dur); real.push(performance.now() - t0); dispatchEvent(new KeyboardEvent('keyup', { code: key }));
          await zz(350); if (__p.frames.some((f) => f[field])) hit++;
        }
        real.sort((a, b) => a - b); return `${hit}/12 (real ${Math.round(real[6])} ms)`;
      }, [key, field, dur]);
      res[key] = r;
    }
    console.log(`tap ~${dur} ms registered: nod N, brow E, wave C, walk W:`, JSON.stringify(res));
  }
  const fr = (await grab(page)).frames; console.log('frame ms:', stat(frameTimes(fr)));
}
if (mode.includes('rest')) {
// blur
await up(); await K.press('Digit1'); await stage(-4, 0.5, Math.PI / 2); await sleep(300);
const st = () => page.evaluate(() => { const s = __stacked; return { lf: s.input.legs.f, v: +s.W.body.v.toFixed(2), down: s.W.body.down }; });
await K.down('KeyW'); await sleep(600); console.log('W held', JSON.stringify(await st()));
await page.evaluate(() => dispatchEvent(new Event('blur'))); await sleep(800); console.log('window blur (synthetic), W still down', JSON.stringify(await st()));
await page.evaluate(() => dispatchEvent(new Event('focus'))); await sleep(600); console.log('focus back, W still down', JSON.stringify(await st())); await K.up('KeyW'); await sleep(400);
// stride then Tab with keys held vs released
for (const [name, held] of [['E+W held through Tab,Tab', true], ['E+W released before Tab,Tab', false], ['E+W 0.5 s then released, no Tab', null]]) {
  let falls = 0;
  for (let i = 0; i < 8; i++) {
    await up(); await K.press('Digit1'); await stage(-4, 0.5, Math.PI / 2); await page.evaluate(() => { for (const h of __stacked.input.hand) h.x = h.y = h.z = 0; }); await sleep(900);
    await K.down('KeyE'); await K.down('KeyW'); await sleep(500);
    if (held === false || held === null) { await K.up('KeyE'); await K.up('KeyW'); }
    if (held !== null) { await K.press('Tab'); await sleep(500); await K.press('Tab'); await sleep(500); } else await sleep(1000);
    if (held) { await K.up('KeyE'); await K.up('KeyW'); }
    await sleep(600); if ((await st()).down) falls++;
  }
  console.log(`stride 0.5 s, ${name}: fell ${falls}/8`);
}
}
console.log('errors', errors()); await k.stop();
