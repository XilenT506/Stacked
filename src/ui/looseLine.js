// where your kids are, and only what's true (M1-F11): loose ones you can walk over, the ones a grown-up is
// carrying off, the ones in the Lost & Found
export function looseLine(loose) {
  const n = (f) => loose.filter(f).length, s = (k) => (k > 1 ? 's' : '');
  const free = n((k) => !k.carriedBy && !k.caged), off = n((k) => k.carriedBy && !k.caged), caged = n((k) => k.caged);
  return (free ? ` · ${free} kid${s(free)} loose! walk over them` : '') + (off ? ` · ${off} kid${s(off)} being carried to the Lost & Found` : '') + (caged ? ` · ${caged} kid${s(caged)} in the Lost & Found` : '');
}
