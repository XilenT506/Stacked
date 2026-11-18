// Everything the Game needs, loaded from the data files (for logic tests).
import { readFileSync } from 'node:fs';
const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
export const DATA = {
  place: J('data/places/supermarket.json'), events: J('data/places/supermarket/events.json'), things: J('data/interactables.json'),
  signals: J('data/signals.json'), balance: J('data/balance.json'), grownups: J('data/grownups.json'), gadgets: J('data/gadgets.json'), loot: J('data/loot.json'),
  crayonmap: J('data/crayonmap.json'),
};
