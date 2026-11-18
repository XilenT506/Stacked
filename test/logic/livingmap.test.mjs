// Logic tests for M1-02: the living supermarket (things, signals, chains, timed events, the mess, hands).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Signals } from '../../src/systems/signals.js';
import { Things } from '../../src/world/interact/loader.js';
import { Mess } from '../../src/systems/mess.js';
import { JobEvents } from '../../src/systems/jobEvents.js';
import { Hands } from '../../src/systems/hands.js';
import { Coat } from '../../src/entities/coat.js';
import { buildPlace, spawnThings } from '../../src/world/place.js';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
const DATA = J('data/interactables.json'), SOUNDS = J('data/sounds.json').sounds, SHOP = J('data/places/supermarket.json');
const EVENTS = J('data/places/supermarket/events.json').events, B = J('data/balance.json'), SIG = J('data/signals.json').types;
const R = await initPhysics();
const DT = 1 / 60;

function shop({ coatAt = null } = {}) {
  const world = makeWorld(R), signals = new Signals(SIG), mess = new Mess(signals, B);
  const place = buildPlace(R, world, SHOP);
  const things = new Things(R, world, signals, DATA, { mess, spots: SHOP.events, balance: B });
  spawnThings(place, things);
  const coat = coatAt ? new Coat(R, world, signals, B, coatAt, undefined, { mess }) : null;
  const hands = coat ? new Hands(coat, things, B) : null;
  const log = [];
  signals.onDeliver = (s) => log.push({ t: signals.time, type: s.type, from: s.source?.name, event: s.data?.event, data: s.data });
  const run = (sec, input = {}, move = { x: 0, z: 0 }) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      if (hands) { hands.step(DT, i === 0 ? input : { ...input, grab: false, throwIt: false }); coat.step(DT, move, false, null, !!input.natural); hands.carry(); }
      world.step(); things.step(DT); signals.flush(DT); mess.step(DT);
    }
  };
  run(1);                       // let everything settle
  log.length = 0;
  return { world, signals, mess, place, things, coat, hands, log, run };
}

test('every thing has a kind, a placeholder sound, a funny use, a useful use and a grown-up reaction', () => {
  for (const [name, d] of Object.entries(DATA.things)) {
    assert.ok(SOUNDS[d.sound], `${name}: sound "${d.sound}" is not in data/sounds.json`);
    for (const k of ['funny', 'useful', 'reaction', 'name']) assert.ok(d[k]?.length > 2, `${name} has no ${k}`);
  }
});

test('the supermarket has at least 16 kinds of interactive thing, all six kinds, everything the plan lists', () => {
  const { things } = shop();
  const names = new Set([...things.list.map((t) => t.name), ...things.groups.map((g) => g.name)]);
  for (const n of ['tin_pyramid', 'trolley', 'vending_machine', 'tannoy', 'light_switch', 'freezer_door', 'conveyor', 'wet_floor_sign', 'mannequin', 'big_box', 'mop', 'clipboard', 'cream_cake', 'ketchup', 'melon']) assert.ok(names.has(n), n);
  assert.ok(names.size >= 16, `only ${names.size}`);
  assert.deepEqual([...new Set(things.list.map((t) => t.kind))].sort(), ['disguise', 'food', 'hide', 'machine', 'prop', 'ride']);
});

test('one kick starts a chain on its own: cans roll out, ketchup splats, a can slips, the tin pyramid crashes', () => {
  const { things, log, run, mess } = shop();
  assert.equal(things.use(things.list.find((t) => t.name === 'vending_machine')), 'kicked');
  run(8);
  const at = (from, ev) => log.find((l) => l.from === from && l.event === ev)?.t;
  const kicked = at('vending_machine', 'kicked'), splat = at('ketchup', 'splat'), slip = at('can', 'slip'), crash = at('tin_pyramid', 'pyramid crash');
  assert.ok(kicked !== undefined && splat > kicked && slip >= splat && crash > slip, JSON.stringify({ kicked, splat, slip, crash }));
  assert.ok(mess.patches.some((p) => p.slippery && p.color === DATA.things.ketchup.splat), 'the ketchup left a slippery puddle');
});

test('the mess stays for the rest of the job', () => {
  const { signals, mess, run } = shop();
  signals.emit({ type: 'slippery', position: { x: 0.5, y: 0, z: 0 }, range: 1, data: { color: '#c4231d' } });
  run(0.1); assert.equal(mess.patches.length, 1);
  mess.step(600); assert.ok(mess.slipperyAt(0.5, 0), 'still slippery ten minutes later');
});

test('timed events: free samples at the bakery and clean-up on aisle 4', () => {
  const s = shop(), said = [], far = [];
  s.signals.listen({ position: { x: -15, y: 0, z: 10 }, types: ['food'], hear: (sig) => far.push(sig) });
  const ev = new JobEvents(EVENTS, { signals: s.signals, things: s.things, spots: SHOP.events, say: (t) => said.push(t) }, B.events);
  const cakes = () => s.things.list.filter((t) => t.name === 'cream_cake' && !t.gone).length, before = cakes();
  for (let i = 0; i < Math.round((B.events.firstAt + 1) / DT); i++) { ev.step(DT); s.signals.flush(DT); }
  assert.equal(ev.fired[0]?.id, 'freeSamples');
  assert.equal(cakes(), before + 3);
  assert.ok(far.length >= 1, 'the whole shop hears about the free samples');
  ev.fire('cleanUp'); s.run(0.2);
  assert.ok(s.mess.slipperyAt(-3.5, -3.2), 'aisle 4 is wet');
  assert.equal(s.things.list.filter((t) => t.name === 'wet_floor_sign').length, 4);
  assert.equal(said.length, 2);
});

test('freezer doors fog up and ice the floor, again and again while open', () => {
  const { things, mess, run } = shop();
  const door = things.list.find((t) => t.name === 'freezer_door');
  assert.equal(things.use(door), 'on'); run(0.2);
  const p = door.position;
  assert.ok(mess.slipperyAt(p.x - 0.9, p.z), 'ice in front of the open door');
  const n = mess.patches.length; run(DATA.things.freezer_door.use.whileOn.every + 0.5);
  assert.ok(mess.patches.some((q) => q.time > 1), 'it keeps icing');
  assert.ok(mess.patches.length >= n);
});

test('the tannoy sends the announcement where it says: the crowd at the far end hears "free cake"', () => {
  const { things, signals, run } = shop(), heard = [];
  signals.listen({ position: { x: 13, y: 0, z: -3 }, types: ['food'], hear: (s) => heard.push(s.data.text) });
  things.use(things.list.find((t) => t.name === 'tannoy')); run(0.1);
  assert.match(heard[0] || '', /cake/i);
});

test('the coat rides a trolley, lets go and the trolley rolls on', () => {
  const s = shop({ coatAt: [-9, 0, 14] });
  s.coat.walker.yaw = 0;
  s.run(0.2, { grab: true });
  assert.ok(s.hands.riding?.name === 'trolley');
  s.run(1.0, {}, { x: -1, z: 0 });
  assert.ok(s.coat.walker.flatSpeed > 4.5, `riding is fast (${s.coat.walker.flatSpeed.toFixed(1)} m/s)`);
  const t = s.hands.riding; s.run(0.05, { grab: true });
  assert.equal(s.hands.riding, null);
  const x0 = t.position.x; s.run(0.5);
  assert.ok(x0 - t.position.x > 0.5, `it keeps rolling (${(x0 - t.position.x).toFixed(2)} m)`);
});

test('pick up a cake and throw it: splat and a slippery patch where it lands', () => {
  const s = shop({ coatAt: [11.5, 0, -3.8] });
  s.run(0.1, { grab: true });
  assert.equal(s.hands.held?.name, 'cream_cake');
  s.run(0.1, { throwIt: true, aim: { x: 0, z: 1 } });
  s.run(2);
  assert.ok(s.log.some((l) => l.from === 'cream_cake' && l.event === 'splat'));
  assert.ok(s.mess.patches.some((p) => p.color === DATA.things.cream_cake.splat));
});

test('hiding: strike a pose by the mannequins, climb into a big box, ride the till belt', () => {
  const s = shop({ coatAt: [16, 0, 2] });
  s.run(0.2, { natural: true });
  assert.equal(s.coat.hidden?.mode, 'pose');
  s.run(0.2); assert.equal(s.coat.hidden, null);
  const b = shop({ coatAt: [10, 0, -14.4] });
  b.run(0.1, { grab: true }); assert.equal(b.coat.hidden?.mode, 'inside');
  b.run(0.1, { grab: true }); assert.equal(b.coat.hidden, null);
  const belt = shop({ coatAt: [-7.1, 0, 6.5] });
  belt.run(0.1, { grab: true }); assert.ok(belt.hands.belt, 'on the belt');
  belt.run(4);
  assert.equal(belt.hands.belt, null, 'carried off the end');
  assert.ok(belt.coat.position.z > 9, `ended at z ${belt.coat.position.z.toFixed(2)}`);
});
