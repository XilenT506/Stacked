// Logic tests for M1-F4: the way out, and carrying together. A side exit from the café corner opens onto
// the car park near the gate; the parked cars leave a clear lane; a bot carries Nan's cake from the bakery
// (and from the entrance) to the gate without getting stuck; leaving with kids still inside takes two
// presses of E and costs them; two coats carry the cake 15 m together without spilling a kid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Bot, botInput } from '../helpers/bot.mjs';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const DT = 1 / 60, P = DATA.place, gate = P.getaway.at;
const inp = (presses = {}, move = { x: 0, z: 0 }) => ({ move, aim: null, run: false, use: false, natural: false, presses });
const put = (c, x, z) => { c.walker.body.setTranslation({ x, y: 1.2, z }, true); c.walker.vel.x = c.walker.vel.z = 0; };
const pathLen = (p) => p.reduce((a, q, i) => a + (i ? Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) : 0), 0);

test('a side exit from the café corner opens onto the car park, next to the gate', () => {
  const side = P.doors.find((d) => d.id === 'side');
  assert.deepEqual(side.between, ['cafe', 'carpark']);
  const g = new Game(R, DATA); g.addPlayer('p1');
  const path = g.people.nav.path(15.8, 10.6, gate[0], gate[1]);
  assert.ok(path && pathLen(path) < 10, `café to gate is a short walk (${path && pathLen(path).toFixed(1)} m)`);
  // and it is shut with the fruit and veg at Closing Time, before the front
  const sec = P.closingTime.sections.find((s) => s.shutters.some((q) => q.join() === side.span.join()));
  assert.ok(sec && sec.areas.includes('cafe'));
});

for (const [from, start] of [['the bakery', [13.5, -4.2]], ['the entrance', [-14.5, 10.5]]]) {
  test(`a bot carries the cake from ${from} to the gate without getting stuck`, () => {
    const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat, cake = g.loot.items.find((i) => i.id === 'birthday_cake');
    for (const p of g.people.list) p.walker.body.setTranslation({ x: p.feet.x, y: -50, z: p.feet.z }, true);   // (nobody about: this is about the way)
    if (from === 'the entrance') Object.assign(cake, { x: start[0], z: start[1] - 0.8 });
    put(c, ...start);
    const bot = new Bot(c, g.people.nav, [{ press: true }, { go: gate, within: 1 }]), k = {};
    let t = 0;
    while (!bot.done && t < 90) { g.setInput('p1', botInput(bot.input(DT, []), k)); g.step(); g.take(); t += DT; }
    assert.ok(bot.done, `stuck at ${JSON.stringify(c.walker.feet)} (${bot.log.at(-1)})`);
    for (let i = 0; i < 10; i++) { g.setInput('p1', botInput({ move: { x: 0, z: 0 } }, k)); g.step(); }
    assert.equal(cake.state, 'banked', 'the cake got to the gate'); assert.equal(c.loose.length, 0, 'nobody fell out');
    console.log(`  cake from ${from} to the gate: ${t.toFixed(1)} s`);
  });
}

test('the gate warns about kids still inside; E again leaves them in the Lost & Found', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const p = g.players[0], c = p.coat;
  put(c, ...gate); for (let i = 0; i < 10; i++) { g.setInput('p1', inp()); g.step(); }
  c.hit(8); for (let i = 0; i < 5; i++) { g.setInput('p1', inp()); g.step(); }
  for (const k of c.loose) { k.x = 0; k.z = 0; }                     // (they ran off back into the shop)
  put(c, ...gate); for (let i = 0; i < 10; i++) { g.setInput('p1', inp()); g.step(); }
  const left = g.kidsInside(); assert.ok(left >= 1); g.take();
  g.setInput('p1', inp({ grab: 1 })); g.step();
  assert.ok(!g.job.over, 'the first E only warns');
  const warn = g.take().find((e) => e.k === 'announce' && e.to === 'p1');
  assert.equal(warn.text, `${left} kid${left > 1 ? 's' : ''} still inside! E again to leave without them`);
  assert.match(g.hint('p1'), /^E again: leave \d kids? behind/);
  g.setInput('p1', inp({ grab: 2 })); g.step();
  assert.ok(g.job.over); assert.equal(g.job.result.leftBehind, left);
  assert.ok(c.loose.every((k) => k.caged), 'they wait in the Lost & Found');
});

test('two coats carry the cake 15 m together without spilling a kid (steadier than alone)', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const [a, b] = g.players.map((p) => p.coat), cake = g.loot.items.find((i) => i.id === 'birthday_cake');
  put(a, 13.0, -4.1); put(b, 14.2, -4.1);
  const step = (ia, ib) => { g.setInput('p1', ia); g.setInput('p2', ib); g.step(); g.take(); };
  for (let i = 0; i < 20; i++) step(inp(), inp());
  step(inp({ grab: 1 }), inp()); step(inp({ grab: 1 }), inp({ grab: 1 }));
  assert.deepEqual(cake.carriers, [a, b]); assert.ok(a.coCarry && b.coCarry);
  const from = { x: cake.x, z: cake.z }, bot = new Bot(a, g.people.nav, [[12.2, -3], [12.2, 6.6], [15.8, 6.6], [15.8, 14]].map((go) => ({ go, hurry: true })));   // (no stopping to act natural: this is about carrying)
  let maxW = 0, t = 0;
  // A leads along the way out; B does what a friend does: walks along behind A in A's footsteps, about a metre back
  const trail = [];
  const follow = (o) => {
    const fa = a.walker.feet, fb = b.walker.feet; trail.push({ x: fa.x, z: fa.z });
    let i = trail.length - 1, back = 0; while (i > 0 && back < 1.0) { back += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].z - trail[i - 1].z); i--; }
    const want = Math.hypot(fb.x - fa.x, fb.z - fa.z) > 1.0 ? trail[i] : { x: fb.x, z: fb.z };
    const mx = o.move.x + (want.x - fb.x) * 2, mz = o.move.z + (want.z - fb.z) * 2, l = Math.hypot(mx, mz);
    return l > 1 ? { x: mx / l, z: mz / l } : { x: mx, z: mz };
  };
  while (!bot.done && t < 30) { const o = bot.input(DT, g.people.list); step(inp({ grab: 1 }, o.move), inp({ grab: 1 }, follow(o))); maxW = Math.max(maxW, a.wobble, b.wobble); t += DT; if (process.env.TRACE && Math.round(t * 60) % 30 === 0) console.log(t.toFixed(1), cake.state, a.walker.feet.x.toFixed(1), a.walker.feet.z.toFixed(1), b.walker.feet.x.toFixed(1), b.walker.feet.z.toFixed(1), b.walker.flatSpeed.toFixed(1)); }
  const moved = Math.hypot(cake.x - from.x, cake.z - from.z);
  assert.ok(moved >= 15, `carried ${moved.toFixed(1)} m (${cake.state}, bot ${bot.log.at(-1)}, a ${JSON.stringify(a.walker.feet)} b ${JSON.stringify(b.walker.feet)})`);
  assert.equal(cake.state, 'carried', 'still holding it together');
  assert.equal(a.loose.length + b.loose.length, 0, 'no kid fell out');
  assert.ok(maxW < 0.8, `the wobble stayed low (${maxW.toFixed(2)}; walking through the fruit, a melon or two bumps the leader)`);
});
