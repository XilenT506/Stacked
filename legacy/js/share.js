// A picture of the round to post: the rank, the worst moment, and what was said out loud.
// Drawn on a canvas at 1080 x 1350 (a tall social-media picture).
const INK = '#33201a', CREAM = '#fff3e2', PAPER = '#fffaf2', RED = '#c4553d', MUSTARD = '#e9a93a';
const RANK_COL = { S: '#f4c542', A: '#8fc46a', B: '#6fb3c4', C: '#d9a07a', D: '#b9a39a' };
const FONT = (w, px) => `${w} ${px}px Fredoka, "Trebuchet MS", "Segoe UI", sans-serif`;

function wrap(g, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
function box(g, x, y, w, h, r, fill) {
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
}
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function shareCard(card, snap) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  try { await document.fonts?.ready; } catch { /* fine */ }
  g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
  // title: STACKED with the two red letters, as on the menu
  g.font = FONT(800, 120); g.textBaseline = 'alphabetic';
  let x = 60; for (const [i, ch] of [...'STACKED'].entries()) { g.fillStyle = i === 2 || i === 5 ? RED : INK; g.fillText(ch, x, 160); x += g.measureText(ch).width + 4; }
  g.font = FONT(600, 34); g.fillStyle = INK; g.fillText(card.daily ? `Today's town \u00b7 ${card.daily}` : 'Three kids. One trench coat. Totally one adult.', 62, 212);
  // rank badge and title
  const rank = card.afternoon ? card.afternoon.rank : card.rank;
  g.beginPath(); g.arc(W - 140, 120, 82, 0, Math.PI * 2); g.fillStyle = RANK_COL[rank] || MUSTARD; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.font = FONT(800, 110); g.textAlign = 'center'; g.fillText(rank, W - 140, 158); g.textAlign = 'left';
  // the worst moment
  let y = 250;
  const img = await loadImg(snap);
  if (img) {
    // a wide crop of the moment (cut a little off the top, where the on-screen bars were)
    const iw = W - 120, ih = 430, sh = img.width * ih / iw, sy = Math.max(0, Math.min(img.height - sh, img.height * 0.12));
    g.save(); g.beginPath(); g.roundRect(60, y, iw, ih, 28); g.clip(); g.drawImage(img, 0, sy, img.width, sh, 60, y, iw, ih); g.restore();
    g.beginPath(); g.roundRect(60, y, iw, ih, 28); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    // a caption tab on the picture
    g.font = FONT(700, 30); const cap = 'Worst moment: ' + card.worst, cw = Math.min(iw - 40, g.measureText(cap).width + 40);
    box(g, 80, y + ih - 70, cw, 52, 16, PAPER); g.fillStyle = INK; g.fillText(cap.length > 60 ? cap.slice(0, 58) + '…' : cap, 100, y + ih - 33);
    y += ih + 30;
  }
  // title of the round
  g.font = FONT(800, 50); g.fillStyle = INK; g.fillText(card.title, 60, y + 44); y += 70;
  g.font = FONT(600, 30); g.fillStyle = '#6b5048';
  const why = (card.why || []).map((w) => w.replace(/★/g, '').trim()).join('  ·  ');
  for (const l of wrap(g, why, W - 120).slice(0, 2)) { g.fillText(l, 60, y + 26); y += 38; }
  y += 16;
  // what was said out loud, or a grown-up's quote
  const lines = card.lines && card.lines.length ? card.lines : null;
  const blocks = lines ? lines.map((l) => ({ tag: l.tag, big: '“' + l.said + '”', small: `${l.who}: “${l.reply}”` }))
    : (card.quotes || []).slice(0, 2).map((q) => ({ tag: q.who, big: q.text, small: '' }));
  for (const b of blocks) {
    if (y > H - 200) break;
    g.font = FONT(700, 38); const bigL = wrap(g, b.big, W - 180).slice(0, 3);
    g.font = FONT(600, 30); const smallL = b.small ? wrap(g, b.small, W - 180).slice(0, 2) : [];
    const h = 64 + bigL.length * 46 + smallL.length * 38 + 10;
    if (y + h > H - 90) break;
    box(g, 60, y, W - 120, h, 24, PAPER);
    g.font = FONT(700, 26); g.fillStyle = RED; g.fillText(b.tag.toUpperCase(), 90, y + 42);
    g.font = FONT(700, 38); g.fillStyle = INK; bigL.forEach((l, i) => g.fillText(l, 90, y + 92 + i * 46));
    g.font = FONT(600, 30); g.fillStyle = '#6b5048'; smallL.forEach((l, i) => g.fillText(l, 90, y + 92 + bigL.length * 46 + i * 38));
    y += h + 20;
  }
  g.font = FONT(600, 26); g.fillStyle = '#8a6d62'; g.fillText('Play STACKED with 1–4 friends', 60, H - 40);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

// save the picture: through the page's download permission on claude.ai, or a plain download link elsewhere
let dl;
export async function savePicture(blob, name) {
  if (dl === undefined) { try { dl = globalThis.claude?.use ? await Promise.race([globalThis.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 4000))]) : null; } catch { dl = null; } }
  if (dl) { try { await dl.save({ filename: name, data: blob }); return 'saved'; } catch (e) { return e?.code === 'declined' ? 'declined' : 'failed'; } }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return 'saved'; } catch { return 'failed'; }
}
