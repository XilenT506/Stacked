// One running job, for 1 to 4 players: everything that is simulated (physics, grown-ups, things, loot,
// Heat, Closing Time, the cage). It knows nothing about drawing or the network: the host (or a solo or
// couch game) owns one of these, feeds it each player's input and asks it for presentation events.
//   const game = new Game(R, DATA); game.addPlayer('p1'); every step: game.setInput(id, input); game.step();
// Players joining after the first 20 seconds of a job wait for the next one (game.reset()).
// Between jobs (M1-10): the results, then Dodgy Del's stall in the alley (phase 'shop') until everyone
// presses Next. The run (sweet jar, gadgets and drinks each player carries) lives across jobs.
import { STEP } from './clock.js';
import { makeWorld } from '../physics/world.js';
import { Signals } from '../systems/signals.js';
import { Mess } from '../systems/mess.js';
import { JobEvents } from '../systems/jobEvents.js';
import { Hands } from '../systems/hands.js';
import { Things } from '../world/interact/loader.js';
import { buildPlace, spawnThings } from '../world/place.js';
import { Coat } from '../entities/coat.js';
import { People } from '../ai/people.js';
import { Suspicion } from '../systems/suspicion.js';
import { ClosingTime } from '../systems/closingTime.js';
import { Security } from '../systems/security.js';
import { Gadgets } from '../systems/gadgets.js';
import { Loot } from '../systems/loot.js';
import { Job } from '../systems/job.js';
import { Rescue } from '../systems/rescue.js';
import { TeamMap } from '../systems/teamMap.js';
import { Run, Shop } from '../systems/shop.js';
import { Drinks } from '../systems/drinks.js';
import { Giggles } from '../systems/giggles.js';
import { snapshot } from '../net/snapshot.js';

export const KIDS = [['sid', 'mo', 'tank'], ['pip', 'kit', 'bo'], ['ziggy', 'nell', 'ash'], ['dot', 'rex', 'flo']];
const NO_INPUT = { move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, map: false, sc: [], shop: [] };
const STILL = { x: 0, z: 0 };
const ACTS = new Set(['pickUp', 'drop', 'throw', 'use', 'hide', 'unhide', 'ride', 'letGo', 'belt', 'offBelt', 'loot', 'openCage']);
const GROWNUP = new Set(['slip', 'soaked', 'chase', 'grabCoat', 'grabKid']), LOOT = new Set(['pocket', 'carry', 'coCarry', 'bank', 'drop']);

// the Heat announcement: what the new level means, and what gave you away ("A Baker saw you running.")
function heatLine(W, e) {
  const base = W?.heatLevels?.[e.level] ?? '', r = W?.reasons?.[e.why]?.heat ?? (e.why === 'test key' ? W?.testKey : null);
  if (!r) return base;
  const who = e.who?.type?.name ?? e.who?.typeName;
  return `${base} ${who ? `${/^[AEIOU]/.test(who) ? 'An' : 'A'} ${who.toLowerCase()} ${r}` : `Someone ${r}`}.`;
}

export class Game {
  // D = { place, events, things, controls?, signals, balance, grownups, gadgets, loot, crayonmap, shop, giggles }
  constructor(R, D, { joinWindow = 20 } = {}) {
    this.R = R; this.D = D; this.joinWindow = joinWindow;
    this.order = []; this.waiting = []; this.out = []; this.jobNo = 0; this.players = [];
    this.run = new Run(D); this.seed = 1;
    this.reset();
  }

  get coats() { return this.players.map((p) => p.coat); }
  player(id) { return this.players.find((p) => p.id === id); }

  // a new job: rebuild the shop and put everyone (including people who were waiting) at the entrance
  reset() {
    const { R, D } = this, B = D.balance;
    this.jobNo++; this.time = 0; this.phase = 'job'; this.shop = null; this.after = 0;
    // presses made between jobs (in the shop) are used up, so they don't fire in the new job
    this.carried = new Map((this.players ?? []).map((p) => [p.id, { ...p.input.presses }]));
    this.order = [...this.order, ...this.waiting.filter((id) => !this.order.includes(id))].slice(0, 4); this.waiting = [];
    this.world = makeWorld(R); this.signals = new Signals(D.signals.types); this.mess = new Mess(this.signals, B);
    this.place = buildPlace(R, this.world, D.place);
    this.things = new Things(R, this.world, this.signals, D.things, { mess: this.mess, spots: D.place.events, balance: B });
    this.things.onSound = (name, p) => this.emit({ k: 'sound', name, x: p?.x, z: p?.z });
    this.things.announce = (text) => this.emit({ k: 'announce', text, title: 'Tannoy' });
    spawnThings(this.place, this.things);
    this.people = new People(R, this.world, this.place, D.grownups, { signals: this.signals, mess: this.mess, things: this.things.list });
    this.sus = new Suspicion(B);
    this.closing = new ClosingTime(R, this.world, this.place, B, { nav: this.people.nav });
    this.security = new Security({ people: this.people, closing: this.closing, suspicion: this.sus, place: this.place, balance: B });
    this.rescue = new Rescue({ R, world: this.world, place: this.place, people: this.people, balance: B, solo: this.order.length <= 1, suspicion: this.sus, closing: this.closing });
    this.loot = new Loot(this.place, D.loot, B); this.job = new Job(this.place, B);
    this.gadgets = new Gadgets(D.gadgets, { R, world: this.world, signals: this.signals, things: this.things, people: this.people, sus: this.sus, balance: B });
    this.jobEvents = new JobEvents(D.events.events, { signals: this.signals, things: this.things, spots: D.place.events, say: (text, title) => { this.emit({ k: 'announce', text, title }); this.emit({ k: 'sound', name: 'tannoy_ding' }); } }, B.events);
    this.map = new TeamMap(this.place, D.crayonmap);
    this.drinks = new Drinks(B, { people: this.people, things: this.things, signals: this.signals });
    // Giggles watch every signal (chains) and keep the game state of the best moments for the highlight reel
    this.giggles = new Giggles(B, D.giggles, { capture: () => snapshot(this, [], { withScribbles: false }) });
    const heard = this.signals.onDeliver; this.signals.onDeliver = (sig) => { heard?.(sig); this.giggles.signal(sig, this.coats); };
    this.jobEvents.onFire = (e, at) => this.map.note(e.name, at);
    this.players = [];
    for (const id of this.order) this.spawnPlayer(id);
    this.emit({ k: 'newJob', job: this.jobNo }); this.fx('job:start', this.place.data.spawns.players[0] && { x: this.place.data.spawns.players[0][0], z: this.place.data.spawns.players[0][1] });
  }

  spawnPlayer(id) {
    const D = this.place.data, i = this.players.length, [sx, sz] = D.spawns.players[i % D.spawns.players.length], B = this.D.balance;
    const coat = new Coat(this.R, this.world, this.signals, B, [sx, 0, sz], KIDS[i % 4], { mess: this.mess });
    coat.floorZones = this.place.slippery; coat.pid = id; coat.slot = i;
    coat.bounds = { x0: D.bounds[0] + 1, z0: D.bounds[1] + 1, x1: D.bounds[2] - 1, z1: D.bounds[3] - 1 };
    const hands = new Hands(coat, this.things, B); hands.loot = this.loot; hands.rescue = this.rescue;
    const kit = this.run.of(id);
    this.gadgets.arm(coat, kit.gadgets); coat.drinks = kit.drinks;            // what this player bought at Del's (drinks used up stay used up)
    const p = { id, coat, hands, input: NO_INPUT, seen: this.carried?.get(id) ?? {}, events: [] };
    this.players.push(p);
    return p;
  }

  // a player wants in: straight away early in a job (or as the first player), otherwise at the next job
  addPlayer(id) {
    if (this.order.includes(id) || this.waiting.includes(id)) return this.player(id) ? 'playing' : 'waiting';
    if (this.order.length + this.waiting.length >= 4) return 'full';
    if (!this.players.length || this.time < this.joinWindow) { this.order.push(id); this.spawnPlayer(id); this.rescue.solo = this.order.length <= 1; this.emit({ k: 'announce', text: `Player ${this.order.length} joined!`, title: 'Hello' }); return 'playing'; }
    this.waiting.push(id); this.emit({ k: 'announce', text: 'A friend is waiting to join: they come in at the next job.', title: 'Hello' });
    return 'waiting';
  }

  removePlayer(id) {
    this.waiting = this.waiting.filter((w) => w !== id); this.order = this.order.filter((w) => w !== id);
    const p = this.player(id); if (!p) return;
    p.coat.walker.collider.setEnabled(false); p.coat.walker.body.setTranslation({ x: 0, y: -50, z: 0 }, true);
    this.players = this.players.filter((q) => q !== p);
    this.emit({ k: 'announce', text: 'A friend left.', title: 'Bye' });
  }

  // input: { move: {x, z} world, aim: {x, z} | null, run, use, natural, presses: { grab, throw, stack, slot1, slot2, slot3, switch } counters,
  //         map: the crayon map is open, sc: scribbles not yet acknowledged (each with the player's own sid),
  //         shop: orders at Del's not yet acknowledged ({ sid, a: 'buy' | 'reroll' | 'ready', i }) }
  // presses are counters (they only ever go up), so a press is never lost between network packets
  setInput(id, input) { const p = this.player(id); if (p) p.input = input; }
  pressed(p, name) { const n = p.input.presses?.[name] ?? 0, was = p.seen[name] ?? 0; if (n > was) { p.seen[name] = n; return true; } return false; }

  emit(e) { this.out.push(e); }
  take() { const e = this.out; this.out = []; return e; }

  step(dt = STEP) {
    const B = this.D.balance, coats = this.coats;
    if (this.phase === 'shop') return this.stepShop();
    this.time += dt;
    // after the results: Del's shop, or (everyone caught) a fresh run
    if (this.job.over && (this.after += dt) >= B.shop.resultsSeconds) return this.job.why === 'all caught' ? this.newRun() : this.openShop();
    this.rescue.step(coats);
    this.people.step(dt, coats); this.rescue.follow();
    this.giggles.step(dt, { coats, people: this.people });
    for (const p of this.players) {
      const c = p.coat, I = p.input, h = p.hands;
      for (const sc of I.sc || []) this.map.add(p.id, sc, c.slot);
      // with the map open the coat stands still behind a big sheet of paper
      const wasMap = c.mapOpen; c.mapOpen = !!I.map && !c.inCage && !c.hidden;
      if (c.mapOpen && !wasMap) this.fx('act:map', c, p.id);
      if (this.pressed(p, 'stack')) { c.toggleStack(); p.events.push(...c.events); c.events = []; }      // (the coat's step clears its events)
      let grab = this.pressed(p, 'grab');
      if (grab && c.atGate && !this.job.over) { this.fx('act:getaway', c, p.id); this.giggles.getaway(c, { closing: this.closing, people: this.people }); this.finish('got away'); grab = false; }
      const sel = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'].findIndex((n) => this.pressed(p, n));
      if (this.pressed(p, 'drink') && !c.mapOpen && this.drinks.drink(c, coats)) this.fx('act:drink', c, p.id);
      const cycle = this.pressed(p, 'switch'); if (sel >= 0 || cycle) this.fx('act:slot', c, p.id);
      if (this.pressed(p, 'point')) { const a = I.aim ?? { x: Math.sin(c.walker.yaw), z: Math.cos(c.walker.yaw) }; this.fx('act:point', { x: c.walker.feet.x + a.x * 3, z: c.walker.feet.z + a.z * 3 }, p.id); }
      this.gadgets.use(c, dt, { fire: I.use && !h.held && !c.mapOpen, select: sel < 0 ? null : sel, cycle: cycle ? 1 : 0, aim: I.aim });
      h.step(dt, { grab, throwIt: this.pressed(p, 'throw'), use: I.use, natural: I.natural, aim: I.aim });
      c.step(dt, c.mapOpen ? STILL : I.move, I.run && !c.mapOpen, I.aim, I.natural);
      p.events.push(...c.events); p.evN = c.events.length;
      for (const e of h.events) { if (e.type === 'throw') this.sus.instant(this.people, c, B.suspicion.throw, 'throw'); if (ACTS.has(e.type)) this.fx('act:' + e.type, c, p.id); }
      // the start of Act Natural and of running get their own little reaction
      if (c.actingNatural && !p.nat) this.fx('act:natural', c, p.id); p.nat = c.actingNatural;
      if (c.running && !p.ran) this.fx('act:run', c, p.id); p.ran = c.running;
    }
    this.sus.step(dt, this.people, coats);
    this.closing.step(dt); this.security.step(); this.gadgets.step(dt, coats); this.drinks.step(dt, coats);
    this.loot.step(dt, coats); this.job.step(dt);
    this.map.step(dt, { coats: coats.filter((c) => !c.inCage), people: this.people, nav: this.people.nav, solo: this.order.length <= 1, closing: this.closing, caretaker: this.security.caretaker });
    if (!this.job.over && !this.closing.endedJob && this.closing.next >= this.closing.sections.length) { this.closing.endedJob = true; this.finish('shut in'); }
    for (const p of this.players) p.hands.carry();
    this.world.step();
    for (const p of this.players) { const c = p.coat; p.events.push(...c.events.slice(p.evN ?? 0)); c.events = []; c.checkHits(this.world); p.events.push(...c.events); }
    this.things.step(dt); this.signals.flush(dt); this.mess.step(dt); this.jobEvents.step(dt);
    this.present();
  }

  finish(why) {
    if (this.job.over) return;
    this.job.finish(why, this.loot, this.sus);
    // Giggles on the results screen; the best moments (with their game state) go on the run's highlight list
    const r = this.job.result, G = this.giggles;
    r.giggles = G.summary(); G.closed = true; r.best = G.best().slice(0, 3).map((m) => ({ label: m.label, reel: m.reel, giggles: m.giggles, by: m.by }));
    this.run.highlights = [...(this.run.highlights ?? []), ...G.best().map((m) => ({ ...m, job: this.jobNo }))].sort((a, b) => b.giggles - a.giggles).slice(0, this.D.balance.giggles.record.keepPerRun);
    this.run.earn(r); this.emit({ k: 'result', result: r }); this.fx('result:' + why); if (r.met) this.fx('result:quota');
  }

  // Dodgy Del's stall in the alley: the shop world stands still while everyone shops
  openShop() {
    this.phase = 'shop'; this.shop = new Shop(this.D, this.run, { seed: this.seed++ });
    this.emit({ k: 'shop' }); this.fx('shop:open');
  }

  stepShop() {
    for (const p of this.players) for (const o of p.input.shop || []) {
      const r = this.shop.order(p.id, o); if (!r) continue;
      this.emit({ k: 'sound', name: r.ok ? (r.a === 'ready' ? 'pose_ding' : 'kaching') : 'squeak' });
      if (r.ok && r.a === 'ready') this.fx('shop:ready', null, p.id);
      if (r.a === 'buy' && r.ok) { this.emit({ k: 'bought', pid: p.id, id: r.id }); this.fx('shop:bought', null, p.id); }
    }
    if (this.shop.allReady(this.players.map((p) => p.id))) this.reset();
    this.present();
  }

  // everyone caught: the run is over. Empty sweet jar, starter gadgets, a new shop
  newRun() { this.run.start(); this.reset(); this.emit({ k: 'announce', text: 'Everyone got caught. New run: empty sweet jar, starter gadgets.', title: 'Run over' }); }

  // turn what happened into things to see and hear (the same list goes to every screen)
  present() {
    const S = this.D.balance;
    for (const p of this.players) { for (const e of p.events) if (['spill', 'hit', 'restack', 'unstack', 'stumble', 'effect'].includes(e.type)) { this.emit({ k: 'coat', pid: p.id, type: e.type }); this.fx('coat:' + e.type, p.coat, p.id); } p.events = []; }
    for (const e of this.people.take()) {
      if (e.type === 'slip') this.giggles.floored(e.who, this.coats);
      if (GROWNUP.has(e.type)) this.fx('grownup:' + (e.type === 'grabCoat' || e.type === 'grabKid' ? 'grab' : e.type), e.who.feet);
      if (e.type === 'say' && e.clip) this.emit({ k: 'say', who: e.who.id, clip: e.clip, x: e.who.feet.x, z: e.who.feet.z });
      if (e.type === 'slip') this.emit({ k: 'sound', name: 'slip_whee', x: e.who.feet.x, z: e.who.feet.z });
    }
    const W = this.D.why;
    for (const e of this.sus.take()) {
      // why a "?" went up: a short bubble over the grown-up (the bust shout wins over it)
      if (e.type === 'why' && W?.reasons[e.why]) this.emit({ k: 'shout', who: e.who.id, text: W.reasons[e.why].bubble, sec: 2.2 });
      if (e.type === 'bust') { this.emit({ k: 'shout', who: e.who.id, text: "THAT'S NOT A GROWN-UP!" }); this.fx('grownup:bust', e.who.feet); }
      if (e.type === 'heat' && e.level > 0) this.fx('heat:' + e.level);
      if (e.type === 'heat') this.emit({ k: 'announce', text: heatLine(W, e), title: `Heat ${e.level}: ${S.heat.names[e.level]}` });
    }
    for (const e of this.security.take()) {
      if (e.type === 'caretaker') { this.emit({ k: 'announce', text: e.why === 'closing' ? 'The Caretaker is doing his rounds. Get out!' : 'Someone has called the Caretaker!', title: 'Uh oh' }); this.emit({ k: 'shout', who: this.security.caretaker.id, text: "Right. Who's still in here?", sec: 3 }); }
      if (e.type === 'start' || e.type === 'shut') this.fx('closing:' + e.type);
      if (e.type === 'start') { this.map.note('Closing Time!', this.place.data.getaway.at); this.emit({ k: 'announce', text: 'Closing Time! The shutters are coming down, section by section.', title: 'Tannoy' }); this.emit({ k: 'sound', name: 'tannoy_ding' }); }
      if (e.type === 'warn') this.emit({ k: 'announce', text: `${e.section.name} closes in ${S.closingTime.warn} seconds!`, title: 'Tannoy' });
      if (e.type === 'shut' && this.closing.started) this.emit({ k: 'announce', text: `The ${e.section.name} shutter is down: find another way round.`, title: 'Shutter' });
      if (e.type === 'shut') this.emit({ k: 'sound', name: 'machine_clunk' });
    }
    const g = this.rescue.gateAt;
    for (const e of this.rescue.take()) {
      if (e.type === 'spareKid' || e.type === 'caught' || e.type === 'gateOpen') this.fx('rescue:' + e.type, e.type === 'gateOpen' ? g : null);
      // who was caught goes on every screen; the player it happened to is told plainly where they are now
      const name = (c) => `Player ${(c.slot ?? 0) + 1}`;
      if (e.type === 'spareKid') this.emit({ k: 'announce', to: e.coat.pid, title: 'Got you!',
        text: `You're Spare Kid ${e.n} of ${e.of}, coming in ${e.back ? 'through the back door (the front is locked)' : 'at the entrance'}. Your old kid waits in the Lost & Found in the staff room.`,
        others: `${name(e.coat)}'s kid was caught! A Spare Kid comes in ${e.back ? 'through the back door' : 'at the entrance'}.` });
      if (e.type === 'caught') this.emit({ k: 'announce', to: e.coat.pid, title: 'Got you!', text: `Your coat was caught! A ${e.by.type.name.toLowerCase()} is carrying you to the Lost & Found in the staff room. A friend can get you out.`, others: `${name(e.coat)}'s coat was caught! They're off to the Lost & Found in the staff room.` });
      if (e.type === 'locked') this.emit({ k: 'sound', name: 'machine_clunk', x: g.x, z: g.z });
      if (e.type === 'locked' && e.coat) this.emit({ k: 'announce', to: e.coat.pid, title: 'Locked in', text: 'Locked in the Lost & Found. A friend can lure the guard away (a noise, a prank, or letting him see them somewhere else) and open the gate with E.', others: `${name(e.coat)} is locked in the Lost & Found (staff room). Lure the guard away, then E at the gate.` });
      if (e.type === 'freed' && e.coat) this.emit({ k: 'announce', to: e.coat.pid, title: 'Free!', text: `${e.by === e.coat ? 'You' : name(e.by)} opened the cage: you're out, as one kid. Find your coat's kids!`, others: `${name(e.coat)} is out of the cage!` });
      if (e.type === 'escaped') this.emit({ k: 'announce', to: e.coat.pid, title: 'Dropped!', text: 'The grown-up slipped and dropped you: run!', others: `${name(e.coat)} got away from the grown-up!` });
      if (e.type === 'gateOpen') { this.emit({ k: 'sound', name: 'switch_click', x: g.x, z: g.z }); this.emit({ k: 'announce', text: 'The Lost & Found is open: everyone out!', title: 'Rescue' }); }
      if (e.type === 'allCaught') this.finish('all caught');
    }
    for (const e of this.loot.take()) {
      const at = e.coat ? e.coat.walker.feet : { x: e.item.x, z: e.item.z };
      if (LOOT.has(e.type)) this.fx('loot:' + e.type, at, e.coat?.pid);
      if (e.type === 'pocket' || e.type === 'carry' || e.type === 'coCarry') this.emit({ k: 'sound', name: 'paper_flap', x: at.x, z: at.z });
      if (e.type === 'bank') this.emit({ k: 'sound', name: 'pose_ding', x: at.x, z: at.z });
      if (e.type === 'drop') this.emit({ k: 'sound', name: 'box_thud', x: at.x, z: at.z });
    }
    for (const e of this.drinks?.take() ?? []) {
      this.emit({ k: 'sound', name: 'gulp', x: e.at.x, z: e.at.z }); this.emit({ k: 'sound', name: this.D.shop.drinks[e.id].sound, x: e.at.x, z: e.at.z });
      const type = e.id === 'burp_blaster' ? 'burp' : 'sugar';
      this.emit({ k: 'coat', pid: e.coat.pid, type }); this.fx('coat:' + type, e.coat, e.coat.pid);
    }
    for (const e of this.gadgets.take()) {
      this.giggles.gadget(e);
      if (e.type === 'fire' && e.sound) this.emit({ k: 'sound', name: e.sound, x: e.at.x, z: e.at.z });
      if (e.type === 'hit') this.emit({ k: 'sound', name: 'bonk', x: e.at.x, z: e.at.z });
      if (e.type === 'trigger') this.emit({ k: 'sound', name: this.D.gadgets.gadgets[e.gadget]?.triggerSound ?? 'slip_whee', x: e.at.x, z: e.at.z });
    }
    this.presentGiggles();
  }

  // a moment for the juice pass (data/juice.json events): a sound, a visual, maybe shake, a freeze-frame and a voice
  fx(key, at = null, pid = null) { const f = at?.walker ? at.walker.feet : at; this.emit({ k: 'fx', key, x: f?.x, z: f?.z, pid }); }

  // Giggles: the shout, the meter, the Giggle Rush (drawn by the HUD)
  presentGiggles() {
    for (const e of this.giggles.take()) {
      if (e.type === 'moment') { this.emit({ k: 'giggle', label: e.m.label, giggles: e.giggles, kind: e.m.kind, by: e.m.by, bigger: e.bigger }); this.fx('giggle', e.m.at, e.m.by); }
      if (e.type === 'rush') { this.emit({ k: 'giggle', label: e.label, rush: true }); this.fx('rush'); }
    }
  }

  // what E does for this player right now (shown at the bottom of their screen)
  hint(id) {
    const p = this.player(id); if (!p) return '';
    if (p.coat.atGate && !this.job.over) return `E: get away! (${this.loot.bankedValue} sweets banked; this ends the job)`;
    return p.hands.hint();
  }

  get lightsOff() { return this.things.list.some((t) => t.def.use?.toggles === 'lights' && t.state === 'off'); }

  // test keys (host only)
  test(key, id) {
    const p = this.player(id) ?? this.players[0]; if (!p) return;
    const c = p.coat, a = p.input.aim || { x: 0, z: -1 }, f = c.walker.position;
    if (key === 'melon') { const m = this.things.spawn('melon', [f.x + a.x, 0.3, f.z + a.z]); m.body.setLinvel({ x: 7 * a.x, y: 0, z: 7 * a.z }, true); }
    if (key === 'puddle') this.signals.emit({ type: 'slippery', position: { x: f.x + a.x * 2, y: 0, z: f.z + a.z * 2 }, range: 1.4 });
    if (key === 'whack') { c.hit(8); p.events.push(...c.events); c.events = []; }
    if (key === 'event' && this.jobEvents.upcoming) this.jobEvents.fire(this.jobEvents.upcoming.id);
    if (key === 'heat') this.sus.addHeat(1, 'test key');
    if (key === 'closing') this.closing.start();
    if (key === 'shop') { this.finish('test key'); this.openShop(); }
  }
}
