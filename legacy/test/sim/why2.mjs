const G = await import('./.bundle.mjs?' + Date.now());
let seed = 777; const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const k = Number(process.argv[2] || 1);
for (let j = 0; j <= k; j++) {
const Wd = G.newWorld(['a', 'b', 'c'], 0, { mode: 'single', errand: 'bank' }, 1000 + j * 7919);
const brain = new G.Brain(1), team = new G.Team(3, rng), nov = new G.Novice(3, rng);
let t = 0;
while (Wd.phase !== 'end' && t < 300) {
  const o = brain.think(Wd, 1 / 60); const pk = nov.apply(Wd, team.packets(Wd, o, 1 / 60), 1 / 60); G.stepWorld(Wd, 1 / 60, pk); t += 1 / 60;
  if (j === k && Math.round(t * 60) % 300 === 0) console.log(`${t.toFixed(0)} step${Wd.errand.step} ${Wd.phase} pos(${Wd.body.x.toFixed(2)},${Wd.body.z.toFixed(2)}) yaw${Wd.body.yaw.toFixed(1)} v${Wd.body.v.toFixed(2)} brain f${o.f.toFixed(2)} t${o.t.toFixed(2)} sent ${JSON.stringify(pk[Wd.seats.legs].l)} items ${JSON.stringify(Wd.items.map((i) => [i.x.toFixed(1), i.y.toFixed(1), i.z.toFixed(1), i.held]))} sus ${Wd.people.map((p) => p.sus.toFixed(2))}`);
}
}
