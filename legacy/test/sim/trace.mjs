const [id = 'bank', n = 1, seedArg = 1000, every = 1] = process.argv.slice(2);
const G = await import('./.bundle.mjs?' + Date.now());
let seed = 7; const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const players = Array.from({ length: Number(n) }, (_, i) => 'p' + i);
const Wd = G.newWorld(players, 0, { mode: 'single', errand: id }, Number(seedArg));
const brain = new G.Brain(1), team = new G.Team(Number(n), rng);
let t = 0, lastLog = -9, lastEv = 0;
while (Wd.phase !== 'end' && t < 600) {
  const o = brain.think(Wd, 1 / 60);
  G.stepWorld(Wd, 1 / 60, team.packets(Wd, o, 1 / 60)); t += 1 / 60;
  for (const [i, k, a] of Wd.ev) if (i > lastEv) { lastEv = i; if (![30].includes(k)) console.log(t.toFixed(1), 'ev', k, a); }
  if (t - lastLog > Number(every)) { lastLog = t; const b = Wd.body; console.log(t.toFixed(1), Wd.phase, 'step', Wd.errand.step, 'pos', b.x.toFixed(1), b.z.toFixed(1), 'lean', Math.hypot(b.lx, b.lz).toFixed(2), 'sus', Wd.people.map((p) => p.id + ':' + p.sus.toFixed(2)).join(' '), 'car', Wd.car ? [Wd.car.v.toFixed(2), Wd.car.a.toFixed(2), Wd.car.yr.toFixed(2), Wd.car.rate.toFixed(2), Wd.car.wheel.toFixed(2), Wd.body.fl.map((f) => f.toFixed(1)).join('/')].join(' ') : '', 'kids', Wd.kids.map((k) => `${k.x.toFixed(1)},${k.z.toFixed(1)}${k.caught ? 'C' : ''}`).join(' '), team.part || ''); }
}
console.log('end', Wd.end, JSON.stringify(Wd.run.results.map((r) => [r.ok, r.fail, r.time])));
