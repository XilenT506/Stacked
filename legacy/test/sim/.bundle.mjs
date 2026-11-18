// test/sim/setup.js
import * as THREE from "three";
globalThis.THREE = THREE;
globalThis.document ||= { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) };

// js/config.js
var T = globalThis.THREE;
var TAU = Math.PI * 2;
var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
var ease = (dt, rate) => 1 - Math.exp(-rate * dt);
var wrap = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
var dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
var fwd = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
var rgt = (yaw) => [-Math.cos(yaw), Math.sin(yaw)];
var yawTo = (dx, dz) => Math.atan2(dx, dz);
var r2 = (v) => Math.round(v * 100) / 100;
var PAL = {
  sky: 16306084,
  fog: 16172442,
  ground: 15186319,
  road: 12159602,
  pave: 15914675,
  cream: 16444630,
  peach: 15773834,
  terracotta: 13199690,
  teal: 5212811,
  mustard: 14723130,
  coat: 7030840,
  collar: 8016708,
  hat: 6177846,
  band: 12091466,
  skin: 15907212,
  hair: 11880494,
  bag: 8367694,
  wood: 10116924,
  stone: 15983560,
  glow: 16767370,
  leaf: 8365648,
  pot: 13203536,
  lamp: 3024418,
  frame: 4161408,
  alley: 9418122,
  wet: 8370121,
  coin: 15909424,
  ink: 1777482,
  white: 16775146,
  kids: [14838095, 5218249, 8372063, 14723130],
  people: [9198240, 5210015, 4153210]
};
var CFG = {
  // walking
  walkSpeed: 2.2,
  tipSpeed: 0.9,
  walkAccel: 6,
  tipAccel: 2.5,
  turnRate: 1.9,
  bodyR: 0.32,
  strideSpeed: 3,
  strideAccel: 8,
  strideWobble: 1.25,
  shuffleSpeed: 0.55,
  shuffleAccel: 3,
  shuffleSteady: 1.6,
  // disguise: points needed for levels 1, 2, 3; platform shoes add height and take away balance
  levels: [3, 7, 12],
  platform: 0.18,
  platformSteady: 0.85,
  disguiseFool: 0.85,
  // wobble: a broom balanced on a hand
  restore: 14,
  damping: 2.2,
  tipForce: 9,
  safeLean: 0.22,
  stumLean: 0.4,
  fallLean: 0.55,
  accelToLean: 0.4,
  handToLean: 3,
  giggle: 0.35,
  downTime: 2.6,
  // kids
  kidH: 0.55,
  kidSpeed: 4.3,
  kidR: 0.2,
  // townspeople
  sightRange: 9,
  sightHalf: 1.05,
  chaseSpeed: 2.9,
  shock: 3.5,
  greetGap: 4,
  strollSpeed: 1.15,
  // the afternoon
  clock: 200,
  startMoney: 20,
  scatterTime: 20
};
var E = {
  FALL: 1,
  STUMBLE: 2,
  RIP: 3,
  GASP: 4,
  REGISTER: 5,
  YELP: 6,
  CLANG: 7,
  COIN: 8,
  SLIP: 9,
  CAUGHT: 10,
  FREED: 11,
  RESTACK: 12,
  BANNER: 13,
  DROP: 14,
  HOPOUT: 15,
  HOPIN: 16,
  SWAP: 17,
  HAT: 18,
  SIGNED: 19,
  END: 20,
  UP: 21,
  CALM: 22,
  BUMP: 23,
  GRAB: 24,
  PAT: 25,
  POINT: 26,
  LEVEL: 27,
  LOOK: 28,
  WORST: 29,
  STEP: 30,
  LAPSE: 31,
  LAPSEEND: 32,
  GUST: 33,
  HIC: 34,
  NEXT: 35,
  ASK: 36
};
var GAIT = { WALK: 0, TIPTOE: 1, STRIDE: 2, SHUFFLE: 3 };
var levelFor = (pts) => CFG.levels.filter((n) => pts >= n).length;

// js/town.js
var W = (x0, z0, x1, z1, h, kind = "wall", color = PAL.cream) => ({ x0, z0, x1, z1, h, kind, color });
var TOWN = {
  start: { x: -7.6, z: -5, yaw: 0 },
  alley: { x0: -8.85, z0: -6.85, x1: -5.15, z1: -2.75 },
  bank: { x0: -3.85, z0: 3.65, x1: 3.85, z1: 10.85 },
  queue: { x: 0, z: 6.3, r: 0.6 },
  counterSpot: { x: 0.3, z: 7.8, r: 0.9 },
  exit: { x: 8.5, z: 0.2, r: 1.4 },
  bench: { x: 5.5, z: -3.3 },
  wet: { x: 0.45, z: 4.65, r: 0.65 },
  paper: { x0: 0.2, x1: -0.3, y: 1.02, z: 8.45, hx: 0.27, hz: 8.57 },
  // signed from x0 to x1 (left to right for the signer); hx, hz: where the other hand holds it flat
  bagHome: { x: 0.8, y: 1.13, z: 8.45 },
  coins: [{ x: -2, z: 0.9 }, { x: -2.2, z: 5.6 }, { x: 2.3, z: 6.6 }],
  kidCoin: { x: -1.6, z: 8.6 },
  walls: [
    // bank
    W(-4.15, 10.85, 4.15, 11.15, 3),
    W(-4.15, 3.5, -3.85, 11, 3),
    W(3.85, 3.5, 4.15, 11, 3),
    W(-4.15, 3.35, -1.1, 3.65, 3),
    W(1.1, 3.35, 4.15, 3.65, 3),
    W(-3, 8.2, 3, 9, 1, "counter", PAL.wood),
    // Mabel's corner stall and the cinema snack cart
    W(-9.1, 2.55, -7.5, 2.95, 1, "counter", PAL.wood),
    W(1.5, -3.95, 3.25, -3.55, 1, "counter", 13199690),
    W(2.9, 4, 3.5, 4.6, 1.3, "plant", PAL.teal),
    // alley: walls on three sides and a half wall across the mouth
    W(-9.15, -7, -8.85, -2.6, 2.6, "wall", PAL.peach),
    W(-5.15, -7, -4.85, -2.6, 2.6, "wall", PAL.peach),
    W(-9.15, -7.15, -4.85, -6.85, 2.6, "wall", PAL.peach),
    W(-9.15, -2.75, -6.4, -2.45, 2.6, "wall", PAL.peach),
    // other buildings
    W(-4.6, -9, 11.7, -4.2, 3.6, "shop", PAL.peach),
    W(-12, -9, -9.4, -2.6, 3.4, "shop", PAL.cream),
    W(-12, 3.5, -4.6, 10, 3.4, "shop", PAL.terracotta),
    W(4.6, 3.5, 12, 10, 3.8, "shop", PAL.mustard),
    // edges of the world
    W(-12.4, -9, -12, 11, 0, "edge"),
    W(12, -9, 12.4, 11, 0, "edge")
  ],
  props: [
    { name: "bin", x: -3.2, z: 2.7, r: 0.3 },
    { name: "crates", x: -4.3, z: -3, r: 0.45 },
    { name: "bucket", x: 1.35, z: 4.2, r: 0.25 },
    { name: "rope post", x: -0.95, z: 6.3, r: 0.12 },
    { name: "rope post", x: 0.95, z: 6.3, r: 0.12 },
    { name: "traffic cone", x: 3, z: -1.9, r: 0.22 }
  ]
};
var inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
var inAlley = (x, z) => inRect(TOWN.alley, x, z);
var inBank = (x, z) => inRect(TOWN.bank, x, z);
var inZone = (zn, x, z) => dist(zn.x, zn.z, x, z) < zn.r;
function collide(x, z, r, kid) {
  let hit = false;
  for (const w of TOWN.walls) {
    if (kid && w.kind === "counter") continue;
    const cx = x < w.x0 ? w.x0 : x > w.x1 ? w.x1 : x;
    const cz = z < w.z0 ? w.z0 : z > w.z1 ? w.z1 : z;
    let dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      x = cx + dx / d * r;
      z = cz + dz / d * r;
    } else {
      const l = x - w.x0, rr = w.x1 - x, b = z - w.z0, t = w.z1 - z;
      const m = Math.min(l, rr, b, t);
      if (m === l) x = w.x0 - r;
      else if (m === rr) x = w.x1 + r;
      else if (m === b) z = w.z0 - r;
      else z = w.z1 + r;
    }
  }
  return { x, z, hit };
}
function los(ax, az, bx, bz, cam = false) {
  const dx = bx - ax, dz = bz - az;
  for (const w of TOWN.walls) {
    if (w.kind === "counter" || w.kind === "plant" || w.kind === "edge" && !cam) continue;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) {
      if (ax < w.x0 || ax > w.x1) continue;
    } else {
      let a = (w.x0 - ax) / dx, b = (w.x1 - ax) / dx;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) {
      if (az < w.z0 || az > w.z1) continue;
    } else {
      let a = (w.z0 - az) / dz, b = (w.z1 - az) / dz;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) continue;
    }
    return false;
  }
  return true;
}
var _bp = new T.Vector3();

// js/data/errands.json
var errands_default = {
  story: [
    "shop",
    "bank",
    "cinema",
    "drive"
  ],
  survival: [
    "shop",
    "bank",
    "cinema"
  ],
  zones: {
    alley: {
      x0: -8.85,
      z0: -6.85,
      x1: -5.15,
      z1: -2.75
    },
    bank: {
      x0: -3.85,
      z0: 3.65,
      x1: 3.85,
      z1: 10.85
    },
    corner: {
      x: 8.5,
      z: 0.2,
      r: 1.4
    },
    queue: {
      x: 0,
      z: 6.3,
      r: 0.6
    },
    counter: {
      x: 0.3,
      z: 7.8,
      r: 0.9
    },
    shopFront: {
      x: -8.3,
      z: 1.95,
      r: 0.6
    },
    cartFront: {
      x: 2.35,
      z: -3.05,
      r: 0.7
    },
    check: {
      x: 9.2,
      z: -3.05,
      r: 0.6
    },
    door: {
      x: 9.2,
      z: -3.75,
      r: 0.55
    },
    line: {
      x0: -3.7,
      z0: -1.25,
      x1: -2.5,
      z1: 1.95
    },
    box: {
      x0: 8.2,
      z0: -0.55,
      x1: 11,
      z1: 1.25
    },
    box2: {
      x0: -9.9,
      z0: -0.55,
      x1: -7.1,
      z1: 1.25
    }
  },
  items: {
    milk: {
      name: "the milk",
      kind: "milk",
      home: [
        -8.05,
        1.14,
        2.75
      ]
    },
    cash: {
      name: "the cash",
      kind: "cash",
      home: [
        0.8,
        1.13,
        8.45
      ]
    },
    popcorn: {
      name: "the popcorn",
      kind: "popcorn",
      home: [
        2,
        1.16,
        -3.75
      ]
    },
    drink: {
      name: "the drink",
      kind: "drink",
      home: [
        2.75,
        1.16,
        -3.75
      ]
    }
  },
  errands: {
    shop: {
      name: "Corner shop",
      intro: "Mum needs milk. Buy one bottle at Mabel's stall and bring it back to the alley.",
      target: [
        120,
        180
      ],
      clock: 360,
      notice: 0.7,
      hints: true,
      people: [
        "mabel",
        "gus"
      ],
      items: [
        "milk"
      ],
      mods: [],
      steps: [
        {
          type: "goto",
          zone: "shopFront",
          text: "Walk out of the alley and across the road to Mabel's stall.",
          hint: {
            legs: "Hold W to walk, A and D to turn.",
            arms: "Nothing to grab yet. Keep the hands still: flapping hands look odd.",
            head: "Look around with the mouse. Nod (N) if someone says hello.",
            all: "Hold W to walk, A and D to turn. Out of the alley to the right, then across to Mabel's stall."
          }
        },
        {
          type: "still",
          zone: "shopFront",
          secs: 2.5,
          who: "mabel",
          say: 22,
          text: "Stand still and wait for Mabel.",
          hint: {
            legs: "Stop and stand still on the spot.",
            arms: "Wait. Still hands.",
            head: "Look at Mabel. A nod is polite.",
            all: "Let go of W and stand still. If Mabel says hello, press N to nod."
          }
        },
        {
          type: "grab",
          items: [
            "milk"
          ],
          text: "Take the milk from the counter.",
          hint: {
            legs: "Stay put. Step closer only if the arms say 'too far'.",
            arms: "Move a hand to the glowing ring, then G to grab.",
            head: "Keep Mabel happy: nod if she looks at you.",
            all: "Hold G: the hand reaches for the milk and grabs it."
          }
        },
        {
          type: "talk",
          who: "mabel",
          secs: 1,
          pay: 2,
          say: 23,
          text: "Say thank you to Mabel.",
          hint: {
            legs: "Stand still.",
            arms: "Hold on to the milk.",
            head: "Press T and say thank you out loud (or Enter to type it, or hold Space to mumble).",
            all: "Press T and say thank you out loud (or Enter to type it)."
          }
        },
        {
          type: "carry",
          items: [
            "milk"
          ],
          zone: "alley",
          text: "Carry the milk back to the alley.",
          hint: {
            legs: "Walk back. Heavy hands wobble: no sharp turns.",
            arms: "Don't let go of the milk.",
            head: "Watch for Gus. Nod back if he says hello.",
            all: "Walk the milk back to the alley. Go slowly: a heavy hand leans the coat."
          }
        }
      ]
    },
    bank: {
      name: "Bank",
      intro: "Dad's birthday money is waiting at the bank. Queue, sign for it, take the cash out to the corner.",
      target: [
        180,
        240
      ],
      clock: 420,
      notice: 1.25,
      people: [
        "ruth",
        "gus",
        "hale"
      ],
      items: [
        "cash"
      ],
      mods: [
        "heavy"
      ],
      steps: [
        {
          type: "goto",
          zone: "bank",
          text: "Walk into the bank."
        },
        {
          type: "still",
          zone: "queue",
          secs: 4,
          who: "ruth",
          say: 20,
          text: "Stand still in the queue."
        },
        {
          type: "sign",
          text: "Hold the form flat with one hand and sign with the other."
        },
        {
          type: "grab",
          items: [
            "cash"
          ],
          text: "Take the cash."
        },
        {
          type: "carry",
          items: [
            "cash"
          ],
          zone: "corner",
          text: "Carry the cash out to the corner."
        }
      ]
    },
    cinema: {
      name: "Cinema",
      intro: "A grown-up film. Get snacks from the cart, pass Pip's height check at the door, and get in.",
      target: [
        240,
        300
      ],
      clock: 480,
      notice: 1.15,
      people: [
        "pip",
        "gus",
        "dot",
        "hale"
      ],
      items: [
        "popcorn",
        "drink"
      ],
      mods: [],
      steps: [
        {
          type: "goto",
          zone: "cartFront",
          text: "Walk to the snack cart."
        },
        {
          type: "grab",
          items: [
            "popcorn",
            "drink"
          ],
          text: "Take the popcorn and the drink, one in each hand."
        },
        {
          type: "carry",
          items: [
            "popcorn",
            "drink"
          ],
          zone: "check",
          text: "Carry both snacks to the cinema door."
        },
        {
          type: "tall",
          zone: "check",
          secs: 2.5,
          who: "pip",
          text: "Height check! Stand still and stand tall (Legs: hold Shift to go on tiptoe)."
        },
        {
          type: "talk",
          who: "pip",
          secs: 1,
          say: 25,
          text: "Ask Pip for one ticket (Head: press T and ask him, or hold Space to mumble)."
        },
        {
          type: "carry",
          items: [
            "popcorn",
            "drink"
          ],
          zone: "door",
          text: "Walk in through the door with both snacks."
        }
      ]
    },
    drive: {
      name: "Driving test",
      intro: `The finale. Pass Mr Price's driving test before his "?" fills up. Legs: pedals. Arms: the wheel. Head: mirrors and nodding.`,
      target: [
        240,
        360
      ],
      clock: 600,
      notice: 1.2,
      drive: true,
      people: [
        "price"
      ],
      items: [],
      mods: [],
      slip: {
        every: [
          30,
          45
        ],
        lasts: [
          3,
          5
        ]
      },
      steps: [
        {
          type: "mirrors",
          text: "Check your mirrors: Head looks left, then right."
        },
        {
          type: "stopline",
          zone: "line",
          text: "Drive to the stop line and stop on it (only the Legs can see it)."
        },
        {
          type: "cones",
          x: 7.6,
          text: "Weave through the cones without knocking any over."
        },
        {
          type: "turn",
          yaw: -1.5708,
          text: "Turn the car around in the road (forward, back, forward is fine)."
        },
        {
          type: "estop",
          x0: 4,
          x1: -1,
          secs: 1.4,
          text: "Drive back down the street. When Mr Price shouts STOP, stop!"
        },
        {
          type: "mirrors",
          text: "Check your mirrors again before you pull away."
        },
        {
          type: "park",
          zone: "box2",
          secs: 1.5,
          text: "Park in the box by the corner shop (only the Legs can see it)."
        }
      ],
      car: {
        x: -10.2,
        z: 0.35,
        yaw: 1.5708
      },
      cones: [
        [
          0,
          1.05
        ],
        [
          2.6,
          -0.35
        ],
        [
          5.2,
          1.05
        ]
      ],
      ask: [
        9,
        13
      ]
    }
  }
};

// js/data/people.json
var people_default = {
  ruth: { name: "Ruth", job: "bank teller", kind: "clerk", look: "teller", x: 0.3, z: 9.8, yaw: 3.1416, quotes: ['"Very tall. Very polite. Slightly giggly."', '"He swayed a lot. I gave him the money anyway."', '"Three children fell out of a man today."'], asks: ["And what do you do for a living, sir?", "Is this account for you, sir? Date of birth?", "You seem... shorter than your signature. Explain?"], voice: "Precise, polite bank teller. Loves forms, rules and correct spelling. Dry. Says 'sir' a lot and 'I'll just need...' constantly." },
  gus: { name: "Gus", job: "out for a walk", kind: "walker", look: "walker", x: -10.5, z: 1.3, yaw: 1.5708, patrol: [-10.5, 10.5], quotes: ['"Nice fellow. Nodded at me twice."', '"Odd walk. Like a ladder in a coat."', '"I chased a small boy round a bench. I am sixty-one."'], asks: ["Haven't seen you round here. New in town?", "Off anywhere nice, then?", "Your coat just giggled. Did your coat giggle?"], voice: "Chatty retired man on his walk. Rambles about the old days, his allotment and his bad knee. Easily distracted, cheerful, a bit deaf." },
  hale: { name: "Officer Hale", job: "on the beat", kind: "guard", look: "guard", x: 2.4, z: 2.6, yaw: 3.1416, sweep: 0.95, quotes: ['"Nothing to report."', '"Kept an eye on him. Mostly the middle of him."', '"I counted three of them. One was holding the hat."'], asks: ["Name and age, sir?", "Where are you headed in such a hurry?", "Why is your middle wobbling, sir?"], voice: "Pompous village policeman who has never solved a crime. Loves procedure, notebooks and saying 'Hmm, I see' and 'Move along'. Very proud of his moustache." },
  mabel: { name: "Mabel", job: "runs the corner stall", kind: "clerk", look: "shop", x: -8.3, z: 3.25, yaw: 3.1416, quotes: ['"Lovely manners. Bought milk like a grown-up."', '"His tummy said thank you. In a different voice."', '"The milk ran off on six little legs."'], asks: ["Sure you're old enough for this, dear?", "What's the milk for, love?", "Your tummy keeps talking. You alright?"], voice: "Warm, gossipy stall lady. Calls everyone 'love' and 'dear', knows everyone's business, offers cake, notices everything." },
  pip: { name: "Pip", job: "cinema usher", kind: "guard", look: "usher", x: 10.3, z: -3.5, yaw: -0.7, sweep: 0.6, quotes: ['"Tall enough. Only just."', '"He measured taller each time I looked."', '"Three tickets for one coat. I want a raise."'], asks: ["How old are you, exactly, sir?", "Is that one ticket or three, sir?", "Why have you got six shoes, sir?"], voice: "Nervous teenage cinema usher who takes the height rule extremely seriously. Squeaky, over-polite, quotes the rulebook." },
  dot: { name: "Dot", job: "nosy neighbour", kind: "walker", look: "nosy", x: -9.5, z: -3, yaw: 1.5708, patrol: [-9.5, 7.5], quotes: ['"I see everything. That was a gentleman."', '"His shoes did not match. I made a note."', '"I told you so. I tell everyone so."'], asks: ["And who might YOU be?", "Does your mother know you're out?", "I know every grown-up on this street. Which one are you?"], voice: "Nosy neighbour who writes everything down. Suspicious of everyone, loves a scandal, says 'I'll be watching you'." },
  kev: { name: "Kev", job: "paper boy", kind: "walker", look: "paper", x: 10, z: 2.5, yaw: -1.5708, patrol: [-10, 10], quotes: ['"Gave me a tip. A small one."', '"His coat laughed at my joke."', '"That was my cousin in there!"'], asks: ["Oi mister, you look well young. How old are ya?", "What's your favourite football team then?", "Is that a kid in your coat?"], voice: "Cheeky paperboy, about 14. Street-smart, slangy, teases, suspects the coat but finds it hilarious." },
  nan: { name: "Nan Ivy", job: "on her bench", kind: "guard", look: "nan", x: 5.5, z: -2.85, yaw: 0, sweep: 1.3, quotes: ['"Such a nice tall boy."', '"In my day coats had one person in them."', '"I knew. I always know."'], asks: ["Ooh, aren't you a tall boy. How old are you, dear?", "Have you eaten your greens today?", "Are you courting, young man?"], voice: "Sweet, slightly confused grandma on her bench. Thinks everyone is a lovely young man, talks about her late husband and knitting." },
  bert: { name: "Bert", job: "window cleaner", kind: "walker", look: "worker", x: 6, z: 2.4, yaw: -1.5708, patrol: [-6, 6], quotes: ['"Nice day for it."', '"Wobbled like my ladder."', '"I fell off my ladder watching that."'], asks: ["Lovely day for it, eh? What line of work you in?", "You want your windows done, mate?", "Is your coat... breathing?"], voice: "Cheerful window cleaner on his ladder. Loves a pun and a natter about the weather, whistles a lot." },
  price: { name: "Mr Price", job: "driving examiner", kind: "examiner", look: "examiner", x: -10, z: 0.35, yaw: 1.5708, quotes: ['"Smooth, attentive, adult. A pass."', '"He nodded at every question. Every one."', '"The driver had six feet. Fail."'], asks: ["So. How long have you been driving?", "What's the speed limit on this street?", "Any pets at home, sir?"], voice: "Stern, dry driving examiner with a clipboard. Speaks in short clipped sentences, ticks boxes, unimpressed by everything, secretly loves rules about mirrors." }
};

// js/data/modifiers.json
var modifiers_default = {
  survivalOrder: ["person:dot", "mod:windy", "person:kev", "mod:slippery", "person:nan", "mod:hiccups", "person:bert", "mod:short", "mod:heavy"],
  mods: {
    heavy: { name: "Heavy pockets", text: "Pockets full of coins: every reach leans more.", handLean: 1.25 },
    windy: { name: "Windy day", text: "Gusts push the coat about.", gust: [5, 9], gustPower: 0.75 },
    slippery: { name: "Slippery shoes", text: "New shoes: slow to stop, slow to start.", accel: 0.45 },
    hiccups: { name: "Hiccups", text: "Somebody in the coat has the hiccups.", hiccup: [6, 10], hicPower: 0.55, hicTell: 0.06 },
    short: { name: "Coat too short", text: "The coat shrank in the wash: grown-ups notice faster.", notice: 1.25 }
  }
};

// js/errands.js
var ERRANDS = errands_default.errands;
var ZONES = errands_default.zones;
var ITEMS = errands_default.items;
var PDEF = people_default;
var MODS = modifiers_default.mods;
var STORY = errands_default.story;
var SURVIVAL = errands_default.survival;
var SURVIVAL_ORDER = modifiers_default.survivalOrder;
var inZ = (z, x, y) => z.r !== void 0 ? inZone(z, x, y) : inRect(z, x, y);
var zoneCentre = (z) => z.r !== void 0 ? { x: z.x, z: z.z } : { x: (z.x0 + z.x1) / 2, z: (z.z0 + z.z1) / 2 };
var personDef = (Wd, i) => PDEF[Wd.people[i]?.id] || { name: "Someone", job: "", quotes: ["", "", ""] };
function rnd(Wd) {
  let t = Wd.seed = Wd.seed + 1831565813 | 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
var range = (Wd, [a, b]) => a + (b - a) * rnd(Wd);
function mergeMods(list) {
  const m = { handLean: 1, accel: 1, notice: 1, gust: null, gustPower: 0, hiccup: null, hicPower: 0, hicTell: 0 };
  for (const id of list) {
    const d = MODS[id];
    if (!d) continue;
    if (d.handLean) m.handLean *= d.handLean;
    if (d.accel) m.accel *= d.accel;
    if (d.notice) m.notice *= d.notice;
    if (d.gust) {
      m.gust = d.gust;
      m.gustPower = d.gustPower;
    }
    if (d.hiccup) {
      m.hiccup = d.hiccup;
      m.hicPower = d.hicPower;
      m.hicTell = d.hicTell;
    }
  }
  return m;
}
function errandSetup(id, extraPeople = [], extraMods = []) {
  const d = ERRANDS[id];
  const people = [...d.people, ...extraPeople.filter((p) => !d.people.includes(p))];
  const mods = [.../* @__PURE__ */ new Set([...d.mods, ...extraMods])];
  const items = d.items.map((k) => {
    const it = ITEMS[k];
    return { id: k, kind: it.kind, x: it.home[0], y: it.home[1], z: it.home[2], vy: 0, held: -1 };
  });
  return { d, people, mods, items };
}
function heldItem(Wd, hand) {
  return Wd.items.find((it) => it.held === hand) || null;
}
var holdingAll = (Wd, ids) => ids.every((k) => {
  const it = Wd.items.find((x) => x.id === k);
  return it && it.held >= 0;
});
function stepErrand(Wd, dt, api, people) {
  const e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
  if (!st || d.drive) return;
  const b = Wd.body, o = Wd.ord;
  const who = st.who ? Wd.people.findIndex((p) => p.id === st.who) : -1;
  const sayW = (line, t = 3.5) => {
    if (who >= 0) {
      Wd.people[who].say = line;
      Wd.people[who].sayT = t;
    }
  };
  const done = () => {
    e.step++;
    e.q = 0;
    e.t2 = 0;
    api.ev(E.STEP, e.step);
    if (e.step >= d.steps.length) api.errandDone();
  };
  const z = st.zone ? ZONES[st.zone] : null;
  const steadyBody = Math.abs(b.v) < 0.15 && Math.hypot(b.lx, b.lz) < 0.3 && !b.down;
  if (st.type === "goto") {
    if (inZ(z, b.x, b.z)) done();
  } else if (st.type === "still") {
    const ok = inZ(z, b.x, b.z) && steadyBody;
    e.q = ok ? e.q + dt : Math.max(0, e.q - dt * 2);
    if (e.q >= st.secs * 0.4 && !e.said) {
      e.said = 1;
      if (st.say !== void 0) sayW(st.say);
    }
    if (e.q >= st.secs) {
      e.said = 0;
      done();
    }
  } else if (st.type === "grab") {
    if (holdingAll(Wd, st.items)) done();
  } else if (st.type === "carry") {
    if (holdingAll(Wd, st.items) && inZ(z, b.x, b.z)) done();
  } else if (st.type === "talk") {
    const p = Wd.people[who];
    const facing = p && Math.abs(wrap(yawTo(p.x - b.x, p.z - b.z) - (b.yaw + o.hy))) < 0.75;
    const ok = p && o.talk && facing && dist(p.x, p.z, b.x, b.z) < 3.4 && !b.down;
    e.q = ok ? e.q + dt : Math.max(0, e.q - dt);
    if (e.q >= st.secs || e.talked) {
      if (st.pay) Wd.money = Math.max(0, Wd.money - st.pay);
      if (st.say !== void 0 && !e.talked) sayW(st.say);
      api.calm(who, 0.1, true);
      e.talked = 0;
      done();
    }
  } else if (st.type === "tall") {
    const inside = inZ(z, b.x, b.z);
    const tall = (o.gait === GAIT.TIPTOE || b.lift > 0) && b.count >= 3;
    const ok = inside && tall && steadyBody;
    e.q = ok ? e.q + dt : Math.max(0, e.q - dt * 1.5);
    if (inside && !tall && steadyBody) {
      e.t2 = (e.t2 || 0) + dt;
      if (e.t2 > 3) {
        e.t2 = 0;
        sayW(24, 2.5);
        if (who >= 0) people.addSus(who, 0.1);
      }
    } else e.t2 = 0;
    if (e.q >= 1 && !e.doubt) {
      e.doubt = 1;
      sayW(24, 1.8);
    }
    if (e.q >= st.secs) {
      e.doubt = 0;
      if (who >= 0) api.calm(who, 0.12, true);
      sayW(13, 2);
      done();
    }
  } else if (st.type === "sign") stepSign(Wd, dt, api);
}
function stepSign(Wd, dt, api) {
  const e = Wd.errand, teller = Wd.people.findIndex((p) => p.id === "ruth");
  const sayT = (line) => {
    if (teller >= 0) {
      Wd.people[teller].say = line;
      Wd.people[teller].sayT = 4;
    }
  };
  const P = TOWN.paper, len = P.x0 - P.x1;
  const onHold = (h) => Math.abs(h.y - P.y) < 0.1 && Math.hypot(h.x - P.hx, h.z - P.hz) < 0.13;
  e.steady = 0;
  Wd.hands.forEach((h, i) => {
    if (Math.abs(h.y - P.y) > 0.09 || Math.abs(h.z - P.z) > 0.2) return;
    const u = (P.x0 - h.x) / len;
    if (u > e.sign && u < e.sign + 0.3 && u > -0.2) {
      const steady = onHold(Wd.hands[1 - i]);
      e.steady = steady ? 1 : 0;
      e.sign = Math.min(1, u);
      e.mess += Math.abs(h.z - P.z) + (steady ? 0 : 0.07);
      e.n++;
      if (!steady && !e.warned && e.sign > 0.15) {
        e.warned = 1;
        sayT(21);
      }
    }
  });
  if (Wd.hands.some(onHold)) e.steady = 1;
  if (e.sign >= 0.95) {
    e.messy = e.n > 0 && e.mess / e.n > 0.05 ? 1 : 0;
    api.ev(E.SIGNED);
    if (e.messy) {
      if (teller >= 0) Wd.people[teller].sus = clamp(Wd.people[teller].sus + 0.2, 0, 1);
      sayT(6);
      api.worst(5);
    } else {
      if (teller >= 0) api.calm(teller, 0.3, true);
      sayT(7);
    }
    e.step++;
    e.q = 0;
    api.ev(E.STEP, e.step);
  }
}
function rankErrand(r) {
  if (!r.ok) return { rank: "D", pts: 0, why: [r.fail || "Errand failed"] };
  const tgt = ERRANDS[r.id].target[1];
  const tp = r.time <= tgt ? 2 : r.time <= tgt * 1.5 ? 1 : 0;
  const sp = r.scatters === 0 ? 2 : r.scatters === 1 ? 1 : 0;
  const mp = r.peak < 0.5 ? 2 : r.peak < 0.85 ? 1 : 0;
  const pts = tp + sp + mp;
  const rank = pts >= 6 ? "S" : pts === 5 ? "A" : pts >= 3 ? "B" : "C";
  return { rank, pts, parts: [tp, sp, mp] };
}

// js/drive.js
var MAXV = 5.2;
var ACC = 3;
var BRAKE = 6.5;
var REV = 1.6;
var STEER = 0.6;
var SEAT_SIDE = 0.36;
var SEAT_LIFT = -0.62;
var CAR_HALF = [0.72, 1.25];
function newCar(Wd, def) {
  const c = def.car;
  return {
    x: c.x,
    z: c.z,
    yaw: c.yaw,
    v: 0,
    wheel: 0,
    a: 0,
    yr: 0,
    bumpT: 0,
    curbT: 0,
    slipT: 0,
    slipKind: 0,
    nextSlip: range(Wd, def.slip.every),
    askT: range(Wd, def.ask),
    ask: 0,
    mirrorCd: 0,
    ml: 0,
    mr: 0,
    cones: 0,
    ran: 0,
    parkT: 0,
    rate: 0,
    stopX: range(Wd, [-1, 4]),
    stopT: -1,
    calmJerk: 0
  };
}
function stepCar(Wd, dt, api) {
  const c = Wd.car, b = Wd.body, o = Wd.ord;
  const pedal = clamp(o.f, -1, 1);
  c.wheel += (clamp((o.hand[0].x + o.hand[1].x) / 0.45, -1, 1) - c.wheel) * Math.min(1, dt * 10);
  const v0 = c.v;
  if (pedal > 0.05) {
    const want = pedal * MAXV;
    c.v += want > c.v ? Math.min(want - c.v, ACC * pedal * dt) : -Math.min(c.v - want, 1.2 * dt);
  } else if (pedal < -0.05) {
    if (c.v > 0.05) c.v = Math.max(0, c.v - BRAKE * -pedal * dt);
    else c.v = Math.max(-REV, c.v - ACC * 0.5 * -pedal * dt);
  } else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 0.7 * dt);
  c.yr = -c.wheel * c.v * (STEER + 0.4 * clamp(1 - (Math.abs(c.v) - 1) / 2, 0, 1));
  c.yaw += c.yr * dt;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  c.x += fx * c.v * dt;
  c.z += fz * c.v * dt;
  let hit = false;
  for (const s of [1, -1]) {
    const px = c.x + fx * s * 0.7, pz = c.z + fz * s * 0.7, r = collide(px, pz, 0.72, false);
    if (r.hit) {
      hit = true;
      c.x += r.x - px;
      c.z += r.z - pz;
    }
  }
  c.bumpT = Math.max(0, c.bumpT - dt);
  c.curbT = Math.max(0, c.curbT - dt);
  if (hit && Math.abs(c.v) > 0.8 && c.bumpT <= 0) {
    c.bumpT = 1.2;
    b.iz += 0.7 * Math.sign(c.v);
    c.v *= -0.25;
    api.ev(E.BUMP);
    Wd.car.rate += 0;
    api.driveTell(0.15, 31);
  }
  if ((c.z < -1.25 + 0.55 || c.z > 1.95 - 0.55) && Math.abs(c.v) > 0.6 && c.curbT <= 0) {
    c.curbT = 1.5;
    b.ix += 0.4 * Math.sign(c.z - 0.35);
    api.ev(E.BUMP);
    api.driveTell(0.06, 37);
  }
  c.a = (c.v - v0) / dt;
  {
    const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
    b.x = c.x - rx * SEAT_SIDE - Math.sin(c.yaw) * 0.2;
    b.z = c.z - rz * SEAT_SIDE - Math.cos(c.yaw) * 0.2;
  }
  b.yaw = c.yaw;
  b.v = c.v;
  return { a: clamp(c.a, -7, 7), yr: c.yr, hit };
}
function stepDrive(Wd, dt, api) {
  const c = Wd.car, b = Wd.body, o = Wd.ord, e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
  const pi = Wd.people.findIndex((p) => p.id === "price"), P = Wd.people[pi];
  const say2 = (line, t = 3) => {
    if (P) {
      P.say = line;
      P.sayT = t;
    }
  };
  const done = () => {
    e.step++;
    e.q = 0;
    api.ev(E.STEP, e.step);
    if (e.step >= d.steps.length) {
      say2(35, 4);
      api.errandDone();
    }
  };
  if (P) {
    const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
    P.x = c.x + rx * 0.42 - Math.sin(c.yaw) * 0.2;
    P.z = c.z + rz * 0.42 - Math.cos(c.yaw) * 0.2;
    P.yaw = c.yaw + (c.slipT > 0 ? -2.2 : 0.5);
  }
  if (c.slipT > 0) {
    c.slipT -= dt;
    if (c.slipT <= 0) {
      api.ev(E.LAPSEEND);
      c.nextSlip = range(Wd, d.slip.every);
    }
  } else {
    c.nextSlip -= dt;
    if (c.nextSlip <= 0 && Wd.phase === "play") {
      c.slipT = range(Wd, d.slip.lasts);
      c.slipKind = Math.floor(Math.random() * 3);
      say2(28 + c.slipKind, c.slipT);
      api.ev(E.LAPSE, c.slipKind);
    }
  }
  const slip = c.slipT > 0;
  c.mirrorCd = Math.max(0, c.mirrorCd - dt);
  if (c.ask > 0) {
    c.ask -= dt;
    if (o.nod) {
      c.ask = 0;
      api.calm(pi, 0.12, true);
      say2(13, 2);
    } else if (c.ask <= 0) {
      api.driveTell(0.12, 15);
    }
  } else if (!slip) {
    c.askT -= dt;
    if (c.askT <= 0) {
      c.askT = range(Wd, d.ask);
      c.ask = 3.2;
      say2(27, 3.2);
    }
  }
  if (Math.abs(o.hy) > 0.75 && c.mirrorCd <= 0 && e.step > 0) {
    c.mirrorCd = 10;
    api.calm(pi, 0.04, true);
  }
  let rate = 0;
  c.calmJerk = Math.max(0, c.calmJerk - dt);
  if (Math.abs(c.a) > 2 && c.calmJerk <= 0) rate += Math.min(0.35, (Math.abs(c.a) - 2) * 0.15);
  c.wobbleWheel = (c.wobbleWheel || 0) * Math.exp(-dt * 2) + Math.abs(c.wheel - (c.lastWheel ?? c.wheel));
  c.lastWheel = c.wheel;
  if (c.wobbleWheel > 0.9) rate += (c.wobbleWheel - 0.9) * 0.2;
  if (c.v > 3.5) rate += 0.12;
  if (Math.abs(c.yr) > 0.7 && Math.abs(c.v) > 1) rate += 0.1;
  const L = Math.hypot(b.lx, b.lz) / CFG.fallLean;
  if (b.down) rate += 0.6;
  else if (L > 0.5) rate += Math.min(0.5, (L - 0.5) * 1.1);
  if (Math.max(b.fl[0], b.fl[1]) > 2.2) rate += 0.12;
  const smooth = Math.abs(c.v) > 0.5 && Math.abs(c.a) < 1.2 && Math.abs(c.yr) < 0.5;
  c.rate = slip ? 0 : rate;
  if (P && Wd.phase === "play") {
    const soothe = (smooth ? 0.014 : 4e-3) * (slip ? 2 : 1);
    P.sus = clamp(P.sus + (c.rate > 0 ? c.rate * Wd.notice : -soothe) * dt, 0, 1);
    P.peak = Math.max(P.peak || 0, P.sus);
    if (P.sus >= 1) api.bust(pi);
  }
  d.cones.forEach(([x, z], i) => {
    if (Wd.cones & 1 << i) return;
    for (const s of [1, 0, -1]) {
      const px = c.x + Math.sin(c.yaw) * s * 0.8, pz = c.z + Math.cos(c.yaw) * s * 0.8;
      if (dist(px, pz, x, z) < 0.62) {
        Wd.cones |= 1 << i;
        api.ev(E.CLANG);
        api.driveTell(0.08, 31);
        break;
      }
    }
  });
  if (!st) return;
  if (["stopline", "cones", "estop"].includes(st.type) && c.stopT < 0) {
    c.slowT = Math.abs(c.v) < 0.8 ? (c.slowT || 0) + dt : Math.max(0, (c.slowT || 0) - dt * 2);
    if (c.slowT > 4.2) {
      c.slowT = 0;
      api.driveTell(0.12, 42);
    }
  }
  if (st.type === "mirrors") {
    if (e.q === 0 && e.asked !== e.step) {
      e.asked = e.step;
      c.ml = c.mr = 0;
      say2(26, 4);
    }
    if (o.hy > 0.75) c.ml += dt;
    if (o.hy < -0.75) c.mr += dt;
    if (c.ml > 0.35 && c.mr > 0.35) {
      api.calm(pi, 0.06, true);
      say2(36, 2.5);
      done();
    }
  } else if (st.type === "stopline") {
    const z = ZONES[st.zone], front = c.x + Math.sin(c.yaw) * CAR_HALF[1];
    if (front > z.x1 + 0.8 && !c.ran) {
      c.ran = 1;
      say2(34, 3);
      api.driveTell(0.15, 34);
      done();
    } else if (inZ(z, front, c.z) && Math.abs(c.v) < 0.15) {
      e.q += dt;
      if (e.q > 0.5) {
        api.calm(pi, 0.1, true);
        say2(13, 2.5);
        done();
      }
    }
  } else if (st.type === "cones") {
    if (e.q === 0 && !e.coneSaid) {
      e.coneSaid = 1;
      say2(31, 3);
    }
    if (c.x > st.x) done();
  } else if (st.type === "turn") {
    if (e.turnSaid !== e.step) {
      e.turnSaid = e.step;
      say2(41, 3);
    }
    if (Math.abs(wrap(c.yaw - st.yaw)) < 0.35 && Math.abs(c.v) < 1.5) done();
  } else if (st.type === "estop") {
    if (c.stopT < 0 && c.x < c.stopX && Math.abs(c.v) > 0.8) {
      c.stopT = 0;
      c.calmJerk = st.secs + 1;
      say2(38, 2);
      api.ev(E.BUMP);
    }
    if (c.stopT >= 0) {
      c.stopT += dt;
      if (Math.abs(c.v) < 0.25) {
        api.calm(pi, 0.1, true);
        say2(39, 2.5);
        done();
      } else if (c.stopT > st.secs) {
        api.driveTell(0.3, 40);
        done();
      }
    }
  } else if (st.type === "park") {
    if (e.parkSaid !== e.step) {
      e.parkSaid = e.step;
      say2(33, 3);
    }
    const z = ZONES[st.zone];
    const inside = c.x - CAR_HALF[1] * 0.8 > z.x0 && c.x + CAR_HALF[1] * 0.8 < z.x1 && c.z - 0.5 > z.z0 && c.z + 0.5 < z.z1 && Math.abs(Math.cos(c.yaw)) < 0.35;
    if (inside && Math.abs(c.v) < 0.1) {
      e.q += dt;
      if (e.q >= st.secs) done();
    } else e.q = Math.max(0, e.q - dt);
  }
}

// js/stack.js
function newBody() {
  return {
    x: TOWN.start.x,
    z: TOWN.start.z,
    yaw: TOWN.start.yaw,
    v: 0,
    lx: 0,
    lz: 0,
    lvx: 0,
    lvz: 0,
    down: 0,
    downT: 0,
    count: 3,
    popped: 0,
    still: 0,
    stum: 0,
    ph: 0,
    fl: [0, 0],
    ix: 0,
    iz: 0,
    bumpT: 0,
    lift: 0
  };
}
var newOrders = () => ({ f: 0, t: 0, gait: 0, hand: [{ x: 0, y: 0, z: 0, act: 0 }, { x: 0, y: 0, z: 0, act: 0 }], hy: 0, hp: 0, nod: 0, shake: 0, talk: 0, brow: 0 });
var GAITS = [[CFG.walkSpeed, CFG.walkAccel], [CFG.tipSpeed, CFG.tipAccel], [CFG.strideSpeed, CFG.strideAccel], [CFG.shuffleSpeed, CFG.shuffleAccel]];
function walkStep(b, o, dt) {
  const g = GAITS[o.gait] || GAITS[0];
  const max = g[0] * (b.stum ? 0.55 : 1), acc = g[1] * (b.accel || 1);
  const v0 = b.v, f = clamp(o.f, -1, 1);
  const target = f * max * (f < 0 ? 0.6 : 1);
  b.v += clamp(target - b.v, -acc * dt, acc * dt);
  const yr = -clamp(o.t, -1, 1) * CFG.turnRate * (o.gait === GAIT.STRIDE ? 0.75 : 1);
  b.yaw += yr * dt;
  const [fx, fz] = fwd(b.yaw);
  b.x += fx * b.v * dt;
  b.z += fz * b.v * dt;
  const c = collide(b.x, b.z, CFG.bodyR, false);
  b.x = c.x;
  b.z = c.z;
  for (const p of TOWN.props) {
    const d = Math.hypot(b.x - p.x, b.z - p.z), min = p.r + CFG.bodyR;
    if (d < min && d > 1e-6) {
      b.x = p.x + (b.x - p.x) / d * min;
      b.z = p.z + (b.z - p.z) / d * min;
    }
  }
  return { a: (b.v - v0) / dt, yr, hit: c.hit };
}
var armIndex = (b) => b.count >= 3 ? 1 : Math.max(0, b.count - 1);
var shiftAt = (b, i) => {
  const up = b.count <= 1 ? 0 : i / (b.count - 1);
  return up * up;
};
function bodyPoint(b, right, y, forward, leanF) {
  const [fx, fz] = fwd(b.yaw), [rx, rz] = rgt(b.yaw);
  const lr = right + b.lx * leanF, lf = forward + b.lz * leanF;
  return { x: b.x + rx * lr + fx * lf, y, z: b.z + rz * lr + fz * lf };
}
var armsY = (b) => CFG.kidH * (armIndex(b) + 0.5) + 0.12 + (b.lift || 0);
function handTarget(b, i, o) {
  return bodyPoint(b, (i === 0 ? -0.26 : 0.26) + o.x, armsY(b) + o.y, 0.22 + o.z, shiftAt(b, armIndex(b)));
}
function effHand(o, i, time, patT) {
  const h = o.hand[i], side = i === 0 ? -1 : 1;
  if (patT > 0) return { x: -side * 0.14, y: -0.12 + Math.sin(time * 22) * 0.04, z: 0 };
  if (h.act === 1) {
    const w = Math.sin(time * 7);
    return { x: side * 0.16 + w * 0.26, y: 0.86 - Math.abs(w) * 0.1, z: 0.1 };
  }
  if (h.act === 2) return { x: clamp(-Math.sin(o.hy) * 0.6 - side * 0.26, -0.55, 0.55), y: 0.36, z: clamp(Math.cos(o.hy) * 0.7, 0, 0.75) };
  return h;
}
function stepBody(Wd, dt, api) {
  const b = Wd.body, o = Wd.ord;
  if (b.popped) return;
  b.bumpT = Math.max(0, b.bumpT - dt);
  if (b.down) {
    b.downT += dt;
    b.v = 0;
    if (b.downT > CFG.downTime && Wd.phase === "play") {
      b.down = 0;
      b.lx = b.lz = b.lvx = b.lvz = 0;
      b.stum = 0;
      api.ev(E.UP);
      api.banner(2);
    }
  } else {
    const { a, yr, hit } = Wd.car ? stepCar(Wd, dt, api) : walkStep(b, o, dt);
    if (o.pos && !Wd.car) {
      const k2 = ease(dt, 10);
      b.x += (o.pos.x - b.x) * k2;
      b.z += (o.pos.z - b.z) * k2;
      b.yaw += Math.atan2(Math.sin(o.pos.yaw - b.yaw), Math.cos(o.pos.yaw - b.yaw)) * k2;
    }
    if (hit && !Wd.car && Math.abs(b.v) > 1.3 && b.bumpT <= 0) {
      b.iz += 0.9 * Math.sign(b.v);
      b.bumpT = 1;
      api.ev(E.BUMP);
    }
    const throwK = CFG.accelToLean * (Wd.car ? 0.55 : o.gait === GAIT.STRIDE ? CFG.strideWobble : o.gait === GAIT.TIPTOE ? 0.7 : 1) * (Wd.mods?.handLean > 1 ? 1.12 : 1);
    let dx = yr * b.v * throwK, dz = -a * throwK;
    const P = TOWN.paper, rest = (h) => h && Math.abs(h.y - P.y) < 0.1 && h.x > -0.55 && h.x < 0.6 && h.z > P.z - 0.2 && h.z < P.hz + 0.15;
    let resting = 0;
    for (let i = 0; i < 2; i++) {
      if (rest(Wd.hands[i])) {
        resting = 1;
        continue;
      }
      const it = Wd.items?.find((x) => x.held === i), heavy = it ? 1 + 0.6 * Math.min(1, (it.heldT || 0) / 1.5) : 1;
      const k2 = heavy * 0.8 * CFG.handToLean * (Wd.mods?.handLean || 1) * (Wd.car ? 0.35 : 1), e = effHand(o, i, Wd.time, Wd.patT);
      dx += e.x * k2;
      dz += e.z * k2;
    }
    const t = Wd.time;
    if (o.nod) dz += Math.sin(t * 9) * 0.55;
    if (o.shake) dx += Math.sin(t * 11) * 0.65;
    if (o.gait === GAIT.TIPTOE && Math.abs(b.v) < 0.2) {
      const n = (Wd.items?.filter((x) => x.held >= 0).length || 0) * (Wd.players?.length === 1 ? 0.55 : 1);
      dx += Math.sin(t * 1.7) * (0.35 + 0.45 * n);
      dz += Math.sin(t * 1.1 + 1) * 0.25 * n;
    }
    dx += Math.sin(t * 2.3 + 1) * Math.sin(t * 0.7) * CFG.giggle;
    dz += Math.sin(t * 1.9) * Math.cos(t * 0.9 + 2) * CFG.giggle;
    b.lvx += b.ix;
    b.lvz += b.iz;
    b.ix = b.iz = 0;
    const steady = (b.count >= 3 ? 1 : 0.7) * (o.gait === GAIT.SHUFFLE ? CFG.shuffleSteady : 1) * (b.lift > 0 ? CFG.platformSteady : 1) * (resting ? 1.6 : 1) * (Wd.players?.length === 1 ? 1.25 : 1);
    const mag = Math.hypot(b.lx, b.lz);
    const tip = clamp((mag - CFG.safeLean) / (CFG.fallLean - CFG.safeLean), 0, 1);
    const k = -CFG.restore * steady * (1 - tip) + CFG.tipForce * tip;
    b.lvx += (b.lx * k + dx) * dt;
    b.lvz += (b.lz * k + dz) * dt;
    const damp = Math.exp(-CFG.damping * dt);
    b.lvx *= damp;
    b.lvz *= damp;
    b.lx += b.lvx * dt;
    b.lz += b.lvz * dt;
    const m2 = Math.hypot(b.lx, b.lz);
    const st = m2 > CFG.stumLean ? 1 : 0;
    if (st && !b.stum) api.ev(E.STUMBLE);
    b.stum = st;
    if (m2 >= CFG.fallLean) {
      b.down = 1;
      b.downT = 0;
      b.v = 0;
      api.fell();
    }
    b.still = Math.abs(b.v) < 0.1 && Math.abs(yr) < 0.1 ? b.still + dt : 0;
    if (!Wd.car) b.ph += Math.abs(b.v) * dt * 5;
  }
  for (let i = 0; i < 2; i++) {
    const h = Wd.hands[i], tg = handTarget(b, i, effHand(o, i, Wd.time, Wd.patT));
    if (b.down) tg.y = 0.15;
    const k = ease(dt, 18), px = h.x, py = h.y, pz = h.z;
    h.x += (tg.x - h.x) * k;
    h.y += (tg.y - h.y) * k;
    h.z += (tg.z - h.z) * k;
    const sp = Math.hypot(h.x - px, h.y - py, h.z - pz) / dt;
    b.fl[i] += (Math.max(0, sp - Math.abs(b.v) - 0.3) - b.fl[i]) * ease(dt, 4);
  }
}

// js/parts.js
function assignSeats(n, rot) {
  n = Math.max(1, Math.min(4, n));
  const base = n === 1 ? [0, 0, 0, 0] : n === 2 ? [0, 1, 1, 1] : n === 3 ? [0, 1, 1, 2] : [0, 1, 2, 3];
  const s = base.map((p) => (p + rot) % n);
  return { legs: s[0], armL: s[1], armR: s[2], head: s[3] };
}
function kidOwners(seats, players) {
  const o = [seats.legs, seats.armL, seats.head];
  if (players >= 4) o.push(seats.armR);
  return o;
}
var emptyPacket = () => ({ l: [0, 0, 0], h: [[0, 0, 0, 0], [0, 0, 0, 0]], hd: [0, 0, 0], k: [0, 0, 0], n: [0, 0, 0, 0, 0, 0] });
function applyInputs(Wd, inputs, last, api) {
  const s = Wd.seats, o = Wd.ord;
  o.pos = null;
  for (let pid = 0; pid < Wd.players.length; pid++) {
    const P = inputs[pid];
    if (!P) continue;
    const L = last[pid] || (last[pid] = P.n.slice());
    if (s.legs === pid) {
      o.f = clamp(P.l[0], -1, 1);
      o.t = clamp(P.l[1], -1, 1);
      o.gait = clamp(P.l[2] | 0, 0, 3);
      if (P.l[6]) o.pos = { x: P.l[3], z: P.l[4], yaw: P.l[5] };
    }
    for (let i = 0; i < 2; i++) {
      if ((i === 0 ? s.armL : s.armR) !== pid) continue;
      const h = o.hand[i];
      h.x = clamp(P.h[i][0], -0.55, 0.55);
      h.y = clamp(P.h[i][1], -0.35, 0.6);
      h.z = clamp(P.h[i][2], 0, 0.75);
      h.act = clamp(P.h[i][3] | 0, 0, 2);
      if (P.n[i] !== L[i]) api.grab(i);
      if (P.n[5] !== L[5]) api.pat();
    }
    if (s.head === pid) {
      o.hy = clamp(P.hd[0], -1.9, 1.9);
      o.hp = clamp(P.hd[1], -0.9, 0.7);
      o.nod = P.hd[2] & 1;
      o.shake = P.hd[2] & 2 ? 1 : 0;
      o.talk = P.hd[2] & 4 ? 1 : 0;
      o.brow = P.hd[2] & 8 ? 1 : 0;
      if (P.n[4] !== L[4]) api.hat();
    }
    if (P.n[2] !== L[2]) api.hop(pid);
    if (P.n[3] !== L[3]) api.swap();
    last[pid] = P.n.slice();
  }
}
function spawnKid(Wd, x, z, owner, color) {
  const c = collide(x, z, CFG.kidR, true);
  Wd.kids.push({ x: c.x, z: c.z, yaw: 0, caught: 0, owner, color });
}
function stepKids(Wd, inputs, dt, api) {
  const byOwner = /* @__PURE__ */ new Map();
  Wd.kids.forEach((k, i) => {
    if (!k.caught) {
      if (!byOwner.has(k.owner)) byOwner.set(k.owner, []);
      byOwner.get(k.owner).push(i);
    }
  });
  for (const [owner, list] of byOwner) {
    const P = inputs[owner] || emptyPacket();
    const lead = list[((P.k[2] | 0) % list.length + list.length) % list.length];
    const L = Wd.kids[lead];
    let mx = -clamp(P.k[0], -1, 1), mz = clamp(P.k[1], -1, 1);
    const m = Math.hypot(mx, mz);
    if (m > 1) {
      mx /= m;
      mz /= m;
    }
    moveKid(L, mx * CFG.kidSpeed, mz * CFG.kidSpeed, dt);
    L.lead = 1;
    let prev = L;
    for (const i of list) {
      if (i === lead) continue;
      const k = Wd.kids[i];
      k.lead = 0;
      const d = dist(k.x, k.z, prev.x, prev.z);
      if (d > 0.75) moveKid(k, (prev.x - k.x) / d * CFG.kidSpeed, (prev.z - k.z) / d * CFG.kidSpeed, dt);
      prev = k;
    }
  }
  for (const c of Wd.kids) {
    if (!c.caught || !c.seat) continue;
    for (const f of Wd.kids) if (!f.caught && dist(c.x, c.z, f.x, f.z) < 1.1) {
      c.caught = 0;
      c.seat = 0;
      api.ev(E.FREED);
      break;
    }
  }
}
function moveKid(k, vx, vz, dt) {
  if (Math.abs(vx) + Math.abs(vz) < 0.01) return;
  const c = collide(k.x + vx * dt, k.z + vz * dt, CFG.kidR, true);
  k.x = c.x;
  k.z = c.z;
  k.yaw = yawTo(vx, vz);
}
var SC = { p: new T.Vector3(), l: new T.Vector3(), mode: "", init: 0, side: 0 };

// js/townspeople.js
function newPeople(ids) {
  return ids.map((id) => {
    const p = PDEF[id];
    return {
      id,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      sus: 0,
      peak: 0,
      mode: 0,
      say: -1,
      sayT: 0,
      greet: 0,
      greetT: 0,
      cool: 6 + Math.random() * 4,
      calmCd: 0,
      dir: 1,
      bumpCd: 0,
      lookT: 0,
      lookYaw: 0,
      lookCd: 0,
      browCd: 0,
      patCd: 0,
      up: 0,
      carry: -1
    };
  });
}
function sees(p, x, z) {
  const d = dist(p.x, p.z, x, z);
  if (d > CFG.sightRange) return false;
  if (d > 0.6 && Math.abs(wrap(yawTo(x - p.x, z - p.z) - p.yaw)) > CFG.sightHalf) return false;
  return los(p.x, p.z, x, z);
}
function say(p, line, t = 3) {
  p.say = line;
  p.sayT = t;
}
function tell(Wd, x, z, amount, radius) {
  if (inAlley(x, z)) return;
  for (const p of Wd.people) {
    const d = dist(p.x, p.z, x, z);
    if (d < radius && (d < 4 || los(p.x, p.z, x, z))) p.sus = clamp(p.sus + amount, 0, 1);
  }
}
function nav(p, tx, tz) {
  if (los(p.x, p.z, tx, tz)) return [tx, tz];
  const pin = inBank(p.x, p.z), tin = inBank(tx, tz);
  if (pin && !tin) return dist(p.x, p.z, 0, 4.3) > 0.5 && !los(p.x, p.z, 0, 2.4) ? [0, 4.3] : [0, 2.4];
  if (!pin && tin) return los(p.x, p.z, 0, 4.3) ? [0, 4.3] : [0, 2.4];
  if (Math.abs(p.z - 0.6) > 0.8) return [p.x, 0.6];
  return [tx, 0.6];
}
function walk(p, tx, tz, speed, dt) {
  const [nx, nz] = nav(p, tx, tz);
  const dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  p.yaw += wrap(yawTo(dx, dz) - p.yaw) * ease(dt, 8);
  const c = collide(p.x + dx / d * speed * dt, p.z + dz / d * speed * dt, 0.3, false);
  p.x = c.x;
  p.z = c.z;
}
function stepPeople(Wd, dt, api) {
  const b = Wd.body, o = Wd.ord, lvl = Wd.dis.lvl;
  const hidden = b.popped || inAlley(b.x, b.z);
  const free = (i) => !heldItem(Wd, i);
  const waving = [0, 1].some((i) => free(i) && (o.hand[i].act === 1 || o.hand[i].y > 0.35)) && Wd.patT <= 0;
  const pointing = [0, 1].some((i) => o.hand[i].act === 2) && Wd.patT <= 0;
  const pointYaw = b.yaw + o.hy;
  const moving = Math.abs(b.v) > 0.25;
  const fool = (lvl >= 1 ? CFG.disguiseFool : 1) * (lvl >= 2 ? CFG.disguiseFool : 1);
  Wd.browT = o.brow ? (Wd.browT || 0) + dt : 0;
  Wd.people.forEach((p, i) => {
    const def = PDEF[p.id];
    if (def.kind === "examiner") {
      if (p.sayT > 0) {
        p.sayT -= dt;
        if (p.sayT <= 0) p.say = -1;
      }
      return;
    }
    if (p.sayT > 0) {
      p.sayT -= dt;
      if (p.sayT <= 0) p.say = -1;
    }
    for (const k of ["calmCd", "bumpCd", "lookT", "lookCd", "browCd", "patCd"]) p[k] = Math.max(0, p[k] - dt);
    if (Wd.phase === "scatter") {
      if (def.kind === "clerk") {
        p.sus = 1;
        return;
      }
      const seat = (k, n) => {
        k.x = TOWN.bench.x - 0.8 + n % 3 * 0.8;
        k.z = TOWN.bench.z;
        k.seat = 1;
      };
      const held = p.carry >= 0 ? Wd.kids[p.carry] : null;
      if (held && held.caught && !held.seat) {
        if (Wd.scatterT <= 0 || dist(p.x, p.z, TOWN.bench.x, TOWN.bench.z + 0.9) < 0.7) {
          seat(held, p.carry);
          p.carry = -1;
        } else {
          walk(p, TOWN.bench.x, TOWN.bench.z + 0.9, 2.5, dt);
          const [hx, hz] = [Math.sin(p.yaw), Math.cos(p.yaw)];
          held.x = p.x + hx * 0.45;
          held.z = p.z + hz * 0.45;
          held.yaw = p.yaw;
          p.mode = 1;
          return;
        }
      } else p.carry = -1;
      if (Wd.scatterT <= 0) {
        p.mode = 2;
        walk(p, def.x, def.z, 1.6, dt);
        return;
      }
      p.mode = 1;
      p.sus = 1;
      if (Wd.scatterT > CFG.scatterTime - CFG.shock) return;
      let best = null, bd = 1e9;
      for (const k of Wd.kids) {
        if (k.caught || inAlley(k.x, k.z)) continue;
        const d = dist(p.x, p.z, k.x, k.z);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (!best) return;
      if (bd < 0.8) {
        best.caught = 1;
        best.seat = 0;
        p.carry = Wd.kids.indexOf(best);
        say(p, 10, 2);
        api.caught();
        return;
      }
      walk(p, best.x, best.z, CFG.chaseSpeed, dt);
      return;
    }
    const canSee = !hidden && sees(p, b.x, b.z);
    const near = dist(p.x, p.z, b.x, b.z);
    if (p.lookT > 0 && p.mode !== 2) {
      p.yaw += wrap(p.lookYaw - p.yaw) * ease(dt, 7);
    } else if (p.mode === 2) {
      walk(p, def.x, def.z, 1.6, dt);
      if (dist(p.x, p.z, def.x, def.z) < 0.3) {
        p.mode = 0;
        p.yaw = def.yaw;
      }
    } else if (def.kind === "clerk") {
      const want = canSee ? yawTo(b.x - p.x, b.z - p.z) : def.yaw;
      p.yaw += wrap(want - p.yaw) * ease(dt, 5);
    } else if (def.kind === "guard") {
      p.yaw += wrap(def.yaw + Math.sin(Wd.time * 0.45 + i) * (def.sweep ?? 0.95) - p.yaw) * ease(dt, 4);
    } else if (!(p.greet && near < 3.5) && !(p.ask > 0)) {
      const [pa, pb] = def.patrol || [-10.5, 10.5], tx = p.dir > 0 ? Math.max(pa, pb) : Math.min(pa, pb);
      if (Math.abs(p.x - tx) < 0.4) p.dir = -p.dir;
      const ahead = (b.x - p.x) * p.dir;
      if (!(near < 1.2 && ahead > 0 && !hidden)) walk(p, tx, def.z, CFG.strollSpeed, dt);
    } else p.yaw += wrap(yawTo(b.x - p.x, b.z - p.z) - p.yaw) * ease(dt, 6);
    let rate = 0, soothe = 0.02;
    if (canSee) {
      const L = Math.hypot(b.lx, b.lz) / CFG.fallLean;
      if (b.down) rate += (p.fallGain || 0) < (Wd.errand.id === "shop" ? 0.3 : 0.42) ? 0.45 : 0;
      else if (L > 0.5) rate += Math.min(0.5, (L - 0.5) * 1.1);
      if (Math.max(b.fl[0], b.fl[1]) > 1.8 && !waving && Wd.patT <= 0) rate += 0.22;
      if (b.count < 3) rate += 0.05;
      const waiting = ["queue", "counter", "shopFront", "cartFront", "check"].some((k) => inZone(ZONES[k], b.x, b.z));
      if (b.still > 6 && !waiting) rate += 0.05;
      if (moving && o.gait === GAIT.TIPTOE && !inBank(b.x, b.z)) rate += 0.035;
      if (moving && o.gait === GAIT.SHUFFLE) rate += 0.02;
      if (moving && o.gait === GAIT.STRIDE && L < 0.4) soothe = 0.05;
      if (Wd.browT > 3) rate += 0.04;
      if (waving && !o.nod && !p.greet && p.calmCd <= 0 && near > 3.5) rate += 0.02;
      if (near < 0.75 && p.bumpCd <= 0) {
        p.bumpCd = 3;
        p.sus = clamp(p.sus + 0.15, 0, 1);
        say(p, 11, 2);
        api.ev(E.BUMP);
      }
    }
    for (const k of Wd.kids) if (!inAlley(k.x, k.z) && sees(p, k.x, k.z)) rate += 0.15;
    const before = p.sus;
    if (b.down && canSee) p.fallGain = (p.fallGain || 0) + Math.max(0, rate) * dt * Wd.notice;
    else if (!b.down) p.fallGain = 0;
    p.sus = clamp(p.sus + (rate > 0 ? rate * fool * Wd.notice : -soothe) * dt, 0, 1);
    if (before < 0.6 && p.sus >= 0.6) {
      api.ev(E.GASP);
      if (p.say < 0) say(p, 15, 2);
    }
    if (canSee && !b.down) {
      if (o.nod && waving && p.calmCd <= 0) {
        api.calm(i, 0.3);
        p.calmCd = 4;
        say(p, 2, 2.5);
        if (p.greet === 1) {
          p.greet = 0;
          p.cool = Wd.time + 16;
        }
      }
      if (o.brow && p.sus >= 0.45 && p.browCd <= 0 && Wd.browT < 3) {
        api.calm(i, 0.15);
        p.browCd = 6;
      }
      if (Wd.patT > 0.6 && p.patCd <= 0 && near < 7) {
        p.patCd = 8;
        if (p.sus > 0.05) {
          api.calm(i, 0.1);
          say(p, 19, 2);
        }
      }
      if (pointing && p.lookCd <= 0 && near < 8) {
        p.lookCd = 9;
        const at = Math.abs(wrap(yawTo(p.x - b.x, p.z - b.z) - pointYaw));
        if (at < 0.4) {
          p.sus = clamp(p.sus + 0.1, 0, 1);
          say(p, 18, 2.5);
        } else {
          p.lookT = 3;
          p.lookYaw = pointYaw;
          say(p, 17, 2);
          api.ev(E.LOOK, i);
        }
      }
    }
    if (p.ask > 0) {
      p.ask -= dt;
      if (o.nod && canSee) p.askNod = 1;
      if (p.ask <= 0) {
        p.ask = 0;
        p.cool = Wd.time + 14;
        if (p.askNod) {
          api.calm(i, 0.05, true);
          say(p, "Hm. Not much of a talker, are you?", 3);
        } else {
          p.sus = clamp(p.sus + 0.2 * Wd.notice, 0, 1);
          say(p, "Well?! Cat got your tongue?", 3);
        }
      }
    } else if (Wd.asks && canSee && near < 3.8 && p.sus >= 0.45 && p.mode === 0 && !p.greet && !b.down && def.asks && Wd.time > (p.askCool || 0) && Wd.time > (Wd.askAt ?? -99) + 14) {
      Wd.askAt = Wd.time;
      p.askCool = Wd.time + 30;
      p.ask = 10;
      p.askNod = 0;
      p.askN = ((p.askN ?? -1) + 1) % def.asks.length;
      say(p, def.asks[p.askN], 10);
      api.ev(E.ASK, i);
    }
    if (!(p.ask > 0)) {
      if (p.greet) {
        p.greetT -= dt;
        const yes = o.nod, no = o.shake;
        if (canSee && (p.greet === 1 && yes || p.greet === 2 && no)) {
          api.calm(i, 0.15);
          say(p, p.greet === 1 ? 2 : 13, 2.5);
          p.greet = 0;
          p.cool = Wd.time + 16;
        } else if (canSee && p.greet === 1 && waving && p.greetT < 3.8) {
          api.calm(i, 0.08);
          say(p, 2, 2.5);
          p.greet = 0;
          p.cool = Wd.time + 16;
        } else if (canSee && p.greet === 2 && yes && p.greetT < 3.4) {
          p.sus = clamp(p.sus + 0.15, 0, 1);
          say(p, 16, 3);
          p.greet = 0;
          p.cool = Wd.time + 16;
        } else if (p.greetT <= 0) {
          p.sus = clamp(p.sus + 0.2, 0, 1);
          say(p, 3, 2.5);
          p.greet = 0;
          p.cool = Wd.time + 16;
        }
      } else if (canSee && near < (def.kind === "clerk" ? 4.2 : 3.2) && Wd.time > p.cool && Wd.time > (Wd.greetAt || 0) + CFG.greetGap && !b.down && Math.hypot(b.lx, b.lz) < CFG.fallLean * 0.45 && p.mode === 0 && p.lookT <= 0) {
        Wd.greetAt = Wd.time;
        p.greet = Math.random() < 0.3 ? 2 : 1;
        p.greetT = 4.5;
        say(p, p.greet === 1 ? 0 : 1, 4.5);
      }
    }
    if (p.sus >= 0.5) p.up = 1;
    if (p.up && p.sus <= 1e-3) {
      p.up = 0;
      api.fooled(i);
    }
    p.peak = Math.max(p.peak, p.sus);
    if (p.sus >= 1) api.bust(i);
  });
}

// js/talk.js
function applyTalk(Wd, api, i, said, v) {
  const p = Wd.people[i];
  Wd.coatSay = said.slice(0, 120);
  Wd.coatSayT = 4;
  Wd.talkN = (Wd.talkN || 0) + 1;
  if (!p) return;
  const change = clamp(Number(v.change) || 0, -0.45, 0.45);
  let reply = String(v.reply || "...").replace(/\s+/g, " ").trim();
  if (/^".*"$/.test(reply) && !reply.slice(1, -1).includes('"')) reply = reply.slice(1, -1);
  reply = reply.slice(0, 130);
  p.say = reply;
  p.sayT = Math.min(8, 2.8 + reply.length * 0.065);
  if (change < 0) api.calm(i, -change, true);
  else p.sus = clamp(p.sus + change * Wd.notice, 0, 1);
  if (p.greet) {
    p.greet = 0;
    p.cool = Wd.time + 16;
  }
  if (p.ask > 0) {
    p.ask = 0;
    p.cool = Wd.time + 14;
  }
  if (Wd.car && Wd.car.ask > 0 && change <= 0.1) Wd.car.ask = 0;
  if (v.ask && /\?\s*$/.test(reply) && (p.followups || 0) < 2 && Wd.phase === "play" && !Wd.car) {
    p.followups = (p.followups || 0) + 1;
    p.ask = Math.max(9, p.sayT + 5);
    p.askNod = 0;
    p.sayT = p.ask;
  }
  const e = Wd.errand, st = ERRANDS[e.id]?.steps[e.step];
  if (st && st.type === "talk" && st.who === p.id && change <= 0.1) e.talked = 1;
  const mem = (Wd.convo ||= {})[p.id] ||= [];
  mem.push([said.slice(0, 140), reply, Math.round(change * 100) / 100]);
  if (mem.length > 4) mem.shift();
  const log = Wd.talkLog || (Wd.talkLog = []);
  log.push([said.slice(0, 90), reply.slice(0, 90), p.id, Math.round(change * 100) / 100]);
  if (log.length > 12) log.splice(0, log.length - 12);
  if (change >= 0.25) api.worst(12, i);
}
var KID = /\b(mum|mummy|mom|mommy|mam|dad|daddy|papa|school|teacher|homework|class|bedtime|nap|toy|toys|lego|dinosaurs?|candy|sweets|lolly|lollipop|ice ?cream|chocolate|playground|recess|we|us|our|hehe|haha|giggle|poo|poop|fart|bum|butt|pinky|promise|years? old|grade|nana|granny|cartoons?|video ?games?|minecraft|fortnite|roblox|cookies?|pony|unicorns?|birthday party|sleepover|allowance|pocket money)\b/i;
var TOPICS = [
  ["weather", /\b(weather|rain|raining|sun|sunny|cold|chilly|hot|wind|windy|cloud|forecast)\b/i, ["Ooh, I know. They said rain by teatime.", "Bitter out, isn't it? Feel it in my knees.", "Lovely spell, though it won't last."]],
  ["traffic", /\b(traffic|roadworks|bus|buses|parking|commute|ring road|motorway|train|late)\b/i, ["Don't get me started on the roadworks.", "Forty minutes on the ring road, I heard.", "Parking round here! Criminal."]],
  ["work", /\b(work|working|office|business|meeting|boss|colleague|deadline|job|accountant|invoice|emails?|spreadsheet|conference)\b/i, ["Busy, busy. Never stops, does it?", "Ah, a man of business. Very good.", "Mondays, eh? Even on a Friday."]],
  ["money", /\b(tax|taxes|mortgage|pension|bank|interest|rates?|bills?|insurance|budget|savings|loan|council tax)\b/i, ["Interest rates! Shocking. Shocking.", "Tell me about it. My pension barely stretches.", "The council wants another rise, you know."]],
  ["health", /\b(back|knee|knees|hip|doctor|dentist|aches?|bad back|blood pressure|cholesterol|tired)\b/i, ["Oh, my back's the same. It's the age.", "You want to rub some liniment on that.", "Getting old is no fun, is it, dear?"]],
  ["drink", /\b(tea|coffee|cuppa|biscuit|newspaper|paper|crossword|news)\b/i, ["Nothing like a cuppa and the paper.", "Did you see the crossword? Fiendish.", "Milk and two sugars, I bet."]],
  ["home", /\b(wife|husband|garden|lawn|allotment|hedge|bins?|neighbours?|kids|children|my son|my daughter|dog|car)\b/i, ["Bin day's Tuesday, don't forget.", "Hedges grow so fast this time of year.", "Family keeps you busy, I bet."]],
  ["polite", /\b(good (morning|afternoon|evening|day)|madam|sir|indeed|certainly|splendid|quite|pleasure|kind regards|thank you|please|lovely)\b/i, ["And a very good day to you too.", "Such lovely manners. Rare these days.", "Quite right, quite right."]]
];
var KID_R = ["Your {w}? How old are you, exactly?", '"{w}"? Odd thing for a grown man to say.', 'Did your coat just say "{w}"?', `Hm. "{w}", he says. I'll remember that.`];
var ODD_R = ["Right... okay then.", "Hm. If you say so.", "Sorry, what was that?", "Pardon? You mumbled, dear."];
var REPEAT_R = ["You said that already, sir.", "Yes, yes, you mentioned that.", "Is that all you ever talk about?"];
function localJudge(said, mem = []) {
  const k = said.match(KID);
  const words = said.trim().split(/\s+/).filter(Boolean).length;
  const pick = (l) => l[(said.length * 7 + words) % l.length];
  const topic = TOPICS.find(([, re]) => re.test(said));
  const used = mem.some(([s]) => topic && topic[1].test(s));
  if (k && !(topic && said.search(topic[1]) < k.index)) return { reply: pick(KID_R).replace("{w}", k[0].toLowerCase()), change: 0.25, ask: /\?$/.test(pick(KID_R)) };
  if (topic && used) return { reply: pick(REPEAT_R), change: 0.05 };
  if (topic) return { reply: pick(topic[2]), change: words >= 4 ? -0.3 : -0.15 };
  if (words <= 1) return { reply: pick(ODD_R), change: 0.08 };
  if (/!{2,}|[A-Z]{5,}/.test(said)) return { reply: "No need to shout, sir!", change: 0.15 };
  return { reply: pick(ODD_R), change: words >= 5 ? -0.05 : 0.02 };
}

// js/game.js
function newWorld(players = ["solo"], pts = 0, run = { mode: "single", errand: "bank" }, seed = Math.random() * 1e9 | 0) {
  const b = newBody(), o = newOrders(), lvl = levelFor(pts);
  b.lift = lvl >= 2 ? CFG.platform : 0;
  const Wd = {
    phase: "play",
    time: 0,
    clock: CFG.clock,
    money: CFG.startMoney,
    rot: 0,
    seed,
    players,
    seats: assignSeats(players.length, 0),
    body: b,
    ord: o,
    hands: [handTarget(b, 0, o.hand[0]), handTarget(b, 1, o.hand[1])],
    hatT: 0,
    items: [],
    coins: 0,
    props: 0,
    cones: 0,
    people: [],
    dog: { x: 5, z: -0.8, yaw: 0, tx: 5, tz: -0.8, wait: 2, run: 0, off: 0 },
    kids: [],
    scatterT: 0,
    errand: { id: "bank", step: 0, q: 0, sign: 0, mess: 0, n: 0, messy: 0 },
    stats: { falls: 0, busts: 0, worst: 0, who: 0, sev: 0, fooled: 0, earned: 0 },
    end: 0,
    ev: [],
    evId: 0,
    last: [],
    asks: !(run.noAsks || run.noMods),
    dis: { pts, lvl },
    patT: 0,
    browT: 0,
    car: null,
    mods: mergeMods([]),
    modList: [],
    notice: 1,
    run: { noMods: !!run.noMods, daily: run.daily || "", mode: run.mode, list: run.mode === "story" ? STORY.slice() : run.mode === "single" ? [run.errand] : [], idx: 0, done: 0, scatters: 0, extras: [], extraMods: [], results: [], betweenT: 0, last: "" },
    es: null
  };
  if (Wd.run.mode === "survival") {
    Wd.clock = 300;
    Wd.run.list = [pickSurvival(Wd)];
  }
  setupErrand(Wd, Wd.run.list[0]);
  return Wd;
}
function pickSurvival(Wd) {
  const opts = SURVIVAL.filter((k2) => k2 !== Wd.run.last);
  const k = opts[Math.floor(rnd(Wd) * opts.length)];
  Wd.run.last = k;
  return k;
}
function setupErrand(Wd, id) {
  const r = Wd.run, s = errandSetup(id, r.extras, r.extraMods), d = s.d;
  Object.assign(Wd.body, newBody(), { lift: Wd.dis.lvl >= 2 ? CFG.platform : 0 });
  Wd.errand = { id, step: 0, q: 0, sign: 0, mess: 0, n: 0, messy: 0, steady: 0 };
  Wd.talkLog = [];
  Wd.coatSayT = 0;
  if (r.noMods) s.mods = [];
  Wd.items = s.items;
  Wd.modList = s.mods;
  Wd.mods = mergeMods(s.mods);
  Wd.notice = d.notice * Wd.mods.notice * (r.mode === "survival" ? 1 + Math.max(0, r.done - SURVIVAL_ORDER.length) * 0.12 + r.done * 0.04 : 1);
  Wd.body.accel = Wd.mods.accel;
  Wd.people = newPeople(s.people);
  Wd.kids = [];
  Wd.phase = "play";
  Wd.end = 0;
  Wd.cones = 0;
  Wd.props = 0;
  Wd.coins = 0;
  Wd.dog.off = d.drive ? 1 : 0;
  Wd.car = d.drive ? newCar(Wd, d) : null;
  if (Wd.car) {
    Object.assign(Wd.body, { x: Wd.car.x, z: Wd.car.z, yaw: Wd.car.yaw });
    Wd.body.lift = SEAT_LIFT;
  }
  if (r.mode !== "survival") Wd.clock = d.clock;
  Wd.gustT = Wd.mods.gust ? range(Wd, Wd.mods.gust) : 0;
  Wd.hicT = Wd.mods.hiccup ? range(Wd, Wd.mods.hiccup) : 0;
  Wd.es = { start: Wd.time, scatters: 0, peak: 0, falls: 0 };
  Wd.stats.sev = 0;
  Wd.stats.worst = 0;
  Wd.stats.who = 0;
}
var WORST_SEV = [0, 3, 2, 5, 6, 4, 1, 7, 8, 7, 6, 5, 4];
var WORST = [
  "Nothing. Suspiciously smooth.",
  "Slipped on the wet floor",
  "Kicked the dog",
  "Fell over in front of {who}",
  "The coat popped open in front of {who}",
  "Signed the form like an earthquake",
  "Knocked over the {prop}",
  "Missed dinner",
  "Every single kid got caught",
  "Failed the driving test",
  "Knocked over a cone",
  "Dropped {item}",
  "Said something very childish to {who}"
];
function makeApi(Wd) {
  const ev = (k, a = 0) => {
    Wd.ev.push([++Wd.evId, k, a]);
    if (Wd.ev.length > 8) Wd.ev.shift();
  };
  const worst = (code, who = 0) => {
    if (WORST_SEV[code] > Wd.stats.sev) {
      Wd.stats.sev = WORST_SEV[code];
      Wd.stats.worst = code;
      Wd.stats.who = who;
      ev(E.WORST, code);
    }
  };
  const dropAll = () => {
    for (const it of Wd.items) if (it.held >= 0) {
      it.held = -1;
      ev(E.DROP);
      tell(Wd, it.x, it.z, 0.2, 8);
      worst(11, Wd.items.indexOf(it));
    }
  };
  const api = {
    ev,
    worst,
    banner: (i) => ev(E.BANNER, i),
    fell() {
      Wd.stats.falls++;
      if (Wd.es) Wd.es.falls++;
      ev(E.FALL);
      api.banner(1);
      dropAll();
      const b = Wd.body;
      let who = -1;
      Wd.people.forEach((p, i) => {
        if (!inAlley(b.x, b.z) && dist(p.x, p.z, b.x, b.z) < 8) who = i;
      });
      if (who >= 0) worst(3, who);
    },
    grab(i) {
      const h = Wd.hands[i], mine = heldItem(Wd, i);
      if (mine) {
        mine.held = -1;
        ev(E.DROP);
        tell(Wd, mine.x, mine.z, 0.12, 6);
        return;
      }
      if (Wd.body.down) return;
      let best = null, bd = 0.34;
      for (const it of Wd.items) {
        if (it.held >= 0) continue;
        const d = Math.hypot(h.x - it.x, h.y - it.y, h.z - it.z);
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
      if (best) {
        best.held = i;
        ev(E.GRAB);
      }
    },
    // a bluff landed on person i: the meter drops and everyone gets to see it. While the examiner looks away it counts double.
    calm(i, amount, always) {
      const p = Wd.people[i];
      if (!p || p.sus <= 0.01 && !always) return;
      if (Wd.car && Wd.car.slipT > 0) amount *= 2;
      p.sus = Math.max(0, p.sus - amount);
      ev(E.CALM, i);
    },
    driveTell(amount, line) {
      if (Wd.car && Wd.car.slipT > 0) return;
      const i = Wd.people.findIndex((p2) => p2.id === "price");
      if (i < 0) return;
      const p = Wd.people[i];
      p.sus = clamp(p.sus + amount * Wd.notice, 0, 1);
      if (line !== void 0) {
        p.say = line;
        p.sayT = 2.5;
      }
      if (line === 31) worst(10, i);
    },
    fooled(i) {
      Wd.stats.fooled++;
      api.points(1);
      api.banner(17);
      ev(E.POINT, i);
    },
    points(n) {
      const d = Wd.dis;
      d.pts += n;
      Wd.stats.earned += n;
      const lvl = levelFor(d.pts);
      if (lvl > d.lvl) {
        d.lvl = lvl;
        Wd.body.lift = Wd.car ? SEAT_LIFT : lvl >= 2 ? CFG.platform : 0;
        ev(E.LEVEL, lvl);
        api.banner(13 + lvl);
      }
    },
    pat() {
      if (Wd.patT > 0 || Wd.body.down || Wd.phase !== "play") return;
      Wd.patT = 1;
      Wd.body.iz -= 0.35;
      ev(E.PAT);
    },
    hat() {
      Wd.hatT = 1;
      Wd.body.ix += 0.3;
      ev(E.HAT);
      Wd.people.forEach((p, i) => {
        if (!inAlley(Wd.body.x, Wd.body.z) && dist(p.x, p.z, Wd.body.x, Wd.body.z) < 5 && p.sus > 0.01) api.calm(i, 0.05);
      });
    },
    hop(pid) {
      const b = Wd.body;
      if (Wd.phase !== "play" || b.down || Wd.car) return;
      if (Wd.kids.length) {
        const k = Wd.kids[0];
        if (!inAlley(b.x, b.z) || dist(k.x, k.z, b.x, b.z) > 1.8) {
          api.banner(10);
          return;
        }
        Wd.kids = [];
        b.count = 3;
        ev(E.HOPIN);
        api.banner(6);
        return;
      }
      if (!inAlley(b.x, b.z)) {
        api.banner(9);
        return;
      }
      b.count = 2;
      spawnKid(Wd, b.x + 0.9, b.z - 0.2, pid, 2);
      ev(E.HOPOUT);
      api.banner(5);
    },
    swap() {
      if (Wd.phase !== "play" || !inAlley(Wd.body.x, Wd.body.z)) {
        api.banner(9);
        return;
      }
      Wd.rot = (Wd.rot + 1) % Math.max(1, Wd.players.length);
      Wd.seats = assignSeats(Wd.players.length, Wd.rot);
      ev(E.SWAP);
      api.banner(7);
    },
    caught() {
      ev(E.CAUGHT);
    },
    bust(i) {
      if (Wd.phase !== "play") return;
      const b = Wd.body;
      Wd.stats.busts++;
      Wd.es.scatters++;
      Wd.run.scatters++;
      worst(4, i);
      dropAll();
      ev(E.RIP);
      api.banner(3);
      Wd.people[i].say = 9;
      Wd.people[i].sayT = 3;
      b.popped = 1;
      b.v = 0;
      if (Wd.car) {
        worst(9, i);
        Wd.car.v = 0;
        finishErrand(Wd, api, false, "Mr Price saw through the coat");
        return;
      }
      if (Wd.run.mode === "survival" && Wd.run.scatters >= 3) {
        finishRun(Wd, api, "Third Scatter: grounded for the day");
        return;
      }
      Wd.phase = "scatter";
      Wd.scatterT = CFG.scatterTime;
      const owners = kidOwners(Wd.seats, Wd.players.length);
      const have = Wd.kids.length;
      for (let k = 0; k < owners.length - have; k++) {
        const a = k / owners.length * Math.PI * 2 + 0.5;
        spawnKid(Wd, b.x + Math.cos(a) * 0.7, b.z + Math.sin(a) * 0.7, owners[k], k);
      }
    },
    errandDone() {
      finishErrand(Wd, api, true);
    }
  };
  return api;
}
function finishErrand(Wd, api, ok, fail) {
  if (Wd.phase === "end" || Wd.phase === "between") return;
  const r = Wd.run, peak = Math.max(Wd.es.peak, ...Wd.people.map((p) => p.peak || 0));
  const res = {
    id: Wd.errand.id,
    ok,
    fail: ok ? "" : fail,
    time: Math.round(Wd.time - Wd.es.start),
    scatters: Wd.es.scatters,
    peak: r2(peak),
    falls: Wd.es.falls,
    worst: worstText(Wd),
    quotes: quotes(Wd),
    lines: talkLines(Wd)
  };
  res.rank = rankErrand(res).rank;
  r.results.push(res);
  if (ok) {
    Wd.money += 10;
    if (!Wd.es.scatters) {
      api.points(3);
      api.banner(18);
    }
  }
  if (r.mode === "survival") {
    if (ok) {
      r.done++;
      Wd.clock += Math.max(10, 40 - r.done * 4);
      Wd.phase = "between";
      Wd.run.betweenT = 3;
      growSurvival(Wd);
      api.ev(E.NEXT, r.done);
      return;
    }
    finishRun(Wd, api, fail);
    return;
  }
  Wd.end = ok ? 1 : 4;
  Wd.phase = "end";
  api.ev(E.END, Wd.end);
}
function finishRun(Wd, api, why) {
  Wd.run.why = why;
  Wd.end = 5;
  Wd.phase = "end";
  api.worst(7);
  api.ev(E.END, 5);
}
function growSurvival(Wd) {
  const r = Wd.run, add = SURVIVAL_ORDER[(r.done - 1) % SURVIVAL_ORDER.length];
  const [kind, id] = add.split(":");
  if (kind === "person" && !r.extras.includes(id)) r.extras.push(id);
  else if (kind === "mod" && !r.extraMods.includes(id)) r.extraMods.push(id);
  r.added = kind === "mod" ? MODS[id]?.name : personDef({ people: [{ id }] }, 0).name + " joins the street";
  r.list.push(pickSurvival(Wd));
}
function restack(Wd, api) {
  const b = Wd.body;
  let gx = 0, gz = 0;
  for (const k of Wd.kids) {
    gx += k.x;
    gz += k.z;
  }
  const n = Math.max(1, Wd.kids.length), at = collide(gx / n, gz / n, CFG.bodyR, false);
  Object.assign(b, { x: at.x, z: at.z, yaw: TOWN.start.yaw, v: 0, lx: 0, lz: 0, lvx: 0, lvz: 0, down: 0, popped: 0, count: 3, stum: 0, still: 0 });
  Wd.kids = [];
  Wd.phase = "play";
  Wd.money = Math.max(0, Wd.money - 5);
  for (const p of Wd.people) {
    p.sus = 0.15;
    p.mode = 2;
    p.greet = 0;
    p.cool = Wd.time + 10;
    p.carry = -1;
  }
  const d = ERRANDS[Wd.errand.id];
  for (const it of Wd.items) {
    const h = ITEMS[it.id].home;
    Object.assign(it, { x: h[0], y: h[1], z: h[2], vy: 0, held: -1 });
  }
  const g = d.steps.findIndex((st) => st.type === "grab");
  if (g >= 0 && Wd.errand.step > g) Wd.errand.step = g;
  Wd.errand.q = 0;
  api.ev(E.RESTACK);
  api.banner(4);
}
function stepThings(Wd, dt, api) {
  const b = Wd.body;
  for (const it of Wd.items) {
    if (it.held >= 0) {
      const h = Wd.hands[it.held];
      it.x = h.x;
      it.y = h.y - 0.1;
      it.z = h.z;
      it.vy = 0;
      it.heldT = (it.heldT || 0) + dt;
      continue;
    }
    it.heldT = 0;
    const home = ITEMS[it.id].home, onHome = Math.hypot(it.x - home[0], it.z - home[2]) < 0.6;
    const floor = onHome ? home[1] : 0.13;
    if (it.y > floor) {
      it.vy -= 9.8 * dt;
      it.y = Math.max(floor, it.y + it.vy * dt);
    } else {
      it.vy = 0;
      it.y = Math.max(it.y, floor);
    }
  }
  if (b.popped) return;
  if (!Wd.car) {
    TOWN.coins.forEach((c, i) => {
      if (!(Wd.coins & 1 << i) && dist(c.x, c.z, b.x, b.z) < 0.5) {
        Wd.coins |= 1 << i;
        Wd.money += 2;
        api.ev(E.COIN);
      }
    });
    for (const k of Wd.kids) if (!(Wd.coins & 8) && dist(TOWN.kidCoin.x, TOWN.kidCoin.z, k.x, k.z) < 0.6) {
      Wd.coins |= 8;
      Wd.money += 10;
      api.ev(E.COIN);
      api.banner(8);
    }
    TOWN.props.forEach((p, i) => {
      const d2 = dist(p.x, p.z, b.x, b.z), min = p.r + CFG.bodyR;
      if (d2 >= min) return;
      const nx = (b.x - p.x) / (d2 || 1), nz = (b.z - p.z) / (d2 || 1);
      b.x = p.x + nx * min;
      b.z = p.z + nz * min;
      if (!(Wd.props & 1 << i)) {
        Wd.props |= 1 << i;
        b.iz -= 0.7;
        api.ev(E.CLANG);
        tell(Wd, p.x, p.z, 0.12, 7);
        api.worst(6, i);
      }
    });
    if (Math.hypot(TOWN.wet.x - b.x, TOWN.wet.z - b.z) < TOWN.wet.r && Math.abs(b.v) > 1.1 && b.bumpT <= 0 && !b.down) {
      b.iz += 1.45;
      b.ix += 0.6;
      b.bumpT = 1.5;
      api.ev(E.SLIP);
      api.banner(11);
      api.worst(1);
      tell(Wd, b.x, b.z, 0.1, 7);
    }
  }
  const m = Wd.mods;
  if (m.gust && !b.down) {
    Wd.gustT -= dt;
    if (Wd.gustT <= 0) {
      Wd.gustT = range(Wd, m.gust);
      b.ix += m.gustPower * (rnd(Wd) < 0.5 ? -1 : 1);
      b.iz += m.gustPower * 0.5 * (rnd(Wd) - 0.5);
      api.ev(E.GUST);
    }
  }
  if (m.hiccup && !b.down) {
    Wd.hicT -= dt;
    if (Wd.hicT <= 0) {
      Wd.hicT = range(Wd, m.hiccup);
      b.iz += m.hicPower;
      api.ev(E.HIC);
      tell(Wd, b.x, b.z, m.hicTell, 5);
    }
  }
  const d = Wd.dog;
  if (d.off) {
    d.x = 12;
    d.z = -6;
    return;
  }
  d.wait -= dt;
  d.run = Math.max(0, d.run - dt);
  if (d.wait <= 0) {
    d.tx = -8 + Math.random() * 16;
    d.tz = -1.6 + Math.random() * 3.6;
    d.wait = 3 + Math.random() * 4;
  }
  const ddx = d.tx - d.x, ddz = d.tz - d.z, dd = Math.hypot(ddx, ddz);
  if (dd > 0.1) {
    const sp = d.run > 0 ? 4 : 0.9;
    d.x += ddx / dd * sp * dt;
    d.z += ddz / dd * sp * dt;
    d.yaw = Math.atan2(ddx, ddz);
  }
  if (dist(d.x, d.z, b.x, b.z) < 0.5 && d.run <= 0 && !b.down) {
    d.run = 2;
    d.tx = clamp(d.x + (d.x - b.x) * 12, -9, 9);
    d.tz = clamp(d.z + (d.z - b.z) * 12, -1.8, 2);
    d.wait = 3;
    b.iz -= 0.9 * Math.sign(b.v || 1);
    api.ev(E.YELP);
    api.banner(12);
    api.worst(2);
    tell(Wd, d.x, d.z, 0.1, 7);
  }
}
function stepWorld(Wd, dt, inputs) {
  const api = makeApi(Wd);
  if (Wd.phase === "end") return;
  Wd.time += dt;
  Wd.coatSayT = Math.max(0, (Wd.coatSayT || 0) - dt);
  Wd.hatT = Math.max(0, Wd.hatT - dt * 1.4);
  Wd.patT = Math.max(0, Wd.patT - dt);
  applyInputs(Wd, inputs, Wd.last, api);
  if (Wd.coatSayT > 0.5) Wd.ord.talk = 1;
  if (Wd.phase === "between") {
    Wd.run.betweenT -= dt;
    if (Wd.run.betweenT <= 0) {
      setupErrand(Wd, Wd.run.list[Wd.run.list.length - 1]);
      api.ev(E.RESTACK);
    }
    return;
  }
  if (Wd.phase === "play") {
    Wd.clock -= dt;
    stepBody(Wd, dt, api);
    stepKids(Wd, inputs, dt, api);
    stepThings(Wd, dt, api);
    stepPeople(Wd, dt, api);
    if (Wd.car) stepDrive(Wd, dt, api);
    if (Wd.phase === "play") stepErrand(Wd, dt, api, { addSus: (i, a) => {
      Wd.people[i].sus = clamp(Wd.people[i].sus + a * Wd.notice, 0, 1);
    } });
    for (const p of Wd.people) Wd.es.peak = Math.max(Wd.es.peak, p.sus);
    if (Wd.clock <= 0 && Wd.phase === "play") {
      if (Wd.run.mode === "survival") finishRun(Wd, api, "Dinner time!");
      else {
        api.worst(7);
        finishErrand(Wd, api, false, "Late: the shop shut / the town went home");
      }
    }
  } else if (Wd.phase === "scatter") {
    Wd.scatterT = Math.max(0, Wd.scatterT - dt);
    if (Wd.run.mode === "survival") Wd.clock -= dt;
    stepKids(Wd, inputs, dt, api);
    stepThings(Wd, dt, api);
    stepPeople(Wd, dt, api);
    const free = Wd.kids.filter((k) => !k.caught);
    if (!free.length) {
      api.worst(8);
      if (Wd.run.mode === "survival") finishRun(Wd, api, "Every kid got caught");
      else finishErrand(Wd, api, false, "Every kid got caught");
    } else if (free.length === Wd.kids.length && free.every((k) => inAlley(k.x, k.z))) restack(Wd, api);
  }
}
function talkLines(Wd) {
  const log = Wd.talkLog || [];
  if (!log.length) return null;
  const name = (id) => PDEF[id]?.name || "Someone";
  const best = log.reduce((a, l) => l[3] < a[3] ? l : a), worst = log.reduce((a, l) => l[3] > a[3] ? l : a);
  const out = [];
  if (best[3] < 0) out.push({ tag: "Best bluff", said: best[0], who: name(best[2]), reply: best[1] });
  if (worst[3] > 0.05 && worst !== best) out.push({ tag: "Worst blurt", said: worst[0], who: name(worst[2]), reply: worst[1] });
  return out.length ? out : null;
}
function hostTalk(Wd, i, said, v) {
  applyTalk(Wd, makeApi(Wd), i, said, v);
}
function worstText(Wd) {
  const s = Wd.stats, it = Wd.items[s.who];
  return WORST[s.worst].replace("{who}", personDef(Wd, s.who).name).replace("{prop}", TOWN.props[s.who]?.name || "bin").replace("{item}", it ? ITEMS[it.id].name : "something");
}
function quotes(Wd) {
  return Wd.people.map((p, i) => {
    const def = personDef(Wd, i), s = Wd.stats;
    const lvl = s.busts && s.who === i && s.worst === 4 || (p.peak || 0) >= 0.999 ? 2 : (p.peak || 0) > 0.45 ? 1 : 0;
    return { who: def.name + ", " + def.job, text: def.quotes[lvl] };
  });
}

// js/assist.js
function offsetFor(b, i, t) {
  const [fx, fz] = fwd(b.yaw), [rx, rz] = rgt(b.yaw), sh = shiftAt(b, armIndex(b));
  const dx = t.x - b.x, dz = t.z - b.z;
  return { x: dx * rx + dz * rz - b.lx * sh - (i === 0 ? -0.26 : 0.26), y: t.y - armsY(b), z: dx * fx + dz * fz - b.lz * sh - 0.22 };
}

// test/sim/brain.js
var NODES = [[-7, -4.8], [-6, -3.4], [-5.8, -2.1], [0, 2.6], [0, 3.5], [0, 4.6]];
for (let x = -10; x <= 10; x += 2) NODES.push([x, 0.4], [x, 2.15], [x, -3]);
var clear = (ax, az, bx, bz) => {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
  for (let i = 0; i <= n; i++) {
    const x = ax + (bx - ax) * (i / n), z = az + (bz - az) * (i / n);
    if (i * 0.2 < 0.35) continue;
    if (collide(x, z, 0.36, false).hit) return false;
    for (const p of TOWN.props) if (Math.hypot(p.x - x, p.z - z) < p.r + 0.36) return false;
  }
  return true;
};
var OK = NODES.filter(([x, z]) => !collide(x, z, 0.36, false).hit && !TOWN.props.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.36));
var EDGES = OK.map((a, i) => OK.map((b, j) => i !== j && Math.hypot(a[0] - b[0], a[1] - b[1]) < 4.6 && clear(a[0], a[1], b[0], b[1]) ? j : -1).filter((j) => j >= 0));
function path(fx, fz, tx, tz) {
  if (clear(fx, fz, tx, tz)) return [[tx, tz]];
  const near = (x, z) => OK.map((n, i) => [Math.hypot(n[0] - x, n[1] - z), i]).filter(([d, i]) => clear(x, z, OK[i][0], OK[i][1])).sort((a, b) => a[0] - b[0]).slice(0, 4).map((a) => a[1]);
  const starts = near(fx, fz), ends = new Set(near(tx, tz));
  const dd = /* @__PURE__ */ new Map(), prev = /* @__PURE__ */ new Map(), open = [];
  for (const s of starts) {
    dd.set(s, Math.hypot(OK[s][0] - fx, OK[s][1] - fz));
    open.push(s);
  }
  while (open.length) {
    open.sort((a, b) => dd.get(a) - dd.get(b));
    const u = open.shift();
    if (ends.has(u)) {
      const out = [[tx, tz]];
      for (let v = u; v !== void 0; v = prev.get(v)) out.unshift(OK[v]);
      return out;
    }
    for (const v of EDGES[u]) {
      const nd = dd.get(u) + Math.hypot(OK[u][0] - OK[v][0], OK[u][1] - OK[v][1]);
      if (nd < (dd.get(v) ?? 1e9)) {
        dd.set(v, nd);
        prev.set(v, u);
        if (!open.includes(v)) open.push(v);
      }
    }
  }
  return [[tx, tz]];
}
var Brain = class {
  constructor(skill = 1) {
    this.skill = skill;
    this.route = null;
    this.goal = null;
    this.t = 0;
    this.out = blank();
    this.grabN = [0, 0];
    this.hatN = 0;
    this.bluffT = 0;
    this.nodT = 0;
    this.mirror = 0;
    this.headLook = null;
  }
  think(Wd, dt) {
    this.t += dt;
    const o = this.out = blank(this.out.hand), b = Wd.body;
    if (Wd.phase === "scatter") return this.scatter(Wd, o);
    if (Wd.phase !== "play" || b.popped) return o;
    const e = Wd.errand, d = ERRANDS[e.id], st = d.steps[e.step];
    if (Wd.car) {
      this.drive(Wd, dt, o, st);
      this.head(Wd, dt, o);
      return o;
    }
    if (b.down) return o;
    const lean = Math.hypot(b.lx, b.lz);
    let dest = null, stopAt = null, tall = false, face = null;
    const dropped = Wd.items.find((it) => it.held < 0 && d.steps.slice(0, e.step).some((s) => s.type === "grab" && s.items.includes(it.id)));
    if (dropped) dest = { x: dropped.x, z: dropped.z, tol: 0.5, item: dropped };
    else if (!st) return o;
    else if (st.type === "goto" || st.type === "carry") dest = { ...zoneCentre(ZONES[st.zone]), tol: ZONES[st.zone].r ? ZONES[st.zone].r * 0.55 : 0.6 };
    else if (st.type === "still" || st.type === "tall") {
      dest = { ...zoneCentre(ZONES[st.zone]), tol: ZONES[st.zone].r * 0.55 };
      stopAt = true;
      tall = st.type === "tall";
    } else if (st.type === "grab") {
      const it = Wd.items.find((x) => st.items.includes(x.id) && x.held < 0);
      if (it) {
        const home = ITEMS[it.id].home;
        dest = this.standFor(home);
        face = { x: home[0], z: home[2] };
      }
    } else if (st.type === "sign") {
      dest = { x: 0.3, z: 7.74, tol: 0.14 };
      face = { x: 0.3, z: 9 };
    } else if (st.type === "talk") {
      const p = Wd.people.find((x) => x.id === st.who);
      if (p) face = { x: p.x, z: p.z };
    }
    if (dest) {
      const there = dist(b.x, b.z, dest.x, dest.z) < (dest.tol || 0.3);
      if (!there) this.walk(Wd, o, dest, lean);
      else if (face) this.turnTo(Wd, o, face);
    } else if (face) this.turnTo(Wd, o, face);
    if (tall) o.gait = GAIT.TIPTOE;
    this.arms(Wd, dt, o, st, dropped);
    if (st && st.type === "talk") {
      const p = Wd.people.find((x) => x.id === st.who);
      if (p) {
        o.hy = clamp(wrap(yawTo(p.x - b.x, p.z - b.z) - b.yaw), -1.8, 1.8);
        o.talk = Math.abs(o.hy) < 1.75 ? 1 : 0;
      }
    }
    this.head(Wd, dt, o);
    return o;
  }
  standFor(home) {
    if (home[2] > 8) return { x: home[0] < 0.6 ? 0.3 : 0.6, z: 7.78, tol: 0.14 };
    if (home[2] > 2) return { x: -8.2, z: 2.08, tol: 0.14 };
    return { x: 2.37, z: -3.1, tol: 0.25 };
  }
  walk(Wd, o, dest, lean) {
    const b = Wd.body;
    const gone = dist(b.x, b.z, dest.x, dest.z);
    if (this.unstick > 0) {
      this.unstick -= 1 / 60;
      o.f = -0.5;
      o.t = this.unstickDir;
      return;
    }
    if (this.prog === void 0 || gone < this.prog - 0.25) {
      this.prog = gone;
      this.progT = this.t;
    } else if (this.t - this.progT > 3 && !b.down) {
      this.unstick = 0.9;
      this.unstickDir = Math.random() < 0.5 ? 1 : -1;
      this.prog = void 0;
      this.route = null;
      return;
    }
    const key = `${dest.x.toFixed(1)},${dest.z.toFixed(1)}`;
    if (!this.route || this.routeKey !== key || this.t - this.routeAt > 3) {
      this.route = path(b.x, b.z, dest.x, dest.z);
      this.routeKey = key;
      this.routeAt = this.t;
    }
    while (this.route.length > 1 && dist(b.x, b.z, this.route[0][0], this.route[0][1]) < 0.5) this.route.shift();
    const [tx, tz] = this.route[0];
    const err = wrap(yawTo(tx - b.x, tz - b.z) - b.yaw);
    o.t = clamp(-err * 2.2, -1, 1);
    const left = dist(b.x, b.z, dest.x, dest.z);
    o.f = Math.abs(err) > 0.6 ? 0.12 : clamp(left * 0.9, 0.25, 0.85) * this.skill;
    if (lean > 0.3) o.f *= 0.3;
    if (Wd.items.some((it) => it.held >= 0)) o.f *= 0.8;
    if (left < 1.2) o.gait = GAIT.SHUFFLE;
    if (Math.hypot(TOWN.wet.x - b.x, TOWN.wet.z - b.z) < TOWN.wet.r + 1.4) o.f = Math.min(o.f, 0.4);
  }
  turnTo(Wd, o, p) {
    const b = Wd.body, err = wrap(yawTo(p.x - b.x, p.z - b.z) - b.yaw);
    if (Math.abs(err) > 0.25) {
      o.t = clamp(-err * 2, -1, 1) * 0.6;
      o.gait = GAIT.SHUFFLE;
    }
  }
  arms(Wd, dt, o, st, dropped) {
    const b = Wd.body;
    const want = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
    const targets = [];
    if (dropped) targets.push(dropped);
    else if (st && st.type === "grab") {
      for (const it of Wd.items) if (st.items.includes(it.id) && it.held < 0) targets.push(it);
    }
    for (const it of targets) {
      let best = -1, bd = 9;
      for (const i of [0, 1]) {
        if (heldItem(Wd, i) || want[i].busy) continue;
        const off2 = offsetFor(b, i, it), d = Math.abs(off2.x) + Math.abs(off2.z);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) continue;
      const off = offsetFor(b, best, it);
      if (!(Math.abs(off.x) < 0.6 && off.z < 0.8 && off.z > -0.1 && Math.abs(b.v) < 0.3)) continue;
      want[best] = { x: clamp(off.x, -0.55, 0.55), y: clamp(off.y, -0.35, 0.6), z: clamp(off.z, 0, 0.75), busy: 1 };
      const h = Wd.hands[best];
      if (Math.hypot(h.x - it.x, h.y - it.y, h.z - it.z) < 0.27 && dist(b.x, b.z, it.x, it.z) < 1.3) this.press(o, best);
    }
    if (st && st.type === "sign" && dist(b.x, b.z, 0.3, 7.74) < 0.3 && Math.abs(b.v) < 0.2) {
      const P = TOWN.paper;
      const hold = offsetFor(b, 0, { x: P.hx, y: P.y, z: P.hz });
      want[0] = { x: hold.x, y: hold.y, z: hold.z };
      const u = clamp(Wd.errand.sign + 0.12, 0, 1);
      const pen = offsetFor(b, 1, { x: P.x0 + (P.x1 - P.x0) * u, y: P.y, z: P.z });
      const holding = Math.hypot(Wd.hands[0].x - P.hx, Wd.hands[0].z - P.hz) < 0.12 && Math.abs(Wd.hands[0].y - P.y) < 0.09;
      want[1] = holding ? { x: pen.x, y: pen.y, z: pen.z } : { x: 0.1, y: 0, z: 0.2 };
    }
    if (Math.hypot(b.lx, b.lz) > 0.3) {
      for (const i of [0, 1]) if (!heldItem(Wd, i)) want[i] = { x: 0, y: 0, z: 0 };
    }
    if (this.bluffT > 0) o.act[0] = 1;
    for (const i of [0, 1]) {
      const h = o.hand[i], w = want[i], k = 0.9 * dt;
      h.x += clamp(w.x - h.x, -k, k);
      h.y += clamp(w.y - h.y, -k * 1.4, k * 1.4);
      h.z += clamp(w.z - h.z, -k, k);
    }
  }
  press(o, i) {
    if (this.t - (this.lastGrab?.[i] || 0) > 0.6) {
      (this.lastGrab ||= [0, 0])[i] = this.t;
      o.grab[i] = 1;
    }
  }
  // the head: answer greetings, bluff when someone is getting suspicious, tip the hat now and then
  head(Wd, dt, o) {
    const b = Wd.body;
    this.bluffT = Math.max(0, this.bluffT - dt);
    this.nodT = Math.max(0, this.nodT - dt);
    let worst = null;
    Wd.people.forEach((p) => {
      if (p.id === "price") return;
      if (sees(p, b.x, b.z) && (!worst || p.sus > worst.sus)) worst = p;
    });
    for (const p of Wd.people) {
      if (p.greet && sees(p, b.x, b.z) && dist(p.x, p.z, b.x, b.z) < 4.5) {
        if (p.greet === 1) {
          o.nod = 1;
          this.headLook = p;
        } else {
          o.shake = 1;
          this.headLook = p;
        }
      }
    }
    if (worst && worst.sus > 0.5 && this.t - (this.lastBluff || 0) > 4.5) {
      this.lastBluff = this.t;
      this.bluffT = 1.2;
      this.nodT = 1;
    }
    if (this.nodT > 0) o.nod = 1;
    if (Wd.car) {
      const c = Wd.car, P = Wd.people.find((p) => p.id === "price");
      if (c.ask > 0 && c.ask < 3.4) o.nod = 1;
      if (P && P.sus > 0.35 && this.t - (this.lastHat || 0) > (c.slipT > 0 ? 1.5 : 6)) {
        this.lastHat = this.t;
        o.hat = 1;
      }
    }
    if (!o.talk && this.headLook && !Wd.car) {
      const p = this.headLook;
      o.hy = clamp(wrap(yawTo(p.x - b.x, p.z - b.z) - b.yaw), -1.8, 1.8);
    }
  }
  scatter(Wd, o) {
    o.kid = true;
    return o;
  }
  // ---------- the driving test ----------
  drive(Wd, dt, o, st) {
    const c = Wd.car;
    if (!st) return;
    let tx = c.x + 3 * Math.sin(c.yaw), tz = 0.35, vt = 0, wheelOverride = null;
    const head = Math.sin(c.yaw) >= 0 ? 1 : -1;
    if (st.type === "mirrors") {
      o.hy = c.ml < 0.5 ? 1 : c.mr < 0.5 ? -1 : 0;
      vt = 0;
    } else if (st.type === "stopline") {
      const z = ZONES.line, goal = (z.x0 + z.x1) / 2 - CAR_HALF[1];
      vt = clamp((goal - c.x) * 0.7, 0, 2.4);
    } else if (st.type === "cones") {
      const pts = [[-1.2, -0.45], [1.3, -0.45], [2.6, 1.15], [3.9, 1.15], [5.2, -0.45], [6.6, -0.45], [8, 0.35]];
      const nxt = pts.find(([x]) => x > c.x + 0.6) || [9, 0.35];
      tx = nxt[0];
      tz = nxt[1];
      vt = 1.5 * this.skill;
    } else if (st.type === "turn") {
      const fz = Math.cos(c.yaw);
      if (this.turnDir === void 0) this.turnDir = 1;
      if (!this.turnStarted) {
        vt = 0;
        if (Math.abs(c.v) < 0.15) this.turnStarted = true;
      } else if (this.turnDir > 0) {
        vt = 0.9;
        wheelOverride = -1;
        if (c.z > 1.4 && fz > 0.2 || c.z < -0.7 && fz < -0.2) this.turnDir = -1;
      } else {
        vt = -0.8;
        wheelOverride = 1;
        if (c.z < -0.3 && fz > 0.2 || c.z > 1 && fz < -0.2 || Math.abs(fz) < 0.25) this.turnDir = 1;
      }
      if (this.turnDir > 0 && Math.abs(c.v) < 0.05 && this.lastDir < 0) this.turnDir = 1;
      this.lastDir = this.turnDir;
    } else if (st.type === "estop") {
      if (c.stopT >= 0) {
        vt = 0;
        o.f = -1;
        this.hardBrake = true;
      } else {
        vt = 2;
        tx = c.x - 3;
        tz = 0.35;
      }
    } else if (st.type === "park") {
      const z = ZONES[st.zone], gx = (z.x0 + z.x1) / 2, gz = (z.z0 + z.z1) / 2;
      const along = (gx - c.x) * head, off = Math.abs(c.z - gz) > 0.3 || Math.abs(Math.cos(c.yaw)) > 0.35;
      if (this.backing) {
        vt = -0.8;
        tx = c.x + 3 * head;
        tz = gz;
        if (along > 3) this.backing = false;
      } else {
        vt = clamp(along * 0.6, 0, 2);
        tx = c.x + Math.max(2.2, along) * head;
        tz = gz;
        if (off && along < 1 && Math.abs(c.v) < 0.1) this.backing = true;
      }
    }
    const err = wrap(yawTo(tx - c.x, tz - c.z) - c.yaw);
    const yr = c.yr || 0, wheel = wheelOverride ?? clamp(-(err * 0.9 - yr * 0.35), -0.8, 0.8) * (vt < 0 ? -0.6 : 1);
    o.hand[0].x += clamp(wheel * 0.45 - o.hand[0].x, -dt * 1.2, dt * 1.2);
    o.hand[1].x = o.hand[0].x;
    if (Math.abs(c.wheel - wheel) > 0.4 && vt > 0.6) vt = 0.6;
    if (this.hardBrake && st.type === "estop") return;
    this.hardBrake = false;
    const v = c.v;
    o.f = vt > 0.05 ? v < -0.05 ? -0.4 : clamp(vt / 5.2 + (vt - v) * 0.25, 0.06, 0.6) : vt < -0.05 ? v > 0.05 ? -0.4 : v < -0.9 ? 0 : -0.35 : clamp((vt - v) * 0.3, -0.4, 0);
  }
};
function blank(hand) {
  return { f: 0, t: 0, gait: 0, hand: hand || [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], act: [0, 0], grab: [0, 0], hy: 0, hp: 0, nod: 0, shake: 0, talk: 0, brow: 0, hat: 0, kid: false };
}
var Team = class {
  constructor(n, rng) {
    this.n = n;
    this.rng = rng;
    this.delay = Array.from({ length: n }, () => Math.round((0.22 + rng() * 0.25) * 60));
    this.hist = [];
    this.counters = Array.from({ length: n }, () => [0, 0, 0, 0, 0, 0]);
    this.part = "legs";
    this.switchT = 0;
    this.keep = 0;
    this.stay = 0;
    this.idle = {};
    this.idleMax = {};
    this.lastOut = null;
  }
  packets(Wd, out, dt) {
    this.hist.push(JSON.parse(JSON.stringify(out)));
    if (this.hist.length > 60) this.hist.shift();
    const late = (p) => this.hist[Math.max(0, this.hist.length - 1 - this.delay[p])];
    const s = Wd.seats, P = Array.from({ length: this.n }, () => emptyPacket());
    if (this.n === 1) return [this.solo(Wd, out, dt)];
    const owner = { legs: s.legs, armL: s.armL, armR: s.armR, head: s.head };
    for (let p = 0; p < this.n; p++) {
      const o = late(p), pk = P[p];
      if (owner.legs === p) pk.l = [o.f, o.t, o.gait];
      for (const [i, k] of [[0, "armL"], [1, "armR"]]) if (owner[k] === p) {
        pk.h[i] = [o.hand[i].x, o.hand[i].y, o.hand[i].z, o.act[i]];
        if (o.grab[i]) this.counters[p][i]++;
      }
      if (owner.head === p) {
        pk.hd = [o.hy, o.hp, o.nod | o.shake << 1 | o.talk << 2 | o.brow << 3];
        if (o.hat) this.counters[p][4]++;
      }
      pk.n = this.counters[p].slice();
      if (Wd.phase === "scatter") pk.k = this.kid(Wd, p);
    }
    this.track(Wd, dt, P);
    return P;
  }
  // one player, one part at a time: pick what matters most right now, switching costs a moment
  solo(Wd, o, dt) {
    const pk = emptyPacket(), b = Wd.body;
    const need = {
      legs: Math.abs(o.f) > 0.05 || Math.abs(o.t) > 0.05 || o.gait === GAIT.TIPTOE ? Wd.car ? 3 : Math.abs(o.f) > 0.2 ? 3 : 2 : 0,
      arms: o.grab[0] || o.grab[1] || o.act[0] || this.handGap(o) > 0.03 ? 2.5 : 0,
      head: o.nod || o.shake || o.talk || o.hat || Wd.car && Math.abs(o.hy) > 0.5 ? 3 : 0
    };
    if (Wd.car && this.held) {
      need.legs = Math.abs(o.f - this.keep) * 5 + (this.part === "legs" ? Math.abs(o.f) * 2 : 0);
      need.arms = Math.abs(o.hand[0].x - this.held.hand[0].x) * 9;
      need.head = o.nod || o.hat || Math.abs(o.hy - this.held.hy) > 0.3 ? 3.2 : 0;
    }
    this.stay -= dt;
    if (this.switchT > 0) {
      this.switchT -= dt;
    } else if (this.stay <= 0) {
      let best = this.part, bv = need[this.part] + 0.4;
      for (const k of ["legs", "arms", "head"]) if (need[k] > bv) {
        best = k;
        bv = need[k];
      }
      if (best !== this.part) {
        this.keep = this.part === "legs" && !Wd.car && Math.abs(o.t) < 0.3 && o.f > 0.2 ? o.f : 0;
        if (this.part === "legs" && Wd.car) this.keep = o.f;
        this.part = best;
        this.switchT = 0.3;
        this.stay = Wd.car ? 0.45 : 0.7;
      }
    }
    this.held ||= { hand: [{ x: 0, y: 0, z: 0, act: 0 }, { x: 0, y: 0, z: 0, act: 0 }], hy: 0 };
    const H = this.held, act = this.switchT > 0 ? null : this.part;
    if (act === "legs") {
      pk.l = [o.f, o.t, o.gait];
      this.keep = 0;
    } else pk.l = [this.keep, 0, 0];
    this.waveLeft = Math.max(0, (this.waveLeft || 0) - dt);
    if (act === "arms") {
      for (const i of [0, 1]) {
        H.hand[i] = { ...o.hand[i], act: o.act[i] };
        if (o.grab[i]) this.counters[0][i]++;
        if (o.act[i] === 1) this.waveLeft = 1.3;
      }
    }
    pk.h = [0, 1].map((i) => [H.hand[i].x, H.hand[i].y, H.hand[i].z, H.hand[i].act]);
    if (act === "head") {
      H.hy = o.hy;
      pk.hd = [o.hy, o.hp, o.nod | o.shake << 1 | o.talk << 2];
      if (o.hat) this.counters[0][4]++;
    } else pk.hd = [H.hy, 0, 0];
    if (act !== "arms") {
      for (const i of [0, 1]) if (H.hand[i].act) H.hand[i] = { ...H.hand[i], act: this.waveLeft > 0 ? 1 : 0 };
    }
    pk.n = this.counters[0].slice();
    if (Wd.phase === "scatter") pk.k = this.kid(Wd, 0);
    this.track(Wd, dt, [pk]);
    return pk;
  }
  // how far the hands I hold are from where the brain wants them
  handGap(o) {
    const H = this.held;
    if (!H) return 1;
    return Math.max(...[0, 1].map((i) => Math.abs(H.hand[i].x - o.hand[i].x) + Math.abs(H.hand[i].y - o.hand[i].y) + Math.abs(H.hand[i].z - o.hand[i].z)));
  }
  handMove(o) {
    const l = this.lastHands;
    this.lastHands = o.hand.map((h) => ({ ...h }));
    if (!l) return 0;
    return Math.max(...[0, 1].map((i) => Math.abs(l[i].x - o.hand[i].x) + Math.abs(l[i].z - o.hand[i].z) + Math.abs(l[i].y - o.hand[i].y)));
  }
  // in a Scatter, each player runs their kid straight for the alley (or to free a friend on the bench)
  kid(Wd, p) {
    const mine = Wd.kids.filter((k2) => k2.owner === p && !k2.caught);
    if (!mine.length) return [0, 0, 0];
    const k = mine.find((x) => x.lead) || mine[0];
    let tx = -7, tz = -4.6;
    const bench = Wd.kids.find((x) => x.caught && x.seat);
    if (bench && Wd.scatterT <= 0) {
      tx = bench.x;
      tz = bench.z;
    }
    const route = path(k.x, k.z, tx, tz);
    while (route.length > 1 && Math.hypot(route[0][0] - k.x, route[0][1] - k.z) < 0.6) route.shift();
    const [wx, wz] = route[0];
    const dx = wx - k.x, dz = wz - k.z, d = Math.hypot(dx, dz) || 1;
    return [-dx / d, dz / d, 0];
  }
  // how long each part has gone without anything to do
  track(Wd, dt, P) {
    if (Wd.phase !== "play") return;
    const s = Wd.seats, parts = this.n >= 4 ? ["legs", "armL", "armR", "head"] : ["legs", "arms", "head"];
    const prev = this.prevP || P;
    for (const part of parts) {
      let busy;
      if (part === "legs") {
        const pk = P[s.legs];
        busy = Math.abs(pk.l[0]) > 0.05 || Math.abs(pk.l[1]) > 0.05 || pk.l[2];
      } else if (part === "head") {
        const pk = P[s.head], pv = prev[s.head];
        busy = pk.hd[2] || Math.abs(pk.hd[0] - pv.hd[0]) > 3e-3 || pk.n[4] !== pv.n[4];
      } else {
        const hs = part === "armL" ? [0] : part === "armR" ? [1] : [0, 1];
        busy = hs.some((i) => {
          const own = i === 0 ? s.armL : s.armR, pk = P[own], pv = prev[own];
          return pk.h[i][3] || Math.abs(pk.h[i][0] - pv.h[i][0]) + Math.abs(pk.h[i][2] - pv.h[i][2]) + Math.abs(pk.h[i][1] - pv.h[i][1]) > 2e-3 || pk.n[i] !== pv.n[i] || Wd.items.some((it) => it.held === i);
        });
      }
      this.idle[part] = busy ? 0 : (this.idle[part] || 0) + dt;
      this.idleMax[part] = Math.max(this.idleMax[part] || 0, this.idle[part]);
    }
    this.prevP = JSON.parse(JSON.stringify(P));
  }
};

// test/sim/novice.js
var Novice = class {
  constructor(n, rng) {
    this.n = n;
    this.rng = rng;
    this.freeze = Array(n).fill(0);
    this.step = -1;
    this.miss = Array(n).fill(0);
    this.missT = 0;
    this.held = [];
  }
  apply(Wd, P, dt) {
    const r = this.rng, e = Wd.errand;
    const key = e.id + "/" + e.step;
    if (key !== this.step) {
      this.step = key;
      for (let p = 0; p < this.n; p++) this.freeze[p] = Math.max(this.freeze[p], 1.5 + r() * 3);
    }
    this.missT -= dt;
    if (this.missT <= 0) {
      this.missT = 4;
      for (let p = 0; p < this.n; p++) this.miss[p] = r() < 0.45 ? 1 : 0;
    }
    P.forEach((pk, p) => {
      if (this.freeze[p] > 0) {
        this.freeze[p] -= dt;
        if (this.held[p]) {
          pk.l = [0, 0, 0];
          pk.h = this.held[p].h;
          pk.hd = [this.held[p].hd[0], this.held[p].hd[1], 0];
        }
        return;
      }
      if (r() < 0.05 * dt * (this.n === 1 ? 1.6 : 1)) this.freeze[p] = 0.8 + r() * 2.2;
      if (pk.l[0] > 0.05 && !Wd.car) pk.l[0] = clamp(pk.l[0] * 1.15 + 0.08, -1, 1);
      pk.h = pk.h.map((h) => [h[0] + (r() - 0.5) * 0.05, h[1] + (r() - 0.5) * 0.05, h[2] + (r() - 0.5) * 0.04, h[3]]);
      if (this.miss[p]) pk.hd = [pk.hd[0], pk.hd[1], pk.hd[2] & ~1];
      this.held[p] = JSON.parse(JSON.stringify(pk));
    });
    return P;
  }
};
export {
  Brain,
  ERRANDS,
  Novice,
  Team,
  hostTalk,
  localJudge,
  newWorld,
  rankErrand,
  stepWorld
};
