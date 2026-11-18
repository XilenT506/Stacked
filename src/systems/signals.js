// Signals: how things in the living map tell each other what happened.
// Anything can send {type, position, range, source}. Every listener within range of the position hears it.
// Signals are queued and delivered once per physics step, so a chain reaction (a can falls, a shopper
// slips, a pyramid crashes) unfolds over several steps instead of all at once in one call.
export const SIGNAL_TYPES = ['noise', 'spill', 'slippery', 'crash', 'smell', 'dark', 'alarm', 'food'];

export class Signals {
  // defaults: { type: { range } } from data/signals.json
  constructor(defaults = {}) {
    this.defaults = defaults;
    this.listeners = new Set();
    this.queue = [];
    this.log = [];            // recent signals, newest last (for tests, the crayon map and Giggles later)
    this.time = 0;
    this.sent = 0;            // how many signals have been delivered in total
    this.onDeliver = null;    // optional: called with every signal as it is delivered (debug rings, Giggles)
  }

  // listener: { position: {x,y,z} | () => {x,y,z}, types?: [..] (all when missing), hear(signal, distance) }
  // or { everywhere: true, ... } to hear every signal wherever it is (the floor remembering slippery patches)
  // returns a function that removes the listener
  listen(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  emit({ type, position, range, source = null, data = null }) {
    if (!SIGNAL_TYPES.includes(type)) throw new Error(`unknown signal type "${type}"`);
    const r = range ?? this.defaults[type]?.range ?? 5;
    const s = { type, position: { x: position.x, y: position.y ?? 0, z: position.z }, range: r, source, data, time: this.time };
    this.queue.push(s);
    return s;
  }

  // deliver everything sent since the last flush; signals sent while delivering wait for the next flush
  flush(dt = 0) {
    this.time += dt;
    const batch = this.queue; this.queue = [];
    let heard = 0;
    for (const s of batch) {
      this.log.push(s); if (this.log.length > 200) this.log.shift();
      this.sent++; this.onDeliver?.(s);
      for (const l of this.listeners) {
        if (l.types && !l.types.includes(s.type)) continue;
        if (l.source !== undefined && l.source === s.source) continue;     // nothing hears itself
        if (l.everywhere) { l.hear(s, 0); heard++; continue; }
        const p = typeof l.position === 'function' ? l.position() : l.position;
        const d = Math.hypot(p.x - s.position.x, (p.y ?? 0) - s.position.y, p.z - s.position.z);
        if (d <= s.range) { l.hear(s, d); heard++; }
      }
    }
    return heard;
  }
}
