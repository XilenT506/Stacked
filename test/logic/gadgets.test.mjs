// Logic tests for M1-05: gadgets (water pistol, slingshot, banana peel) on grown-ups, friends and things.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Signals } from '../../src/systems/signals.js';
import { Things } from '../../src/world/interact/loader.js';
import { Mess } from '../../src/systems/mess.js';
import { Coat } from '../../src/entities/coat.js';
import { People } from '../../src/ai/people.js';
import { Suspicion } from '../../src/systems/suspicion.js';
import { Gadgets } from '../../src/systems/gadgets.js';
import { buildPlace, spawnThings } from '../../src/world/place.js';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
const DATA = J('data/interactables.json'), SHOP = J('data/places/supermarket.json'), GROWN = J('data/grownups.json');
const GADGETS = J('data/gadgets.json'), B = J('data/balance.json'), SIG = J('data/signals.json').types;
const R = await initPhysics();
const DT = 1 / 60;
const EAST = { x: 1, z: 0 };

// the back walkway: a coat at the west end, grown-ups placed as asked (people), friends (friends: positions)
function setup({ people = [], friends = [], gadgets = GADGETS, coatAt = [-16, 0, -8] } = {}) {
  const world = makeWorld(R), signals = new Signals(SIG), mess = new Mess(signals, B);
  const place = buildPlace(R, world, { ...SHOP, people: { list: people } });
  const things = new Things(R, world, signals, DATA, { mess, spots: SHOP.events, balance: B });
  spawnThings(place, things);
  const ppl = new People(R, world, place, GROWN, { signals, mess, things: things.list });
  const sus = new Suspicion(B);
  const coat = new Coat(R, world, signals, B, coatAt, undefined, { mess });
  const others = friends.map((p) => new Coat(R, world, signals, B, p, ['pip', 'mo', 'sid'], { mess }));
  const coats = [coat, ...others];
  const gad = new Gadgets(gadgets, { R, world, signals, things, people: ppl, sus });
  gad.arm(coat);
  const events = [], log = [];
  signals.onDeliver = (s) => log.push(s);
  // hold: { fire, select, aim } for this many seconds; moves: per coat {x,z}
  const run = (sec, hold = {}, moves = [], until) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      ppl.step(DT, coats);
      gad.use(coat, DT, { aim: EAST, ...hold });
      coats.forEach((c, k) => c.step(DT, moves[k] || { x: 0, z: 0 }, false, null));
      world.step(); things.step(DT); signals.flush(DT); mess.step(DT);
      gad.step(DT, coats); sus.step(DT, ppl, coats);
      events.push(...gad.take(), ...ppl.take());
      if (until?.()) return true;
    }
    return false;
  };
  return { world, signals, mess, things, people: ppl, coat, others, gad, events, log, run, sus };
}
const hits = (s, target) => s.events.filter((e) => e.type === 'hit' && e.target === target);

test('every gadget in the data has a mode, ammo, a sound, a funny use and a useful use; effects are known', () => {
  for (const [id, d] of Object.entries(GADGETS.gadgets)) {
    assert.ok(['projectile', 'thrown', 'place'].includes(d.mode), id);
    assert.ok(d.ammo > 0 && d.sound && d.funny && d.useful, id);
    for (const k of ['onHit', 'onLand', 'onTrigger']) if (d[k]?.effect) assert.ok(GADGETS.effects[d[k].effect], `${id} ${k}`);
  }
});

test('water pistol: soaks a grown-up (noise where it hits), who then slips on the next sharp turn', () => {
  const s = setup({ people: [{ type: 'shopper', at: [-11, -8], face: [-1, 0] }] });
  const g = s.people.list[0]; g.set('idle'); g.type = { ...g.type, stays: true };
  s.run(0.5, { fire: true, select: 0 });
  assert.ok(hits(s, 'grownup').length > 0, 'no hit');
  assert.ok(g.effects.soaked > 0, 'not soaked');
  assert.ok(s.log.some((x) => x.type === 'noise' && x.data?.gadget === 'water_pistol'));
  // send him round the corner into aisle 3
  g.type = { ...g.type, stays: false }; g.go('investigate', { x: -7.5, z: 1 }, 2.4, 3);
  assert.ok(s.run(8, {}, [], () => g.state === 'slipped'), `no slip (${g.state} at ${g.feet.x.toFixed(1)}, ${g.feet.z.toFixed(1)})`);
});

test('slingshot: a full charge blinds a grown-up; a quick flick only knocks', () => {
  const s = setup({ people: [{ type: 'cashier', at: [-11, -8], face: [-1, 0] }] });
  const g = s.people.list[0];
  s.run(1.1, { fire: true, select: 1 }); s.run(0.6, { fire: false, select: 1 });
  assert.ok(hits(s, 'grownup').some((h) => h.effect === 'blinded'), 'no blinding hit');
  assert.equal(g.state, 'blinded'); assert.ok(!g.sees(s.coat.walker.feet), 'a blinded grown-up sees nothing');
  const q = setup({ people: [{ type: 'cashier', at: [-11, -8], face: [-1, 0] }] });
  q.run(0.25, { fire: true, select: 1 }); q.run(0.8, { fire: false, select: 1 });
  const h = hits(q, 'grownup'); assert.ok(h.length && !h[0].effect, 'a flick hits without blinding');
});

test('banana peel: a slippery patch where it lies; the grown-up who steps on it goes flat', () => {
  const s = setup({ people: [{ type: 'shopper', at: [-11, -8], face: [-1, 0] }] });
  const g = s.people.list[0]; g.set('idle'); g.type = { ...g.type, stays: true };
  s.run(0.05, { fire: true, select: 2 }); s.run(0.6, { fire: false });
  const b = s.gad.items[0]; assert.ok(b, 'no banana');
  assert.ok(s.mess.slipperyAt(b.x, b.z), 'a banana is slippery');
  s.coat.walker.body.setTranslation({ x: -16, y: 1.2, z: -6.5 }, true);       // step out of the way
  g.type = { ...g.type, stays: false }; g.go('investigate', { x: b.x - 2, z: b.z }, 2, 3);
  assert.ok(s.run(8, {}, [], () => s.events.some((e) => e.type === 'trigger' && e.target === 'grownup')), 'never stepped on it');
  assert.equal(g.state, 'slipped');
  assert.equal(s.gad.items.length, 0, 'a peel works once');
});

test('friendly fire: water and the slingshot hit a friend; a friend steps on your banana', () => {
  const s = setup({ friends: [[-12, 0, -8]] });
  const f = s.others[0];
  s.run(0.4, { fire: true, select: 0 });
  assert.ok(hits(s, 'coat').length > 0 && f.effects.soaked > 0, 'friend not soaked');
  s.run(1.1, { fire: true, select: 1 }); s.run(0.6, { fire: false, select: 1 });
  assert.ok(f.effects.blinded > 0 || f.wobble > 0.3, 'slingshot did nothing to the friend');
  const t = setup({ friends: [[-13.5, 0, -8]] });
  t.run(0.05, { fire: true, select: 2 }); t.run(0.8, { fire: false });
  const w0 = t.others[0].wobble;
  assert.ok(t.run(3, {}, [{ x: 0, z: 0 }, { x: -1, z: 0 }], () => t.events.some((e) => e.type === 'trigger' && e.target === 'coat')), 'friend never slipped');
  assert.ok(t.others[0].wobble > w0 + 0.4 && t.others[0].stunned > 0, 'slipping fills the wobble and stops you');
});

test('gadgets work on things: the slingshot knocks the tin pyramid down and flips the light switch from afar', () => {
  const s = setup({ coatAt: [-3.5, 0, 4.2] });
  const at = { x: 0.06, z: -1 };          // (dead centre would thread the gap between two tins)
  s.run(1.1, { fire: true, select: 1, aim: at }); s.run(1.5, { fire: false, select: 1, aim: at });
  assert.ok(hits(s, 'thing').length > 0, 'missed');
  assert.ok(s.log.some((x) => x.data?.event === 'pyramid crash'), 'the pyramid came down');
  const l = setup({ coatAt: [-11.5, 0, -8.6] });
  const sw = l.things.list.find((t) => t.name === 'light_switch');
  l.coat.walker.yaw = Math.PI;
  const aim = { x: 0, z: -1 };
  // aim up at the switch: shoot from close, it flies flat
  l.run(1.1, { fire: true, select: 1, aim }); l.run(0.5, { fire: false, select: 1, aim });
  assert.equal(sw.state, 'off', 'the lights went out');
});

test('a fourth gadget needs only JSON: a water balloon thrown in an arc soaks everyone where it lands', () => {
  const extra = structuredClone(GADGETS);
  extra.gadgets.water_balloon = { name: 'Water balloon', family: 'Splash', mode: 'thrown', ammo: 3, cooldown: 0.5,
    projectile: { speed: 7, gravity: 9.8, lift: 3, radius: 0.12, life: 3, color: '#7fc8ff', height: 1.4 },
    onHit: { effect: 'soaked', signals: [{ type: 'noise', range: 6 }] },
    onLand: { radius: 1.8, effect: 'soaked', signals: [{ type: 'slippery', range: 1.5, color: '#cde9ff' }] },
    sound: 'squirt', funny: 'Splosh.', useful: 'Soaks a whole queue.' };
  extra.loadout.slots = ['water_balloon'];
  const s = setup({ gadgets: extra, people: [{ type: 'cashier', at: [-11.4, -8], face: [-1, 0] }, { type: 'cashier', at: [-11.4, -9.2], face: [-1, 0] }] });
  s.run(0.05, { fire: true }); s.run(2, { fire: false });
  assert.ok(s.people.list.every((g) => g.effects.soaked > 0), 'both soaked');
  assert.ok(s.mess.patches.some((p) => p.color === '#cde9ff'), 'a puddle where it landed');
});
