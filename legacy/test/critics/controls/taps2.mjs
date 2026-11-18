// friend: exact-length synthetic taps (dispatched inside the friend page); does the host's world ever show them?
import { start } from '../../lib.mjs';
import { sleep } from './probe.mjs';
const k = await start(8301); const o = { viewport: { width: 320, height: 180 } };
const h = await k.open('?q=low', o), c = await k.open('?q=low', o); const H = h.page, C = c.page;
await H.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent));
await H.click('#host'); await H.waitForFunction(() => __stacked.mode === 'play');
const code = await H.evaluate(() => __stacked.link.code);
await C.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await C.fill('#code', code); await C.click('#join');
await C.waitForFunction(() => __stacked.mode === 'play' && __stacked.W.players.length === 2, null, { timeout: 20000 });
await sleep(2500);
await H.evaluate(() => { globalThis.__seen = {}; setInterval(() => { const o = __stacked.W.ord; for (const f of ['nod', 'shake', 'brow']) if (o[f]) __seen[f] = 1; for (const hh of o.hand) if (hh.act) __seen['act' + hh.act] = 1; }, 2); });
await C.evaluate(() => { globalThis.__seen = {}; setInterval(() => { const I = __stacked.input, o = __stacked.W.ord; for (const f of ['nod', 'shake', 'brow']) if (I.head[f]) __seen[f] = 1; for (const hh of I.hand) if (hh.act) __seen['act' + hh.act] = 1; }, 2); });
console.log('fps host/friend', await H.evaluate(() => __stacked.fps.toFixed(0)), await C.evaluate(() => __stacked.fps.toFixed(0)));
for (const [key, field, part, gap] of [['KeyE', 'brow', 'Digit3', 300], ['KeyM', 'shake', 'Digit3', 300], ['KeyN', 'nod', 'Digit3', 1100], ['KeyX', 'act2', 'Digit2', 400], ['KeyC', 'act1', 'Digit2', 1600]]) {
  await C.keyboard.press(part); await sleep(300);
  const row = [];
  for (const dur of [0, 17, 35]) {
    let loc = 0, rem = 0; const n = 12;
    for (let i = 0; i < n; i++) {
      await sleep(gap + Math.random() * 60);
      await Promise.all([H, C].map((p) => p.evaluate(() => { __seen = {}; })));
      await C.evaluate(async ([key, dur]) => { dispatchEvent(new KeyboardEvent('keydown', { code: key })); if (dur) await new Promise((r) => setTimeout(r, dur)); dispatchEvent(new KeyboardEvent('keyup', { code: key })); }, [key, dur]);
      await sleep(500);
      if (await C.evaluate((f) => __seen[f], field)) loc++; if (await H.evaluate((f) => __seen[f], field)) rem++;
    }
    row.push(`${dur} ms: friend ${loc}/${n}, host ${rem}/${n}`);
  }
  console.log(key.padEnd(5), row.join(' | '));
}
console.log('errors', h.errors(), c.errors()); await k.stop();
