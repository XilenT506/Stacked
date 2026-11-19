// Logic tests for M1-01: the supermarket layout (data/places/supermarket.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Signals } from '../../src/systems/signals.js';
import { Coat } from '../../src/entities/coat.js';
import { buildPlace, rectsOf } from '../../src/world/place.js';

const SHOP = JSON.parse(readFileSync(new URL('../../data/places/supermarket.json', import.meta.url)));
const B = JSON.parse(readFileSync(new URL('../../data/balance.json', import.meta.url)));
const R = await initPhysics();
const DT = 1 / 60;

test('the shop has every area the plan asks for, and the data is complete', () => {
  const ids = SHOP.areas.map((a) => a.id);
  for (const id of ['entrance', 'aisle1', 'aisle2', 'aisle3', 'aisle4', 'sweets', 'bakery', 'freezer', 'tills', 'staff', 'store', 'getaway']) assert.ok(ids.includes(id), id);
  assert.ok(SHOP.doors.some((d) => d.id === 'back'));
  assert.equal(SHOP.spawns.players.length, 4);
  assert.ok(SHOP.loot.list.length >= 10 && SHOP.loot.list.some((l) => l.kind === 'big'));
  assert.ok(SHOP.hiding.list.length >= 5);
  assert.ok(SHOP.map.building.length >= 4 && SHOP.map.grounds.length >= 4);
  // Closing Time: every area named exists, every section has shutters, and the last one is the front doors
  const secs = SHOP.closingTime.sections;
  for (const s of secs) { assert.ok(s.shutters.length > 0); for (const a of s.areas) assert.ok(ids.includes(a), a); }
  assert.equal(secs.at(-1).id, 'front');
});

test('spawn points, loot and hiding spots sit inside an area and not inside furniture', () => {
  const world = makeWorld(R, 18), place = buildPlace(R, world, SHOP);
  const solids = SHOP.solids.list;
  const inSolid = (x, z) => solids.some(([sx, sz, w, , d]) => Math.abs(x - sx) < w / 2 && Math.abs(z - sz) < d / 2);
  const pts = [...Object.entries(SHOP.spawns).filter(([k]) => !k.startsWith('_')).map(([, v]) => v).flat(), ...SHOP.hiding.list.map((h) => h.at), ...SHOP.loot.list.filter((l) => l.at[1] < 0.5).map((l) => [l.at[0], l.at[2]])];
  for (const [x, z] of pts) { assert.ok(place.areaAt(x, z), `${x},${z} is in no area`); assert.ok(!inSolid(x, z), `${x},${z} is inside furniture`); }
  assert.equal(place.areaAt(0.5, 0).id, 'sweets');
  assert.equal(place.areaAt(-14, 10).id, 'entrance');
  assert.equal(place.areaAt(16, 18.5).id, 'getaway');
});

test('you can walk the whole shop with the coat: every area, through every door, to the getaway gate', () => {
  const world = makeWorld(R, 18), place = buildPlace(R, world, SHOP), signals = new Signals();
  const coat = new Coat(R, world, signals, B, [-14.5, 0, 16]);
  coat.floorZones = place.slippery;
  const route = [[-14.5, 10.5], [-6, 10.5], [-6, 5], [-15.5, 4.5], [-15.5, -8], [-11.5, -8], [-11.5, 4.5], [-7.5, 4.5], [-7.5, -8], [-3.5, -8],
    [-3.5, 4.5], [0.5, 4.5], [0.5, -8], [4.5, -8], [4.5, 4.5], [9, 4], [13, 3.8], [16, 6], [14.2, 10.5], [16, 6], [13, -3.5], [9, -3.5], [9, -8], [4, -8], [4, -12], [4, -14.2],
    [-4, -14.25], [-9, -12.5], [-9, -8], [4, -8], [4, -14.2], [6, -14.2], [6, -19.5], [16, -19.5], [16, -14], [20, -14], [20, 14], [16, 18.5]];
  const seen = new Set();
  let t = 0;
  for (const [wx, wz] of route) {
    let left = 15;                                     // seconds allowed per leg
    for (;;) {
      const p = coat.position, dx = wx - p.x, dz = wz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.5) break;
      assert.ok((left -= DT) > 0, `stuck on the way to ${wx},${wz} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
      const k = Math.min(1, d);
      coat.step(DT, { x: dx / d * k, z: dz / d * k }, false, null); world.step(); signals.flush(DT); t += DT;
      // gather any kid that slipped out on the ice, like a player would
      for (const kid of coat.loose) { kid.x = p.x; kid.z = p.z; }
      const a = place.areaAt(p.x, p.z); if (a) seen.add(a.id);
    }
  }
  const all = SHOP.areas.map((a) => a.id);
  assert.deepEqual(all.filter((id) => !seen.has(id)), [], 'areas never visited');
  console.log('tour', t.toFixed(1), 's, areas', seen.size);
  assert.ok(t < 300, `the tour took ${t.toFixed(0)} s`);
});

test('the freezer aisle is icy', () => {
  const world = makeWorld(R, 18), place = buildPlace(R, world, SHOP);
  const coat = new Coat(R, world, null, B, [4.5, 0, -4]); coat.floorZones = place.slippery;
  coat.step(DT, { x: 0, z: 1 }, false, null);
  assert.equal(coat.walker.grip, B.slippery.grip);
  const r = rectsOf(SHOP.areas.find((a) => a.id === 'freezer'))[0];
  for (const z of place.slippery) assert.ok(z[0] >= r[0] && z[2] <= r[2]);
});
