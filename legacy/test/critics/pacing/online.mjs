// Online check: host = legs (steered by a waypoint follower via input.setMove), friend = head + arms (does nothing).
// Records on the friend's page what the friend could react to (greetings, "?" meters) while the host walks alley -> queue.
import { start } from '../../lib.mjs';
const k = await start(8303);
const h = await k.open(''), c = await k.open('');
await h.page.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent), null, { timeout: 10000 });
await h.page.evaluate(() => document.getElementById('host').click());
await h.page.waitForFunction(() => globalThis.__stacked.mode === 'play', null, { timeout: 10000 });
const code = await h.page.evaluate(() => __stacked.link.code);
await c.page.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await c.page.fill('#code', code); await c.page.evaluate(() => document.getElementById('join').click());
await c.page.waitForFunction(() => __stacked.W.players.length === 2, null, { timeout: 60000 }).catch(async () => { console.log('JOIN FAIL', await c.page.evaluate(() => [document.getElementById('status').textContent, __stacked.mode, __stacked.W.players.length, String(__stacked.link && __stacked.link.code)])); process.exit(2); });
console.log('seats', JSON.stringify(await h.page.evaluate(() => __stacked.W.seats)), 'friend part', await c.page.evaluate(() => __stacked.input.part));
const wps = [[-7.6, -2.6], [-5.8, -2.6], [-5.0, 0.5], [0, 0.5], [0, 3.5], [0, 6.3]]; let wi = 0;
const t0 = await h.page.evaluate(() => __stacked.W.time); let last = '';
for (let i = 0; i < 160 && wi < wps.length; i++) {
  const b = await h.page.evaluate(() => { const B = __stacked.W.body; return { x: B.x, z: B.z, yaw: B.yaw, down: B.down, t: __stacked.W.time }; });
  const [tx, tz] = wps[wi]; const dx = tx - b.x, dz = tz - b.z; if (Math.hypot(dx, dz) < 0.5) { wi++; continue; }
  // joystick in world-ish terms: try camera-relative x,y = (dx, -dz) normalised (empirical)
  const L = Math.hypot(dx, dz); await h.page.evaluate(([x, y]) => __stacked.input.setMove(x, y), [dx / L * 0.8, dz / L * 0.8]);
  const f = await c.page.evaluate(() => { const W = __stacked.W; return { t: W.time, st: W.errand.step, x: W.body.x, z: W.body.z, ppl: W.people.map(p => [+p.sus.toFixed(2), p.say, p.greet]) }; });
  const key = JSON.stringify(f.ppl.map(p => [p[0] > 0.05, p[1], p[2]])) + f.st;
  if (key !== last || i % 20 === 0) { console.log((f.t - t0).toFixed(1), 'friend sees body', f.x.toFixed(1), f.z.toFixed(1), 'step', f.st, 'host down', b.down, JSON.stringify(f.ppl)); last = key; }
  await h.page.waitForTimeout(250);
}
console.log('reached wp', wi, 'of', wps.length, 'in', ((await h.page.evaluate(() => __stacked.W.time)) - t0).toFixed(1), 's');
await k.stop();
