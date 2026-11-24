// Everything on screen for one job, drawn from a model: either the real Game (solo, couch, host) or a
// client's Mirror of the host's snapshots. Both look the same to the views. A new job (model.jobNo
// changes) rebuilds the scene. present(events) turns the game's presentation events into sounds, voices,
// speech bubbles, announcements and coat pops.
import * as T from 'three';
import { PlaceView } from './placeView.js';
import { ThingsView } from './thingsView.js';
import { CoatView } from './coatView.js';
import { PeopleView } from './peopleView.js';
import { ShutterView } from './shutterView.js';
import { GadgetView } from './gadgetView.js';
import { LootView } from './lootView.js';
import { CageView } from './cageView.js';
import { WallFade } from './wallFade.js';
import { AimMarker } from './aimMarker.js';
import { ChalkView } from './chalkView.js';
import { Juice } from './juice.js';

export class Stage {
  constructor({ place, data, hud, sfx, voices, callouts = null, camRig = null }) {
    this.place = place; this.data = data; this.hud = hud; this.sfx = sfx; this.voices = voices; this.callouts = callouts; this.camRig = camRig; this.jobNo = -1;
  }

  build(model) {
    this.model = model; this.jobNo = model.jobNo;
    const scene = this.scene = new T.Scene(); scene.background = new T.Color(0xfff3e2);
    const hemi = new T.HemisphereLight(0xfde9dc, 0xd9906a, 1.2), sun = new T.DirectionalLight(0xffe2b8, 2.2);
    sun.position.set(-6, 12, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
    scene.add(hemi, sun, sun.target); this.lights = { hemi, sun };
    this.fade = new WallFade();
    this.placeView = new PlaceView(scene, this.place, this.fade);
    this.thingsView = new ThingsView(scene, model.things, model.mess);
    this.peopleView = new PeopleView(scene, model.people, this.data.grownups.models);
    this.shutterView = new ShutterView(scene, model.closing, this.fade);
    this.gadgetView = new GadgetView(scene, model.gadgets);
    this.lootView = new LootView(scene, model.loot, this.data.place.job);
    this.cageView = new CageView(scene, model.rescue);
    this.chalkView = new ChalkView(scene, this.data.crayonmap.playerColors);
    this.juice = new Juice(scene, this.data.juice, { sfx: this.sfx, callouts: this.callouts, camRig: this.camRig });
    this.coatViews = new Map();
    this.aimMarks = [];
    this.hud.results(null);
  }

  // keep a view for every coat (players come and go)
  syncCoats() {
    const coats = this.model.coats, live = new Set(coats);
    for (const c of coats) if (!this.coatViews.has(c)) this.coatViews.set(c, new CoatView(this.scene, c, this.data.balance.suspicion.actNaturalLines));
    for (const [c, v] of this.coatViews) if (!live.has(c)) { v.remove(); this.coatViews.delete(c); }
    const many = coats.length > 1;
    for (const c of coats) this.coatViews.get(c).setTag(c.slot ?? 0, many);
  }

  // draw one frame. watch = the coat whose HUD and meters are shown; focus = where the camera looks
  // what caused a Giggle, from this screen's point of view: "your water balloon", "Player 2's banana peel"
  causeLine(e, me) {
    if (!e.cause) return '';
    const what = this.data.gadgets.gadgets[e.cause]?.name ?? this.data.giggles.causes?.[e.cause] ?? e.cause;
    const slot = this.model.coats.find((c) => c.pid === e.by)?.slot, who = e.by == null ? '' : me.includes(e.by) ? 'your' : `Player ${(slot ?? 0) + 1}'s`;
    return `${who} ${what.toLowerCase()}`.trim();
  }

  update(dt, { watch, focus, aims = [], camera, events = [], me = [] }) {
    if (this.model.jobNo !== this.jobNo) this.build(this.model);
    this.syncCoats();
    this.peopleView.watch = watch;
    this.present(events, me);
    this.juice.handle(events, { me, focus }); this.juice.update(dt, camera);
    this.thingsView.update(dt); this.peopleView.update(dt); this.shutterView.update(dt); this.gadgetView.update(); this.lootView.update(dt); this.cageView.update(dt); this.chalkView.update(this.model.map);
    // how many grown-ups are right on top of each coat (a pile-on): the coat's outline shows through them
    const crowd = (c) => { const f = c.walker.feet; return this.model.people.list.filter((g) => Math.hypot(g.feet.x - f.x, g.feet.z - f.z) < 1.5).length; };
    for (const [c, v] of this.coatViews) v.update(dt, this.pops?.get(c) ?? [], { crowd: crowd(c), mine: me.includes(c.pid) });
    this.placeView.fadeSigns(this.model.coats.map((c) => c.walker.feet), dt, camera);
    // acting natural: the coat whistles a little tune (data/juice.json whistle)
    const W = this.data.juice.whistle;
    for (const c of this.model.coats) {
      if (!c.actingNatural) { c.whistleT = 0; continue; }
      if ((c.whistleT = (c.whistleT ?? 0) - dt) <= 0) { c.whistleT = W.every; c.whistleN = ((c.whistleN ?? -1) + 1) % W.notes.length; this.sfx.play(W.notes[c.whistleN], c.walker.feet); }
    }
    this.pops = new Map();
    // aim markers for local players: where the shot will land, lit up over a grown-up (M1-F9)
    while (this.aimMarks.length < aims.length) this.aimMarks.push(new AimMarker(this.scene, this.data));
    this.aimMarks.forEach((m, i) => { this.aimAt = m.update(dt, aims[i], this.model.people.list); });
    // the sun's shadows follow the camera; the lights follow the light switch
    this.lights.sun.position.set(focus.x - 6, 12, focus.z + 6); this.lights.sun.target.position.set(focus.x, 0, focus.z);
    const k = this.model.lightsOff ? 0.12 : 1;
    this.lights.sun.intensity += (2.2 * k - this.lights.sun.intensity) * Math.min(1, dt * 6);
    this.lights.hemi.intensity += (1.2 * Math.max(k, 0.2) - this.lights.hemi.intensity) * Math.min(1, dt * 6);
    this.fade.update(dt, camera.position, this.model.coats.map((c) => c.walker.feet));
  }

  // the game's presentation events: the same list on every screen
  present(events, me = []) {
    const people = new Map(this.model.people.list.map((g) => [g.id, g])), coats = new Map(this.model.coats.map((c) => [c.pid, c]));
    this.pops ??= new Map();
    for (const e of events) {
      if (e.k === 'sound') this.sfx.play(e.name, e.x !== undefined ? { x: e.x, z: e.z } : null);
      else if (e.k === 'say') this.voices.say(e.who, e.clip, { x: e.x, z: e.z });
      else if (e.k === 'announce') { const mine = !e.to || me.includes(e.to); if (mine || e.others) this.hud.announce(mine ? e.text : e.others, e.title); }
      else if (e.k === 'shout') { const g = people.get(e.who); if (g) this.peopleView.shout(g, e.text, e.sec); }
      else if (e.k === 'giggle') this.hud.giggle({ ...e, from: this.causeLine(e, me) });
      else if (e.k === 'coat') { const c = coats.get(e.pid); if (c) { const l = this.pops.get(c) ?? []; l.push({ type: e.type }); this.pops.set(c, l); } }
    }
  }
}
