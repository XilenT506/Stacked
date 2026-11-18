// The finale: a driving test. Same three jobs, new meaning: Legs work the pedals (W / S), Arms turn the wheel
// (move the hands left and right), Head checks the mirrors and nods at Mr Price. The coat stands up in a small
// open-top car, so every sharp start, stop or swerve makes it wobble, and Mr Price notices.
// Every 30 to 45 seconds his attention slips for a few seconds: then nothing is noticed and bluffs count double.
import { CFG, E, clamp, dist, wrap } from './config.js';
import { collide } from './town.js';
import { ERRANDS, ZONES, inZ, range } from './errands.js';

const MAXV = 5.2, ACC = 3.0, BRAKE = 6.5, REV = 1.6, STEER = 0.6;
export const SEAT_SIDE = 0.36, SEAT_LIFT = -0.62;     // driver's seat: across from the examiner, and sunk in so only chest and head show
export const CAR_HALF = [0.72, 1.25];      // half width, half length

export function newCar(Wd, def) {
  const c = def.car;
  return { x: c.x, z: c.z, yaw: c.yaw, v: 0, wheel: 0, a: 0, yr: 0, bumpT: 0, curbT: 0,
    slipT: 0, slipKind: 0, nextSlip: range(Wd, def.slip.every), askT: range(Wd, def.ask), ask: 0, mirrorCd: 0,
    ml: 0, mr: 0, cones: 0, ran: 0, parkT: 0, rate: 0, stopX: range(Wd, [-1.0, 4.0]), stopT: -1, calmJerk: 0 };
}

// returns what the wobble needs: acceleration, yaw rate, and whether we hit something
export function stepCar(Wd, dt, api) {
  const c = Wd.car, b = Wd.body, o = Wd.ord;
  const pedal = clamp(o.f, -1, 1);
  c.wheel += (clamp((o.hand[0].x + o.hand[1].x) / 0.45, -1, 1) - c.wheel) * Math.min(1, dt * 10);
  const v0 = c.v;
  if (pedal > 0.05) { const want = pedal * MAXV; c.v += want > c.v ? Math.min(want - c.v, ACC * pedal * dt) : -Math.min(c.v - want, 1.2 * dt); }   // easing off the gas only coasts
  else if (pedal < -0.05) { if (c.v > 0.05) c.v = Math.max(0, c.v - BRAKE * -pedal * dt); else c.v = Math.max(-REV, c.v - ACC * 0.5 * -pedal * dt); }
  else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 0.7 * dt);
  c.yr = -c.wheel * c.v * (STEER + 0.4 * clamp(1 - (Math.abs(c.v) - 1) / 2, 0, 1));     // tighter turns at walking pace, so a U-turn fits in the street
  c.yaw += c.yr * dt;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  c.x += fx * c.v * dt; c.z += fz * c.v * dt;
  // the car is two circles, front and back, pushed out of walls
  let hit = false;
  for (const s of [1, -1]) {
    const px = c.x + fx * s * 0.7, pz = c.z + fz * s * 0.7, r = collide(px, pz, 0.72, false);
    if (r.hit) { hit = true; c.x += r.x - px; c.z += r.z - pz; }
  }
  c.bumpT = Math.max(0, c.bumpT - dt); c.curbT = Math.max(0, c.curbT - dt);
  if (hit && Math.abs(c.v) > 0.8 && c.bumpT <= 0) { c.bumpT = 1.2; b.iz += 0.7 * Math.sign(c.v); c.v *= -0.25; api.ev(E.BUMP); Wd.car.rate += 0; api.driveTell(0.15, 31); }
  // the kerbs: bump up on to the pavement
  if ((c.z < -1.25 + 0.55 || c.z > 1.95 - 0.55) && Math.abs(c.v) > 0.6 && c.curbT <= 0) { c.curbT = 1.5; b.ix += 0.4 * Math.sign(c.z - 0.35); api.ev(E.BUMP); api.driveTell(0.06, 37); }
  c.a = (c.v - v0) / dt;
  // the coat sits in the driver's seat: beside the examiner, a little back from the middle of the car
  { const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw); b.x = c.x - rx * SEAT_SIDE - Math.sin(c.yaw) * 0.2; b.z = c.z - rz * SEAT_SIDE - Math.cos(c.yaw) * 0.2; }
  b.yaw = c.yaw; b.v = c.v;
  return { a: clamp(c.a, -7, 7), yr: c.yr, hit };       // a crash jolts the coat, but not off the planet
}

// the steps of the test, Mr Price's attention, and what he notices
export function stepDrive(Wd, dt, api) {
  const c = Wd.car, b = Wd.body, o = Wd.ord, e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
  const pi = Wd.people.findIndex((p) => p.id === 'price'), P = Wd.people[pi];
  const say = (line, t = 3) => { if (P) { P.say = line; P.sayT = t; } };
  const done = () => { e.step++; e.q = 0; api.ev(E.STEP, e.step); if (e.step >= d.steps.length) { say(35, 4); api.errandDone(); } };
  // ride along in the passenger seat
  if (P) { const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw); P.x = c.x + rx * 0.42 - Math.sin(c.yaw) * 0.2; P.z = c.z + rz * 0.42 - Math.cos(c.yaw) * 0.2; P.yaw = c.yaw + (c.slipT > 0 ? -2.2 : 0.5); }     // looking away out of his side of the car during a slip
  // attention slips: a clipboard, a sneeze, a phone call
  if (c.slipT > 0) { c.slipT -= dt; if (c.slipT <= 0) { api.ev(E.LAPSEEND); c.nextSlip = range(Wd, d.slip.every); } }
  else { c.nextSlip -= dt; if (c.nextSlip <= 0 && Wd.phase === 'play') { c.slipT = range(Wd, d.slip.lasts); c.slipKind = Math.floor(Math.random() * 3); say(28 + c.slipKind, c.slipT); api.ev(E.LAPSE, c.slipKind); } }
  const slip = c.slipT > 0;
  // small talk: he asks something every so often and expects a nod
  c.mirrorCd = Math.max(0, c.mirrorCd - dt);
  if (c.ask > 0) {
    c.ask -= dt;
    if (o.nod) { c.ask = 0; api.calm(pi, 0.12, true); say(13, 2); }
    else if (c.ask <= 0) { api.driveTell(0.12, 15); }
  } else if (!slip) { c.askT -= dt; if (c.askT <= 0) { c.askT = range(Wd, d.ask); c.ask = 3.2; say(27, 3.2); } }
  // a glance at the mirrors without being asked is very adult
  if (Math.abs(o.hy) > 0.75 && c.mirrorCd <= 0 && e.step > 0) { c.mirrorCd = 10; api.calm(pi, 0.04, true); }
  // what he notices about the driving
  let rate = 0;
  c.calmJerk = Math.max(0, c.calmJerk - dt);
  if (Math.abs(c.a) > 2.0 && c.calmJerk <= 0) rate += Math.min(0.35, (Math.abs(c.a) - 2.0) * 0.15);
  c.wobbleWheel = (c.wobbleWheel || 0) * Math.exp(-dt * 2) + Math.abs(c.wheel - (c.lastWheel ?? c.wheel)); c.lastWheel = c.wheel;
  if (c.wobbleWheel > 0.9) rate += (c.wobbleWheel - 0.9) * 0.2;          // sawing hard at the wheel looks nervous
  if (c.v > 3.5) rate += 0.12;
  if (Math.abs(c.yr) > 0.7 && Math.abs(c.v) > 1) rate += 0.1;
  const L = Math.hypot(b.lx, b.lz) / CFG.fallLean;
  if (b.down) rate += 0.6; else if (L > 0.5) rate += Math.min(0.5, (L - 0.5) * 1.1);
  if (Math.max(b.fl[0], b.fl[1]) > 2.2) rate += 0.12;
  const smooth = Math.abs(c.v) > 0.5 && Math.abs(c.a) < 1.2 && Math.abs(c.yr) < 0.5;
  c.rate = slip ? 0 : rate;
  if (P && Wd.phase === 'play') {
    const soothe = (smooth ? 0.014 : 0.004) * (slip ? 2 : 1);
    P.sus = clamp(P.sus + (c.rate > 0 ? c.rate * Wd.notice : -soothe) * dt, 0, 1);
    P.peak = Math.max(P.peak || 0, P.sus);
    if (P.sus >= 1) api.bust(pi);
  }
  // cones: knock one over and he writes something down
  d.cones.forEach(([x, z], i) => {
    if (Wd.cones & (1 << i)) return;
    for (const s of [1, 0, -1]) {
      const px = c.x + Math.sin(c.yaw) * s * 0.8, pz = c.z + Math.cos(c.yaw) * s * 0.8;
      if (dist(px, pz, x, z) < 0.62) { Wd.cones |= 1 << i; api.ev(E.CLANG); api.driveTell(0.08, 31); break; }
    }
  });
  if (!st) return;
  // crawling along on a driving step is what a nervous child would do
  if (['stopline', 'cones', 'estop'].includes(st.type) && c.stopT < 0) {
    c.slowT = Math.abs(c.v) < 0.8 ? (c.slowT || 0) + dt : Math.max(0, (c.slowT || 0) - dt * 2);
    if (c.slowT > 4.2) { c.slowT = 0; api.driveTell(0.12, 42); }
  }
  if (st.type === 'mirrors') {
    if (e.q === 0 && e.asked !== e.step) { e.asked = e.step; c.ml = c.mr = 0; say(26, 4); }
    if (o.hy > 0.75) c.ml += dt; if (o.hy < -0.75) c.mr += dt;
    if (c.ml > 0.35 && c.mr > 0.35) { api.calm(pi, 0.06, true); say(36, 2.5); done(); }
  } else if (st.type === 'stopline') {
    const z = ZONES[st.zone], front = c.x + Math.sin(c.yaw) * CAR_HALF[1];
    if (front > z.x1 + 0.8 && !c.ran) { c.ran = 1; say(34, 3); api.driveTell(0.15, 34); done(); }
    else if (inZ(z, front, c.z) && Math.abs(c.v) < 0.15) { e.q += dt; if (e.q > 0.5) { api.calm(pi, 0.1, true); say(13, 2.5); done(); } }
  } else if (st.type === 'cones') { if (e.q === 0 && !e.coneSaid) { e.coneSaid = 1; say(31, 3); } if (c.x > st.x) done(); }
  else if (st.type === 'turn') {
    if (e.turnSaid !== e.step) { e.turnSaid = e.step; say(41, 3); }
    if (Math.abs(wrap(c.yaw - st.yaw)) < 0.35 && Math.abs(c.v) < 1.5) done();
  } else if (st.type === 'estop') {
    // driving back: somewhere along the street he shouts STOP, and the legs have to stamp on the brake
    if (c.stopT < 0 && c.x < c.stopX && Math.abs(c.v) > 0.8) { c.stopT = 0; c.calmJerk = st.secs + 1; say(38, 2); api.ev(E.BUMP); }
    if (c.stopT >= 0) {
      c.stopT += dt;
      if (Math.abs(c.v) < 0.25) { api.calm(pi, 0.1, true); say(39, 2.5); done(); }
      else if (c.stopT > st.secs) { api.driveTell(0.3, 40); done(); }
    }
  } else if (st.type === 'park') {
    if (e.parkSaid !== e.step) { e.parkSaid = e.step; say(33, 3); }
    const z = ZONES[st.zone];
    const inside = c.x - CAR_HALF[1] * 0.8 > z.x0 && c.x + CAR_HALF[1] * 0.8 < z.x1 && c.z - 0.5 > z.z0 && c.z + 0.5 < z.z1 && Math.abs(Math.cos(c.yaw)) < 0.35;
    if (inside && Math.abs(c.v) < 0.1) { e.q += dt; if (e.q >= st.secs) done(); } else e.q = Math.max(0, e.q - dt);
  }
}

export const slipping = (Wd) => !!(Wd.car && Wd.car.slipT > 0);
export const steerDir = (c) => wrap(c.yaw);
