globalThis.THREE = {};
const { newWorld, stepWorld } = await import('../js/game.js');
const { emptyPacket } = await import('../js/parts.js');
const W = newWorld(['solo']); W.body.x = 0.6; W.body.z = 0.6;
W.people[2].sus = 0.999; W.body.down = 1;
for (let i = 0; i < 40; i++) { stepWorld(W, 1 / 60, [emptyPacket()]); if (i % 5 === 0 || W.phase !== 'play') console.log(i, W.phase, W.end, JSON.stringify(W.kids.map((k) => [k.x.toFixed(1), k.z.toFixed(1), k.caught])), W.scatterT.toFixed(2)); if (W.phase === 'end') break; }
