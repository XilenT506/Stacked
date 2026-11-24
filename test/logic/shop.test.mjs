// Logic tests for M1-10: Dodgy Del's mini shop between jobs. The sweet jar fills from a job's result; the
// stall has 4 gadgets and the 2 drinks at balance.json prices; buying, being too poor, the reroll getting
// dearer, Next for everyone; what you bought works in the next job (a new gadget, Sugar Rush, Burp
// Blaster); everyone caught starts a new run; and the shop works online.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Mirror } from '../../src/net/snapshot.js';
import { HostSession, ClientSession } from '../../src/net/session.js';
import { MemoryHub, MemoryLink } from '../../src/net/links.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const DT = 1 / 60;
const idle = (extra = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...extra });
const put = (coat, x, z) => coat.walker.body.setTranslation({ x, y: coat.walker.body.translation().y, z }, true);
const P = DATA.balance.shop.prices;

// the results card waits for a key (M1-F11): someone presses one after it has been up a moment
const pressOn = (g) => { for (const p of g.players) g.setInput(p.id, idle({ presses: { grab: 99 } })); g.step(); };
// end a job with some sweets banked, look at the results, press a key
function toShop(g, sweets) {
  g.loot.items[0].state = 'banked'; g.loot.banked.push(g.loot.items[0]); g.finish('got away');
  g.run.sweets = sweets;
  for (let i = 0; i < 60 * (DATA.balance.shop.resultsSeconds + 0.5); i++) g.step();
  pressOn(g);
}
const order = (g, id, list) => { g.setInput(id, idle({ shop: list })); g.step(); };

test('after the results, Del opens: 4 different gadgets and the 2 drinks, at balance.json prices', () => {
  const g = new Game(R, DATA); g.addPlayer('p1');
  g.loot.items[0].state = 'banked'; g.loot.banked.push(g.loot.items[0]); g.finish('got away');
  assert.equal(g.run.sweets, g.job.result.total, 'the job\'s sweets go in the jar');
  for (let i = 0; i < 60 * (DATA.balance.shop.resultsSeconds + 5); i++) g.step();
  assert.equal(g.phase, 'job', 'results first, and they wait for a key (M1-F11)');
  pressOn(g);
  assert.equal(g.phase, 'shop');
  const st = g.shop.stock;
  assert.equal(st.length, 6);
  assert.equal(new Set(st.filter((s) => s.kind === 'gadget').map((s) => s.id)).size, 4, '4 different gadgets');
  assert.deepEqual(st.filter((s) => s.kind === 'drink').map((s) => s.id), ['sugar_rush', 'burp_blaster']);
  for (const s of st) { assert.equal(g.shop.price(s.id), P[s.id]); assert.ok(DATA.gadgets.gadgets[s.id] || DATA.shop.drinks[s.id], `${s.id} is a real thing`); }
  // change a price in the data: the shop follows
  const D2 = { ...DATA, balance: { ...DATA.balance, shop: { ...DATA.balance.shop, prices: { ...P, sugar_rush: 999 } } } };
  const g2 = new Game(R, D2); g2.addPlayer('p1'); g2.finish('test'); g2.openShop();
  assert.equal(g2.shop.price('sugar_rush'), 999);
});

test('buying: sweets go down by the price, too poor is refused, reroll gets dearer, Next starts the next job', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); toShop(g, 200);
  g.shop.stock[0] = { id: 'water_balloon', kind: 'gadget', left: 1 };
  order(g, 'p1', [{ sid: 1, a: 'buy', i: 0 }, { sid: 2, a: 'buy', i: 4 }, { sid: 3, a: 'buy', i: 5 }]);
  order(g, 'p1', [{ sid: 1, a: 'buy', i: 0 }, { sid: 2, a: 'buy', i: 4 }, { sid: 3, a: 'buy', i: 5 }]);   // the same packet again
  assert.equal(g.run.sweets, 200 - P.water_balloon - P.sugar_rush - P.burp_blaster, 'each bought once');
  const kit = g.run.of('p1');
  assert.ok(kit.gadgets.some((x) => x.id === 'water_balloon'));
  assert.deepEqual(kit.drinks, ['sugar_rush', 'burp_blaster']);
  assert.equal(g.shop.stock[0].left, 0, 'sold out');
  // reroll: 15, then 25
  const before = g.run.sweets, gadgetsBefore = g.shop.stock.slice(0, 4).map((s) => s.id).join();
  order(g, 'p1', [{ sid: 4, a: 'reroll' }]); order(g, 'p1', [{ sid: 5, a: 'reroll' }]);
  assert.equal(g.run.sweets, before - 15 - 25);
  assert.equal(g.shop.rerollPrice, 35);
  assert.ok(g.shop.stock.slice(0, 4).every((s) => s.left === 1), 'fresh gadgets');
  assert.equal(g.shop.stock[4].left, DATA.balance.shop.stock.drinksEach - 1, 'the drinks stay as they were');
  // too poor
  g.run.sweets = 10;
  order(g, 'p1', [{ sid: 6, a: 'buy', i: 1 }]);
  assert.equal(g.run.sweets, 10); assert.match(g.shop.say, /sweets|richer/i);
  assert.ok(gadgetsBefore.length > 0);
  // Next
  const job = g.jobNo;
  order(g, 'p1', [{ sid: 7, a: 'ready' }]);
  assert.equal(g.phase, 'job'); assert.equal(g.jobNo, job + 1, 'the next job starts when everyone pressed Next');
});

test('what you bought works in the next job: the water balloon, Sugar Rush, Burp Blaster', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); toShop(g, 300);
  g.shop.stock[0] = { id: 'water_balloon', kind: 'gadget', left: 1 };
  order(g, 'p1', [{ sid: 1, a: 'buy', i: 0 }, { sid: 2, a: 'buy', i: 4 }, { sid: 3, a: 'buy', i: 5 }, { sid: 4, a: 'ready' }]);
  assert.equal(g.phase, 'job');
  const p = g.players[0], c = p.coat;
  assert.deepEqual(c.gadgets.slots, [...DATA.gadgets.loadout.slots, 'water_balloon']);
  assert.equal(c.gadgets.ammo.water_balloon, DATA.gadgets.gadgets.water_balloon.ammo);
  assert.deepEqual(c.drinks, ['sugar_rush', 'burp_blaster']);
  for (let i = 0; i < 10; i++) { g.setInput('p1', idle({ shop: [] })); g.step(); }   // the shop presses are used up, nothing fires
  assert.equal(c.gadgets.ammo.water_balloon, DATA.gadgets.gadgets.water_balloon.ammo);
  // the water balloon soaks a grown-up where it lands
  const cashier = g.people.list.find((q) => q.typeName === 'cashier');
  put(c, cashier.feet.x, cashier.feet.z + 4); for (let i = 0; i < 5; i++) g.step();
  const aim = { x: (cashier.feet.x - c.walker.feet.x) / 4, z: (cashier.feet.z - c.walker.feet.z) / 4 };
  let n = 0; const press = (name) => { n++; return { [name]: n }; };
  g.setInput('p1', idle({ aim, presses: press('slot4') })); g.step();
  for (let i = 0; i < 20; i++) { g.setInput('p1', idle({ aim, use: true, presses: { slot4: 1 } })); g.step(); }
  for (let i = 0; i < 90; i++) { g.setInput('p1', idle({ aim, presses: { slot4: 1 } })); g.step(); }
  assert.equal(c.gadgets.ammo.water_balloon, DATA.gadgets.gadgets.water_balloon.ammo - 1, 'one balloon thrown');
  assert.ok(g.people.list.some((q) => (q.effects?.soaked ?? 0) > 0), 'somebody got soaked');
  // Sugar Rush: faster for a while
  const walk = (frames, drinkIt) => {
    put(c, -14, 13); for (let i = 0; i < 5; i++) g.step();
    const a = { ...c.walker.feet };
    for (let i = 0; i < frames; i++) { g.setInput('p1', idle({ move: { x: 1, z: 0 }, presses: { slot4: 1, drink: drinkIt ? 1 : 0 } })); g.step(); }
    return c.walker.feet.x - a.x;
  };
  const plain = walk(60, false), sugary = walk(60, true);
  assert.ok(c.sugar > 0, 'sugar rush on');
  assert.ok(sugary > plain * 1.3, `faster on a Sugar Rush (${sugary.toFixed(2)} m vs ${plain.toFixed(2)} m)`);
  assert.deepEqual(c.drinks, ['burp_blaster']);
  assert.deepEqual(g.run.of('p1').drinks, ['burp_blaster'], 'a drink you drank is gone for good');
  // Burp Blaster: the grown-up next to you goes over
  const gr = g.people.list.find((q) => q.typeName === 'granny');
  put(c, gr.feet.x + 1.2, gr.feet.z); for (let i = 0; i < 3; i++) { g.setInput('p1', idle({ presses: { slot4: 1, drink: 1 } })); g.step(); }
  g.setInput('p1', idle({ presses: { slot4: 1, drink: 2 } })); g.step();
  assert.deepEqual(c.drinks, []);
  assert.ok(['slipped', 'stunned'].includes(gr.state) || (gr.effects?.slipped ?? 0) > 0, `granny is knocked over (${gr.state})`);
});

test('everyone caught ends the run: an empty jar and the starter gadgets again', () => {
  const g = new Game(R, DATA); g.addPlayer('p1');
  g.run.sweets = 500; g.run.of('p1').gadgets.push({ id: 'stink_bomb', copies: 1 });
  g.finish('all caught');
  for (let i = 0; i < 60 * (DATA.balance.shop.resultsSeconds + 0.5); i++) g.step();
  pressOn(g);
  assert.equal(g.phase, 'job', 'no shop: straight into a new run');
  assert.equal(g.run.sweets, 0);
  assert.deepEqual(g.players[0].coat.gadgets.slots, DATA.gadgets.loadout.slots);
});

test('online: a friend buys at Del\'s, everyone sees it, and the friend has it in the next job', async () => {
  const hub = new MemoryHub(0.05), game = new Game(R, DATA); game.addPlayer('host');
  const hl = new MemoryLink(hub); await hl.host('DEL1'); const host = new HostSession(game, hl);
  const l = new MemoryLink(hub); await l.join('DEL1'); const cl = new ClientSession(new Mirror(DATA), l);
  let out = [];
  const tick = () => {
    const ack = +(cl.mirror.shop?.acks.get(cl.id) ?? 0); out = out.filter((o) => o.sid > ack);
    cl.send(idle({ shop: out })); cl.tick(DT);
    hub.tick(DT); game.step(); host.share(game.take()); host.tick(DT); hub.tick(0);
    cl.mirror.update(DT); cl.take();
  };
  for (let i = 0; i < 30; i++) tick();
  game.finish('test'); game.run.sweets = 200; game.openShop();
  for (let i = 0; i < 20; i++) tick();
  assert.equal(cl.mirror.phase, 'shop'); assert.equal(cl.mirror.shop.stock.length, 6);
  out.push({ sid: 1, a: 'buy', i: 4 }, { sid: 2, a: 'ready' });
  for (let i = 0; i < 30; i++) tick();
  assert.deepEqual(game.run.of(cl.id).drinks, ['sugar_rush']);
  assert.equal(cl.mirror.run.sweets, 200 - P.sugar_rush, 'the friend sees the jar go down');
  assert.ok(cl.mirror.shop.ready.has(cl.id));
  game.setInput('host', idle({ shop: [{ sid: 1, a: 'ready' }] }));
  for (let i = 0; i < 30; i++) tick();
  assert.equal(game.phase, 'job');
  assert.deepEqual(game.player(cl.id).coat.drinks, ['sugar_rush'], 'the friend carries it into the next job');
  assert.deepEqual(cl.mirror.coats.find((c) => c.pid === cl.id).drinks, ['sugar_rush']);
});
