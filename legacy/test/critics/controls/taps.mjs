// in-between-frames taps (solo) and short taps from a friend reaching the host
import { start } from '../../lib.mjs';
import { install, clear, grab, sleep } from './probe.mjs';
const k = await start(8301); const o = { viewport: { width: 320, height: 180 } };
const h = await k.open('?q=low', o), c = await k.open('?q=low', o); const H = h.page, C = c.page;
await H.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent));
await H.click('#host'); await H.waitForFunction(() => __stacked.mode === 'play');
// solo-host: keydown+keyup inside one gap between frames
for (const [key, field, part] of [['KeyN', 'head.nod', 'Digit3'], ['KeyE', 'head.brow', 'Digit3'], ['KeyM', 'head.shake', 'Digit3'], ['KeyC', 'wave', 'Digit2'], ['KeyX', 'wave', 'Digit2'], ['KeyG', 'grab', 'Digit2']]) {
  await H.keyboard.press(part); await sleep(300);
  const r = await H.evaluate(async ([key, field]) => {
    const I = __stacked.input, zz = (ms) => new Promise((r) => setTimeout(r, ms)); let hit = 0;
    const get = () => field === 'wave' ? I.hand[I.sel].act : field === 'grab' ? I.n[0] + I.n[1] : I.head[field.split('.')[1]];
    for (let i = 0; i < 10; i++) { await zz(field === 'wave' ? 1500 : 1000); const g0 = get(); let seen = 0; const iv = setInterval(() => { if (get() !== g0) seen = 1; }, 4);
      dispatchEvent(new KeyboardEvent('keydown', { code: key })); dispatchEvent(new KeyboardEvent('keyup', { code: key })); await zz(200); clearInterval(iv); hit += seen; }
    return hit; }, [key, field]);
  console.log(`solo/host, ${key} pressed and released between two frames: registered ${r}/10`);
}
const code = await H.evaluate(() => __stacked.link.code);
await C.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await C.fill('#code', code); await C.click('#join');
await C.waitForFunction(() => __stacked.mode === 'play' && __stacked.W.players.length === 2, null, { timeout: 20000 });
await install(H); await install(C); await sleep(3000);
for (const [key, loc, rem, part, gap] of [['KeyE', 'ibrow', 'obrow', 'Digit3', 300], ['KeyN', 'inod', 'onod', 'Digit3', 1100], ['KeyC', 'iact', 'oact', 'Digit2', 1500], ['KeyX', 'iact', 'oact', 'Digit2', 400]]) {
  await C.keyboard.press(part); await sleep(300);
  for (const dur of [17, 35, 50]) {
    let l = 0, r = 0; const n = 12, real = [];
    for (let i = 0; i < n; i++) { await sleep(gap + Math.random() * 50); await Promise.all([clear(H), clear(C)]); await C.keyboard.down(key); await sleep(dur); await C.keyboard.up(key); await sleep(350);
      const [a, b] = await Promise.all([grab(H), grab(C)]); if (b.frames.some((f) => f[loc])) l++; if (a.frames.some((f) => f[rem])) r++; const ks = b.keys.filter((q) => q.k === key); if (ks.length >= 2) real.push(ks[1].ts - ks[0].ts); }
    real.sort((x, y) => x - y);
    console.log(`friend taps ${key} ~${Math.round(real[real.length >> 1])} ms: shown on friend ${l}/${n}, reached host ${r}/${n}`);
  }
}
console.log('errors', h.errors(), c.errors()); await k.stop();
