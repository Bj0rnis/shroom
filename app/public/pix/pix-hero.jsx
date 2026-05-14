// pixel-header.jsx — animated SHROOM wordmark + favicon strip.

(function(){

const { C, PB, PixelStage, PixelStageAnim, paintDark, paintParchment,
        mulberry, rgba } = window.PIX;

// ── SHROOM glyphs · 11 wide × 13 tall, stout retro arcade ───────
const G = {
  'S': [
    '.#########.',
    '###########',
    '##.......##',
    '##.........',
    '##.........',
    '.##........',
    '..########.',
    '..#########',
    '.........##',
    '..........#',
    '##.......##',
    '###########',
    '.#########.',
  ],
  'H': [
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '###########',
    '###########',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
  ],
  'R': [
    '##########.',
    '###########',
    '##.......##',
    '##.......##',
    '##.......##',
    '###########',
    '##########.',
    '##..##.....',
    '##...##....',
    '##....##...',
    '##.....##..',
    '##......##.',
    '##.......##',
  ],
  'O': [
    '.#########.',
    '###########',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '###########',
    '.#########.',
  ],
  'M': [
    '##.......##',
    '###.....###',
    '####...####',
    '##.##.##.##',
    '##.##.##.##',
    '##..###..##',
    '##...#...##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
    '##.......##',
  ],
};

const GLYPH_W = 11, GLYPH_H = 13, GLYPH_GAP = 2;
const WORD = 'SHROOM';

function drawGlyph(pb, ch, x, y, main, hi, shadow) {
  const g = G[ch];
  for (let yy = 0; yy < g.length; yy++) {
    const row = g[yy];
    for (let xx = 0; xx < row.length; xx++) {
      const c = row[xx];
      if (c !== '#') continue;
      // top-edge of stroke → highlight
      const top = yy === 0 || g[yy-1][xx] !== '#';
      // bottom-edge of stroke → shadow
      const bot = yy === g.length - 1 || g[yy+1][xx] !== '#';
      let col = main;
      if (top && hi) col = hi;
      else if (bot && shadow) col = shadow;
      pb.set(x + xx, y + yy, col);
    }
  }
}

function drawWord(pb, x, y, main, hi, shadow) {
  let cx = x;
  for (const ch of WORD) {
    drawGlyph(pb, ch, cx, y, main, hi, shadow);
    cx += GLYPH_W + GLYPH_GAP;
  }
  return cx - GLYPH_GAP;
}

const WORD_W = WORD.length * GLYPH_W + (WORD.length - 1) * GLYPH_GAP;
const WORD_H = GLYPH_H;

// ── Mask of word pixels for hyphae routing ──────────────────────
function buildMask(W, H, wx, wy) {
  const mask = new Uint8Array(W * H);
  let cx = wx;
  for (const ch of WORD) {
    const g = G[ch];
    for (let yy = 0; yy < g.length; yy++) {
      const row = g[yy];
      for (let xx = 0; xx < row.length; xx++) {
        if (row[xx] === '#') {
          const px = cx + xx, py = wy + yy;
          if (px >= 0 && py >= 0 && px < W && py < H) {
            mask[py*W + px] = 1;
          }
        }
      }
    }
    cx += GLYPH_W + GLYPH_GAP;
  }
  // dilate mask 1px (keep a clear gutter around letters)
  const dil = new Uint8Array(W*H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mask[y*W+x]) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x+dx, ny = y+dy;
        if (nx>=0 && ny>=0 && nx<W && ny<H) dil[ny*W+nx] = 1;
      }
    }
  }
  return dil;
}

// Bake N filaments. Each is { path: [[x,y,branch?], ...] }.
function bakeHyphae(W, H, mask, count, seed, wordBox) {
  const r = mulberry(seed);
  const paths = [];
  for (let i = 0; i < count; i++) {
    // start at a random edge of the canvas
    const side = (r() * 4) | 0;
    let x, y, ang;
    if (side === 0)      { x = (r()*W)|0; y = 0;     ang =  Math.PI/2 + (r()-0.5)*1.0; }
    else if (side === 1) { x = W-1;       y = (r()*H)|0; ang =  Math.PI + (r()-0.5)*1.0; }
    else if (side === 2) { x = (r()*W)|0; y = H-1;   ang = -Math.PI/2 + (r()-0.5)*1.0; }
    else                 { x = 0;         y = (r()*H)|0; ang =  0 + (r()-0.5)*1.0; }

    const path = [];
    const maxLen = 90 + ((r()*80)|0);
    let stuck = 0;
    for (let j = 0; j < maxLen; j++) {
      ang += (r() - 0.5) * 0.6;
      const nx = x + Math.cos(ang), ny = y + Math.sin(ang);
      const ix = nx|0, iy = ny|0;
      const oob = (ix < 0 || iy < 0 || ix >= W || iy >= H);
      const hit = !oob && mask[iy*W + ix];
      if (oob || hit) {
        ang += Math.PI/2 * (r() < 0.5 ? 1 : -1) + (r()-0.5)*0.4;
        stuck++;
        if (stuck > 6) break;
        continue;
      }
      x = nx; y = ny; stuck = 0;
      path.push([ix, iy, 0]);
      // occasional branch
      if (r() < 0.05 && j > 6) {
        let bx = x, by = y, ba = ang + (r() < 0.5 ? -1 : 1);
        const blen = 4 + ((r()*10)|0);
        for (let k = 0; k < blen; k++) {
          ba += (r()-0.5)*0.4;
          bx += Math.cos(ba); by += Math.sin(ba);
          const bix = bx|0, biy = by|0;
          if (bix < 0 || biy < 0 || bix >= W || biy >= H) break;
          if (mask[biy*W + bix]) break;
          path.push([bix, biy, 1]);
        }
      }
    }
    paths.push({ path });
  }
  return paths;
}

// ── Scenery helpers (dirt + rocks + flora + life) ───────────────
function paintDirt(pb, x, y, w, h) {
  // depth gradient: humus brown → deep peat
  for (let yy = 0; yy < h; yy++) {
    const depth = yy / Math.max(1, h);
    const r = (60 - depth*30)|0;
    const g = (40 - depth*18)|0;
    const b = (22 - depth*10)|0;
    pb.hline(x, y+yy, w, [r, g, b]);
  }
  // grain
  const rng = mulberry(23);
  for (let i = 0; i < (w*h*0.22)|0; i++) {
    const px = (rng()*w)|0, py = (rng()*h)|0;
    const cc = rng() < 0.5 ? [40, 24, 12] : (rng() < 0.5 ? [72, 50, 30] : [56, 38, 22]);
    pb.set(x+px, y+py, cc, 0.6);
  }
  // humus highlight + root hints
  pb.hline(x, y, w, [78, 58, 36]);
  for (let i = 0; i < (w/30)|0; i++) {
    const px = (rng()*w)|0;
    const len = 3 + ((rng()*4)|0);
    for (let k = 0; k < len; k++) {
      pb.set(x+px+(k%2 ? 1 : 0), y+1+k, [70, 46, 22], 0.7);
    }
  }
}

function drawRocks(pb, x, y, w, h) {
  // hand-placed positions, normalized x / y-within-strip / size
  const placements = [
    [0.06, 0.40, 2], [0.14, 0.78, 1], [0.32, 0.55, 2],
    [0.48, 0.82, 1], [0.66, 0.42, 2], [0.82, 0.65, 1], [0.94, 0.30, 2],
  ];
  const dark = [54, 48, 38], mid = [108, 98, 84], hi = [148, 138, 120];
  placements.forEach(([fx, fy, sz]) => {
    const cx = (fx*w)|0, cy = y + (fy*h)|0;
    for (let dy = -sz+1; dy <= sz; dy++) for (let dx = -sz; dx <= sz; dx++) {
      const d = Math.sqrt(dx*dx + dy*dy*1.3);
      if (d > sz+0.5) continue;
      let cc = mid;
      if (d > sz) cc = dark;
      else if (dx <= -sz*0.3 && dy <= 0) cc = hi;
      else if (dy >= sz*0.4) cc = dark;
      pb.set(x+cx+dx, cy+dy, cc);
    }
    // tiny moss on a couple of them
    if (fx > 0.5 && sz === 2) pb.set(x+cx-1, cy-sz, [108, 132, 64]);
  });
}

function drawDirtFlora(pb, groundY, W, t) {
  // grass blades
  const rng = mulberry(37);
  const bladeCount = (W / 14)|0;
  for (let i = 0; i < bladeCount; i++) {
    const bx = (rng()*W)|0;
    const bh = 1 + ((rng()*2)|0);
    const sway = Math.sin(t*0.7 + bx*0.13);
    for (let k = 0; k < bh; k++) {
      const off = k > 0 ? (sway > 0.3 ? 1 : sway < -0.3 ? -1 : 0) : 0;
      pb.set(bx + off, groundY - 1 - k, [86, 104, 52], 0.92);
    }
  }
  // tiny mushrooms — varied hues, sprouting from the dirt edge
  const shrooms = [
    { fx: 0.06, hue: 'ember',  stemH: 3 },
    { fx: 0.20, hue: 'cool',   stemH: 4 },
    { fx: 0.36, hue: 'green',  stemH: 2 },
    { fx: 0.52, hue: 'violet', stemH: 3 },
    { fx: 0.68, hue: 'ember',  stemH: 2 },
    { fx: 0.86, hue: 'cool',   stemH: 4 },
    { fx: 0.96, hue: 'green',  stemH: 3 },
  ];
  shrooms.forEach(({ fx, hue, stemH }) => {
    const palette = (hue === 'cool')   ? { cap: [120, 168, 200], hi: [184, 220, 240] }
                  : (hue === 'green')  ? { cap: [144, 168,  88], hi: [200, 220, 140] }
                  : (hue === 'violet') ? { cap: [184, 144, 200], hi: [224, 188, 232] }
                  :                      { cap: C.ember,         hi: C.emberHi };
    const cx = (fx*W)|0;
    const baseY = groundY - 1;
    const topY = baseY - stemH;
    // stem
    pb.vline(cx, topY+1, stemH, C.text2);
    pb.set(cx, baseY, [56, 50, 36]);
    // cap (a chunky 3-row dome)
    pb.hline(cx-1, topY,   3, palette.cap);
    pb.set(cx, topY-1,        palette.hi);
    pb.hline(cx-2, topY+1, 5, palette.cap);
    pb.set(cx-2, topY+1, [palette.cap[0]-30, palette.cap[1]-30, palette.cap[2]-30]);
    pb.set(cx+2, topY+1, [palette.cap[0]-30, palette.cap[1]-30, palette.cap[2]-30]);
    pb.set(cx-1, topY+1, palette.hi);
    // gill shadow under cap
    pb.set(cx, topY+2, [40, 32, 22]);
    // breathing glow above (cool blue is locked ~3× warmer)
    const breath = 0.55 + Math.sin(t*1.2 + cx) * 0.3;
    const glowA = (hue === 'cool') ? 0.55 : 0.32;
    pb.set(cx,   topY-2, palette.hi, glowA * breath);
    pb.set(cx-1, topY-2, palette.hi, glowA * breath * 0.5);
    pb.set(cx+1, topY-2, palette.hi, glowA * breath * 0.5);
    pb.set(cx,   topY-3, palette.hi, glowA * breath * 0.4);
  });
}

function drawGlowworm(pb, groundY, W, t) {
  // slow drift along the soil surface
  const period = 18;
  const u = ((t / period) % 1);
  const cx = (u * (W + 14) - 7)|0;
  const baseY = groundY + 2;
  for (let i = 0; i < 6; i++) {
    const bx = cx - i;
    const by = baseY + (Math.sin(u * Math.PI * 4 + i*0.4) * 1.2)|0 + (i > 3 ? -1 : 0);
    const a = 1 - i*0.14;
    const col = i < 2 ? [232, 244, 140] : [148, 172, 88];
    pb.set(bx, by, col, a);
  }
  // head halo
  pb.set(cx,   baseY - 1, [248, 252, 196], 0.55);
  pb.set(cx+1, baseY,     [248, 252, 196], 0.45);
  pb.set(cx-1, baseY,     [248, 252, 196], 0.35);
}

function drawSpores(pb, W, groundY, t) {
  const sources = [0.06, 0.20, 0.36, 0.52, 0.68, 0.86, 0.96];
  sources.forEach((fx, i) => {
    const sx = (fx*W)|0;
    const period = 5 + (i%3);
    for (let n = 0; n < 3; n++) {
      const phase = ((t / period) + n*0.33 + i*0.11) % 1;
      const py = groundY - 6 - (phase * (groundY - 8))|0;
      const drift = Math.sin(phase * Math.PI * 4 + i) * 3;
      const px = sx + (drift|0);
      const a = (1 - phase) * 0.55;
      pb.set(px, py, [232, 220, 160], a);
    }
  });
}

function drawSkyLife(pb, W, groundY, t) {
  // faint static stars in upper sky
  const r = mulberry(13);
  for (let i = 0; i < 14; i++) {
    const sx = (r()*W)|0, sy = (r()*(groundY-8))|0;
    pb.set(sx, sy, [200, 200, 200], 0.18 + r()*0.18);
  }
  // 2 fireflies drifting in figure-8 paths, breathing in/out
  for (let k = 0; k < 2; k++) {
    const cx = ((Math.sin(t*0.32 + k*1.7) * 0.36 + 0.5) * W)|0;
    const cy = ((Math.sin(t*0.5  + k*2.3) * 0.28 + 0.4) * groundY)|0;
    const a  = 0.4 + Math.sin(t*3 + k*1.4) * 0.35;
    pb.set(cx,   cy,   [232, 232, 130], a);
    pb.set(cx+1, cy,   [232, 232, 130], a*0.55);
    pb.set(cx-1, cy,   [232, 232, 130], a*0.55);
    pb.set(cx,   cy+1, [232, 232, 130], a*0.55);
    pb.set(cx,   cy-1, [232, 232, 130], a*0.55);
  }
}

// ── HERO ───────────────────────────────────────────────────────
function ShroomHero({ srcW = 240, srcH = 80, scale = 4 }) {
  const cacheRef = React.useRef(null);
  return (
    <PixelStageAnim w={srcW} h={srcH} scale={scale} draw={(pb, ctx, t) => {
      // ── Scene layout ────────────────────────
      const groundY = (srcH * 0.78)|0;

      // sky + dirt
      paintDark(pb, 0, 0, srcW, groundY);
      drawSkyLife(pb, srcW, groundY, t);
      paintDirt(pb, 0, groundY, srcW, srcH - groundY);
      drawRocks(pb, 0, groundY, srcW, srcH - groundY);
      drawDirtFlora(pb, groundY, srcW, t);
      drawGlowworm(pb, groundY, srcW, t);
      drawSpores(pb, srcW, groundY, t);

      const wx = ((srcW - WORD_W)/2)|0;
      const wy = ((srcH - WORD_H)/2)|0;

      // bake mask & paths once per size
      if (!cacheRef.current || cacheRef.current.W !== srcW || cacheRef.current.H !== srcH) {
        const mask = buildMask(srcW, srcH, wx, wy);
        const paths = bakeHyphae(srcW, srcH, mask, 22, 31, { wx, wy });
        cacheRef.current = { W: srcW, H: srcH, mask, paths, wx, wy };
      }
      const cache = cacheRef.current;

      // ── Hyphae layer (behind word) ────────────────────
      // Each filament has its own phase; the tip advances over `cycleSec`
      // seconds then loops. Old segments fade out behind the tip.
      const cycleSec = 22;
      cache.paths.forEach((p, i) => {
        const path = p.path;
        if (!path.length) return;
        const phase = ((t / cycleSec) + (i * 0.13)) % 1;
        const tipAt = phase * (path.length + 36) - 36;
        const tailLen = 42;
        const fromIdx = Math.max(0, (tipAt - tailLen)|0);
        const toIdx = Math.min(path.length, tipAt|0);
        for (let k = fromIdx; k < toIdx; k++) {
          const [px, py, branch] = path[k];
          const distFromTip = tipAt - k;
          // tip = brightest cream → body = warm hypha → tail fades to nothing
          let col = C.hypha;
          if (distFromTip < 1.2) col = C.hyphaTip;
          else if (distFromTip < 4) col = C.hyphaHi;
          let a = Math.max(0, Math.min(1, 1 - distFromTip/tailLen));
          if (branch) a *= 0.7;
          pb.set(px, py, col, a);
        }
        // halo around the tip (1-px ring at sub-alpha)
        if (toIdx > 0 && toIdx < path.length) {
          const [tx, ty] = path[toIdx-1];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (cache.mask[(ty+dy)*srcW + (tx+dx)]) continue;
            pb.set(tx+dx, ty+dy, C.hyphaTip, 0.22);
          }
        }
      });

      // ── Word with breathing under-glow ───────────────
      // glow first (behind/under the letters)
      const breath = 0.55 + Math.sin(t * 0.9) * 0.18;
      // a warm pad behind the bottom of letters
      for (let dy = 0; dy < 8; dy++) {
        const a = Math.max(0, 0.14 - dy*0.014) * breath;
        for (let dx = -3; dx < WORD_W + 3; dx++) {
          // only paint where not under a letter pixel itself (mask)
          const px = wx + dx, py = wy + WORD_H + dy;
          if (px < 0 || py < 0 || px >= srcW || py >= srcH) continue;
          pb.set(px, py, C.emberHi, a);
        }
      }
      // word, top-row highlight + bottom-row shadow
      drawWord(pb, wx, wy, C.ember, C.emberHi, [120, 64, 32]);

      // tiny mushroom-dot charm — centered above the wordmark's midpoint
      const dotX = wx + ((WORD_W - 3) / 2 | 0);
      const dotY = wy - 5;
      // cap
      pb.rect(dotX, dotY, 3, 1, C.ember);
      pb.rect(dotX-1, dotY+1, 5, 2, C.ember);
      pb.hline(dotX-1, dotY+1, 5, C.emberHi);
      // stem
      pb.set(dotX+1, dotY+3, C.text2);

      // Tagline (faint, all-caps · mock-Latin)
      const tag = 'MYCELIUM SILENTIUM';
      const tagW = pb.measure(tag, { size: 'xs' });
      pb.text(tag, ((srcW - tagW)/2)|0, wy + WORD_H + 6, C.text2, { size: 'xs' });
    }} />
  );
}

// ── FAVICON STRIP ───────────────────────────────────────────────
// Same 16×16 source mark, rendered at integer scales 1×, 2×, 4×.
// Then a separate "mark + wordmark" lockup at the right.

const MARK = [
  '................',
  '......###.......',
  '....#######.....',
  '...#########....',
  '..###########...',
  '..####***####...',
  '.#############..',
  '.##############.',
  '.##############.',
  '..############..',
  '...##########...',
  '.....######.....',
  '.......##.......',
  '.......##.......',
  '......####......',
  '.....######.....',
];

function drawMark(pb, x, y, s, season) {
  // season picks the cap color
  const capColor = season === 'cool' ? [120, 168, 200]
                 : season === 'green' ? [144, 168, 88]
                 : C.ember;
  for (let yy = 0; yy < MARK.length; yy++) {
    const row = MARK[yy];
    for (let xx = 0; xx < row.length; xx++) {
      const ch = row[xx];
      if (ch === '.') continue;
      let col;
      if (ch === '*') col = C.emberHi;
      else if (yy < 6)  col = capColor;
      else if (yy < 11) col = capColor;
      else if (yy === 11) col = C.inkHi; // gill shadow
      else if (yy < 14) col = C.text2; // stem
      else col = C.textFaint; // base
      pb.rect(x + xx*s, y + yy*s, s, s, col);
    }
  }
}

window.SHROOM = Object.assign(window.SHROOM || {}, { ShroomHero });

})();
