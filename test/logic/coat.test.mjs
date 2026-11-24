// Logic tests for M0-04: the coat (height states, wobble, spills, loose kids, unstack and restack).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Signals } from '../../src/systems/signals.js';
import { Coat } from '../../src/entities/coat.js';

const B = JSON.parse(readFileSync(new URL('../../data/balance.json', import.meta.url)));
const R = await initPhysics();
const DT = 1 / 60;

function room() {
  const world = makeWorld(R, 18);
  const floor = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(R.ColliderDesc.cuboid(30, 0.1, 30).setTranslation(0, -0.1, 0), floor);
  const signals = new Signals();
  const coat = new Coat(R, world, signals, B, [0, 0, 0]);
  const run = (sec, move = { x: 0, z: 0 }, runKey = false, extra) => {
    for (let i = 0; i < Math.round(sec / DT); i++) { coat.step(DT, move, runKey, null); extra?.(); world.step(); coat.checkHits(world); signals.flush(DT); }
  };
  run(0.2);
  return { world, signals, coat, run };
}

test('speeds and heights come from balance.json for all three heights', () => {
  const { coat, run } = room();
  for (const n of [3, 2, 1]) {
    while (coat.count > n) coat.spill();
    assert.equal(coat.walker.speed, B.heights[n].speed);
    assert.ok(Math.abs(coat.walker.height - B.heights[n].height) < 1e-6);
    assert.equal(coat.disguise, B.heights[n].disguise);
  }
  const x0 = coat.position.x; run(1, { x: 1, z: 0 });
  assert.ok(coat.position.x - x0 > B.heights[1].speed * 0.8, 'one kid is fast');
});

test('a big hit spills the top kid, a small hit only wobbles', () => {
  const { coat } = room();
  coat.hit(2);
  assert.equal(coat.count, 3); assert.ok(coat.wobble > 0.2);
  coat.hit(8);
  assert.equal(coat.count, 2); assert.equal(coat.loose.length, 1); assert.equal(coat.loose[0].id, 'tank');
  assert.equal(coat.walker.speed, 4.8);
});

test('a melon flying into the coat knocks a kid out', () => {
  const { world, coat, run } = room();
  const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-3, 1.2, 0).setLinvel(12, 0, 0).setGravityScale(0));
  world.createCollider(R.ColliderDesc.ball(0.2).setMass(1.5), b);
  run(0.6);
  assert.equal(coat.count, 2);
});

test('running fills the wobble until a kid falls out; calm walking never does', () => {
  const a = room();
  a.run(8, { x: 0.6, z: 0.8 });
  assert.equal(a.coat.count, 3); assert.equal(a.coat.wobble, 0);
  const b = room(); let spilled = false;
  for (let i = 0; i < 20 && !spilled; i++) { b.run(0.5, { x: Math.sin(i * 1.7), z: Math.cos(i * 1.7) }, true); spilled = b.coat.count < 3; }
  assert.ok(spilled, 'running around wildly spills a kid');
});

test('loose kids run around for 10 seconds, then wait; walking over them stacks them back', () => {
  const { coat, run } = room();
  coat.hit(10);
  const k = coat.loose[0], x0 = k.x;
  run(3); assert.ok(!k.waiting && Math.hypot(k.x - x0, k.z) > 1, 'it runs around');
  run(7.5); assert.ok(k.waiting, 'after 10 seconds it waits');
  const kx = k.x, kz = k.z; run(0.5); assert.equal(k.x, kx);
  // walk to the kid
  for (let i = 0; i < 600 && coat.count < 3; i++) {
    const p = coat.position, d = Math.hypot(kx - p.x, kz - p.z) || 1;
    run(DT, { x: (kx - p.x) / d, z: (kz - p.z) / d });
  }
  assert.equal(coat.count, 3); assert.equal(coat.loose.length, 0); assert.equal(coat.walker.speed, 4.2);
});

test('slippery signal: low grip and the wobble fills while walking on it', () => {
  const { coat, signals, run } = room();
  signals.emit({ type: 'slippery', position: { x: 4, y: 0, z: 0 }, range: 2 });
  run(0.1); assert.equal(coat.patches.length, 1, 'the floor remembers the patch even 4 m away');
  assert.equal(coat.walker.grip, 1);
  for (let i = 0; i < 300 && coat.walker.grip === 1; i++) run(DT, { x: 1, z: 0 });
  assert.equal(coat.walker.grip, B.slippery.grip, 'walking onto it: low grip');
  run(0.5, { x: 0.3, z: 0 });
  assert.ok(coat.wobble > 0.15 || coat.count < 3, `wobble ${coat.wobble}`);
  assert.equal(coat.filling, 'slip', 'and the HUD says the slippery floor is filling the wobble bar');
});

test('R unstacks into a laundry pile and R at the pile restacks; too far does nothing', () => {
  const { coat, run } = room();
  assert.ok(coat.toggleStack());
  assert.equal(coat.count, 1); assert.ok(coat.pile); assert.deepEqual(coat.pile.kids, ['sid', 'mo']);
  assert.equal(coat.walker.speed, 6);
  run(1.5, { x: 1, z: 0 });
  assert.ok(!coat.toggleStack(), 'too far from the pile');
  run(1.5, { x: -1, z: 0 }); run(0.5);
  assert.ok(coat.toggleStack());
  assert.equal(coat.count, 3); assert.deepEqual(coat.stack, ['sid', 'mo', 'tank']); assert.equal(coat.pile, null);
});

test('the coat pushes a box along', () => {
  const { world, coat, run } = room();
  const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(1.2, 0.3, 0));
  world.createCollider(R.ColliderDesc.cuboid(0.3, 0.3, 0.3).setMass(2), b);
  run(2, { x: 1, z: 0 });
  assert.ok(b.translation().x > 2.5, `box moved to ${b.translation().x}`);
});
