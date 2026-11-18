// Logic tests for M1-09: the crayon map. What the team has seen (areas, grown-ups), scribbles with their
// limits, the map going round online (a scribble from one friend reaches the host and the other friend),
// holding the map up (standing still, a little suspicious), and the Caretaker's route when playing alone.
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

test('the map only knows the parts the team has been in, and the grown-ups someone has seen', () => {
  const g = new Game(R, DATA); g.addPlayer('p1');
  for (let i = 0; i < 10; i++) g.step();
  assert.ok(g.map.seenAreas.has('carpark'), 'the car park, where we start');
  assert.ok(!g.map.seenAreas.has('bakery') && !g.map.seenAreas.has('staff'), 'not the bakery or the staff room yet');
  put(g.players[0].coat, -5.2, 6);                               // at the tills
  for (let i = 0; i < 20; i++) g.step();
  assert.ok(g.map.seenAreas.has('tills'));
  const types = [...g.map.seenPeople.values()].map((p) => p.type);
  assert.ok(types.includes('cashier'), `the cashiers are on the map (saw ${types})`);
  assert.ok(![...g.map.seenPeople.values()].some((p) => p.type === 'baker'), 'the baker (behind shelves, far away) is not');
  // last-seen: a grown-up out of sight stays where they were last seen
  const cashier = [...g.map.seenPeople.values()].find((p) => p.type === 'cashier');
  put(g.players[0].coat, 14, -15);                               // round the back
  for (let i = 0; i < 20; i++) g.step();
  assert.equal(g.map.seenPeople.get(cashier.id).x, cashier.x, 'out of sight: stays where we saw them');
});

test('scribbles: arrows, circles, stickers; repeats are ignored, limits hold, rub out clears only yours', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const C = DATA.crayonmap;
  g.setInput('p1', idle({ sc: [{ sid: 1, kind: 'arrow', pts: [[0, 0], [2, 1], [4, 3]] }, { sid: 2, kind: 'sticker', pts: [[1, 1]], text: 'RUN' }] }));
  g.setInput('p2', idle({ sc: [{ sid: 1, kind: 'circle', pts: [[5, 5], [6, 5]] }, { sid: 2, kind: 'sticker', pts: [[3, 3]], text: 'something rude' }] }));
  g.step(); g.step(); g.step();                                   // the same packet three times
  assert.equal(g.map.scribbles.length, 4, 'each scribble once');
  assert.equal(g.map.scribbles.find((s) => s.by === 'p2' && s.kind === 'sticker').text, C.stickers[0], 'only real stickers');
  assert.equal(g.map.acks.get('p1'), 2);
  assert.ok(!g.map.add('p1', { sid: 3, kind: 'laser', pts: [[0, 0]] }), 'unknown kinds are refused');
  for (let i = 4; i < 4 + C.maxPerPlayer + 5; i++) g.map.add('p1', { sid: i, kind: 'line', pts: [[0, 0], [1, 1]] });
  assert.equal(g.map.scribbles.filter((s) => s.by === 'p1').length, C.maxPerPlayer, 'a player can only have so many (the oldest go)');
  g.map.add('p1', { sid: 100, kind: 'clear', pts: [] });
  assert.deepEqual(g.map.scribbles.map((s) => s.by), ['p2', 'p2'], 'rubbing out only takes your own');
});

test('holding up the map: the coat stands still, and a grown-up watching gets a little suspicious', () => {
  const run = (open) => {
    const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
    put(c, -5.2, 6);
    for (let i = 0; i < 5; i++) g.step();
    const at = { ...c.walker.feet };
    for (let i = 0; i < 120; i++) { g.setInput('p1', idle({ map: open, move: { x: 1, z: 0 } })); g.step(); }
    const sus = Math.max(...g.people.list.map((p) => p.sus.get(c) ?? 0));
    return { moved: Math.hypot(c.walker.feet.x - at.x, c.walker.feet.z - at.z), sus, open: c.mapOpen };
  };
  const shut = run(false), open = run(true);
  assert.ok(open.open && open.moved < 0.2, `stands still with the map open (moved ${open.moved.toFixed(2)} m)`);
  assert.ok(shut.moved > 1, 'walks with it shut');
  const still = (() => { const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat; put(c, -5.2, 6); for (let i = 0; i < 125; i++) { g.setInput('p1', idle()); g.step(); } return Math.max(...g.people.list.map((p) => p.sus.get(c) ?? 0)); })();
  assert.ok(open.sus > still + 0.05, `the map looks odd: ${open.sus.toFixed(2)} vs standing still ${still.toFixed(2)}`);
});

test('online: a scribble from one friend reaches the host and the other friend, and is acknowledged', async () => {
  const hub = new MemoryHub(0.05), game = new Game(R, DATA); game.addPlayer('host');
  const hl = new MemoryLink(hub); await hl.host('MAP1'); const host = new HostSession(game, hl);
  const clients = [];
  for (let i = 0; i < 2; i++) { const l = new MemoryLink(hub); await l.join('MAP1'); clients.push(new ClientSession(new Mirror(DATA), l)); }
  const [a, b] = clients;
  const out = { [a.id]: [], [b.id]: [] };
  const tick = () => {
    for (const c of clients) { const ack = +(c.mirror.map.acks.get(c.id) ?? 0); out[c.id] = out[c.id].filter((s) => s.sid > ack); c.send(idle({ map: out[c.id].length > 0, sc: out[c.id] })); c.tick(DT); }
    hub.tick(DT); game.step(); host.share(game.take()); host.tick(DT); hub.tick(0);
    for (const c of clients) { c.mirror.update(DT); c.take(); }
  };
  for (let i = 0; i < 30; i++) tick();
  out[a.id].push({ sid: 1, kind: 'arrow', pts: [[-14, 14], [-14, 10], [-12, 8]] }, { sid: 2, kind: 'sticker', pts: [[-12, 8]], text: 'DANGER: GRANNY' });
  out[b.id].push({ sid: 1, kind: 'circle', pts: [[16, 18.5], [17.5, 18.5]] });
  for (let i = 0; i < 40; i++) tick();
  assert.equal(game.map.scribbles.length, 3, 'the host has all three');
  for (const c of clients) {
    const sc = c.mirror.map.scribbles;
    assert.equal(sc.length, 3, 'every friend sees every scribble');
    assert.ok(sc.some((s) => s.kind === 'sticker' && s.text === 'DANGER: GRANNY' && s.by === a.id));
    assert.ok(sc.some((s) => s.kind === 'circle' && s.by === b.id));
  }
  assert.equal(out[a.id].length + out[b.id].length, 0, 'acknowledged, so they stop being sent');
  assert.ok(a.mirror.map.seenAreas.has('carpark'), 'seen areas travel too');
  // the scribbles only travel when they change (and once a second), so snapshots stay small
  const sizes = []; const pub = hl.publish.bind(hl); hl.publish = (S) => { sizes.push([!!S.map.sc, JSON.stringify(S).length]); pub(S); };
  for (let i = 0; i < 60; i++) tick();
  assert.ok(sizes.filter(([sc]) => sc).length <= 2, 'not every snapshot carries the scribbles');
});

test('playing alone: after Closing Time the map shows where the Caretaker is going', () => {
  const g = new Game(R, DATA); g.addPlayer('p1');
  for (let i = 0; i < 5; i++) g.step();
  assert.equal(g.map.route, null, 'no route before Closing Time');
  g.closing.start(); g.security.callCaretaker('closing');
  for (let i = 0; i < 30; i++) g.step();
  assert.ok(g.map.route && g.map.route.length >= 3, `a route of a few stops (${JSON.stringify(g.map.route)})`);
  const g2 = new Game(R, DATA); g2.addPlayer('p1'); g2.addPlayer('p2'); g2.closing.start(); g2.security.callCaretaker('closing');
  for (let i = 0; i < 30; i++) g2.step();
  assert.equal(g2.map.route, null, 'with friends you have to find him yourselves');
});
