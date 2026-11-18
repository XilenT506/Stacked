// What Heat and Closing Time bring: more guards at Alert, and at Panic the front doors lock and the
// Caretaker comes (he also comes when Closing Time starts). Numbers in data/balance.json (heat).
export class Security {
  constructor({ people, closing, suspicion, place, balance }) {
    this.people = people; this.closing = closing; this.H = balance.heat; this.D = place.data;
    this.extra = []; this.caretaker = null; this.events = [];
    suspicion.onLevel = (lvl) => this.onHeat(lvl);
  }

  onHeat(level) {
    const want = this.H.extraGuards[level] ?? 0, door = this.D.spawns.guard[0];
    while (this.extra.length < want) {
      const g = this.people.add({ type: 'guard', at: [door[0] + this.extra.length * 0.8, door[1]], routine: 'patrol' });
      this.extra.push(g); this.events.push({ type: 'guardArrives', who: g });
    }
    if (level >= this.H.lockFrontAt && this.closing) { this.closing.lock('front'); this.events.push({ type: 'doorsLocked' }); }
    if (level >= this.H.caretakerAt) this.callCaretaker('heat');
  }

  callCaretaker(why) {
    if (this.caretaker) return this.caretaker;
    const at = this.D.spawns.caretaker[0];
    this.caretaker = this.people.add({ type: 'caretaker', at, routine: 'patrol' });
    this.events.push({ type: 'caretaker', why });
    return this.caretaker;
  }

  step() { for (const e of this.closing?.take() || []) { this.events.push(e); if (e.type === 'start') this.callCaretaker('closing'); } }

  take() { const e = this.events; this.events = []; return e; }
}
