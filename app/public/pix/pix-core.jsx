// pixel-core.jsx — pixel-art primitives for the Shroom UI kit.
// Source-grid canvas + 5×7 font + 3×5 micro font + 3 surfaces + draw helpers.

(function(){

// ── Palette ─────────────────────────────────────────────────────
const C = {
  // Dark surface (warm ink)
  ink:        [10,  9,  8],
  inkLo:      [22, 19, 15],
  inkMd:      [38, 33, 26],
  inkHi:      [58, 52, 40],
  ink2:       [82, 73, 56],
  text:       [212, 205, 184],
  textHi:     [232, 223, 200],
  text2:      [168, 154, 120],
  textDim:    [122, 112, 96],
  textFaint:  [82,  74,  60],
  ember:      [200, 144, 88],
  emberHi:    [232, 184, 120],
  emberLo:    [144,  96, 56],
  danger:     [200, 112, 88],
  hypha:      [224, 184, 120],
  hyphaHi:    [248, 220, 168],
  hyphaTip:   [255, 236, 196],
  cool:       [120, 168, 200],
  glow:       [232, 200, 132],
  // Parchment
  paper:      [212, 195, 160],
  paperLo:    [188, 168, 132],
  paperHi:    [228, 212, 180],
  paperInk:   [58,  42,  28],
  paperSoft:  [100, 72,  48],
  paperSpot:  [142, 100, 64],
  paperEmber: [168, 100, 52],
  // Wood (oak log)
  woodLo:     [40,  24,  12],
  woodMd:     [78,  50,  28],
  woodHi:     [108, 76,  44],
  woodTop:    [142, 100, 58],
  woodGrain:  [50,  30,  14],
  woodMoss:   [76,  98,  48],
};

// ── Bit-pattern fonts ───────────────────────────────────────────
// 5×7 body font · MSB is leftmost column.
const F = (a,b,c,d,e,f,g) => [a,b,c,d,e,f,g];
const F57 = {
  'A': F(0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001),
  'B': F(0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110),
  'C': F(0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110),
  'D': F(0b11100,0b10010,0b10001,0b10001,0b10001,0b10010,0b11100),
  'E': F(0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111),
  'F': F(0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000),
  'G': F(0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01111),
  'H': F(0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001),
  'I': F(0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110),
  'J': F(0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100),
  'K': F(0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001),
  'L': F(0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111),
  'M': F(0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001),
  'N': F(0b10001,0b10001,0b11001,0b10101,0b10011,0b10001,0b10001),
  'O': F(0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110),
  'P': F(0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000),
  'Q': F(0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101),
  'R': F(0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001),
  'S': F(0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110),
  'T': F(0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100),
  'U': F(0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110),
  'V': F(0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100),
  'W': F(0b10001,0b10001,0b10001,0b10101,0b10101,0b10101,0b01010),
  'X': F(0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001),
  'Y': F(0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100),
  'Z': F(0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111),
  '0': F(0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110),
  '1': F(0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110),
  '2': F(0b01110,0b10001,0b00001,0b00110,0b01000,0b10000,0b11111),
  '3': F(0b11110,0b00001,0b00001,0b01110,0b00001,0b00001,0b11110),
  '4': F(0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010),
  '5': F(0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110),
  '6': F(0b00110,0b01000,0b10000,0b11110,0b10001,0b10001,0b01110),
  '7': F(0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000),
  '8': F(0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110),
  '9': F(0b01110,0b10001,0b10001,0b01111,0b00001,0b00010,0b01100),
  ' ': F(0,0,0,0,0,0,0),
  '.': F(0,0,0,0,0,0,0b00100),
  ',': F(0,0,0,0,0,0b00100,0b01000),
  ':': F(0,0,0b00100,0,0,0b00100,0),
  ';': F(0,0,0b00100,0,0,0b00100,0b01000),
  '-': F(0,0,0,0b01110,0,0,0),
  '_': F(0,0,0,0,0,0,0b11111),
  "'": F(0b00100,0b00100,0,0,0,0,0),
  '"': F(0b01010,0b01010,0,0,0,0,0),
  '!': F(0b00100,0b00100,0b00100,0b00100,0b00100,0,0b00100),
  '?': F(0b01110,0b10001,0b00010,0b00100,0,0b00100,0),
  '/': F(0b00001,0b00010,0b00100,0b00100,0b01000,0b10000,0b10000),
  '\\':F(0b10000,0b01000,0b00100,0b00100,0b00010,0b00001,0b00001),
  '·': F(0,0,0,0b00100,0,0,0),
  '&': F(0b01100,0b10010,0b10100,0b01000,0b10101,0b10010,0b01101),
  '+': F(0,0,0b00100,0b01110,0b00100,0,0),
  '*': F(0,0b01010,0b00100,0b11111,0b00100,0b01010,0),
  '(': F(0b00010,0b00100,0b01000,0b01000,0b01000,0b00100,0b00010),
  ')': F(0b01000,0b00100,0b00010,0b00010,0b00010,0b00100,0b01000),
  '[': F(0b01110,0b01000,0b01000,0b01000,0b01000,0b01000,0b01110),
  ']': F(0b01110,0b00010,0b00010,0b00010,0b00010,0b00010,0b01110),
  '=': F(0,0,0b11111,0,0b11111,0,0),
  '<': F(0,0b00010,0b00100,0b01000,0b00100,0b00010,0),
  '>': F(0,0b01000,0b00100,0b00010,0b00100,0b01000,0),
  '×': F(0,0,0b10001,0b01010,0b00100,0b01010,0b10001),
  '◆': F(0,0b00100,0b01110,0b11111,0b01110,0b00100,0),
  '↑': F(0b00100,0b01110,0b10101,0b00100,0b00100,0b00100,0b00100),
  '↓': F(0b00100,0b00100,0b00100,0b00100,0b10101,0b01110,0b00100),
  '→': F(0,0b00100,0b00010,0b11111,0b00010,0b00100,0),
  '←': F(0,0b00100,0b01000,0b11111,0b01000,0b00100,0),
  '✓': F(0,0,0,0b00001,0b00010,0b10100,0b01000),
};

// 3×5 micro font · MSB leftmost
const T = (a,b,c,d,e) => [a,b,c,d,e];
const F35 = {
  'A': T(0b010,0b101,0b111,0b101,0b101),
  'B': T(0b110,0b101,0b110,0b101,0b110),
  'C': T(0b011,0b100,0b100,0b100,0b011),
  'D': T(0b110,0b101,0b101,0b101,0b110),
  'E': T(0b111,0b100,0b110,0b100,0b111),
  'F': T(0b111,0b100,0b110,0b100,0b100),
  'G': T(0b011,0b100,0b101,0b101,0b011),
  'H': T(0b101,0b101,0b111,0b101,0b101),
  'I': T(0b111,0b010,0b010,0b010,0b111),
  'J': T(0b001,0b001,0b001,0b101,0b010),
  'K': T(0b101,0b110,0b100,0b110,0b101),
  'L': T(0b100,0b100,0b100,0b100,0b111),
  'M': T(0b101,0b111,0b111,0b101,0b101),
  'N': T(0b101,0b111,0b111,0b111,0b101),
  'O': T(0b010,0b101,0b101,0b101,0b010),
  'P': T(0b110,0b101,0b110,0b100,0b100),
  'Q': T(0b010,0b101,0b101,0b111,0b011),
  'R': T(0b110,0b101,0b110,0b101,0b101),
  'S': T(0b011,0b100,0b010,0b001,0b110),
  'T': T(0b111,0b010,0b010,0b010,0b010),
  'U': T(0b101,0b101,0b101,0b101,0b011),
  'V': T(0b101,0b101,0b101,0b101,0b010),
  'W': T(0b101,0b101,0b111,0b111,0b101),
  'X': T(0b101,0b101,0b010,0b101,0b101),
  'Y': T(0b101,0b101,0b010,0b010,0b010),
  'Z': T(0b111,0b001,0b010,0b100,0b111),
  '0': T(0b111,0b101,0b101,0b101,0b111),
  '1': T(0b010,0b110,0b010,0b010,0b111),
  '2': T(0b110,0b001,0b010,0b100,0b111),
  '3': T(0b110,0b001,0b110,0b001,0b110),
  '4': T(0b101,0b101,0b111,0b001,0b001),
  '5': T(0b111,0b100,0b110,0b001,0b110),
  '6': T(0b011,0b100,0b111,0b101,0b111),
  '7': T(0b111,0b001,0b010,0b010,0b010),
  '8': T(0b111,0b101,0b111,0b101,0b111),
  '9': T(0b111,0b101,0b111,0b001,0b110),
  ' ': T(0,0,0,0,0),
  '.': T(0,0,0,0,0b010),
  ',': T(0,0,0,0b010,0b100),
  '-': T(0,0,0b111,0,0),
  ':': T(0,0b010,0,0b010,0),
  '·': T(0,0,0b010,0,0),
  '/': T(0b001,0b001,0b010,0b100,0b100),
  "'": T(0b010,0b010,0,0,0),
  '!': T(0b010,0b010,0b010,0,0b010),
  '?': T(0b110,0b001,0b010,0,0b010),
  '+': T(0,0b010,0b111,0b010,0),
  '×': T(0b101,0b010,0b101,0,0),
  '◆': T(0b010,0b111,0b010,0,0),
};

const rgba = (c, a=1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ── Deterministic RNG ─────────────────────────────────────
function mulberry(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── PixelBuffer wrapper ───────────────────────────────────
class PB {
  constructor(ctx, w, h) { this.ctx = ctx; this.w = w; this.h = h; }
  clr() { this.ctx.clearRect(0, 0, this.w, this.h); }
  set(x, y, c, a=1) {
    x = x|0; y = y|0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = rgba(c, a);
    this.ctx.fillRect(x, y, 1, 1);
  }
  rect(x, y, w, h, c, a=1) {
    this.ctx.fillStyle = rgba(c, a);
    this.ctx.fillRect(x|0, y|0, Math.max(0,w|0), Math.max(0,h|0));
  }
  border(x, y, w, h, c, a=1) {
    this.rect(x, y, w, 1, c, a);
    this.rect(x, y+h-1, w, 1, c, a);
    this.rect(x, y, 1, h, c, a);
    this.rect(x+w-1, y, 1, h, c, a);
  }
  hline(x, y, len, c, a=1) { this.rect(x, y, len, 1, c, a); }
  vline(x, y, len, c, a=1) { this.rect(x, y, 1, len, c, a); }
  line(x1, y1, x2, y2, c, a=1) {
    x1|=0; y1|=0; x2|=0; y2|=0;
    const dx = Math.abs(x2-x1), sx = x1<x2 ? 1 : -1;
    const dy = -Math.abs(y2-y1), sy = y1<y2 ? 1 : -1;
    let err = dx+dy;
    while (true) {
      this.set(x1, y1, c, a);
      if (x1===x2 && y1===y2) break;
      const e2 = 2*err;
      if (e2 >= dy) { err += dy; x1 += sx; }
      if (e2 <= dx) { err += dx; y1 += sy; }
    }
  }
  dither(x, y, w, h, c, a=1, parity=0) {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      if (((xx + yy) & 1) === parity) this.set(x+xx, y+yy, c, a);
    }
  }
  // Text. opts: { size: 'sm' (default 5x7) | 'xs' (3x5), spacing: 1 }
  text(s, x, y, c, opts) {
    opts = opts || {};
    const tiny = opts.size === 'xs';
    const tbl = tiny ? F35 : F57;
    const rows = tiny ? 5 : 7;
    const cols = tiny ? 3 : 5;
    const sp = opts.spacing != null ? opts.spacing : 1;
    let cx = x|0;
    for (const ch of String(s).toUpperCase()) {
      const g = tbl[ch] || tbl['?'];
      for (let r = 0; r < rows; r++) {
        const bits = g[r];
        for (let cc = 0; cc < cols; cc++) {
          if (bits & (1 << (cols - 1 - cc))) this.set(cx + cc, y + r, c);
        }
      }
      cx += cols + sp;
    }
    return cx - sp;
  }
  measure(s, opts) {
    opts = opts || {};
    const tiny = opts.size === 'xs';
    const cols = tiny ? 3 : 5;
    const sp = opts.spacing != null ? opts.spacing : 1;
    const n = String(s).length;
    return n * cols + Math.max(0, n-1) * sp;
  }
  // String-grid sprite. Pass an array of strings using '#' (filled) or '.' / ' ' (skip).
  // Optional second array of strings with alt colors (e.g. '*' for highlight).
  sprite(x, y, grid, paint) {
    for (let yy = 0; yy < grid.length; yy++) {
      const row = grid[yy];
      for (let xx = 0; xx < row.length; xx++) {
        const ch = row[xx];
        if (ch === '.' || ch === ' ') continue;
        const c = paint(ch);
        if (c) this.set(x+xx, y+yy, Array.isArray(c) ? c : c.c || c, (c.a != null ? c.a : 1));
      }
    }
  }
}

// ── Surfaces ──────────────────────────────────────────────
function paintDark(pb, x, y, w, h, opts) {
  opts = opts || {};
  pb.rect(x, y, w, h, C.ink);
  const r = mulberry((opts.seed || 0) | 11);
  for (let i = 0; i < (w*h*0.025)|0; i++) {
    const xx = (r()*w)|0, yy = (r()*h)|0;
    pb.set(x+xx, y+yy, C.inkLo, 0.65);
  }
}
function paintParchment(pb, x, y, w, h, opts) {
  opts = opts || {};
  pb.rect(x, y, w, h, C.paper);
  const r = mulberry((opts.seed || 0) | 13);
  for (let i = 0; i < (w*h*0.035)|0; i++) {
    const xx = (r()*w)|0, yy = (r()*h)|0;
    pb.set(x+xx, y+yy, r() < 0.5 ? C.paperLo : C.paperHi, 0.5);
  }
  // foxing spots
  const spots = Math.max(2, ((w*h) / 220)|0);
  for (let i = 0; i < spots; i++) {
    const cx = (r()*w)|0, cy = (r()*h)|0;
    const rad = 1 + ((r()*2)|0);
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx*dx + dy*dy <= rad*rad) pb.set(x+cx+dx, y+cy+dy, C.paperSpot, 0.16);
    }
  }
  // perimeter burn — top/bot 1px row darker
  pb.hline(x, y, w, C.paperSpot, 0.18);
  pb.hline(x, y+h-1, w, C.paperSpot, 0.22);
}
function paintWood(pb, x, y, w, h, opts) {
  opts = opts || {};
  pb.rect(x, y, w, h, C.woodMd);
  const seed = (opts.seed || 0) | 17;
  const r = mulberry(seed);
  // horizontal grain bands
  for (let yy = 0; yy < h; yy++) {
    const v = Math.sin(yy*0.7 + seed) * 0.5 + 0.5;
    const c = v < 0.28 ? C.woodLo : v < 0.62 ? C.woodMd : v < 0.85 ? C.woodHi : C.woodTop;
    pb.hline(x, y+yy, w, c, 0.55);
  }
  // grain speckle
  for (let i = 0; i < (w*h*0.18)|0; i++) {
    const xx = (r()*w)|0, yy = (r()*h)|0;
    pb.set(x+xx, y+yy, r() < 0.6 ? C.woodGrain : C.woodLo, 0.35);
  }
  // knot
  if (w > 24 && h > 24) {
    const cx = ((0.3 + r()*0.4)*w)|0, cy = ((0.3 + r()*0.4)*h)|0;
    const rad = 3 + ((r()*2)|0);
    for (let dy = -rad-1; dy <= rad+1; dy++) for (let dx = -rad-1; dx <= rad+1; dx++) {
      const d = Math.sqrt(dx*dx + dy*dy*1.1);
      if (d > rad+1) continue;
      let cc = C.woodMd;
      if (d < 1) cc = C.woodGrain;
      else if (d < rad*0.6) cc = C.woodLo;
      else if (d > rad-0.5) cc = C.woodGrain;
      else cc = C.woodMd;
      pb.set(x+cx+dx, y+cy+dy, cc, 0.85);
    }
  }
  // dark ridges
  for (let i = 0; i < 3; i++) {
    const yy = ((r()*h)|0);
    pb.hline(x, y+yy, w, C.woodGrain, 0.4);
  }
}

// ── 1px bordered panel (rounded-ish via corner notch) ──────
function panel(pb, x, y, w, h, opts) {
  opts = opts || {};
  const surf = opts.surface || 'dark';
  const paint = surf === 'parch' ? paintParchment : surf === 'wood' ? paintWood : paintDark;
  paint(pb, x, y, w, h, opts);
  const border = opts.border != null ? opts.border : (
    surf === 'parch' ? C.paperSoft : surf === 'wood' ? C.woodLo : C.inkHi
  );
  pb.border(x, y, w, h, border);
  // corner notch (clip to 'dark' color or 'transparent' would need erasing — instead darken)
  if (opts.notch !== false) {
    const corner = surf === 'parch' ? C.paper : surf === 'wood' ? C.woodMd : C.ink;
    // clear the 4 corner pixels
    pb.set(x,      y,      corner);
    pb.set(x+w-1,  y,      corner);
    pb.set(x,      y+h-1,  corner);
    pb.set(x+w-1,  y+h-1,  corner);
  }
}

// ── PixelStage component ─────────────────────────────────
// Static canvas. Default deps = [w, h] so resizes re-run draw; pass your
// own deps to invalidate on other state.
function PixelStage({ w, h, scale=4, draw, deps, style, label }) {
  const effectiveDeps = deps != null ? deps : [w, h];
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    const pb = new PB(ctx, w, h);
    if (typeof draw === 'function') draw(pb, ctx);
  }, effectiveDeps);
  return (
    <canvas ref={ref} width={w} height={h} aria-label={label}
      style={{
        width: w*scale, height: h*scale, imageRendering: 'pixelated',
        display: 'block',
        ...style,
      }} />
  );
}

// rAF stage — captures `draw` in a ref so a fresh inline draw each render
// doesn't restart the animation loop. The loop only resets when w/h change.
function PixelStageAnim({ w, h, scale=4, draw, style, label }) {
  const ref = React.useRef(null);
  const drawRef = React.useRef(draw);
  drawRef.current = draw;
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let raf, start = performance.now(), stop = false;
    function tick(t) {
      if (stop) return;
      ctx.clearRect(0, 0, w, h);
      const pb = new PB(ctx, w, h);
      const fn = drawRef.current;
      if (typeof fn === 'function') fn(pb, ctx, (t - start) / 1000);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [w, h]);
  return (
    <canvas ref={ref} width={w} height={h} aria-label={label}
      style={{ width: w*scale, height: h*scale, imageRendering: 'pixelated', display: 'block', ...style }} />
  );
}

window.PIX = { C, F57, F35, PB, PixelStage, PixelStageAnim,
  paintDark, paintParchment, paintWood, panel, mulberry, rgba };

})();
