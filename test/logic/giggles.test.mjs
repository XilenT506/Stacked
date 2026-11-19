// Logic tests for M1-11: Giggles. A Domino from a real chain (a water balloon splashes a group at the
// tills; soaked and on a wet floor they go over one after another, each fall a noise that is part of the
// same chain); trick shot; soaking a friend; nerves of steel in the mannequin row; a last-second getaway;
// the Giggle meter starting a Giggle Rush (team Sugar Rush, endless ammo); Giggles on the results; and the
// best moments keeping their game state for the highlight reel (a Mirror can play a stored frame).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Mirror } from '../../src/net/snapshot.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const G = DATA.balance.giggles.moments;
const idle = (extra = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...extra });
const put = (body, x, z, y = 1) => body.setTranslation({ x, y, z }, true);
const giggleEvents = (g, out) => { for (const e of g.take()) if (e.k === 'giggle') out.push(e); };

// a group of shoppers and Granny at the tills, and a coat with a water balloon 4 m away
function tillsScene() {
  const g = new Game(R, DATA); g.addPlayer('p1');
  const c = g.players[0].coat; put(c.walker.body, 0, 11);
  const who = g.people.list.filter((p) => ['shopper', 'granny'].includes(p.typeName));
  [[-0.6, 7], [0.6, 7], [0, 6.2], [0, 7.8], [0.8, 6.3]].forEach(([x, z], i) => who[i] && put(who[i].walker.body, x, z, 0.9));
  for (let i = 0; i < 10; i++) g.step();
  g.gadgets.arm(c, [...DATA.gadgets.loadout.slots, 'water_balloon']);
  return { g, c, who };
}

test('a Domino from a real chain: one water balloon, and the grown-ups go over one after another', () => {
  const { g, c } = tillsScene(), out = [];
  g.gadgets.fire(c, 'water_balloon', 0.25, { x: 0, z: -1 });
  for (let i = 0; i < 60 * 6; i++) { g.step(); giggleEvents(g, out); }
  const dom = g.giggles.moments.find((m) => m.kind === 'domino');
  assert.ok(dom, `a Domino (moments: ${JSON.stringify(g.giggles.moments.map((m) => m.kind))})`);
  assert.ok(dom.n >= G.domino.min, `at least ${G.domino.min} on the floor (${dom.n})`);
  assert.ok(dom.signals >= 4 && dom.types.includes('noise') && dom.types.length >= 2, `a real chain of signals (${dom.signals}: ${dom.types})`);
  assert.equal(dom.by, 'p1', 'the thrower gets the credit');
  assert.equal(dom.giggles, G.domino.giggles + G.domino.perExtra * (dom.n - G.domino.min));
  assert.ok(out.some((e) => e.label === `DOMINO ×${dom.n}!`), 'the game shouts it');
  assert.equal(g.giggles.total, dom.giggles); assert.equal(g.giggles.meter, dom.giggles);
  // the highlight reel: the moment kept the game state from before it (and a little after) ...
  assert.ok(dom.frames.length >= 8, `frames kept (${dom.frames.length})`);
  // ... and a Mirror can play a stored frame: the grown-ups lie on the floor in it
  const last = dom.frames[dom.frames.length - 1], mirror = new Mirror(DATA); mirror.apply(last);
  assert.ok(mirror.people.list.filter((p) => p.state === 'slipped').length >= G.domino.min, 'the replay frame shows them on the floor');
});

test('trick shot: the slingshot hits a grown-up from right across the shop', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
  // down the whole length of aisle 1
  const cashier = g.people.list.find((p) => p.typeName === 'cashier');
  put(cashier.walker.body, -15.5, -4.5, 0.9); put(c.walker.body, -15.5, 7.6);
  for (let i = 0; i < 5; i++) g.step();
  const d = { x: cashier.feet.x - c.walker.feet.x, z: cashier.feet.z - c.walker.feet.z }, l = Math.hypot(d.x, d.z);
  g.gadgets.fire(c, 'slingshot', 1, { x: d.x / l, z: d.z / l });
  for (let i = 0; i < 90; i++) g.step();
  const m = g.giggles.moments.find((x) => x.kind === 'trickShot');
  assert.ok(m && m.dist >= G.trickShot.distance, `trick shot (${JSON.stringify(g.giggles.moments)})`);
  // a short shot is not a trick shot
  const g2 = new Game(R, DATA); g2.addPlayer('p1'); const c2 = g2.players[0].coat, k2 = g2.people.list.find((p) => p.typeName === 'cashier');
  put(c2.walker.body, k2.feet.x + 3, k2.feet.z); for (let i = 0; i < 5; i++) g2.step();
  g2.gadgets.fire(c2, 'slingshot', 1, { x: -1, z: 0 }); for (let i = 0; i < 60; i++) g2.step();
  assert.ok(!g2.giggles.moments.some((x) => x.kind === 'trickShot'));
});

test('soaking a friend', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const [a, b] = g.players.map((p) => p.coat);
  put(a.walker.body, -14, 15); put(b.walker.body, -14, 13); for (let i = 0; i < 5; i++) g.step();
  g.gadgets.fire(a, 'water_pistol', 1, { x: 0, z: -1 });
  for (let i = 0; i < 40; i++) g.step();
  const m = g.giggles.moments.find((x) => x.kind === 'soakFriend');
  assert.ok(m && m.by === 'p1' && m.who === 'p2', JSON.stringify(g.giggles.moments));
});

test('nerves of steel: posing in the mannequin row while the guard inspects you up close, and he walks off', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
  const pose = g.things.list.find((t) => t.kind === 'hide' && t.mode === 'pose'), guard = g.people.list.find((p) => p.typeName === 'guard');
  put(c.walker.body, pose.position.x, pose.position.z + 0.5); for (let i = 0; i < 5; i++) g.step();
  g.setInput('p1', idle({ natural: true })); g.step();
  assert.equal(c.hidden?.mode, 'pose', 'posing');
  put(guard.walker.body, pose.position.x - 4, pose.position.z + 1, 0.9); g.step();
  guard.walker.yaw = Math.atan2(c.walker.feet.x - guard.feet.x, c.walker.feet.z - guard.feet.z);     // looking our way
  let saw = false;
  for (let i = 0; i < 60 * 20; i++) { g.setInput('p1', idle({ natural: true })); g.step(); if (guard.state === 'inspect') saw = true; if (g.giggles.moments.some((m) => m.kind === 'mannequin')) break; }
  assert.ok(saw, 'the guard came to inspect');
  assert.ok(g.giggles.moments.some((m) => m.kind === 'mannequin'), `nerves of steel (guard ${guard.state}, hostile ${guard.hostile.has(c)})`);
});

test('a last-second getaway, and one kid left', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
  g.closing.start(); g.closing.next = g.closing.sections.length - 1; g.closing.warnT = 5;
  put(c.walker.body, ...DATA.place.getaway.at); for (let i = 0; i < 5; i++) g.step();
  assert.ok(c.atGate);
  g.setInput('p1', idle({ presses: { grab: 1 } })); g.step();
  assert.equal(g.job.why, 'got away');
  assert.ok(g.giggles.moments.some((m) => m.kind === 'lastSecond'), JSON.stringify(g.giggles.moments));
  assert.ok(!g.giggles.moments.some((m) => m.kind === 'oneKid'), 'three kids: no one-kid show');
  // the results show the Giggles
  const r = g.job.result;
  assert.equal(r.giggles.total, G.lastSecond.giggles);
  assert.deepEqual(r.giggles.moments.map((m) => m.label), [DATA.giggles.moments.lastSecond.shout]);
  assert.ok(g.run.highlights.length >= 1 && g.run.highlights[0].frames, 'the best moment goes on the run\'s highlight list with its frames');
});

test('a full Giggle meter starts a Giggle Rush: everyone faster, endless ammo, and the meter empties', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  for (let i = 0; i < 3; i++) g.step();
  const at = { x: 0, z: 0 };
  for (let i = 0; i < 4; i++) g.giggles.moment('trickShot', { at, by: 'p1' });         // 60
  assert.ok(g.coats.every((c) => !(c.superT > 0)));
  g.giggles.moment('lastSecond', { at, by: 'p2' }); g.giggles.moment('lastSecond', { at, by: 'p2' });   // 110: full
  assert.equal(g.giggles.meter, 4 * G.trickShot.giggles + 2 * G.lastSecond.giggles - DATA.balance.giggles.meter);
  assert.ok(g.coats.every((c) => c.superT > 0 && c.sugar > 0), 'everyone is on a Giggle Rush');
  const c = g.coats[0], ammo = c.gadgets.ammo.water_pistol;
  g.gadgets.fire(c, 'water_pistol', 1, { x: 1, z: 0 });
  assert.equal(c.gadgets.ammo.water_pistol, ammo, 'endless ammo');
  for (let i = 0; i < 60 * (DATA.balance.giggles.superSeconds + 0.5); i++) g.step();
  assert.ok(g.coats.every((c) => !(c.superT > 0)), 'it wears off');
  const out = []; giggleEvents(g, out);
});
