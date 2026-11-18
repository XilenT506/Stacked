// Headless critic table: node test/sim/run.mjs [runs] [errands] [players]
//   e.g. node test/sim/run.mjs 20 shop,bank,cinema,drive 1,2,3,4
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const [runs = 20, ers = 'shop,bank,cinema,drive', pls = '1,2,3,4', mode = 'single'] = process.argv.slice(2);
const out = await build({ entryPoints: ['test/sim/entry.js'], bundle: true, format: 'esm', platform: 'node', write: false, loader: { '.glb': 'binary', '.mp3': 'empty', '.jpg': 'empty' }, logLevel: 'error', external: ['three'] });
await writeFile('test/sim/.bundle.mjs', out.outputFiles[0].text);
const G = await import('./.bundle.mjs?' + Date.now());
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
let seed = 12345; const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const rows = [];
for (const id of ers.split(',')) for (const n of pls.split(',').map(Number)) {
  const R = [];
  for (let k = 0; k < Number(runs); k++) {
    const players = Array.from({ length: n }, (_, i) => 'p' + i);
    const Wd = G.newWorld(players, 0, mode === 'survival' ? { mode: 'survival' } : { mode: 'single', errand: id }, 1000 + k * 7919);
    if (process.env.NOSLIP && Wd.car) Wd.car.nextSlip = 1e9;
    if (process.env.NOASK) Wd.asks = false;
    const brain = new G.Brain(0.85 + rng() * 0.3), team = new G.Team(n, rng);
    const nov = process.env.NOVICE ? new G.Novice(n, rng) : null;
    if (nov && process.env.SLOW) team.delay = team.delay.map(() => Math.round((0.55 + rng() * 0.45) * 60));
    const dt = 1 / 60; let t = 0, peakSeen = 0, risk = 0;
    while (Wd.phase !== 'end' && t < 1500) {
      const o = brain.think(Wd, dt);
      const pk = team.packets(Wd, o, dt);
      G.stepWorld(Wd, dt, nov ? nov.apply(Wd, pk, dt) : pk);
      // a typical head answers questions after a few seconds: mostly grown-up small talk, sometimes a kid slip, sometimes nothing
      if (!process.env.NOTALK) Wd.people.forEach((p, i) => {
        if (!(p.ask > 0)) { p.simT = undefined; return; }
        if (p.simT === undefined) { const r = rng(); p.simT = r < 0.1 ? -1 : 2 + rng() * 4; p.simLine = r < (nov ? 0.4 : 0.25) ? 'my mum said we can have sweets' : r < 0.4 ? 'erm, yes' : 'Good afternoon. Dreadful traffic today, terrible for business.'; }
        if (p.simT > 0 && (p.simT -= dt) <= 0) G.hostTalk(Wd, i, p.simLine, G.localJudge(p.simLine));
      });
      t += dt;
    }
    const r = Wd.run.results[Wd.run.results.length - 1] || { ok: false, time: t, scatters: Wd.run.scatters, peak: 1 };
    R.push({ ok: mode === 'survival' ? true : r.ok, time: mode === 'survival' ? t : r.time, scatters: mode === 'survival' ? Wd.run.scatters : r.scatters, peak: r.peak, idle: Math.max(0, ...Object.values(team.idleMax)), idleBy: team.idleMax, rank: r.rank, fail: r.fail, done: Wd.run.done, falls: r.falls });
    if (mode === 'survival' && process.env.WHY) console.log('  survival run', k, 'done', Wd.run.done, 'why', Wd.run.why, 'last errand', Wd.errand.id, 'step', Wd.errand.step, 'idle', JSON.stringify(team.idleMax));
    if (!r.ok && process.env.WHY) console.log('  failed run', k, 'step', Wd.errand.step, 'at', Wd.body.x.toFixed(2), Wd.body.z.toFixed(2), 'yaw', Wd.body.yaw.toFixed(2), 'items', JSON.stringify(Wd.items.map((i) => [i.id, i.x.toFixed(2), i.y.toFixed(2), i.z.toFixed(2), i.held])), 'hands', JSON.stringify(Wd.hands.map((h) => [h.x.toFixed(2), h.y.toFixed(2), h.z.toFixed(2)])));
  }
  const ok = R.filter((r) => r.ok);
  const row = { errand: id, players: n, median: Math.round(med(ok.map((r) => r.time))), longest: Math.round(Math.max(0, ...ok.map((r) => r.time))),
    scatters: +(R.reduce((a, r) => a + r.scatters, 0) / R.length).toFixed(2), idle: Math.round(Math.max(...R.map((r) => r.idle))),
    idlePart: Object.entries(R.reduce((m, r) => { for (const [k, v] of Object.entries(r.idleBy)) m[k] = Math.max(m[k] || 0, v); return m; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0],
    done: Math.round((ok.length / R.length) * 100), risk: Math.round((R.filter((r) => r.peak >= 0.6).length / R.length) * 100),
    ranks: R.map((r) => r.rank || '-').join(''), fails: [...new Set(R.filter((r) => !r.ok).map((r) => r.fail))].join('; '), surv: med(R.map((r) => r.done)) };
  rows.push(row);
  console.log(JSON.stringify(row));
}
await writeFile('test/sim/last.json', JSON.stringify(rows, null, 1));
