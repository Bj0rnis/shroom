// Almari Shroom — canvas renderer.
// Three-band cross-section view. Sky cycles with Stockholm clock. Hyphae
// glow. Mushrooms drawn from per-colony genome (cap hue, shape, size, stem).

const SHROOM_W = 320;
const SHROOM_H = 180;
const SCALE   = 4;                      // canvas is 1280x720
const CANVAS_W = SHROOM_W * SCALE;
const CANVAS_H = SHROOM_H * SCALE;

// Cell kinds (must match world.js)
const AIR   = 0;
const SOIL  = 1;
const GRASS = 2;
const LOG   = 3;
const FRUIT = 4;
const TREE  = 5;

// ── Decode ──────────────────────────────────────────────

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Sky ─────────────────────────────────────────────────

// Returns {top, bottom, stars} for the sky given a Date in Stockholm time.
function skyForTime(now) {
  const fmt = new Intl.DateTimeFormat('en-SE', {
    hour: 'numeric', minute: 'numeric',
    timeZone: 'Europe/Stockholm', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = +(parts.find(p => p.type === 'hour')?.value || 12);
  const m = +(parts.find(p => p.type === 'minute')?.value || 0);
  const t = h + m / 60; // 0..24

  // Phase blends — chosen for the feel of the seasons in Sweden, not realism.
  // night (deep) | dawn | day | dusk | night
  const phases = [
    { t: 0,    top: '#0a0c1a', bot: '#1a1d30', stars: 1 },
    { t: 4.5,  top: '#1c1d33', bot: '#3b3850', stars: 0.6 },
    { t: 6.0,  top: '#7e6088', bot: '#dba37e', stars: 0 },
    { t: 7.5,  top: '#9bb8d6', bot: '#cfe1ec', stars: 0 },
    { t: 12,   top: '#a8c8e8', bot: '#cfe2ee', stars: 0 },
    { t: 17,   top: '#88a4c6', bot: '#d3b292', stars: 0 },
    { t: 19.5, top: '#574870', bot: '#cf7d56', stars: 0 },
    { t: 21.5, top: '#1d2244', bot: '#3a3654', stars: 0.4 },
    { t: 23.5, top: '#0a0c1a', bot: '#1a1d30', stars: 1 },
    { t: 24,   top: '#0a0c1a', bot: '#1a1d30', stars: 1 },
  ];
  let a = phases[0], b = phases[1];
  for (let i = 0; i < phases.length - 1; i++) {
    if (t >= phases[i].t && t <= phases[i + 1].t) { a = phases[i]; b = phases[i + 1]; break; }
  }
  const u = (t - a.t) / Math.max(0.01, b.t - a.t);
  return {
    top:   lerpHex(a.top, b.top, u),
    bot:   lerpHex(a.bot, b.bot, u),
    stars: a.stars + (b.stars - a.stars) * u,
  };
}

function lerpHex(h1, h2, u) {
  const c1 = parseHex(h1), c2 = parseHex(h2);
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * u);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * u);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * u);
  return `rgb(${r},${g},${b})`;
}
function parseHex(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Stable star field — re-seeded once per session.
const STARS = [];
(function seedStars() {
  let seed = 12345;
  function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (let i = 0; i < 80; i++) {
    STARS.push({
      x: rng() * CANVAS_W,
      y: rng() * (CANVAS_H * 0.45),
      r: rng() * 1.2 + 0.3,
      twinkle: rng(),
    });
  }
})();

// ── Renderer ────────────────────────────────────────────

function ShroomCanvas({ snapshot }) {
  const canvasRef = React.useRef();

  React.useEffect(() => {
    if (!snapshot) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    drawScene(ctx, snapshot);
  }, [snapshot]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        width: '100%', height: 'auto', display: 'block',
        imageRendering: 'pixelated',
        borderRadius: 8,
        background: '#000',
      }}
    />
  );
}

function drawScene(ctx, snap) {
  const sky = skyForTime(new Date());
  drawSky(ctx, sky);
  drawStars(ctx, sky.stars);

  const kind     = b64ToBytes(snap.kind);
  const occupied = b64ToBytes(snap.occupied);
  const moisture = b64ToBytes(snap.moisture);

  // Render the world via offscreen 320x180 imageData, then upscale.
  const off = document.createElement('canvas');
  off.width = SHROOM_W; off.height = SHROOM_H;
  const offCtx = off.getContext('2d');
  const img = offCtx.createImageData(SHROOM_W, SHROOM_H);
  paintWorldPixels(img, kind, occupied, moisture, sky);
  offCtx.putImageData(img, 0, 0);

  // Glow layer — separate offscreen with hyphae bloom.
  const glow = buildGlowCanvas(occupied, moisture);

  // Crisp upscale of world pixels
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H);

  // Soft glow on top (additive light)
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(6px)';
  ctx.drawImage(glow, 0, 0, CANVAS_W, CANVAS_H);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  // Spores — drifting motes
  drawSpores(ctx, snap.spores);

  // Mushrooms — drawn last so they sit on top
  drawMushrooms(ctx, snap.fruits, snap.colonies);

  // Weather flourish during a toofan
  if (snap.meta.weather && snap.meta.weather !== 'clear') {
    drawWeatherFlourish(ctx, snap.meta.weather);
  }
}

function drawSky(ctx, sky) {
  // Sky gradient spans the sky band (top 35% of canvas) — matches GRASS_Y.
  // Soil below is painted per-pixel in paintWorldPixels.
  const grd = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.35);
  grd.addColorStop(0, sky.top);
  grd.addColorStop(1, sky.bot);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawStars(ctx, alpha) {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.fillStyle = `rgba(245, 240, 230, ${alpha})`;
  for (const s of STARS) {
    const a = alpha * (0.6 + 0.4 * Math.sin(Date.now() * 0.001 + s.twinkle * 6));
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Soil / log / grass painted into the offscreen low-res buffer.
function paintWorldPixels(img, kind, occupied, moisture, sky) {
  const data = img.data;
  for (let y = 0; y < SHROOM_H; y++) {
    for (let x = 0; x < SHROOM_W; x++) {
      const i = y * SHROOM_W + x;
      const o = i * 4;
      const k = kind[i];
      let r = 0, g = 0, b = 0, a = 0; // a=0 means "let sky show through"

      if (k === SOIL) {
        // dark warm earth, depth gradient
        // Soil band is rows 64..179 (65% of canvas). Anchor matches GRASS_Y.
        const depth = (y - SHROOM_H * 0.35) / (SHROOM_H * 0.65);
        const v = 0.18 - depth * 0.05;
        r = clamp255(95 * v * 5);
        g = clamp255(72 * v * 5);
        b = clamp255(58 * v * 5);
        a = 255;
      } else if (k === GRASS) {
        r = 64; g = 110; b = 56; a = 255;
      } else if (k === LOG) {
        // base log brown, modulated by moisture
        const m = moisture[i] / 255 * (255 / 100); // approximate
        const wet = Math.min(1, moisture[i] / 80);
        r = Math.round(116 - wet * 30);
        g = Math.round(82  - wet * 18);
        b = Math.round(54  + wet * 12);
        a = 255;
      } else if (k === FRUIT) {
        // marker only — actual mushroom drawn later. Make this transparent.
        a = 0;
      } else if (k === TREE) {
        // Tree — warm brown trunk + canopy. v3 polish will differentiate
        // stem vs crown and tint by species; for MVP a single solid shade
        // is enough to read the lifecycle.
        r = 88; g = 60; b = 36; a = 255;
      } else {
        // AIR — keep sky; occupied air (rare) gets faint hypha tint
        a = 0;
      }

      // Hyphae overlay — additive warm tint where occupied
      if (occupied[i]) {
        r = Math.round((r || 0) * 0.65 + 240 * 0.35);
        g = Math.round((g || 0) * 0.65 + 215 * 0.35);
        b = Math.round((b || 0) * 0.65 + 140 * 0.35);
        a = 255;
      }

      data[o]     = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = a;
    }
  }
}

function buildGlowCanvas(occupied, moisture) {
  const canvas = document.createElement('canvas');
  canvas.width = SHROOM_W; canvas.height = SHROOM_H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SHROOM_W, SHROOM_H);
  const data = img.data;
  for (let i = 0; i < occupied.length; i++) {
    const o = i * 4;
    if (!occupied[i]) { data[o + 3] = 0; continue; }
    // Tip detection: if any 4-neighbor is unoccupied, treat this as a tip
    const x = i % SHROOM_W;
    const isTip =
      (x > 0            && !occupied[i - 1])      ||
      (x < SHROOM_W - 1  && !occupied[i + 1])      ||
      (i >= SHROOM_W     && !occupied[i - SHROOM_W])||
      (i < occupied.length - SHROOM_W && !occupied[i + SHROOM_W]);
    const intensity = isTip ? 220 : 80;
    data[o]     = 255;
    data[o + 1] = 220;
    data[o + 2] = 130;
    data[o + 3] = intensity;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function drawSpores(ctx, spores) {
  if (!spores || !spores.length) return;
  ctx.save();
  for (const s of spores) {
    const sx = s.x * SCALE, sy = s.y * SCALE;
    const lifeFade = 1 - Math.min(1, s.age / 200);
    ctx.globalAlpha = 0.25 + lifeFade * 0.45;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5 + lifeFade * 1.5, 0, Math.PI * 2);
    ctx.fill();
    // soft halo
    ctx.globalAlpha = 0.1 * lifeFade;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMushrooms(ctx, fruits, colonies) {
  if (!fruits || !fruits.length) return;
  ctx.save();
  for (const f of fruits) {
    const col = colonies[f.colonyId];
    if (!col) continue;
    const x = f.x * SCALE + SCALE / 2;
    const yBase = f.y * SCALE + SCALE; // base sits on log surface
    const matureT = Math.min(1, f.age / 80);
    const stem = (col.stemLength || 1) * 14 * (0.4 + matureT * 0.6);
    const capR = (col.capSize  || 1)   * 7  * (0.4 + matureT * 0.6);
    const capY = yBase - stem;
    const hue  = ((col.capHue || 30) % 360 + 360) % 360;

    // stem
    ctx.fillStyle = '#ddd0b3';
    ctx.fillRect(x - 1.6, capY, 3.2, stem);

    // cap
    ctx.fillStyle = `hsl(${hue} 60% 55%)`;
    ctx.strokeStyle = `hsl(${hue} 35% 35%)`;
    ctx.lineWidth = 1;
    drawCap(ctx, x, capY, capR, col.capShape || 0);

    // gentle outer glow on the cap when mature
    if (matureT >= 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = `hsl(${hue} 80% 70%)`;
      ctx.beginPath();
      ctx.arc(x, capY, capR * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawCap(ctx, x, y, r, shape) {
  ctx.beginPath();
  switch (shape) {
    case 1: // conical
      ctx.moveTo(x - r, y);
      ctx.lineTo(x, y - r * 1.6);
      ctx.lineTo(x + r, y);
      ctx.closePath();
      break;
    case 2: // flat
      ctx.ellipse(x, y - 1, r * 1.15, r * 0.45, 0, 0, Math.PI * 2);
      break;
    case 3: // frilly
      ctx.moveTo(x - r, y);
      for (let i = -r; i <= r; i += r / 3) {
        ctx.lineTo(x + i, y - r * (0.7 + Math.sin(i * 1.3) * 0.2));
      }
      ctx.lineTo(x + r, y);
      ctx.closePath();
      break;
    case 0: // round
    default:
      ctx.arc(x, y, r, Math.PI, 0);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x - r, y);
      ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

function drawWeatherFlourish(ctx, kind) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  switch (kind) {
    case 'flood':
      ctx.fillStyle = 'rgba(70,130,180,0.5)';
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * CANVAS_W;
        const y = Math.random() * CANVAS_H;
        ctx.fillRect(x, y, 1.5, 12);
      }
      break;
    case 'fire':
      ctx.fillStyle = 'rgba(220,80,30,0.4)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      break;
    case 'frost':
      ctx.fillStyle = 'rgba(180,210,240,0.3)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      break;
    case 'wind':
      ctx.strokeStyle = 'rgba(220,220,220,0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        const y = Math.random() * CANVAS_H;
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y + Math.random() * 30 - 15);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// Expose
window.ShroomCanvas = ShroomCanvas;
