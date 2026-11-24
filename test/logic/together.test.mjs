// Logic tests for M1-F8: the coat stays together, and says why when it doesn't. A slip is a short skid (not a
// slide across the shop), every fall has a one-line reason, a fallen kid's sweets lie on the floor next to it
// ready to pocket again, the coat slides round the ends of tills and shelves, and nothing walks off the map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Bot } from '../helpers/bot.mjs';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const DT = 1 / 60, B = DATA.balance;
const inp = (o = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...o });
const put = (w, x, z) => { const p = { x, y: w.half + w.radius + 0.02, z }; w.body.setTranslation(p, true); w.body.setNextKinematicTranslation(p); w.vel.x = w.vel.z = 0; };
const quiet = (g) => { for (const p of g.people.list) put(p.walker, p.feet.x + 60, p.feet.z); };   // (nobody about)
const steps = (g, n, I = inp()) => { const out = []; for (let i = 0; i < n; i++) { g.setInput('p1', I); g.step(); out.push(...g.take()); } return out; };

test('slipping on your own puddle is a short skid: under 3 m, with the reason on the HUD', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); quiet(g); const c = g.players[0].coat;
  put(c.walker, -14, 5.2); steps(g, 5);
  // your own water: squirt the floor ahead of you along the till row for a couple of seconds
  c.gadgets.i = c.gadgets.slots.indexOf('water_pistol');
  for (let x = -14; x < -4; x += 1.5) { put(c.walker, x, 5.2); steps(g, 60, inp({ use: true, aim: { x: 1, z: 0 } })); steps(g, 30); }
  // and your own water balloons burst along it (the splash a balloon leaves: data/gadgets.json onLand)
  const splash = DATA.gadgets.gadgets.water_balloon.onLand.signals.find((x) => x.type === 'slippery');
  for (let x = -13; x < -3; x += 2) g.signals.emit({ type: 'slippery', range: splash.range, position: { x, y: 0, z: 5.2 }, data: { color: splash.color }, source: c });
  steps(g, 2);
  assert.ok(g.mess.patches.filter((p) => p.slippery).length >= 6, `a wet trail (${g.mess.patches.length} patches)`);
  // run back onto it, and let go of the keys as soon as your feet go
  put(c.walker, -17, 5.2); let start = null, t = 0;
  for (; t < 8; t += DT) {
    if (!start && c.onSlippery()) start = { ...c.walker.feet };
    g.setInput('p1', start ? inp() : inp({ move: { x: 1, z: 0 }, run: true })); g.step(); g.take();
  }
  assert.ok(start, 'it slipped');
  const slid = Math.hypot(c.walker.feet.x - start.x, c.walker.feet.z - start.z);
  console.log(`  skid on your own water: ${slid.toFixed(2)} m (before M1-F8 a puddle trail slid a coat 7 to 29 m), ${c.count} kids`);
  assert.ok(slid < 3, `slid ${slid.toFixed(2)} m`);
  // walking about on it fills the wobble, and the HUD says why
  c.loose = []; c.stack = ['sid', 'mo', 'tank']; c.applyHeight(); c.wobble = 0;      // (all back in the coat)
  put(c.walker, -9, 5.2); steps(g, 30); for (let i = 0; i < 30; i++) { g.setInput('p1', inp({ move: { x: 0.4, z: 0 } })); g.step(); g.take(); }
  assert.equal(c.fillText, 'slippery floor');
  c.wobble = 0.999; c.lastFill = 'slip'; for (let i = 0; i < 4 && c.count === 3; i++) { g.setInput('p1', inp({ move: { x: 0.4, z: 0 } })); g.step(); g.take(); }
  assert.equal(c.count, 2, 'a kid slipped out'); assert.match(c.whyText, /^Slipped on a puddle!/);
});

test("a fallen kid's sweets lie on the floor next to it, the money line drops at once, and you can pocket them again", () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); quiet(g); const c = g.players[0].coat;
  const smalls = g.loot.items.filter((i) => i.kind === 'small').slice(0, 6);
  for (const it of smalls) { put(c.walker, it.x, it.z + 0.5); steps(g, 3); g.setInput('p1', inp({ presses: { grab: (g._n = (g._n ?? 0) + 1) } })); g.step(); g.take(); }
  assert.equal(g.loot.pockets(c).length, 6, 'six sweets in the pockets');
  assert.deepEqual([...new Set(g.loot.pockets(c).map((i) => i.kid))].sort(), [...c.stack].sort(), 'shared out: every kid holds some');
  put(c.walker, 0.5, 5); steps(g, 3);
  const top = c.stack.at(-1), theirs = g.loot.pockets(c).filter((i) => i.kid === top), holding = g.loot.inHand();
  const dropped = theirs.reduce((a, i) => a + i.value, 0);
  c.hit(9, 'hit', 'melon'); g.setInput('p1', inp()); g.step(); g.take();
  const kid = c.loose.find((k) => k.id === top); assert.ok(kid, 'the top kid fell out');
  assert.ok(theirs.length && theirs.every((i) => i.state === 'lying' && Math.hypot(i.x - kid.x, i.z - kid.z) < 1), 'its sweets lie right next to it');
  assert.equal(g.loot.inHand(), holding - dropped, 'Holding goes down at once, by what fell out');
  assert.equal(c.whyText, `Whacked by a flying melon! Dropped ${dropped} sweets!`);
  // the other kids keep theirs; then pick one back up
  assert.equal(g.loot.pockets(c).length, 6 - theirs.length);
  const it = theirs[0]; put(c.walker, it.x, it.z); steps(g, 2);
  g.setInput('p1', inp({ presses: { grab: 99 } })); g.step(); g.take();
  assert.equal(it.state, 'pocket', 'pocketed again');
});

test('throwing something never knocks a kid out of your own coat', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); quiet(g); const c = g.players[0].coat;
  const melon = g.things.list.find((t) => t.def.name?.toLowerCase().includes('melon') && t.kind !== 'machine');
  assert.ok(melon, 'a melon in the shop');
  put(c.walker, melon.position.x, melon.position.z + 0.8); steps(g, 3);
  const h = g.players[0].hands; h.pickUp(melon); steps(g, 3);
  for (const aim of [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }]) {
    h.throw(aim); steps(g, 30); assert.equal(c.count, 3, `threw ${JSON.stringify(aim)}: nobody fell out`);
    put(c.walker, melon.position.x, melon.position.z + 0.8); steps(g, 3); h.pickUp(melon); steps(g, 2);
  }
});

test('a bot walks along the till row and the aisle ends without getting stuck', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); quiet(g); const c = g.players[0].coat;
  put(c.walker, -16, 5.6); steps(g, 3);
  // close to the ends of the tills (z 6) and of the shelves (z 4 and z -6), the way a player cuts corners
  const route = [[-16, 5.65], [6, 5.65], [7.5, 4.3], [-16.5, 4.3], [-16.5, -6.3], [7.5, -6.3]];
  let stuck = 0, t = 0, worst = 0, run = 0;
  for (const [x, z] of route) {
    for (let k = 0; k < 20 * 60; k++) {
      const f = c.walker.feet, dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz); if (d < 0.35) break;
      g.setInput('p1', inp({ move: { x: dx / d, z: dz / d } })); g.step(); g.take(); t += DT;
      if (c.walker.flatSpeed < 0.5 && t > 0.3) { stuck += DT; run += DT; worst = Math.max(worst, run); } else run = 0;
    }
    assert.ok(Math.hypot(x - c.walker.feet.x, z - c.walker.feet.z) < 0.5, `got to ${x}, ${z} (at ${c.walker.feet.x.toFixed(2)}, ${c.walker.feet.z.toFixed(2)})`);
  }
  console.log(`  straight along the tills and aisle ends: ${t.toFixed(1)} s, stuck ${stuck.toFixed(2)} s (longest ${worst.toFixed(2)} s)`);
  assert.ok(worst < 0.5, `stuck for ${worst.toFixed(2)} s in one go`);
  // and the same with the test bot finding its own way
  put(c.walker, -16, 5.6); steps(g, 3);
  const bot = new Bot(c, g.people.nav, [[6, 5.6], [7.5, 4.3], [-16.5, 4.3], [-16.5, -6.3], [7.5, -6.3]].map((go) => ({ go })));
  let bt = 0;
  for (; bt < 90 && !bot.done; bt += DT) { const o = bot.input(DT, g.people.list); g.setInput('p1', inp({ move: o.move })); g.step(); g.take(); }
  assert.ok(bot.done, `the bot got stuck (${bot.log.join(', ')})`);
  console.log(`  the bot: ${bt.toFixed(1)} s`);
});

test('the coat slides round corners it clips instead of snagging on them', () => {
  // straight lines that clip the end of a till, a shelf, the freezer, a crate or the counter by a hand's width
  const legs = [[[-13.4, 4.4], [-10.6, 7.2]], [[-10.6, 4.4], [-13.4, 7.2]], [[-11.5, 2.5], [-7.6, 5.5]], [[-11.5, -4.5], [-7.6, -7.5]],
    [[5.2, 2.6], [8.2, 5.3]], [[12.6, 6.8], [15.4, 9.6]], [[9.8, 4.6], [12.4, 6.6]], [[9.6, -3.5], [9.0, -6.5]]];
  let total = 0;
  for (const [a, b] of legs) {
    const g = new Game(R, DATA); g.addPlayer('p1'); quiet(g); const c = g.players[0].coat;
    put(c.walker, ...a); steps(g, 3);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), dir = { x: (b[0] - a[0]) / d, z: (b[1] - a[1]) / d };
    let t = 0;
    for (; t < 4; t += DT) {
      const f = c.walker.feet; if ((f.x - a[0]) * dir.x + (f.z - a[1]) * dir.z >= d) break;
      g.setInput('p1', inp({ move: dir })); g.step(); g.take(); if (t > 0.3 && c.walker.flatSpeed < 0.5) total += DT;
    }
    assert.ok(t < 4, `got past the corner from ${a} to ${b}`);
  }
  console.log(`  clipping 8 corners: stuck ${total.toFixed(2)} s in all (before M1-F8: 0.43 s, on the crates)`);
  assert.ok(total < 0.1, `stuck ${total.toFixed(2)} s`);
});

test('the world has no holes: not past the getaway gate, not through the outer wall', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); quiet(g); const c = g.players[0].coat;
  // straight out past the getaway gate into the blank area
  put(c.walker, 16, 18.5); steps(g, 3);
  for (let i = 0; i < 4 * 60; i++) { g.setInput('p1', inp({ move: { x: 0, z: 1 }, run: true })); g.step(); g.take(); }
  assert.ok(c.walker.feet.z < 20, `stays in the car park (z ${c.walker.feet.z.toFixed(2)})`);
  // a hard shove into the shop's outer wall at a low frame rate: never comes out the other side
  put(c.walker, 17.4, 0); steps(g, 3);
  for (let i = 0; i < 40; i++) { c.walker.vel.x = 40; g.setInput('p1', inp({ move: { x: 1, z: 0 }, run: true })); g.step(); g.take(); }
  assert.ok(c.walker.feet.x < 18, `still inside the shop (x ${c.walker.feet.x.toFixed(2)})`);
  // a grown-up shoved through the fence is put back too
  const gu = g.people.byType('shopper')[0]; put(gu.walker, 21.5, 5); steps(g, 3);
  for (let i = 0; i < 30; i++) { gu.walker.vel.x = 40; steps(g, 1); }
  assert.ok(gu.feet.x < 22, `the shopper stays on the map (x ${gu.feet.x.toFixed(2)})`);
  // and the edge behind the gate is not drawn: an invisible wall
  assert.ok(g.place.statics.some((s) => s.invisible && s.kind === 'edge'));
});
