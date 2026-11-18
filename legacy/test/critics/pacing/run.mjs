// Pacing probe: runs the bot N times, records an in-page timeline (sampled each frame, kept every 0.25 game s).
import { start } from '../../lib.mjs';
import { writeFile } from 'node:fs/promises';
const N = +(process.argv[2] || 3), SPEED = process.argv[3] || '4', TAG = process.argv[4] || 'r';
const k = await start(8303);
for (let i = 0; i < N; i++) {
  const { page, errors } = await k.open(`?bot=1&speed=${SPEED}&q=low`, { viewport: { width: 640, height: 360 } });
  await page.evaluate(() => {
    const s = globalThis.__stacked; const tl = []; const evs = []; const seen = new Set(); let last = -1;
    globalThis.__tl = tl; globalThis.__evs = evs;
    function f() {
      const W = s.W;
      for (const e of (W.ev || [])) { if (!seen.has(e[0])) { seen.add(e[0]); evs.push([W.time, e[1], e[2]]); } }
      if (W.time - last >= 0.25) { last = W.time;
        tl.push({ t: W.time, ph: W.phase, clk: W.clock, st: W.errand?.step, q: W.errand?.q, sg: W.errand?.sign, x: W.body.x, z: W.body.z, v: W.body.v, down: W.body.down,
          part: s.input.part, hand: (W.ord.hand || []).map(h => h.act), hp: (W.ord.hand || []).map(h => [+h.x.toFixed(2), +h.y.toFixed(2), +h.z.toFixed(2)]), hw: (W.hands||[]).map(h => [+(+h.x).toFixed(2), +(+h.y).toFixed(2), +(+h.z).toFixed(2)]), ph2: s.input.hand, nod: W.ord.nod, sh: W.ord.shake, talk: W.ord.talk, brow: W.ord.brow,
          ppl: W.people.map(p => [+p.sus.toFixed(2), p.mode, p.say || '', p.greet || 0]), sT: W.scatterT, kids: JSON.stringify(W.kids).slice(0, 400), bag: W.bag, log: s.bot.log.length });
      }
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  });
  const t0 = Date.now(); let st;
  for (;;) { st = await page.evaluate(() => ({ done: __stacked.bot.done, err: __stacked.bot.error })); if (st.done || Date.now() - t0 > 400000) break; await new Promise(r => setTimeout(r, 1000)); }
  await new Promise(r => setTimeout(r, 1500));
  const out = await page.evaluate(() => { const s = globalThis.__stacked; return { times: s.bot.times, idle: s.bot.idle, log: s.bot.log, bluffs: s.bot.bluffs, end: s.W.end, clock: s.W.clock, stats: s.W.stats, players: s.W.players, seats: s.W.seats, tl: globalThis.__tl, evs: globalThis.__evs, done: s.bot.done, err: s.bot.error }; });
  out.errors = errors();
  await writeFile(new URL(`./${TAG}${i}.json`, import.meta.url), JSON.stringify(out));
  console.log(i, 'done', out.done, out.err, 'end', out.end, 'clock', out.clock?.toFixed(1), JSON.stringify(out.times), 'wall', (Date.now() - t0) / 1000);
  await page.close();
}
await k.stop();
