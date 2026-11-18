const G = await import('./.bundle.mjs?' + Date.now());
let seed = 99; const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const tally = {}; const add = (k) => (tally[k] = (tally[k] || 0) + 1);
for (let j = 0; j < 10; j++) {
  const Wd = G.newWorld(['a', 'b', 'c'], 0, { mode: 'single', errand: process.argv[2] || 'bank' }, 1000 + j * 7919);
  const brain = new G.Brain(1), team = new G.Team(3, rng), nov = new G.Novice(3, rng);
  let t = 0, busts = 0, falls = 0, ring = [];
  while (Wd.phase !== 'end' && t < 400) {
    const o = brain.think(Wd, 1 / 60); G.stepWorld(Wd, 1 / 60, nov.apply(Wd, team.packets(Wd, o, 1 / 60), 1 / 60)); t += 1 / 60;
    ring.push({ down: Wd.body.down, lean: Math.hypot(Wd.body.lx, Wd.body.lz), step: Wd.errand.step, held: Wd.items.some((i) => i.held >= 0), greet: Wd.people.some((p) => p.greet), ask: Wd.people.some((p) => p.ask > 0), x: Wd.body.x, z: Wd.body.z }); if (ring.length > 240) ring.shift();
    if (Wd.stats.falls > falls) { falls = Wd.stats.falls; const r = ring[ring.length - 1]; add(`fall step${r.step} ${r.held ? 'holding' : 'empty'} at ${r.x.toFixed(0)},${r.z.toFixed(0)}`); }
    if (Wd.stats.busts > busts) {
      busts = Wd.stats.busts; const fell = ring.some((r) => r.down), asked = ring.some((r) => r.ask), greeted = ring.some((r) => r.greet);
      add('BUST ' + (fell ? 'after a fall' : asked ? 'after a question' : greeted ? 'after an unanswered hello' : 'other') + ' step' + ring[ring.length - 1].step);
    }
  }
  add('end ' + (Wd.run.results[0]?.ok ? 'done' : 'failed'));
}
console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + '  ' + k).join('\n'));
