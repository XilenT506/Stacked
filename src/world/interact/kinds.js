// What each of the six kinds does on top of the base Thing. Nothing here is scripted for a place:
// a thing only sends signals (and spawns what its data says), and other things react to those.
// ctx is the Things list: ctx.signals, ctx.spawn(), ctx.sound(), ctx.spots (named places from the place file).
export const KINDS = {
  // physics prop: an impact sends its signals
  prop: { onImpact: sendImpact },

  // machine or switch: use() does what def.use.type says
  machine: {
    init(t) { t.state = t.def.use?.start ?? 'off'; t.useCool = 0; t.timer = 0; t.said = -1; },
    use(t, ctx) {
      const u = t.def.use || {};
      if (t.useCool > 0) return null;
      t.useCool = u.cooldown ?? 0.3;
      ctx.sound(t);
      if (u.type === 'kick') return kick(t, ctx, u);
      if (u.type === 'tannoy') return announce(t, ctx, u);
      // toggle: flip the state and send a signal for the new state
      t.state = t.state === 'on' ? 'off' : 'on'; t.timer = 0;
      const list = t.state === 'off' ? u.signalsWhenOff : u.signalsWhenOn;
      for (const type of list || []) ctx.signals.emit({ type, position: t.position, source: t, data: { event: t.state === 'on' ? 'opened' : 'closed' } });
      if (t.state === 'on' && u.whileOn) whileOn(t, ctx, u.whileOn);
      return t.state;
    },
    // machines that keep doing something while they are on (an open freezer door keeps icing the floor)
    tick(t, ctx, dt) {
      t.useCool = Math.max(0, t.useCool - dt);
      const w = t.def.use?.whileOn;
      if (!w || t.state !== 'on') return;
      t.timer += dt;
      if (t.timer >= w.every) { t.timer = 0; whileOn(t, ctx, w); }
    },
  },

  // ride: trolleys are pushed and steered by the coat riding them; belts carry you along (src/systems/hands.js)
  ride: { init(t) { t.rider = null; }, onImpact: sendImpact },

  // hiding spot: a circle around it where a coat can hide (inside, by posing, or by standing still)
  hide: {
    init(t) { t.radius = t.def.hide?.radius ?? 0.7; t.mode = t.def.hide?.mode ?? 'stand'; },
    contains(t, p) { const c = t.position; return Math.hypot(p.x - c.x, p.z - c.z) <= t.radius; },
  },

  // disguise prop: held to blend in; dropping it makes a noise
  disguise: { init(t) { t.holder = null; }, onImpact: sendImpact },

  // food or throwable: splats; food that breaks sends its signals once, leaves its splat and is gone
  food: {
    init(t) { t.holder = null; t.squirts = t.def.squirt?.uses ?? 0; },
    onImpact(t, ctx, speed) {
      if (t.broken) return;
      sendImpact(t, ctx, speed);
      if (t.def.impact?.breaks) { t.broken = true; t.remove(); }
    },
  },
};

export function sendImpact(t, ctx, speed) {
  const im = t.def.impact || {};
  for (const type of im.signals || []) ctx.signals.emit({ type, position: t.position, source: t, range: im.range, data: { speed, event: im.event, color: t.def.splat } });
  ctx.sound(t);
}

// kick: cans (or whatever the data says) shoot out of the front
function kick(t, ctx, u) {
  const f = t.front, p = t.position, side = { x: f.z, z: -f.x };
  for (const type of u.signals || []) ctx.signals.emit({ type, position: p, source: t, data: { event: u.event } });
  const out = u.out || [0, 0.3, 0.6];
  for (let i = 0; i < (u.count || 1); i++) {
    const s = (i - (u.count - 1) / 2) * (u.gap ?? 0.22), a = (i - (u.count - 1) / 2) * (u.spread || 0);
    const pos = [p.x + f.x * out[2] + side.x * s, out[1] + 0.07, p.z + f.z * out[2] + side.z * s];
    const dir = { x: f.x + side.x * a, z: f.z + side.z * a };
    // cans come out lying down, so they roll
    const can = ctx.spawn(u.spawn, pos, { onFloor: false, yaw: t.yaw, lie: true });
    can.body.setLinvel({ x: dir.x * u.speed, y: 0, z: dir.z * u.speed }, true);
    can.prevVel = { x: dir.x * u.speed, y: 0, z: dir.z * u.speed };      // being shot out is not an impact
  }
  return 'kicked';
}

// tannoy: the next announcement; its signal goes off where the announcement sends people
function announce(t, ctx, u) {
  const list = u.announcements || []; if (!list.length) return null;
  t.said = (t.said + 1) % list.length;
  const a = list[t.said], at = ctx.spots[a.at] || [t.position.x, t.position.z];
  ctx.signals.emit({ type: 'noise', position: t.position, source: t, range: 45, data: { event: 'announce', text: a.text } });
  ctx.signals.emit({ type: a.signal, position: { x: at[0], y: 0, z: at[1] }, source: t, range: a.range, data: { event: 'announce', text: a.text } });
  ctx.announce?.(a.text);
  return a.text;
}

function whileOn(t, ctx, w) {
  const f = t.front, side = { x: f.z, z: -f.x }, [ox, oz] = w.offset || [0, 0], p = t.position;
  const at = { x: p.x + side.x * ox + f.x * oz, y: 0, z: p.z + side.z * ox + f.z * oz };
  for (const type of w.signals) ctx.signals.emit({ type, position: at, source: t, range: w.range, data: { color: w.color, event: 'freezing' } });
}
