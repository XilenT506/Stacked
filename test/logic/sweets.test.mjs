// Logic tests for M1-F3: sweets and loot that make sense. Loot at the plan's scale (quota 150, Del's prices
// matter); the cream cakes are throwable props, not loot, and picking one up no longer shoves the coat
// across the shop; carrying big loot, the hint says your hands are full; the HUD and the getaway gate show
// the same money line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { moneyLine } from '../../src/systems/job.js';
import { quotaHtml } from '../../src/ui/quotaBar.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const inp = (presses = {}, x = 0, z = 0) => ({ move: { x, z }, aim: null, run: false, use: false, natural: false, presses });
const place = (c, x, z) => { c.walker.body.setTranslation({ x, y: 1.2, z }, true); c.walker.vel.x = c.walker.vel.z = 0; };
const run = (g, n, I = inp()) => { for (let i = 0; i < n; i++) { g.setInput('p1', I); if (g.player('p2')) g.setInput('p2', inp()); g.step(); } };

test('sweets at the plan\'s scale: quota 150, and Del\'s prices are a real choice', () => {
  const L = DATA.place.loot.list, total = L.reduce((a, e) => a + e.value, 0);
  assert.equal(DATA.place.job.quota, 150);
  assert.equal(total, 298, 'every loot value divided by 10');
  assert.equal(L.find((e) => e.id === 'birthday_cake').value, 80);
  const prices = Object.values(DATA.balance.shop.prices);
  assert.ok(Math.min(...prices) >= 30 && Math.max(...prices) <= 55);
  const sum = prices.reduce((a, b) => a + b, 0);
  assert.ok(150 >= 2 * Math.max(...prices) && 150 < sum, 'a job that just meets the quota buys two or three things, not the whole stall');
});

test('the cream cakes are props to throw, not loot, and say so', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const p = g.players[0], c = p.coat;
  assert.ok(!g.loot.items.some((it) => /cream/i.test(it.name) || it.id.includes('cream')), 'no cream cake in the loot');
  assert.equal(g.things.list.filter((t) => t.name === 'cream_cake').length, 2);
  // next to Nan's cake the loot hint wins; next to a cream cake on its own it says it's a prop
  place(c, 13.5, -4.3); run(g, 20); assert.match(g.hint('p1'), /birthday cake \(80 sweets\)/);
  place(c, 15.8, -4.3); run(g, 20); assert.equal(g.hint('p1'), 'E: pick up a cream cake (a prop to throw, not loot)');
  run(g, 2, inp({ grab: 1 }));
  assert.equal(p.hands.held?.def.name, 'Cream cake'); assert.equal(g.loot.inHand(), 0, 'holding a cream cake is not holding sweets');
});

test('picking up a cream cake after walking does not shove the coat across the shop', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const p = g.players[0], c = p.coat;
  place(c, 13, -4.3); run(g, 20);
  run(g, 25, inp({}, -1, 0));                                       // walk along the counter
  assert.match(g.hint('p1'), /cream cake/);
  run(g, 1, inp({ grab: 1 })); assert.equal(p.hands.held?.def.name, 'Cream cake');
  const a = { x: c.walker.feet.x, z: c.walker.feet.z };
  run(g, 90, inp({ grab: 1 }));                                     // hold still for 1.5 s
  const moved = Math.hypot(c.walker.feet.x - a.x, c.walker.feet.z - a.z);
  assert.ok(moved < 0.8, `the coat slid ${moved.toFixed(2)} m (it used to fly 7 to 13 m)`);
  run(g, 60, inp({ grab: 1 }, 1, 0));
  assert.ok(c.walker.feet.x > a.x + 1, 'and still walks normally holding it');
});

test('carrying big loot, small loot in reach says your hands are full', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const p = g.players[0], c = p.coat;
  const lolly = g.loot.items.find((it) => it.id === 'giant_lolly'), choc = g.loot.items.find((it) => it.id === 'chocolate');
  Object.assign(lolly, { state: 'carried', carriers: [c] }); g.loot.load(lolly);
  place(c, choc.x, choc.z + 0.8); run(g, 10);
  assert.equal(g.hint('p1'), 'Hands full: drop the giant lolly first (E)');
});

test('the HUD and the getaway gate show the same money line', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const [a, b] = g.players.map((p) => p.coat), at = (id) => g.loot.items.find((it) => it.id === id);
  Object.assign(at('chocolate'), { state: 'pocket', owner: a }); Object.assign(at('coin_jar'), { state: 'pocket', owner: a });
  Object.assign(at('lollies'), { state: 'pocket', owner: b });
  place(a, ...DATA.place.getaway.at); run(g, 20);
  assert.equal(g.loot.bankedValue, 45, 'standing at the gate banks what you bring');
  const m = moneyLine(g.loot, g.job);
  assert.equal(m.text, 'Banked 45 · Holding 8 · Quota 150');
  assert.equal(g.hint('p1'), `E: get away! ${m.text} (this ends the job)`);
  // the HUD's money line
  const html = quotaHtml(g.job, g.loot);
  assert.equal(html.match(/<div class="qt">(.*?)<\/div>/)[1].replace(/<[^>]+>/g, ''), m.text);
  assert.doesNotMatch(html, /Bonus|×|%</, 'no bonus on the HUD: that is for the results screen');
});
