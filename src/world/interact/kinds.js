// What each of the six kinds does on top of the base Thing.
// Kept small for now (M0-02); later prompts add riding, hiding, holding and throwing.
export const KINDS = {
  // physics prop: an impact sends its signals
  prop: { onImpact: sendImpact },

  // machine or switch: use() flips its state and sends a signal for the new state
  machine: {
    init(t) { t.state = t.def.use?.start ?? 'off'; },
    use(t, signals) {
      t.state = t.state === 'on' ? 'off' : 'on';
      const list = t.state === 'off' ? t.def.use?.signalsWhenOff : t.def.use?.signalsWhenOn;
      for (const type of list || []) signals.emit({ type, position: t.position, source: t });
      return t.state;
    },
  },

  // ride: a seat to sit on (riding comes with the coat in M0-04); impacts crash like props
  ride: { init(t) { t.rider = null; }, onImpact: sendImpact },

  // hiding spot: a circle around it where a coat counts as hidden
  hide: {
    init(t) { t.radius = t.def.hide?.radius ?? 0.7; },
    contains(t, p) { const c = t.position; return Math.hypot(p.x - c.x, p.z - c.z) <= t.radius; },
  },

  // disguise prop: can be held (holding comes later); dropping it makes a noise
  disguise: { init(t) { t.holder = null; }, onImpact: sendImpact },

  // food or throwable: splats; food that breaks sends its signals once and stays broken
  food: {
    onImpact(t, signals, speed) {
      if (t.broken) return;
      sendImpact(t, signals, speed);
      if (t.def.impact?.breaks) t.broken = true;
    },
  },
};

function sendImpact(t, signals, speed) {
  for (const type of t.def.impact?.signals || []) signals.emit({ type, position: t.position, source: t, data: { speed } });
}
