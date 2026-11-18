// Analyse recorded runs: errand splits, scatter, greetings / "?" rises, per-seat dead time.
const fs = require('fs'); const files = process.argv.slice(2);
const K = {1:'FALL',3:'RIP',5:'REG',8:'COIN',10:'CAUGHT',11:'FREED',12:'RESTACK',20:'END',22:'CALM',25:'PAT',26:'POINT',28:'LOOK'};
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f)); const T = d.times, tl = d.tl;
  const a = T.errandStart, b = T.errandEnd; const first = (pred) => (tl.find((s) => s.t >= a && pred(s)) || {}).t;
  const door = first((s) => s.st >= 1), qArr = first((s) => s.st >= 1 && s.q > 0), sign = first((s) => s.st >= 2), signed = first((s) => s.st >= 3), cash = first((s) => s.st >= 4);
  const atCounter = first((s) => s.st >= 2 && s.v < 0.05 && s.z > 7.3);
  console.log(`\n${f}: end=${d.end} clockLeft=${d.clock.toFixed(1)} errand ${a}->${b} = ${(b - a).toFixed(1)}s | walk-in ${(door - a).toFixed(1)} (to queue spot ${(qArr - a).toFixed(1)}) queue ${(sign - door).toFixed(1)} [standing ${(sign - qArr).toFixed(1)}] sign ${(signed - sign).toFixed(1)} [walk to counter ${(atCounter - sign).toFixed(1)}] grab ${(cash - signed).toFixed(1)} walk-out ${(b - cash).toFixed(1)}`);
  console.log(' scatter', T.scatterStart, '->', T.scatterEnd, '=', (T.scatterEnd - T.scatterStart).toFixed(1), 'timer0 at', (tl.find((s) => s.t > T.scatterStart + 1 && s.ph === 'scatter' && s.sT <= 0) || {}).t, 'idle', JSON.stringify(d.idle), 'stats', JSON.stringify(d.stats));
  const ev = d.evs.filter((e) => [10, 11, 12, 3, 22, 25, 26].includes(e[1])).map((e) => e[0].toFixed(1) + K[e[1]]); console.log(' ev', ev.join(' '));
  // townspeople moments during the errand: a person's say/greet starts, sus rises above 0.1
  const W = tl.filter((s) => s.t >= a && s.t <= b); const greets = [], rises = []; let prevSay = [-1, -1, -1], prevHi = [0, 0, 0];
  for (const s of W) s.ppl.forEach((p, i) => { const say = p[2] === -1 ? -1 : p[2]; if (say !== -1 && prevSay[i] === -1) greets.push([s.t, i, say, p[3]]); prevSay[i] = say; const hi = p[0] > 0.1; if (hi && !prevHi[i]) rises.push([s.t, i, p[0]]); prevHi[i] = hi; });
  // whole-run as well
  const gAll = []; let ps = [-1, -1, -1]; for (const s of tl) s.ppl.forEach((p, i) => { if (p[2] !== -1 && ps[i] === -1) gAll.push(s.t.toFixed(1) + 'p' + i + ':' + p[2]); ps[i] = p[2]; });
  const susMax = Math.max(...W.flatMap((s) => s.ppl.map((p) => p[0])));
  console.log(' errand people-moments', greets.map((g) => g[0].toFixed(1) + 'p' + g[1] + ':' + g[2]).join(' '), '| sus>0.1 rises', rises.map((r) => r[0].toFixed(1) + 'p' + r[1]).join(' '), '| max sus', susMax.toFixed(2));
  console.log(' all-run people-moments', gAll.join(' '));
  // dead time per seat: "something to do" windows from game state
  const dt = 0.25, need = { legs: [], arms: [], head: [], armA: [], armB: [] };
  let prevSus = [0, 0, 0];
  for (const s of W) {
    const talk = s.ppl.some((p) => p[2] !== -1), greet = s.ppl.some((p) => p[3] > 0 || p[2] === 1), sus = s.ppl.some((p, i) => p[0] > prevSus[i] + 0.001); prevSus = s.ppl.map((p) => p[0]);
    const legs = s.v > 0.05 || s.down; const signing = s.st === 2 && s.z > 7.2, grab = s.st === 3;
    const arms = greet || signing || grab; const head = talk || sus;
    need.armA.push(greet); need.armB.push(signing || grab || s.hand[1] > 0); need.legs.push(legs); need.arms.push(arms); need.head.push(head);
  }
  const stat = (arr) => { let run = 0, best = 0, bestAt = 0, idle = 0; W.forEach((s, i) => { if (!arr[i]) { run += dt; idle += dt; if (run > best) { best = run; bestAt = s.t; } } else run = 0; }); return `longest idle ${best.toFixed(1)}s (ends ${bestAt.toFixed(1)}), waiting ${(100 * idle / (W.length * dt)).toFixed(0)}%`; };
  const or = (x, y) => x.map((v, i) => v || y[i]);
  console.log(' seat legs     ', stat(need.legs)); console.log(' seat arms     ', stat(need.arms)); console.log(' seat head     ', stat(need.head)); console.log(' seat head+arms', stat(or(need.arms, need.head))); console.log(' seat L arm    ', stat(need.armA)); console.log(' seat R arm    ', stat(need.armB));
}
