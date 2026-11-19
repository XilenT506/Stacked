// Logic tests for M1-04: the "?" meters, Act Natural, hiding, disguises, busts, Heat, Closing Time.
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
import { ClosingTime } from '../../src/systems/closingTime.js';
import { Security } from '../../src/systems/security.js';
import { buildPlace, spawnThings } from '../../src/world/place.js';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
const DATA = J('data/interactables.json'), SHOP = J('data/places/supermarket.json'), GROWN = J('data/grownups.json');
const B = J('data/balance.json'), SIG = J('data/signals.json').types;
const R = await initPhysics();
const DT = 1 / 60;

function shop({ coatAt = [-5.8, 0, 7.5], only = (p) => p.type === 'cashier' && p.at[0] === -7.2, balance = B } = {}) {
  const world = makeWorld(R), signals = new Signals(SIG), mess = new Mess(signals, balance);
  const place = buildPlace(R, world, { ...SHOP, people: { list: SHOP.people.list.filter(only) } });
  const things = new Things(R, world, signals, DATA, { mess, spots: SHOP.events, balance });
  spawnThings(place, things);
  const people = new People(R, world, place, GROWN, { signals, mess, things: things.list });
  const coat = new Coat(R, world, signals, balance, coatAt, undefined, { mess });
  const sus = new Suspicion(balance), closing = new ClosingTime(R, world, place, balance, { nav: people.nav });
  const security = new Security({ people, closing, suspicion: sus, place, balance });
  const events = [];
  let dir = 1;
  // drive: 'run' or 'walk' up and down the till lane, or 'still'; natural = hold Q
  const run = (sec, { drive = 'still', natural = false } = {}, until) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      people.step(DT, [coat]);
      const z = coat.position.z; if (z > 9.4) dir = -1; if (z < 5.6) dir = 1;
      const move = drive === 'still' ? { x: 0, z: 0 } : { x: 0, z: dir };
      coat.step(DT, move, drive === 'run', null, natural);
      world.step(); things.step(DT); signals.flush(DT); mess.step(DT);
      sus.step(DT, people, [coat]); closing.step(DT); security.step();
      events.push(...people.take(), ...sus.take(), ...security.take());
      if (until?.()) return true;
    }
    return false;
  };
  return { world, signals, place, people, coat, sus, closing, security, events, run, cashier: people.list[0] };
}

test('running near a shopper fills the "?" meter, much faster than walking past', () => {
  const a = shop(); a.run(2, { drive: 'walk' });
  const walked = a.cashier.sus.get(a.coat) ?? 0;
  const b = shop(); b.run(2, { drive: 'run' });
  const ran = b.cashier.sus.get(b.coat) ?? 0;
  assert.ok(ran > 0.5, `running: ${ran.toFixed(2)}`);
  assert.ok(ran > walked * 4, `running ${ran.toFixed(2)} vs walking ${walked.toFixed(2)}`);
});

test('a full meter: THAT\'S NOT A GROWN-UP! The grown-up turns hostile and Heat goes up', () => {
  const s = shop();
  assert.ok(s.run(6, { drive: 'run' }, () => s.cashier.hostile.has(s.coat)), 'never busted');
  assert.ok(s.events.some((e) => e.type === 'bust'));
  assert.equal(s.sus.level, 1); assert.equal(s.sus.name, 'Twitchy');
});

test('Act Natural (hold Q) drains the meter; hiding drains it too', () => {
  const s = shop(); s.cashier.sus.set(s.coat, 0.7);
  s.run(2, { natural: true });
  assert.ok(s.cashier.sus.get(s.coat) < 0.1, `after acting natural: ${s.cashier.sus.get(s.coat).toFixed(2)}`);
  const h = shop(); h.cashier.sus.set(h.coat, 0.8);
  h.coat.hidden = { mode: 'inside', thing: { def: DATA.things.big_box } };
  h.run(2);
  const left = h.cashier.sus.get(h.coat);
  assert.ok(left < 0.8 - (B.suspicion.drainUnseen + DATA.things.big_box.hide.drainPerSecond) * 2 * 0.9, `after hiding: ${left.toFixed(2)}`);
});

test('a mop near staff slows suspicion; a short coat fills it faster', () => {
  const plain = shop(); plain.run(0.7, { drive: 'run' });
  const mop = shop(); mop.coat.disguiseProp = DATA.things.mop.disguise; mop.run(0.7, { drive: 'run' });
  const short = shop(); short.coat.spill(); short.coat.loose = []; short.run(0.7, { drive: 'run' });
  const v = (s) => s.cashier.sus.get(s.coat) ?? 0;
  assert.ok(v(mop) < v(plain) * 0.7, `mop ${v(mop).toFixed(2)} vs plain ${v(plain).toFixed(2)}`);
  assert.ok(v(short) > v(plain) * 1.3, `short ${v(short).toFixed(2)} vs tall ${v(plain).toFixed(2)}`);
});

test('a hostile guard chases a whole coat and yanks the top kid out', () => {
  const s = shop({ coatAt: [-12, 0, 5.5], only: (p) => p.type === 'guard' });
  const g = s.people.list[0]; g.walker.yaw = Math.PI;
  s.run(0.1); s.sus.bump(g, s.coat, 1);
  assert.ok(g.hostile.has(s.coat)); assert.equal(g.state, 'chase');
  assert.ok(s.run(6, {}, () => s.events.some((e) => e.type === 'grabKid')), `no grab (${g.state})`);
  assert.equal(s.coat.count, 2);
});

test('Heat 2 brings another guard; Heat 3 locks the front doors and brings the Caretaker, who hunts any coat', () => {
  const s = shop({ coatAt: [-7.5, 0, 2], only: () => false });
  const th = s.sus.H.thresholds;                                           // (the Heat road is tuned in data/balance.json)
  s.sus.addHeat(th[1]); assert.equal(s.sus.level, 2);
  assert.equal(s.people.byType('guard').length, 1, 'security arrives at Alert');
  s.sus.addHeat(th[2] - th[1]); assert.equal(s.sus.level, 3); assert.equal(s.sus.name, 'Panic');
  const ct = s.people.byType('caretaker');
  assert.equal(ct.length, 1, 'the Caretaker comes');
  assert.equal(s.people.byType('guard').length, 2);
  assert.ok(s.closing.closed.has('front'), 'the front doors are locked');
  // he hunts a full, well-behaved coat as soon as he sees it
  ct[0].walker.body.setTranslation({ x: -7.5, y: 0.9, z: -3 }, true); ct[0].walker.yaw = 0;
  assert.ok(s.run(2, {}, () => ct[0].state === 'chase'), `no hunt (${ct[0].state})`);
});

test('Closing Time shuts the sections in order towards the front doors, and the Caretaker comes', () => {
  const quick = { ...B, closingTime: { ...B.closingTime, startsAt: 1, sectionEvery: 1, warn: 0.5 } };
  const s = shop({ only: () => false, balance: quick });
  s.run(1.2);
  assert.ok(s.closing.started); assert.ok(s.events.some((e) => e.type === 'caretaker'));
  s.run(8);
  const order = s.events.filter((e) => e.type === 'shut').map((e) => e.section.id);
  assert.deepEqual(order, SHOP.closingTime.sections.map((x) => x.id));
  assert.ok(s.closing.isClosed('bakery') && s.closing.isClosed('staff'));
  // a shutter is solid: the back door is shut
  const w = s.coat.walker; w.body.setTranslation({ x: 6, y: 1.2, z: -16.5 }, true);
  for (let i = 0; i < 120; i++) { w.step(DT, { x: 0, z: -1 }, false, null); s.world.step(); }
  assert.ok(w.position.z > -18, `walked through the back door shutter to z ${w.position.z.toFixed(2)}`);
});
