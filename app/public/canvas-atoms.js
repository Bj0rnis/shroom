// Almari Shroom — pure pixel-buffer atoms.
// Ported from claude.ai design's locked-vision kit (world-renderer.jsx).
// Lives in public/ so the browser fetches it, but exports CommonJS too so
// node smoketests can require it without a DOM. NO browser APIs in this
// file — no document, no canvas, no ImageData — keep it node-pure.
//
// The renderer pipeline:
//   1. server snapshot → worldToCfg (in canvas.js, has the genome map)
//   2. cfg → PB pixel buffer via the paint* atoms in this file
//   3. PB → canvas via putImageData + nearest-neighbor upscale (canvas.js)
//   4. smoothed overlays (sun bloom, hyphae glow, …) painted on top (canvas.js)

(function () {
  const W = 320, H = 180;
  const GRASS_Y = 63;            // mirrors lib/world.js; renderer-side constant.

  // ── helpers ──────────────────────────────────────────────────────────

  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpRgb(c1, c2, t) {
    return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
  }
  // Seeded RNG — deterministic so per-frame jitter doesn't shimmer.
  function mkRng(seed) {
    let s = (seed | 0) || 1;
    return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1e6) / 1e6; };
  }

  // ── PB ───────────────────────────────────────────────────────────────
  // Uint8ClampedArray RGBA buffer. set() is opaque overwrite; blend() is
  // straight alpha-over. Browser-agnostic — works in node.

  class PB {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
    set(x, y, r, g, b, a = 255) {
      x = x | 0; y = y | 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const o = (y * this.w + x) * 4;
      this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b; this.data[o + 3] = a;
    }
    blend(x, y, r, g, b, a) {
      x = x | 0; y = y | 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const o = (y * this.w + x) * 4;
      const da = this.data[o + 3] / 255;
      const sa = a / 255;
      const oa = sa + da * (1 - sa);
      if (oa <= 0) return;
      this.data[o]     = Math.round((r * sa + this.data[o]     * da * (1 - sa)) / oa);
      this.data[o + 1] = Math.round((g * sa + this.data[o + 1] * da * (1 - sa)) / oa);
      this.data[o + 2] = Math.round((b * sa + this.data[o + 2] * da * (1 - sa)) / oa);
      this.data[o + 3] = Math.round(oa * 255);
    }
  }

  // ── sky ──────────────────────────────────────────────────────────────
  // cfg.sky = { top: [r,g,b], mid: [r,g,b], bot: [r,g,b] }
  // 3-stop vertical gradient in the sky band (rows 0..GRASS_Y-1).
  function paintSky(pb, cfg) {
    const top = cfg.sky.top, mid = cfg.sky.mid, bot = cfg.sky.bot;
    for (let y = 0; y < GRASS_Y; y++) {
      const t = y / GRASS_Y;
      let c;
      if (t < 0.6) c = lerpRgb(top, mid, t / 0.6);
      else         c = lerpRgb(mid, bot, (t - 0.6) / 0.4);
      for (let x = 0; x < W; x++) pb.set(x, y, c[0], c[1], c[2]);
    }
  }

  // cfg.body = { kind: 'sun'|'moon', x, y, r, hue (sun only) }
  // Disc painted directly into the buffer; bloom halo is a smoothed overlay
  // handled later in canvas.js.
  function paintSunMoon(pb, cfg) {
    const b = cfg.body;
    if (!b) return;
    if (b.kind === 'sun') {
      const core = hsl(b.hue || 24, 55, 78);
      const rim  = hsl(b.hue || 24, 65, 58);
      for (let dy = -b.r; dy <= b.r; dy++) for (let dx = -b.r; dx <= b.r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > b.r) continue;
        const c = d > b.r - 1.2 ? rim : core;
        pb.set(b.x + dx, b.y + dy, c[0], c[1], c[2]);
      }
    } else if (b.kind === 'moon') {
      const main   = hsl(220, 12, 84);
      const shaded = hsl(228, 14, 56);
      const offX   = Math.round(b.r * 0.55);
      for (let dy = -b.r; dy <= b.r; dy++) for (let dx = -b.r; dx <= b.r; dx++) {
        const d1 = Math.sqrt(dx * dx + dy * dy);
        if (d1 > b.r) continue;
        const dx2 = dx - offX;
        const d2 = Math.sqrt(dx2 * dx2 + dy * dy);
        if (d2 < b.r - 0.5) continue;     // bite out the dark side
        const c = d1 > b.r - 0.8 ? shaded : main;
        pb.set(b.x + dx, b.y + dy, c[0], c[1], c[2]);
      }
    }
  }

  // cfg.stars = 0..1 alpha multiplier. ~180 deterministic pin-pricks.
  function paintStars(pb, cfg) {
    const s = cfg.stars || 0;
    if (s < 0.05) return;
    const rng = mkRng(11);
    const n = Math.round(s * 180);
    for (let i = 0; i < n; i++) {
      const x = (rng() * W) | 0;
      const y = (rng() * GRASS_Y * 0.85) | 0;
      const a = Math.round(s * (60 + rng() * 195));
      pb.blend(x, y, 245, 240, 222, a);
      if (rng() < 0.18) pb.blend(x, y, 255, 250, 230, Math.min(255, a + 40));
    }
  }

  // cfg.cloudCover (0..1) · cfg.cloudSeed · cfg.sky.bot for hue match
  function paintClouds(pb, cfg) {
    const cover = cfg.cloudCover != null ? cfg.cloudCover : 0;
    if (cover < 0.04) return;
    const base   = lerpRgb(cfg.sky.bot, [240, 234, 222], 0.55);
    const shadow = lerpRgb(cfg.sky.bot, [10, 8, 6], 0.45);
    const rng = mkRng((cfg.cloudSeed || 53) * 7);
    const n = Math.round(2 + cover * 12);
    for (let i = 0; i < n; i++) {
      const cx = rng() * W;
      const cy = 4 + rng() * (GRASS_Y * 0.55);
      const sz = 5 + (rng() * 12) | 0;
      for (let dy = -3; dy <= 2; dy++) {
        for (let dx = -sz; dx <= sz; dx++) {
          const d = Math.sqrt((dx / sz) * (dx / sz) + (dy / 2.6) * (dy / 2.6));
          if (d > 1.05) continue;
          const a = Math.round((1 - d) * 230);
          const c = dy > 0 ? shadow : base;
          pb.blend((cx + dx) | 0, (cy + dy) | 0, c[0], c[1], c[2], a);
        }
      }
    }
    if (cover > 0.8) {
      const bandAlpha = Math.round((cover - 0.8) * 700);
      for (let y = 0; y < GRASS_Y * 0.5; y++) {
        const t = 1 - y / (GRASS_Y * 0.5);
        const a = Math.round(bandAlpha * t);
        for (let x = 0; x < W; x++) pb.blend(x, y, base[0], base[1], base[2], a);
      }
    }
  }

  // Distant hills + far-tree silhouettes. cfg.sky.bot used for haze match.
  function paintFarLayer(pb, cfg) {
    const season = cfg.season || 'spring';
    const haze = season === 'autumn' ? hsl(20, 30, 28) : hsl(220, 22, 50);
    const rng = mkRng(7);
    const hill = lerpRgb(cfg.sky.bot, hsl(220, 18, 25), 0.65);
    for (let x = 0; x < W; x++) {
      const h = 4 + Math.sin(x * 0.06) * 2.2 + Math.sin(x * 0.13 + 1.3) * 1.6 + rng() * 0.8;
      const top = Math.round(GRASS_Y - h);
      for (let y = top; y < GRASS_Y; y++) pb.blend(x, y, hill[0], hill[1], hill[2], 200);
    }
    const farTrees = [
      { x: 20, h: 16 }, { x: 48, h: 12 }, { x: 110, h: 18 },
      { x: 168, h: 14 }, { x: 210, h: 20 }, { x: 268, h: 13 }, { x: 296, h: 17 },
    ];
    for (const t of farTrees) {
      const baseY = GRASS_Y - 1;
      const topY  = baseY - t.h;
      for (let y = topY + Math.round(t.h * 0.4); y < baseY; y++) {
        pb.blend(t.x, y, haze[0], haze[1], haze[2], 110);
      }
      for (let y = topY; y < topY + Math.round(t.h * 0.5); y++) {
        const wid = Math.round((1 - (y - topY) / (t.h * 0.5)) * 2.5 + 1.5);
        for (let dx = -wid; dx <= wid; dx++) {
          const a = 90 - Math.abs(dx) * 12;
          if (a > 0) pb.blend(t.x + dx, y, haze[0], haze[1], haze[2], a);
        }
      }
    }
  }

  // Soil: depth gradient + per-pixel jitter + moisture patches + flecks.
  function paintSoil(pb, cfg) {
    const rng = mkRng(31);
    const top = hsl(28, 30, 14);
    const bot = hsl(24, 20, 4);
    for (let y = GRASS_Y; y < H; y++) {
      const t = (y - GRASS_Y) / (H - GRASS_Y);
      const base = lerpRgb(top, bot, t);
      for (let x = 0; x < W; x++) {
        const j = (rng() - 0.5) * 12;
        pb.set(x, y,
          clamp(base[0] + j,        0, 255),
          clamp(base[1] + j * 0.85, 0, 255),
          clamp(base[2] + j * 0.7,  0, 255));
      }
    }
    // Moisture patches.
    for (let i = 0; i < 220; i++) {
      const cx = (rng() * W) | 0;
      const cy = GRASS_Y + ((rng() * (H - GRASS_Y)) | 0);
      const r  = 2 + rng() * 6;
      const dark = rng() < 0.55;
      for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r; xx <= r; xx++) {
          const d = Math.sqrt(xx * xx + yy * yy);
          if (d > r) continue;
          const a = Math.round((1 - d / r) * (dark ? 40 : 22));
          const c = dark ? [0, 0, 0] : [60, 45, 30];
          pb.blend(cx + xx, cy + yy, c[0], c[1], c[2], a);
        }
      }
    }
    // Flecks.
    for (let i = 0; i < 280; i++) {
      const x = (rng() * W) | 0;
      const y = GRASS_Y + 2 + ((rng() * (H - GRASS_Y - 2)) | 0);
      const k = rng();
      if (k < 0.35) {
        const c = hsl(30, 12, 30 + rng() * 8);
        pb.blend(x, y, c[0], c[1], c[2], 200);
        if (rng() < 0.4) pb.blend(x + 1, y, c[0], c[1], c[2], 150);
      } else if (k < 0.7) {
        pb.blend(x, y, 18, 12, 8, 220);
      } else {
        const c = hsl(24, 30, 22);
        pb.blend(x, y, c[0], c[1], c[2], 200);
      }
    }
    // Grass line (1-2px green band — visual only; gameplay GRASS row is row 63).
    for (let x = 0; x < W; x++) {
      const c1 = hsl(82, 36, 28);
      const c2 = hsl(82, 30, 22);
      pb.set(x, GRASS_Y - 1, c1[0], c1[1], c1[2]);
      pb.set(x, GRASS_Y,     c2[0], c2[1], c2[2]);
    }
  }

  function paintGrass(pb, cfg) {
    const rng = mkRng(91);
    const seasonHue = cfg.season === 'autumn' ? 38 : 92;
    const seasonSat = cfg.season === 'autumn' ? 38 : 44;
    for (let x = 0; x < W; x++) {
      if (rng() < 0.22) {
        const h = 1 + (rng() < 0.25 ? 1 : 0);
        const c = hsl(seasonHue, seasonSat, 30 + rng() * 12);
        pb.set(x, GRASS_Y - 2, c[0], c[1], c[2]);
        if (h > 1) {
          const c2 = hsl(seasonHue, seasonSat - 6, 26);
          pb.blend(x, GRASS_Y - 3, c2[0], c2[1], c2[2], 220);
        }
      }
    }
  }

  // log: { x1, x2, y, thickness, species, age (0..1), mossy }
  function paintLog(pb, log) {
    const rng = mkRng(log.x1 * 31 + log.y * 13 + 7);
    const species = log.species || 'oak';
    const base = {
      oak:    hsl(24, 30, 28),
      birch:  hsl(36, 12, 64),
      pine:   hsl(20, 35, 22),
      willow: hsl(40, 25, 38),
    }[species] || hsl(24, 30, 28);
    const dark = {
      oak:    hsl(20, 38, 16),
      birch:  hsl(28, 30, 22),
      pine:   hsl(16, 45, 10),
      willow: hsl(36, 30, 22),
    }[species] || hsl(20, 38, 16);
    for (let y = log.y; y < log.y + log.thickness; y++) {
      for (let x = log.x1; x <= log.x2; x++) {
        const distFromEnd = Math.min(x - log.x1, log.x2 - x);
        const rowOff = (y - log.y);
        const halfTh = log.thickness / 2 - 0.5;
        const yOff = Math.abs(rowOff - halfTh);
        if (distFromEnd < 2 && yOff > halfTh - (2 - distFromEnd)) continue;
        const shade = (rowOff / log.thickness);
        let c = lerpRgb(base, dark, shade * 0.85);
        if (rng() < 0.18) c = dark;
        if (species === 'birch' && (x + y) % 7 === 0 && rng() < 0.5) c = dark;
        if (species === 'pine'  && x % 3 === 0 && rng() < 0.5) c = dark;
        if (log.age > 0.4) c = lerpRgb(c, hsl(70, 20, 16), (log.age - 0.4) * 0.6);
        pb.set(x, y, c[0], c[1], c[2]);
      }
    }
    const knots = 1 + Math.round((log.x2 - log.x1) / 30);
    for (let i = 0; i < knots; i++) {
      const kx = log.x1 + 3 + ((rng() * (log.x2 - log.x1 - 6)) | 0);
      const ky = log.y + 1 + ((rng() * (log.thickness - 2)) | 0);
      pb.set(kx, ky, dark[0], dark[1], dark[2]);
      pb.blend(kx + 1, ky, dark[0], dark[1], dark[2], 180);
    }
    if (log.mossy) {
      const mx1 = log.x1 + 4 + ((rng() * (log.x2 - log.x1 - 8)) | 0);
      const mw = 6 + (rng() * 10) | 0;
      for (let i = 0; i < mw; i++) {
        const x = mx1 + i;
        const moss = hsl(82, 40, 30 + (rng() * 8));
        pb.set(x, log.y - 1, moss[0], moss[1], moss[2]);
        if (rng() < 0.45) {
          const moss2 = hsl(82, 32, 24);
          pb.set(x, log.y, moss2[0], moss2[1], moss2[2]);
        }
      }
    }
    if (log.age < 0.3) {
      for (let x = log.x1 + 1; x <= log.x2 - 1; x++) {
        if ((x + log.y) % 4 === 0) pb.blend(x, log.y, 255, 240, 210, 50);
      }
    }
  }

  function paintStone(pb, s) {
    const rng = mkRng(s.x * 13 + s.y);
    const base  = hsl(30, 8,  36);
    const dark  = hsl(30, 12, 22);
    const light = hsl(30, 6,  48);
    const r = s.r || 3;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy * 0.9);
        if (d > r) continue;
        let c = base;
        if (d > r - 0.8) c = dark;
        else if (dx < 0 && dy < 0) c = light;
        else if (dy > 0) c = dark;
        pb.set(s.x + dx, s.y + dy, c[0], c[1], c[2]);
      }
    }
    if (s.mossy) {
      const mossSide = s.mossSide || -1;
      for (let dy = -Math.round(r * 0.6); dy <= 0; dy++) {
        const xx = s.x + mossSide * Math.round(r * 0.6);
        if (rng() < 0.3) continue;
        const moss = hsl(82, 36, 28);
        pb.blend(xx, s.y + dy, moss[0], moss[1], moss[2], 220);
        if (rng() < 0.4) {
          const moss2 = hsl(82, 28, 22);
          pb.blend(xx - mossSide, s.y + dy, moss2[0], moss2[1], moss2[2], 200);
        }
      }
    }
  }

  // tree: { x, h, species, trunkW, crownW }   cfg.season selects leaf colour.
  function paintTree(pb, tree, cfg) {
    const baseY = GRASS_Y - 1;
    const rng = mkRng(tree.x * 7 + 41);
    // Roots into soil.
    for (let i = 0; i < 4; i++) {
      let rx = tree.x + (i - 1.5) * 1.2;
      let ry = baseY + 1;
      const rdir = Math.sign(i - 1.5) || 1;
      const c = hsl(22, 30, 12);
      for (let j = 0; j < 4 + (rng() * 5 | 0); j++) {
        rx += rdir * 0.5 + (rng() - 0.5) * 0.3;
        ry += 0.8 + rng() * 0.3;
        pb.blend(rx | 0, ry | 0, c[0], c[1], c[2], 220);
      }
    }
    const trunkH = tree.h;
    const crownStart = baseY - Math.round(trunkH * 0.55);
    const topY       = baseY - trunkH;
    const crownH     = baseY - crownStart;
    const crownRise  = Math.ceil(crownH * 0.35);
    const species = tree.species || 'oak';
    const trunkBase = {
      oak:    hsl(22, 28, 22),
      birch:  hsl(36, 8,  70),
      pine:   hsl(18, 32, 16),
      willow: hsl(38, 24, 32),
    }[species] || hsl(22, 28, 22);
    const trunkDark = {
      oak:    hsl(18, 36, 12),
      birch:  hsl(28, 22, 26),
      pine:   hsl(14, 38, 8),
      willow: hsl(34, 28, 18),
    }[species] || hsl(18, 36, 12);
    // Trunk.
    for (let y = topY; y < baseY; y++) {
      const above = (baseY - y) / trunkH;
      const w = Math.max(1, Math.round((1 - above * 0.4) * (tree.trunkW || 2)));
      for (let dx = -w; dx <= w; dx++) {
        const xi = tree.x + dx;
        let c = trunkBase;
        if (dx > 0) c = lerpRgb(trunkBase, trunkDark, 0.5);
        if (species === 'birch' && y % 4 === 0 && rng() < 0.5) c = trunkDark;
        if (species === 'pine'  && rng() < 0.35) c = trunkDark;
        pb.set(xi, y, c[0], c[1], c[2]);
      }
    }
    // Crown.
    const season = cfg.season || 'spring';
    const leaf = species === 'pine'
      ? hsl(122, 28, 22)
      : season === 'autumn'
        ? (species === 'birch'  ? hsl(42, 70, 48)
        :  species === 'willow' ? hsl(50, 60, 48)
        :                          hsl(22, 75, 42))
        : (species === 'birch'  ? hsl(82, 52, 44)
        :  species === 'willow' ? hsl(74, 50, 50)
        :                          hsl(96, 48, 36));
    const leafDark = lerpRgb(leaf, [0, 0, 0], 0.35);
    const crownW = tree.crownW || 8;
    if (species === 'pine') {
      const tipY = topY - crownRise;
      const baseCrownY = crownStart + 2;
      for (let y = tipY; y <= baseCrownY; y++) {
        const t = (y - tipY) / (baseCrownY - tipY + 0.01);
        const w = Math.round(t * (crownW + 1));
        for (let dx = -w; dx <= w; dx++) {
          const c = (dx + y) % 3 === 0 ? leafDark : leaf;
          if (Math.abs(dx) > 0 || y > tipY) pb.set(tree.x + dx, y, c[0], c[1], c[2]);
        }
      }
    } else if (species === 'willow') {
      const ccy = topY + crownH * 0.2;
      for (let y = topY - crownRise; y < crownStart + 4; y++) {
        const ny = (y - ccy) / (crownH * 0.7);
        const w = Math.round(Math.sqrt(Math.max(0, 1 - ny * ny)) * crownW);
        for (let dx = -w; dx <= w; dx++) {
          if (rng() < 0.18) continue;
          const c = rng() < 0.3 ? leafDark : leaf;
          pb.set(tree.x + dx, y, c[0], c[1], c[2]);
        }
        if (y > topY && y % 3 === 0) {
          for (let i = -w; i <= w; i += 4) {
            for (let dy = 0; dy < 4 + (rng() * 4 | 0); dy++) {
              pb.blend(tree.x + i, y + dy, leaf[0], leaf[1], leaf[2], 180);
            }
          }
        }
      }
    } else {
      // oak / birch — broad rounded crown peaking above topY.
      const ccy  = topY + crownH * 0.25;
      const vRad = crownH * 0.75;
      for (let y = topY - crownRise; y < crownStart + 3; y++) {
        for (let dx = -crownW; dx <= crownW; dx++) {
          const ny = (y - ccy) / vRad;
          const nx = dx / crownW;
          if (nx * nx + ny * ny > 1) continue;
          if (rng() < (season === 'autumn' ? 0.18 : 0.08)) continue;
          const c = rng() < 0.3 ? leafDark : leaf;
          pb.set(tree.x + dx, y, c[0], c[1], c[2]);
        }
      }
      if (season === 'autumn') {
        for (let i = 0; i < 6; i++) {
          const bx = tree.x + ((rng() - 0.5) * crownW * 1.8) | 0;
          const by = (topY - crownRise) + (rng() * crownH * 0.7) | 0;
          pb.blend(bx, by, trunkDark[0], trunkDark[1], trunkDark[2], 200);
        }
      }
    }
  }

  // ── hyphae — option B (painterly walker bounded by colony bbox) ─────
  // Each colony: { cx, cy, hue, sat, tips, maxLen, spread, seed, stain,
  //                density, thickness } — translator fills these from bbox.
  function paintHyphae(pb, cfg, colonies) {
    for (const col of colonies) {
      const density = col.density != null ? col.density : 0.45;
      const tipRgb     = hsl(col.hue, col.sat || 30, 82);
      const interior   = hsl(col.hue, (col.sat || 30) * 0.65, 56);
      const aged       = hsl(col.hue, 20, 32);
      const tipShoulder = hsl(col.hue, (col.sat || 30) * 0.6, 64);
      const rng = mkRng(col.seed || 13);

      // Claimed-territory stain bleeds into the substrate beneath the colony.
      if (col.stain) {
        const sx = col.cx, sy = col.cy + col.thickness + 2;
        for (let y = sy; y < Math.min(H, sy + 30); y++) {
          for (let x = sx - 30; x < sx + 30; x++) {
            const dx = x - sx, dy = y - sy;
            const d = Math.sqrt(dx * dx + dy * dy * 0.6);
            if (d > 26) continue;
            const a = Math.round((1 - d / 26) * (22 + density * 22));
            const c = hsl(col.hue, 14, 10);
            pb.blend(x, y, c[0], c[1], c[2], a);
          }
        }
      }

      // Dense colonies grow a visible mat over the log surface.
      if (density > 0.55) {
        const matAlpha = Math.round((density - 0.55) * 260);
        const spread = col.spread || 22;
        for (let dy = -3; dy <= 1; dy++) {
          for (let dx = -Math.round(spread * 0.7); dx <= Math.round(spread * 0.7); dx++) {
            const x = col.cx + dx, y = col.cy + dy - 1;
            if (rng() < 0.4) continue;
            pb.blend(x, y, interior[0], interior[1], interior[2],
              Math.max(0, matAlpha - Math.abs(dx) * 4));
          }
        }
      }

      const passes = density > 0.7 ? 3 : (density > 0.4 ? 2 : 1);
      const tipsPerPass = col.tips || 14;
      for (let pass = 0; pass < passes; pass++) {
        const passTips   = Math.round(tipsPerPass * (pass === 0 ? 1 : 0.7));
        const passOffset = pass === 0 ? 0 : (pass === 1 ? -1 : 1);
        for (let t = 0; t < passTips; t++) {
          let x = col.cx + (rng() - 0.5) * (col.spread || 22) + passOffset;
          let y = col.cy - 1;
          let angle = -Math.PI / 2 + (rng() - 0.5) * 0.4;
          const dirBias = rng() < 0.5 ? -1 : 1;
          const len = 4 + (rng() * (col.maxLen || 16)) | 0;
          for (let i = 0; i < len; i++) {
            if (y < col.cy - 1) angle = -Math.PI / 2 + (rng() - 0.5) * 0.6;
            else if (y > col.cy + col.thickness) angle = Math.PI / 2 + (rng() - 0.5) * 0.8 + dirBias * 0.2;
            else angle += (rng() - 0.5) * 0.5;
            x += Math.cos(angle); y += Math.sin(angle);
            const xi = x | 0, yi = y | 0;
            const isTip = i > len - 3;
            const c = isTip ? tipRgb : (i < len * 0.35 ? aged : interior);
            pb.blend(xi, yi, c[0], c[1], c[2], isTip ? 255 : 230);
            if (isTip) {
              pb.blend(xi + 1, yi,     tipShoulder[0], tipShoulder[1], tipShoulder[2], 130);
              pb.blend(xi - 1, yi,     tipShoulder[0], tipShoulder[1], tipShoulder[2], 130);
              pb.blend(xi,     yi - 1, tipShoulder[0], tipShoulder[1], tipShoulder[2], 130);
            }
            if (i > 2 && rng() < 0.14 + density * 0.1) {
              let bx = x, by = y;
              let ba = angle + (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.6);
              for (let j = 0; j < 3 + (rng() * 4 | 0); j++) {
                bx += Math.cos(ba); by += Math.sin(ba);
                pb.blend(bx | 0, by | 0, interior[0], interior[1], interior[2], 200);
              }
            }
          }
        }
      }
    }
  }

  // Decay stain — patchy dark substrate where a colony has died.
  function paintDecayStain(pb, stains) {
    if (!stains) return;
    for (const s of stains) {
      const rng = mkRng(s.x * 17 + s.y);
      const c = hsl(s.hue || 28, 18, 14);
      for (let y = s.y; y < s.y + s.h; y++) {
        for (let x = s.x; x < s.x + s.w; x++) {
          const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
          const dx = (x - cx) / (s.w / 2), dy = (y - cy) / (s.h / 2);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 1) continue;
          if (rng() < 0.15) continue;
          const a = Math.round((1 - d) * 180);
          pb.blend(x, y, c[0], c[1], c[2], a);
        }
      }
    }
  }

  // mushroom: { x, baseY, stemH, capR, hue, shape (0..3), curve, mature }
  function paintMushroom(pb, m) {
    const x = m.x;
    const baseY = m.baseY;
    const stemH = m.stemH || 12;
    const capR  = m.capR  || 5;
    const hue   = m.hue;
    const shape = m.shape;
    // Stem.
    const stemTop = baseY - stemH;
    const curve = m.curve || 0;
    for (let y = stemTop; y < baseY; y++) {
      const t = (y - stemTop) / stemH;
      const wid = t > 0.75 ? 2 : 1;
      const offset = Math.round(curve * (1 - t));
      const cx = x + offset;
      for (let dx = -wid; dx <= wid; dx++) {
        const stemHue = hsl(38, 14, 76 - dx * 8 - (1 - t) * 8);
        const stemDk  = hsl(36, 18, 56);
        const c = dx === wid ? stemDk : stemHue;
        pb.set(cx + dx, y, c[0], c[1], c[2]);
      }
    }
    // Cap.
    const cy = stemTop;
    const sat = 62;
    const light  = hsl(hue, sat,      60);
    const mid    = hsl(hue, sat,      50);
    const shadow = hsl(hue, sat + 4,  36);
    const outline = hsl(hue, sat - 12, 22);
    if (shape === 0) {
      for (let dy = -capR; dy <= 0; dy++) {
        for (let dx = -capR; dx <= capR; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy * 1.15);
          if (d > capR) continue;
          let c;
          if (d > capR - 1) c = outline;
          else if (dx < -capR * 0.3 && dy < -capR * 0.3) c = light;
          else if (dy > -1) c = shadow;
          else c = mid;
          pb.set(x + dx, cy + dy, c[0], c[1], c[2]);
        }
      }
      for (let dx = -capR + 1; dx <= capR - 1; dx++) {
        pb.set(x + dx, cy + 1, outline[0], outline[1], outline[2]);
      }
    } else if (shape === 1) {
      const h2 = Math.round(capR * 1.7);
      for (let dy = -h2; dy <= 0; dy++) {
        const t = -dy / h2;
        const w = Math.round(capR * (1 - t));
        for (let dx = -w; dx <= w; dx++) {
          let c;
          if (Math.abs(dx) === w || dy === -h2) c = outline;
          else if (dx < 0 && t > 0.4) c = light;
          else if (dx > 0) c = shadow;
          else c = mid;
          pb.set(x + dx, cy + dy, c[0], c[1], c[2]);
        }
      }
      pb.set(x, cy - h2, light[0], light[1], light[2]);
    } else if (shape === 2) {
      const wide = Math.round(capR * 1.4);
      const tall = Math.max(2, Math.round(capR * 0.45));
      for (let dy = -tall; dy <= 0; dy++) {
        for (let dx = -wide; dx <= wide; dx++) {
          const d = Math.sqrt((dx / wide) * (dx / wide) + (dy / tall) * (dy / tall));
          if (d > 1) continue;
          let c;
          if (d > 0.85) c = outline;
          else if (dx < -wide * 0.3 && dy < -tall * 0.3) c = light;
          else if (dy > -tall * 0.4) c = shadow;
          else c = mid;
          pb.set(x + dx, cy + dy, c[0], c[1], c[2]);
        }
      }
    } else {
      const bumps = 4;
      const bumpR = Math.max(1, Math.round(capR * 0.55));
      for (let b = 0; b < bumps; b++) {
        const t = b / (bumps - 1) - 0.5;
        const bx = Math.round(t * capR * 1.6);
        const by = -Math.round(bumpR * (b === 0 || b === bumps - 1 ? 0.7 : 1));
        for (let dy = -bumpR; dy <= 0; dy++) {
          for (let dx = -bumpR; dx <= bumpR; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy * 1.2);
            if (d > bumpR) continue;
            let c;
            if (d > bumpR - 0.8) c = outline;
            else if (dx < 0 && dy < 0) c = light;
            else if (dy > -0.5) c = shadow;
            else c = mid;
            pb.set(x + bx + dx, cy + by + dy, c[0], c[1], c[2]);
          }
        }
      }
      for (let dx = -Math.round(capR * 1.1); dx <= Math.round(capR * 1.1); dx++) {
        pb.set(x + dx, cy, outline[0], outline[1], outline[2]);
      }
    }
  }

  // Critters — pixel-art bugs. { kind, x, y, angle?, segs? }
  function paintCritters(pb, critters) {
    if (!critters) return;
    for (const c of critters) {
      if (c.kind === 'worm') {
        const segs = c.segs || 9;
        const col  = hsl(12, 35, 30);
        const colD = hsl(12, 35, 18);
        let x = c.x, y = c.y;
        for (let i = 0; i < segs; i++) {
          const c2 = i % 2 === 0 ? col : colD;
          pb.set(x | 0, y | 0, c2[0], c2[1], c2[2]);
          pb.blend((x | 0) + 1, y | 0, c2[0], c2[1], c2[2], 200);
          x += Math.cos(c.angle + Math.sin(i * 0.7) * 0.4) * 1.2;
          y += Math.sin(c.angle + Math.sin(i * 0.7) * 0.4) * 1.2;
        }
      } else if (c.kind === 'beetle') {
        const col = hsl(20, 25, 12);
        pb.set(c.x,     c.y,     col[0], col[1], col[2]);
        pb.set(c.x + 1, c.y,     col[0], col[1], col[2]);
        pb.set(c.x,     c.y - 1, col[0], col[1], col[2]);
        pb.set(c.x + 1, c.y - 1, col[0], col[1], col[2]);
        pb.blend(c.x,   c.y - 1, 240, 220, 180, 80);
      } else if (c.kind === 'springtail') {
        const col = hsl(40, 12, 70);
        pb.blend(c.x, c.y, col[0], col[1], col[2], 230);
      } else if (c.kind === 'ant') {
        const col = hsl(18, 40, 18);
        pb.set(c.x,     c.y, col[0], col[1], col[2]);
        pb.set(c.x + 1, c.y, col[0], col[1], col[2]);
      } else if (c.kind === 'pillbug') {
        const col = hsl(30, 15, 30);
        pb.set(c.x,     c.y, col[0], col[1], col[2]);
        pb.set(c.x + 1, c.y, col[0], col[1], col[2]);
        pb.set(c.x + 2, c.y, col[0], col[1], col[2]);
        pb.blend(c.x + 1, c.y - 1, col[0], col[1], col[2], 200);
      }
    }
  }

  // era scar (slice 2: only fire is implemented; flood/frost/wind in slice 4).
  function paintEraScar(pb, scar) {
    if (!scar) return;
    const rng = mkRng(scar.x * 19 || 7);
    if (scar.kind === 'fire') {
      const y0 = GRASS_Y + 1;
      for (let y = y0; y < y0 + 3; y++) {
        for (let x = scar.x1; x <= scar.x2; x++) {
          if (rng() < 0.15) continue;
          const c = hsl(20, 18, 8);
          pb.blend(x, y, c[0], c[1], c[2], 230);
          if (rng() < 0.04) {
            const e = hsl(18, 70, 30);
            pb.blend(x, y, e[0], e[1], e[2], 200);
          }
        }
      }
    }
    // TODO slice 4: flood (silt line at scar.y), frost (crack lines on logs),
    // wind (stripped patch — darker soil + scattered debris).
  }

  // ── time → sky preset ────────────────────────────────────────────────
  // Replaces the old skyForTime/hex pair. Returns {top, mid, bot, stars, sunHue}
  // as RGB triplets the atoms expect. body (sun/moon) trajectory is slice 3.
  function skyPreset(now, season) {
    const fmt = new Intl.DateTimeFormat('en-SE', {
      hour: 'numeric', minute: 'numeric', timeZone: 'Europe/Stockholm', hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hh = +(parts.find(p => p.type === 'hour')?.value   || 12);
    const mm = +(parts.find(p => p.type === 'minute')?.value || 0);
    const t = hh + mm / 60;
    // Phases drawn from palette.jsx sky strip (Stockholm 24h gradient).
    const phases = [
      { t: 0,    top: hsl(232, 36, 6),   mid: hsl(258, 32, 13), bot: hsl(238, 36, 18), stars: 0.95, sunHue: 24 },
      { t: 4.5,  top: hsl(232, 34, 11),  mid: hsl(244, 32, 18), bot: hsl(280, 30, 30), stars: 0.55, sunHue: 24 },
      { t: 6.0,  top: hsl(258, 34, 28),  mid: hsl(280, 38, 38), bot: hsl(18,  58, 42), stars: 0.10, sunHue: 18 },
      { t: 7.5,  top: hsl(218, 38, 42),  mid: hsl(208, 38, 60), bot: hsl(28,  40, 76), stars: 0.00, sunHue: 30 },
      { t: 12,   top: hsl(212, 42, 50),  mid: hsl(208, 36, 64), bot: hsl(28,  30, 80), stars: 0.00, sunHue: 30 },
      { t: 17,   top: hsl(216, 38, 44),  mid: hsl(212, 32, 58), bot: hsl(24,  44, 68), stars: 0.00, sunHue: 24 },
      { t: 19.5, top: hsl(244, 34, 22),  mid: hsl(280, 36, 30), bot: hsl(18,  58, 36), stars: 0.05, sunHue: 14 },
      { t: 21.5, top: hsl(238, 36, 13),  mid: hsl(258, 32, 18), bot: hsl(238, 34, 24), stars: 0.50, sunHue: 14 },
      { t: 23.5, top: hsl(232, 36, 6),   mid: hsl(258, 32, 13), bot: hsl(238, 36, 18), stars: 0.95, sunHue: 14 },
      { t: 24,   top: hsl(232, 36, 6),   mid: hsl(258, 32, 13), bot: hsl(238, 36, 18), stars: 0.95, sunHue: 14 },
    ];
    let a = phases[0], b = phases[1];
    for (let i = 0; i < phases.length - 1; i++) {
      if (t >= phases[i].t && t <= phases[i + 1].t) { a = phases[i]; b = phases[i + 1]; break; }
    }
    const u = (t - a.t) / Math.max(0.01, b.t - a.t);
    return {
      top:    lerpRgb(a.top, b.top, u),
      mid:    lerpRgb(a.mid, b.mid, u),
      bot:    lerpRgb(a.bot, b.bot, u),
      stars:  a.stars + (b.stars - a.stars) * u,
      sunHue: Math.round(a.sunHue + (b.sunHue - a.sunHue) * u),
      hour:   t,
    };
  }

  // ── exports ──────────────────────────────────────────────────────────
  const api = {
    W, H, GRASS_Y,
    hsl, lerp, lerpRgb, clamp, mkRng,
    PB,
    paintSky, paintSunMoon, paintStars, paintClouds, paintFarLayer,
    paintSoil, paintGrass, paintLog, paintStone, paintTree,
    paintHyphae, paintMushroom, paintDecayStain, paintCritters, paintEraScar,
    skyPreset,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ShroomAtoms = api;
})();
