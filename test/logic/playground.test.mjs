// Logic tests for M0-02: signals, the interactive-things loader, and the physics playground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Signals, SIGNAL_TYPES } from '../../src/systems/signals.js';
import { Things } from '../../src/world/interact/loader.js';
import { buildPlayground } from '../../src/world/playground.js';

const json = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
const DATA = json('data/interactables.json'), SIG = json('data/signals.json').types;
const STEP = 1 / 60;

async function setup() {
  const R = await initPhysics(), world = makeWorld(R), signals = new Signals(SIG);
  const things = new Things(R, world, signals, DATA);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { world.step(); things.step(STEP); signals.flush(STEP); } };
  return { R, world, signals, things, step };
}

test('a signal reaches listeners in range and not out of range', () => {
  const s = new Signals(SIG), near = [], far = [];
  s.listen({ position: { x: 4, y: 0, z: 0 }, hear: (sig, d) => near.push([sig.type, d]) });
  s.listen({ position: { x: 25, y: 0, z: 0 }, hear: (sig) => far.push(sig.type) });
  s.emit({ type: 'crash', position: { x: 0, y: 0, z: 0 } });          // crash range is 10 m
  assert.equal(s.flush(), 1);
  assert.deepEqual(near.map((n) => n[0]), ['crash']);
  assert.equal(far.length, 0);
});

test('listeners can pick signal types, and unknown types are refused', () => {
  const s = new Signals(SIG), got = [];
  s.listen({ position: { x: 0, z: 0 }, types: ['smell'], hear: (sig) => got.push(sig.type) });
  s.emit({ type: 'noise', position: { x: 0, z: 0 } });
  s.emit({ type: 'smell', position: { x: 1, z: 0 } });
  s.flush();
  assert.deepEqual(got, ['smell']);
  assert.throws(() => s.emit({ type: 'burp', position: { x: 0, z: 0 } }));
  assert.equal(SIGNAL_TYPES.length, 8);
});

test('every kind in the data file builds, and all six kinds are used', async () => {
  const { things } = await setup();
  for (const name of Object.keys(DATA.things)) things.spawn(name, [0, 2, 0]);
  const kinds = new Set(things.list.map((t) => t.kind));
  assert.deepEqual([...kinds].sort(), ['disguise', 'food', 'hide', 'machine', 'prop', 'ride']);
});

test('a dropped tin sends crash and noise that reach a listener in range and not one out of range', async () => {
  const { R, world, signals, things, step } = await setup();
  world.createCollider(R.ColliderDesc.cuboid(10, 0.1, 10).setTranslation(0, -0.1, 0));
  things.spawn('tin', [0, 2, 0], { onFloor: false });
  const near = [], far = [];
  signals.listen({ position: { x: 5, y: 0, z: 0 }, hear: (sig) => near.push(sig.type) });
  signals.listen({ position: { x: 15, y: 0, z: 0 }, hear: (sig) => far.push(sig.type) });
  step(120);
  assert.ok(near.includes('crash') && near.includes('noise'), `near heard ${near}`);
  assert.ok(!far.includes('crash'), `far heard ${far}`);                 // 15 m is beyond the 10 m crash range
});

test('a dropped box comes to rest and stops making noise', async () => {
  const { R, world, signals, things, step } = await setup();
  world.createCollider(R.ColliderDesc.cuboid(10, 0.1, 10).setTranslation(0, -0.1, 0));
  const box = things.spawn('box', [0, 3, 0], { onFloor: false });
  step(60 * 5);
  const before = signals.log.length;
  step(60);
  assert.ok(Math.abs(box.position.y - 0.225) < 0.03, `box rests at y=${box.position.y.toFixed(3)}`);
  assert.equal(signals.log.length, before, 'a resting box sends nothing');
});

test('playground: the trolley rolls down the ramp and topples the tin pyramid', async () => {
  const { R, world, signals, things, step } = await setup();
  const pg = buildPlayground(R, world, things);
  const start = pg.trolley.position, tinsStart = pg.tins.map((t) => ({ ...t.position }));
  step(60 * 2);
  assert.equal(signals.log.filter((s) => s.type === 'crash' && s.source?.name === 'tin').length, 0, 'tins stand still before the trolley arrives');
  step(60 * 6);
  const end = pg.trolley.position;
  assert.ok(end.x > start.x + 4, `trolley rolled from x=${start.x.toFixed(1)} to x=${end.x.toFixed(1)}`);
  assert.ok(end.y < 0.2, `trolley is down on the floor (y=${end.y.toFixed(2)})`);
  const moved = pg.tins.filter((t, i) => Math.hypot(t.position.x - tinsStart[i].x, t.position.y - tinsStart[i].y, t.position.z - tinsStart[i].z) > 0.15).length;
  assert.ok(moved >= 6, `${moved} of 10 tins knocked over`);
  assert.ok(signals.log.some((s) => s.type === 'crash' && s.source?.name === 'tin'), 'the tins crashed');
});

test('a machine sends a signal when used', async () => {
  const { signals, things } = await setup();
  const sw = things.spawn('light_switch', [0, 1, 0], { onFloor: false }), got = [];
  signals.listen({ position: { x: 1, z: 0 }, hear: (s) => got.push(s.type) });
  assert.equal(things.use(sw), 'off');
  signals.flush();
  assert.deepEqual(got, ['dark']);
});
