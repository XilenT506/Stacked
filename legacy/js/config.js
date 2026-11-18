// Shared constants and small maths helpers. Everything tunable lives in CFG.
export const T = globalThis.THREE;
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (dt, rate) => 1 - Math.exp(-rate * dt);
export const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
// Yaw 0 looks along +z. Turning right makes yaw smaller.
export const fwd = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
export const rgt = (yaw) => [-Math.cos(yaw), Math.sin(yaw)];
export const yawTo = (dx, dz) => Math.atan2(dx, dz);
export const r2 = (v) => Math.round(v * 100) / 100;
export const r3 = (v) => Math.round(v * 1000) / 1000;

// Colours taken from the key art: warm late afternoon, flat toy colours, dark coat.
export const PAL = {
  sky: 0xf8cfa4, fog: 0xf6c59a, ground: 0xe7b98f, road: 0xb98a72, pave: 0xf2d6b3,
  cream: 0xfaecd6, peach: 0xf0b08a, terracotta: 0xc9694a, teal: 0x4f8a8b, mustard: 0xe0a83a,
  coat: 0x6b4838, collar: 0x7a5344, hat: 0x5e4436, band: 0xb8804a, skin: 0xf2b98c, hair: 0xb5482e, bag: 0x7fae4e, wood: 0x9a5f3c,
  stone: 0xf3e3c8, glow: 0xffd98a, leaf: 0x7fa650, pot: 0xc97850, lamp: 0x2e2622, frame: 0x3f7f80,
  alley: 0x8fb58a, wet: 0x7fb7c9, coin: 0xf2c230, ink: 0x1b1f4a, white: 0xfff7ea,
  kids: [0xe2694f, 0x4f9fc9, 0x7fbf5f, 0xe0a83a],
  people: [0x8c5aa0, 0x4f7f9f, 0x3f5f7a],
};

export const CFG = {
  // walking
  walkSpeed: 2.2, tipSpeed: 0.9, walkAccel: 6, tipAccel: 2.5, turnRate: 1.9, bodyR: 0.32,
  strideSpeed: 3.0, strideAccel: 8, strideWobble: 1.25, shuffleSpeed: 0.55, shuffleAccel: 3, shuffleSteady: 1.6,
  // disguise: points needed for levels 1, 2, 3; platform shoes add height and take away balance
  levels: [3, 7, 12], platform: 0.18, platformSteady: 0.85, disguiseFool: 0.85,
  // wobble: a broom balanced on a hand
  restore: 14, damping: 2.2, tipForce: 9, safeLean: 0.22, stumLean: 0.4, fallLean: 0.55,
  accelToLean: 0.4, handToLean: 3, giggle: 0.35, downTime: 2.6,
  // kids
  kidH: 0.55, kidSpeed: 4.3, kidR: 0.2,
  // townspeople
  sightRange: 9, sightHalf: 1.05, chaseSpeed: 2.9, shock: 3.5, greetGap: 4, strollSpeed: 1.15,
  // the afternoon
  clock: 200, startMoney: 20, scatterTime: 20,
};

// Event ids sent from the host to every screen (sounds, banners).
export const E = {
  FALL: 1, STUMBLE: 2, RIP: 3, GASP: 4, REGISTER: 5, YELP: 6, CLANG: 7, COIN: 8, SLIP: 9, CAUGHT: 10,
  FREED: 11, RESTACK: 12, BANNER: 13, DROP: 14, HOPOUT: 15, HOPIN: 16, SWAP: 17, HAT: 18, SIGNED: 19,
  END: 20, UP: 21, CALM: 22, BUMP: 23, GRAB: 24, PAT: 25, POINT: 26, LEVEL: 27, LOOK: 28,
  WORST: 29, STEP: 30, LAPSE: 31, LAPSEEND: 32, GUST: 33, HIC: 34, NEXT: 35, ASK: 36,
};

export const GAIT = { WALK: 0, TIPTOE: 1, STRIDE: 2, SHUFFLE: 3 };
export const levelFor = (pts) => CFG.levels.filter((n) => pts >= n).length;

export const BANNERS = [
  'Three kids. One coat. Act normal.', 'TIMBER!', 'Nobody saw that. Probably.',
  'BUSTED! Everybody back to the alley!', 'Back in the coat. They are still suspicious.',
  'One kid out. The coat is shorter and wobblier.', 'Restacked.', 'Places swapped!',
  'Found a coin!', 'Only in the alley.', 'Bring the kid back to the coat first.',
  'WHOA, slippery!', 'You kicked the dog.', 'Smooth. Very adult.',
  'Disguise level 1: a fake moustache!', 'Disguise level 2: platform shoes! Taller, wobblier.',
  'Disguise level 3: a periscope hat! Legs can peek.', 'Fooled them! +1 disguise point', 'Clean errand! +3 disguise points',
  'He is not looking! Nods and hat tips count double.', 'He is watching again.', 'A gust of wind!', 'Hic!',
  'A question! Head: press T and answer out loud (or Enter to type).',
];

export const LINES = [
  'Afternoon!', 'Are you lost, sir?', 'Lovely day!', 'Hmph. Rude.', 'Next, please!',
  'Sign on the line, please.', '...Is that a signature?', 'Thank you, sir.', 'Have a nice day!',
  'THOSE ARE CHILDREN!', 'Got you!', 'Watch it!', 'Good afternoon, sir.', 'Very good, sir.',
  'Stop right there!', 'Hm?', 'Lost? You said you were lost?', 'Hm? Where?', 'How rude!', 'Oh, I do that too.', "Won't be a moment, sir.", 'Hold it flat, please, sir.',
  'What can I get you, dear?', 'Two coins. Ta, love!', 'Bit short for this film, sir?', 'Enjoy the film, sir.',
  'Check your mirrors, please.', "Lovely weather, isn't it?", 'Achoo!', '*phone rings* Hello?', 'Where is my pen...',
  'Mind the cones!', 'Stop at the line, please.', 'Now park in the box, please.', 'You ran the line!', 'Very good. A pass!',
  'Ready when you are.', 'Mind the kerb!', 'STOP!', 'Good reactions.', 'Too slow!', 'Turn her round, please.', 'Do keep up, sir.',
];
