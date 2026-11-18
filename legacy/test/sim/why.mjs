// Why do first-timers get busted? Logs who filled up, and what the coat was doing, before each bust.
const G = await import('./.bundle.mjs?' + Date.now());
let seed = 777; const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const id = process.argv[2] || 'bank';
for (let k = 0; k < 3; k++) {
  const Wd = G.newWorld(['a', 'b', 'c'], 0, { mode: 'single', errand: id }, 1000 + k * 7919);
  const brain = new G.Brain(1), team = new G.Team(3, rng), nov = new G.Novice(3, rng);
  let t = 0, lastBusts = 0; const hist = [];
  while (Wd.phase !== 'end' && t < 400) {
    const o = brain.think(Wd, 1 / 60); G.stepWorld(Wd, 1 / 60, nov.apply(Wd, team.packets(Wd, o, 1 / 60), 1 / 60)); t += 1 / 60;
    if (Math.round(t * 60) % 30 === 0) hist.push(`${t.toFixed(1)} step${Wd.errand.step} ${Wd.phase} pos(${Wd.body.x.toFixed(1)},${Wd.body.z.toFixed(1)}) lean${Math.hypot(Wd.body.lx, Wd.body.lz).toFixed(2)} down${Wd.body.down} ` + Wd.people.map((p) => `${p.id}:${p.sus.toFixed(2)}${p.greet ? 'G' : ''}${p.say >= 0 || typeof p.say === 'string' ? '"' + p.say + '"' : ''}`).join(' '));
    if (Wd.stats.busts > lastBusts) { lastBusts = Wd.stats.busts; console.log(`run ${k} BUST at ${t.toFixed(1)}:`); console.log(hist.slice(-8).join('\n')); }
  }
  console.log(`run ${k} end ${Wd.phase} t=${t.toFixed(0)} busts ${Wd.stats.busts} falls ${Wd.stats.falls}`);
}
