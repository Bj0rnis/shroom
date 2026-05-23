// Shroom — kit · atmosphere
// PixelBuffer, surface painters, PixelStage/Anim, PageWallpaper.
// Depends on: tokens (window.SHROOM_TOKENS).
// Exports: window.PIX (same API as before) + window.PageWallpaper.

(function () {

const { C, F57, F35, rgba, mulberry } = window.SHROOM_TOKENS;

// ── PixelBuffer wrapper ───────────────────────────────────────────────────
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
  // Text. opts: { size: 'sm' (default 5×7) | 'xs' (3×5), spacing: 1 }
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

// ── Surface painters ──────────────────────────────────────────────────────
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
  pb.hline(x, y, w, C.paperSpot, 0.18);
  pb.hline(x, y+h-1, w, C.paperSpot, 0.22);
}

function paintWood(pb, x, y, w, h, opts) {
  opts = opts || {};
  pb.rect(x, y, w, h, C.woodMd);
  const seed = (opts.seed || 0) | 17;
  const r = mulberry(seed);
  for (let yy = 0; yy < h; yy++) {
    const v = Math.sin(yy*0.7 + seed) * 0.5 + 0.5;
    const c = v < 0.28 ? C.woodLo : v < 0.62 ? C.woodMd : v < 0.85 ? C.woodHi : C.woodTop;
    pb.hline(x, y+yy, w, c, 0.55);
  }
  for (let i = 0; i < (w*h*0.18)|0; i++) {
    const xx = (r()*w)|0, yy = (r()*h)|0;
    pb.set(x+xx, y+yy, r() < 0.6 ? C.woodGrain : C.woodLo, 0.35);
  }
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
  for (let i = 0; i < 3; i++) {
    const yy = ((r()*h)|0);
    pb.hline(x, y+yy, w, C.woodGrain, 0.4);
  }
}

// ── 1px bordered panel (corner notch) ────────────────────────────────────
function panel(pb, x, y, w, h, opts) {
  opts = opts || {};
  const surf = opts.surface || 'dark';
  const paint = surf === 'parch' ? paintParchment : surf === 'wood' ? paintWood : paintDark;
  paint(pb, x, y, w, h, opts);
  const border = opts.border != null ? opts.border : (
    surf === 'parch' ? C.paperSoft : surf === 'wood' ? C.woodLo : C.inkHi
  );
  pb.border(x, y, w, h, border);
  if (opts.notch !== false) {
    const corner = surf === 'parch' ? C.paper : surf === 'wood' ? C.woodMd : C.ink;
    pb.set(x,      y,      corner);
    pb.set(x+w-1,  y,      corner);
    pb.set(x,      y+h-1,  corner);
    pb.set(x+w-1,  y+h-1,  corner);
  }
}

// ── PixelStage — static canvas ────────────────────────────────────────────
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
        display: 'block', ...style,
      }} />
  );
}

// ── PixelStageAnim — rAF-driven canvas ───────────────────────────────────
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

// ── PageWallpaper — full-screen dark pixel noise ──────────────────────────
function PageWallpaper() {
  const wrapRef = React.useRef(null);
  const [dim, setDim] = React.useState({ w: 200, h: 150 });
  React.useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const SCALE = 3;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDim({
        w: Math.max(60, Math.floor(width / SCALE)),
        h: Math.max(60, Math.floor(height / SCALE)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrapRef} style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden' }}>
      <PixelStage w={dim.w} h={dim.h} scale={1} deps={[dim.w, dim.h]}
        draw={(pb) => paintDark(pb, 0, 0, dim.w, dim.h, { seed: 5 })}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {/* Depth-pass vignette — soft radial darkening from the corners.
          Recedes the page edges so the elevated rail panels and the canvas
          read as foreground. Sits above the pixel noise but below the
          content (zIndex: -1 on the wrapper, this div inherits). */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.65) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

window.PIX = { C, F57, F35, PB, PixelStage, PixelStageAnim,
  paintDark, paintParchment, paintWood, panel, mulberry, rgba };
window.PageWallpaper = PageWallpaper;

})();
