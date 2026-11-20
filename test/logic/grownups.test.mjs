// Logic tests for M1-03: grown-ups (sight, hearing, routines, slipping, chasing and grabbing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Signals } from '../../src/systems/signals.js';
import { Things } from '../../src/world/interact/loader.js';
import { Mess } from '../../src/systems/mess.js';
import { Coat } from '../../src/entities/coat.js';
import { People } from '../../src/ai/people.js';
import { buildPlace, spawnThings } from '../../src/world/place.js';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
const DATA = J('data/interactables.json'), SHOP = J('data/places/supermarket.json'), GROWN = J('data/grownups.json');
const B = J('data/balance.json'), SIG = J('data/signals.json').types;
const R = await initPhysics();
const DT = 1 / 60;

function shop({ coatAt = null, only = null } = {}) {
  const world = makeWorld(R), signals = new Signals(SIG), mess = new Mess(signals, B);
  const data = only ? { ...SHOP, people: { list: SHOP.people.list.filter((p, i) => only(p, i)) } } : SHOP;
  const place = buildPlace(R, world, data);
  const things = new Things(R, world, signals, DATA, { mess, spots: SHOP.events, balance: B });
  spawnThings(place, things);
  const people = new People(R, world, place, GROWN, { signals, mess, things: things.list });
  const coat = coatAt ? new Coat(R, world, signals, B, coatAt, undefined, { mess }) : null;
  if (coat) coat.bounds = { x0: -21, z0: -25, x1: 21, z1: 19 };
  const events = [];
  const run = (sec, until) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      people.step(DT, coat ? [coat] : []); events.push(...people.take());
      if (coat) coat.step(DT, { x: 0, z: 0 }, false, null);
      world.step(); things.step(DT); signals.flush(DT); mess.step(DT);
      if (until?.()) return true;
    }
    return false;
  };
  return { world, signals, mess, place, things, people, coat, events, run };
}
const near = (g, x, z, r) => Math.hypot(g.feet.x - x, g.feet.z - z) < r;

test('seven grown-up models, every voice clip exists, every type has sight and speeds', () => {
  const models = Object.keys(GROWN.models).filter((m) => !m.startsWith('_'));
  assert.equal(models.length, 7);
  for (const m of models) for (const [k, f] of Object.entries(GROWN.models[m].voice)) assert.ok(readFileSync(new URL(`../../assets/voices/${f}.mp3`, import.meta.url)).length > 1000, `${m} ${k}`);
  for (const [n, t] of Object.entries(GROWN.types)) assert.ok(t.sight > 0 && t.fov > 0 && t.walk > 0 && t.run > t.walk, n);
});

test('eyes: a tall shelf blocks the view, the same aisle does not', () => {
  const s = shop({ only: (p) => p.type === 'guard' });
  const g = s.people.list[0];
  s.run(0.05);
  g.walker.body.setTranslation({ x: -7.5, y: 0.9, z: 3.5 }, true); g.walker.yaw = Math.PI;      // in aisle 3, looking up the aisle
  assert.ok(g.sees({ x: -7.5, z: -2 }), 'sees up its own aisle');
  assert.ok(!g.sees({ x: -11.5, z: -2 }), 'not through the shelf into aisle 2');
  assert.ok(!g.sees({ x: -7.5, z: 9 }), 'not behind its back');
});

test('a noise pulls the guard over', () => {
  const s = shop({ only: (p) => p.type === 'guard' });
  s.run(0.5);
  s.signals.emit({ type: 'crash', position: { x: -4, y: 0, z: 4.6 }, range: 12 });
  const g = s.people.list[0];
  assert.ok(s.run(10, () => near(g, -4, 4.6, 1.2)), `the guard stayed at ${g.feet.x.toFixed(1)}, ${g.feet.z.toFixed(1)} (${g.state})`);
  assert.equal(g.state, 'investigate');
});

test('a shopper slips on a spill', () => {
  const s = shop({ only: (p) => p.type === 'shopper' && p.at[0] === -4 });
  const g = s.people.list[0];
  s.run(0.3);
  s.signals.emit({ type: 'spill', position: { x: -1, y: 0, z: 5 }, range: 1.2, data: { color: '#c4231d' } });
  s.signals.emit({ type: 'slippery', position: { x: -1, y: 0, z: 5 }, range: 1.2, data: { color: '#c4231d' } });
  s.run(0.1);
  s.signals.emit({ type: 'noise', position: { x: 3, y: 0, z: 5 }, range: 10 });
  assert.ok(s.run(10, () => g.state === 'slipped'), `never slipped (${g.state} at ${g.feet.x.toFixed(1)}, ${g.feet.z.toFixed(1)})`);
  assert.ok(s.events.some((e) => e.type === 'say' && e.key === 'slip'));
});

test('routines run: the shelf stacker restocks aisle 3, and Granny walks to the café at minute 3', () => {
  const s = shop({ only: (p) => p.type === 'shelf_stacker' || p.type === 'granny' });
  assert.ok(s.run(20, () => s.events.some((e) => e.type === 'routine' && e.did === 'restock')), 'no restocking');
  const granny = s.people.byType('granny')[0];
  assert.notEqual(granny.state, 'routine', 'granny waits for minute 3');
  s.people.time = 179;
  assert.ok(s.run(40, () => near(granny, ...SHOP.routines.cafe.steps[0].go, 1)), `granny got to ${granny.feet.x.toFixed(1)}, ${granny.feet.z.toFixed(1)}`);
});

test('free samples pull a crowd; a smell makes people flee', () => {
  const s = shop({ only: (p) => p.type === 'shopper' });
  s.signals.emit({ type: 'food', position: { x: 13, y: 0, z: -3 }, range: 45 });
  s.run(25);
  assert.ok(s.people.list.filter((g) => near(g, 13, -3, 4)).length >= 3, 'the shoppers crowd round the bakery');
  const g = s.people.list[0], before = { ...g.feet };
  s.signals.emit({ type: 'smell', position: before, range: 5 });
  s.run(0.2); assert.equal(g.state, 'flee');
  s.run(2.5);
  assert.ok(Math.hypot(g.feet.x - before.x, g.feet.z - before.z) > 2.5, 'it ran away from the smell');
});

test('a coat posing in the mannequin row gets inspected', () => {
  const s = shop({ coatAt: [16, 0, 2.6], only: (p) => p.type === 'shopper' && p.at[0] === 12 });
  const g = s.people.list[0];
  s.coat.hidden = { mode: 'pose', thing: null }; s.coat.mods = { frozen: true };
  g.walker.yaw = Math.atan2(16 - 12, 2.6 - 4);
  assert.ok(s.run(5, () => g.state === 'inspect'), 'never looked');
  assert.ok(s.run(8, () => near(g, 16, 2.6, 2.1)), 'walked over to look');
});

test('the guard chases a one-kid player and grabs them', () => {
  const s = shop({ coatAt: [-12, 0, 5.5], only: (p) => p.type === 'guard' });
  const g = s.people.list[0];
  g.walker.yaw = Math.PI;                                  // facing into the shop
  s.coat.toggleStack();                                    // unstack: just a kid now
  assert.equal(s.coat.count, 1);
  assert.ok(s.run(3, () => g.state === 'chase'), `no chase (${g.state})`);
  assert.equal(g.target.kid, null, 'it chases the player, not a loose kid');
  assert.ok(s.run(6, () => s.events.some((e) => e.type === 'grabCoat')), 'never caught up');
  assert.equal(s.coat.grabbedBy, g);
});

test('the guard grabs a loose kid and carries it off to Lost & Found; a slip makes him drop it', () => {
  const s = shop({ coatAt: [-12, 0, 6.5], only: (p) => p.type === 'guard' });
  const g = s.people.list[0];
  g.walker.yaw = Math.PI;
  s.coat.hit(10);                                          // a kid falls out
  assert.equal(s.coat.loose.length, 1);
  Object.assign(s.coat.loose[0], { x: -10, z: 5, heading: 1.6, free: 0 });     // (no head start here: M1-F7 tests that in caught.test)
  s.coat.walker.body.setTranslation({ x: -16, y: 1.2, z: 15 }, true);   // the coat runs off outside; the kid is left
  assert.ok(s.run(12, () => s.events.some((e) => e.type === 'grabKid')), `no grab (${g.state})`);
  const kid = g.carrying; assert.ok(kid);
  assert.ok(s.run(25, () => s.events.some((e) => e.type === 'lostAndFound')), `never got there (${g.state} ${g.feet.x.toFixed(1)}, ${g.feet.z.toFixed(1)})`);
  assert.ok(near({ feet: { x: kid.x, z: kid.z } }, ...SHOP.events.lostAndFound, 1.5), 'the kid waits in the staff room');
  // second go: slip while carrying
  const t = shop({ coatAt: [-12, 0, 6.5], only: (p) => p.type === 'guard' });
  const h = t.people.list[0]; h.walker.yaw = Math.PI; t.coat.hit(10);
  Object.assign(t.coat.loose[0], { x: -10, z: 5, heading: 1.6, free: 0 });
  t.coat.walker.body.setTranslation({ x: -16, y: 1.2, z: 15 }, true);
  assert.ok(t.run(12, () => !!h.carrying), 'grabbed');
  const f = h.feet;
  t.signals.emit({ type: 'slippery', position: { x: f.x, y: 0, z: f.z - 1.2 }, range: 1.5 });
  t.signals.emit({ type: 'slippery', position: { x: f.x - 1.2, y: 0, z: f.z }, range: 1.5 });
  t.signals.emit({ type: 'slippery', position: { x: f.x + 1.2, y: 0, z: f.z }, range: 1.5 });
  t.signals.emit({ type: 'slippery', position: { x: f.x, y: 0, z: f.z + 1.2 }, range: 1.5 });
  assert.ok(t.run(4, () => t.events.some((e) => e.type === 'dropKid')), `no drop (${h.state})`);
  assert.equal(h.carrying, null);
});
