// Shroom — canvas wiring.
// Pure pixel-buffer atoms live in canvas-atoms.js (window.ShroomAtoms).
// This file:
//   · decodes the server snapshot
//   · maps it to a cfg the atoms understand (worldToCfg)
//   · renders to the 320×180 buffer, then upscales crisp
//   · paints smoothed overlays (sun bloom, hyphae glow, mushroom glow,
//     spores, fog, leaves, glass edge, vignette)
//   · exposes <ShroomCanvas /> for app.js
//
// Slice 2: visible world is parametric and matches the locked-vision
// kit; smoothed overlays are present but tuning + dynamic positioning
// + glow-budget clamp land in slice 3.

const SHROOM_W = 320;
const SHROOM_H = 180;
const SCALE    = 4;
const CANVAS_W = SHROOM_W * SCALE;
const CANVAS_H = SHROOM_H * SCALE;

// Cell kinds (mirror lib/world.js).
const AIR   = 0;
const SOIL  = 1;
const GRASS = 2;
const LOG   = 3;
const FRUIT = 4;
const TREE  = 5;

// Sim time anchors (mirror lib/time.js — kept renderer-side so we can
// translate "ticks since" → "real days" for log age etc.).
const CANONICAL_TICK_MS = 3000;
const TICKS_PER_DAY     = (24 * 60 * 60 * 1000) / CANONICAL_TICK_MS; // 28800
const TICKS_PER_WEEK    = 7 * TICKS_PER_DAY;
const TICKS_PER_MONTH   = 30 * TICKS_PER_DAY;

// ── decode ────────────────────────────────────────────────────────────

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── state translator ─────────────────────────────────────────────────
// snap (from /api/world/snapshot) → cfg the atoms expect.
//
// The mapping is the actual contract between sim state and renderer. If
// the snapshot shape changes, fix it here, not in the atoms.
function worldToCfg(snap, now, t = 0) {
  const A = window.ShroomAtoms;
  if (!snap || !A) return null;

  const season = snap.meta.season || 'spring';
  const sky    = A.skyPreset(now, season);
  const tick   = snap.meta.tick || 0;

  // ── colonies → hyphae cfg (option B: bbox-bounded painterly walker) ──
  const colonies = [];
  let aliveCount = 0;
  for (const idStr of Object.keys(snap.colonies)) {
    const c = snap.colonies[idStr];
    if (!c.alive || !c.bbox) continue;
    aliveCount++;
    const bb     = c.bbox;
    const bbW    = bb.maxX - bb.minX + 1;
    const bbH    = bb.maxY - bb.minY + 1;
    const bbArea = bbW * bbH;
    // cx = footprint center; cy = bottom row (where the colony hugs the
    // substrate). Hyphae walks up from cy.
    const cx = Math.round((bb.minX + bb.maxX) / 2);
    const cy = bb.maxY;
    // density derives from cell-density inside the bbox, capped to a useful
    // range. Fresh colonies are sparse; old, packed ones are dense mats.
    const density = Math.min(1, Math.max(0.12, (c.cellCount || 1) / Math.max(1, bbArea)));
    colonies.push({
      cx, cy,
      thickness: Math.max(3, bbH),
      hue:    c.capHue,                      // already 0..360
      sat:    32 + Math.round(density * 12), // denser → slightly punchier
      tips:   10 + Math.round(density * 18),
      maxLen: 8  + Math.round(bbW * 0.3),
      spread: Math.max(8, bbW),
      // Seed stays constant per colony so the filament pattern is stable
      // across ticks. (Earlier this baked `tick` in — the hyphae visibly
      // drifted every 3s like grass in wind. The colony isn't relocating;
      // it grows, and growth shows up via bbox + density, not seed.)
      seed:   (idStr * 17) | 0,
      stain:  density > 0.35,
      density,
      _id:    +idStr,                        // used by overlays
    });
  }

  // ── fruits → mushrooms ──────────────────────────────────────────────
  // Per-genome cap shape/hue + size/stem mapped from genes:
  //   cap_size 0.5..2 → capR 3..8
  //   stem_length 0.5..2 → stemH 4..14
  const mushrooms = [];
  for (const f of snap.fruits || []) {
    const c = snap.colonies[f.colonyId];
    if (!c) continue;
    const capR  = Math.round(2 + (c.capSize    || 1) * 2.5);
    const stemH = Math.round(3 + (c.stemLength || 1) * 5);
    mushrooms.push({
      x: f.x, baseY: f.y,
      stemH, capR,
      hue: c.capHue,
      shape: Math.min(3, Math.max(0, c.capShape | 0)),
      curve: ((f.x * 31 + f.y * 13) % 3) - 1,   // -1, 0, or 1
      mature: f.mature !== false,
      _colonyId: f.colonyId,
    });
  }

  // ── trees → tree cfg ────────────────────────────────────────────────
  const trees = [];
  for (const t of (snap.meta.trees || [])) {
    if (t.alive === false || (t.felledTick && (tick - t.felledTick) > 0)) continue;
    trees.push({
      x: t.x,
      h: Math.max(4, t.height || 1),
      species: t.species || 'oak',
      trunkW: 2,
      crownW: t.crownRadius || 8,
    });
  }

  // ── logs ────────────────────────────────────────────────────────────
  // Each log: x1/x2/y/thickness/species/age/mossy. Age derives from how
  // long since the log was created; > 4 weeks goes mossy automatically.
  const logs = [];
  for (const lg of (snap.logs || [])) {
    const ageTicks = Math.max(0, tick - (lg.foundedTick || 0));
    const ageFrac  = Math.min(1, ageTicks / (TICKS_PER_MONTH * 3)); // ~3 months → fully aged
    const mossy    = lg.mossy || ageTicks > TICKS_PER_WEEK * 4;
    logs.push({
      x1: lg.x0, x2: lg.x0 + lg.w - 1,
      y:  lg.y0, thickness: lg.h,
      species: lg.species,
      age:     ageFrac,
      mossy,
    });
  }

  // ── stones — sim doesn't track them yet; seed a deterministic set ───
  // (Per-world stones from the seed so they don't shimmer between ticks.)
  const stones = [];
  const stoneRng = A.mkRng(snap.meta.seed || 7);
  const stoneN   = 4 + Math.floor(stoneRng() * 4);
  for (let i = 0; i < stoneN; i++) {
    stones.push({
      x: Math.floor(stoneRng() * SHROOM_W),
      y: 70 + Math.floor(stoneRng() * 90),
      r: 2 + Math.floor(stoneRng() * 3),
      mossy: stoneRng() < 0.4,
      mossSide: stoneRng() < 0.5 ? -1 : 1,
    });
  }

  // ── critters — cosmetic; walk continuously using real time ─────────
  // Seed is stable per world (not per tick) so positions don't jump;
  // t drives the walk so they move smoothly at 60fps between sim ticks.
  const critters = [];
  const critterRng = A.mkRng((snap.meta.seed || 7) * 31 + 7);
  const critterKinds = ['worm', 'beetle', 'springtail', 'ant', 'pillbug'];
  const critterCount = 3 + Math.floor(critterRng() * 3);
  const tSec = t / 1000;
  for (let i = 0; i < critterCount; i++) {
    const kindIdx = Math.floor(critterRng() * critterKinds.length);
    const baseX   = critterRng() * SHROOM_W;
    const baseY   = 80 + critterRng() * 90;
    // Walk horizontally — body angle stays aligned with travel direction so
    // worms read as crawling, not spinning. Body undulation comes from
    // `phase` in canvas-atoms.js worm draw.
    const dir     = critterRng() < 0.5 ? -1 : 1;
    const baseAng = dir > 0 ? 0 : Math.PI;
    const segs    = 8 + Math.floor(critterRng() * 3);
    // px/s, varies per critter. Tuned so forward motion outpaces the body
    // wiggle amplitude — at 2-3 px/s a worm crosses the 320-wide canvas in
    // ~2 real minutes, slow enough to be ambient but visibly moving.
    const speed   = 2.0 + (i % 3) * 0.6;
    const walkX   = ((baseX + dir * speed * tSec) % SHROOM_W + SHROOM_W) % SHROOM_W;
    const walkY   = baseY + Math.sin(tSec * 0.55 + i * 1.8) * 1.4;
    critters.push({
      kind:  critterKinds[kindIdx],
      x:     Math.round(walkX),
      y:     Math.round(walkY),
      angle: baseAng,
      // Time phase per-critter: drives body undulation in the worm draw so
      // the S-curve travels down the body as it moves forward.
      phase: tSec * 3 + i * 0.9,
      segs,
    });
  }

  // ── sun/moon body ───────────────────────────────────────────────────
  // Slice 2 uses fixed positions per phase. Slice 3 makes it trajectory.
  let body = null;
  if (sky.hour >= 6 && sky.hour < 19.5) {
    // Sun visible roughly from dawn to dusk. Arc from (40, 50) → (280, 20) → (280, 50).
    const t = (sky.hour - 6) / 13.5;          // 0..1 across the daylight window
    const ang = t * Math.PI;
    const sx = 40 + (280 - 40) * t;
    const sy = 50 - Math.sin(ang) * 36;       // dome
    body = { kind: 'sun', x: Math.round(sx), y: Math.round(sy), r: 11, hue: sky.sunHue };
  } else {
    // Moon visible at night. Same arc but inverted x.
    const tNight = sky.hour >= 19.5
      ? (sky.hour - 19.5) / 10.5
      : (sky.hour + 4.5)  / 10.5;
    const t = Math.min(1, Math.max(0, tNight));
    const ang = t * Math.PI;
    const mx = 40 + (280 - 40) * t;
    const my = 35 - Math.sin(ang) * 24;
    body = { kind: 'moon', x: Math.round(mx), y: Math.round(my), r: 7 };
  }

  // ── persona wisp ────────────────────────────────────────────────────
  // Smokeless-fire wisp at dusk (19:00–19:30 local), hovering above a
  // deterministic log chosen by world seed so it always returns to the
  // same place. Slice 3 wiring; in v3 this gets sim-driven (Nigehban
  // chooses the log via a tool call).
  let personaWisp = null;
  if (sky.hour >= 19.0 && sky.hour < 19.5 && logs.length > 0) {
    const pick = logs[Math.abs((snap.meta.seed || 0) * 13) % logs.length];
    personaWisp = {
      x: Math.round((pick.x1 + pick.x2) / 2),
      y: pick.y - 6,   // hovers 6 cells above the log surface
    };
  }

  return {
    sky, body,
    stars: sky.stars,
    season, tick,
    cloudCover: cloudCoverForSeason(season),
    cloudSeed: snap.meta.seed || 7,
    logs, trees, colonies, mushrooms,
    stones, critters,
    spores: snap.spores || [],
    stains: [],          // dead-colony stains — needs a sim hook later
    // Scars age over ~3 real weeks (~600k ticks); renderer fades alpha.
    eraScars: (snap.eraScars || []).map(s => {
      const elapsed = Math.max(0, tick - (s.foundedTick || 0));
      const lifeTicks = TICKS_PER_WEEK * 3;
      return { ...s, age: Math.max(0, 1 - elapsed / lifeTicks) };
    }),
    dew:        sky.hour < 7.5,
    personaWisp,
    autumnFog:  season === 'autumn' && sky.hour < 9,
    fallingLeaves: season === 'autumn',
    aliveCount,
  };
}

function cloudCoverForSeason(season) {
  if (season === 'spring') return 0.18;
  if (season === 'summer') return 0.10;
  if (season === 'autumn') return 0.45;
  if (season === 'winter') return 0.60;
  return 0.25;
}

// ── render ────────────────────────────────────────────────────────────

// ── Rail hover bloom (design kanban #03 + #10) ───────────────────────
// When the user hovers a TopColony rail entry, App passes the matching
// colonyId via the `hoveredColonyId` prop. We paint a soft hue-tinted
// ring around the colony's bbox and an F57 label above it — connecting
// the rail name to the colony without permanent labels on the diorama.
function paintHoverBloom(ctx, snap, hoveredColonyId, sx, sy) {
  if (!hoveredColonyId) return;
  const c = snap.colonies?.[hoveredColonyId];
  if (!c || !c.alive || !c.bbox) return;
  const A = window.ShroomAtoms;
  if (!A) return;

  const { minX, minY, maxX, maxY } = c.bbox;
  // Expand the bbox slightly for the bloom — gives breathing room around
  // tip cells that sit at the edge.
  const pad = 4;
  const x0 = Math.max(0, minX - pad) * sx;
  const y0 = Math.max(0, minY - pad) * sy;
  const x1 = (maxX + pad) * sx;
  const y1 = (maxY + pad) * sy;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w = x1 - x0, h = y1 - y0;
  const r = Math.max(w, h) * 0.7;

  // Soft outline bloom — capHue tint, additive, breathing-free (no
  // animation: hover is the animation).
  const rgb = A.hsl(c.capHue || 0, 70, 64);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, r);
  g.addColorStop(0,    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.20)`);
  g.addColorStop(0.55, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.10)`);
  g.addColorStop(1,    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // F57 label — first in-world use of the bitmap font (kanban #10).
  // We paint each glyph pixel as a scaled rect on the upscaled context
  // so the bitmap pixels line up with the rest of the diorama. A dark
  // 1-pixel halo keeps the label legible against any background.
  const name = (c.name || c.placeholderName || '').toString();
  if (!name) return;
  const F57 = window.SHROOM_TOKENS && window.SHROOM_TOKENS.F57;
  if (!F57) return;
  const labelText = name.toUpperCase();
  const cw = 5, ch = 7, sp = 1;
  const labelW = labelText.length * (cw + sp) - sp;
  // Position in pixel-buffer coords: 2 px above the bbox top, clamped
  // inside the canvas.
  const labelPbX = Math.max(2, Math.min(SHROOM_W - labelW - 2,
    Math.floor((minX + maxX) / 2 - labelW / 2)));
  const labelPbY = Math.max(2, minY - pad - ch - 2);

  const labelRgb = A.hsl(c.capHue || 0, 65, 88);
  const labelFill = `rgb(${labelRgb[0]},${labelRgb[1]},${labelRgb[2]})`;
  const haloFill  = 'rgba(8, 6, 4, 0.85)';

  // Two passes: halo offsets first, then the label on top.
  function paintGlyphPixels(fill, ox, oy) {
    ctx.fillStyle = fill;
    let pxx = labelPbX + ox;
    for (const char of labelText) {
      const g = F57[char] || F57['?'];
      if (g) {
        for (let r = 0; r < ch; r++) {
          const bits = g[r];
          for (let cc = 0; cc < cw; cc++) {
            if (bits & (1 << (cw - 1 - cc))) {
              ctx.fillRect(
                (pxx + cc) * sx,
                (labelPbY + oy + r) * sy,
                sx, sy);
            }
          }
        }
      }
      pxx += cw + sp;
    }
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    paintGlyphPixels(haloFill, dx, dy);
  }
  paintGlyphPixels(labelFill, 0, 0);
  ctx.restore();
}

function drawScene(ctx, snap, t = 0, opts) {
  const A = window.ShroomAtoms;
  if (!A) return;
  const cfg = worldToCfg(snap, new Date(), t);
  if (!cfg) return;

  // Decode colony grid once for option-A cell painting.
  const colonyBytes = b64ToBytes(snap.colony);
  // Uint16 view on the underlying buffer. View length = bytes / 2.
  const colonyU16 = new Uint16Array(colonyBytes.buffer, colonyBytes.byteOffset, colonyBytes.byteLength / 2);

  // 1. Build the 320×180 pixel buffer.
  const pb = new A.PB(SHROOM_W, SHROOM_H);
  A.paintSky(pb, cfg);
  A.paintSunMoon(pb, cfg);
  A.paintStars(pb, cfg);
  A.paintClouds(pb, cfg);
  A.paintFarLayer(pb, cfg);
  A.paintSoil(pb, cfg);
  for (const scar of cfg.eraScars) A.paintEraScar(pb, scar);
  for (const s of cfg.stones) A.paintStone(pb, s);
  for (const t of cfg.trees)  A.paintTree(pb, t, cfg);
  for (const lg of cfg.logs)  A.paintLog(pb, lg);
  // Hyphae painted from the actual cell grid — one pixel per filled cell.
  A.paintHyphaeFromGrid(pb, colonyU16, snap.colonies);
  A.paintDecayStain(pb, cfg.stains);
  A.paintGrass(pb, cfg);
  A.paintCritters(pb, cfg.critters);
  for (const m of cfg.mushrooms) A.paintMushroom(pb, m);

  // Dawn dew on log + grass.
  if (cfg.dew) {
    const rng = A.mkRng(99);
    for (const lg of cfg.logs) {
      for (let x = lg.x1 + 1; x < lg.x2; x++) {
        if (rng() < 0.14) pb.blend(x, lg.y, 220, 230, 240, 180);
      }
    }
    for (let x = 0; x < SHROOM_W; x++) {
      if (rng() < 0.07) pb.blend(x, A.GRASS_Y - 2, 220, 230, 240, 180);
    }
  }

  // 2. Put pixel buffer into the canvas, crisp upscale.
  const off = document.createElement('canvas');
  off.width = SHROOM_W; off.height = SHROOM_H;
  off.getContext('2d').putImageData(new ImageData(pb.data, SHROOM_W, SHROOM_H), 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H);

  // 3. Smoothed overlays (post-upscale). The hyphae glow now derives
  // from the cell grid too: build an offscreen hue-tinted glow buffer
  // (tip pixels emit bright, interior dim), blur, composite additive.
  paintOverlays(ctx, cfg, colonyU16, snap.colonies, t);

  // 4. Hover bloom — drawn on top of the vignette so the highlighted
  // colony stays legible no matter where it sits. Only fires when the
  // user is hovering a TopColony rail entry.
  if (opts && opts.hoveredColonyId) {
    const sx = CANVAS_W / SHROOM_W;
    const sy = CANVAS_H / SHROOM_H;
    paintHoverBloom(ctx, snap, opts.hoveredColonyId, sx, sy);
  }
}

// Build an offscreen 320×180 glow buffer from the cell grid. Tip cells
// emit brightly, chain/branch cells emit modestly, fully-interior mat
// barely emits — same connectivity tiers as paintHyphaeFromGrid so the
// glow traces the network topology instead of bloating the whole mass.
// Returned as a canvas that drawScene blurs + composites with `lighter`.
function buildHyphaeGlowCanvas(colonyU16, coloniesByCid, A) {
  const off = document.createElement('canvas');
  off.width = SHROOM_W; off.height = SHROOM_H;
  const img = off.getContext('2d').createImageData(SHROOM_W, SHROOM_H);
  const data = img.data;
  const palette = {};
  for (const cid of Object.keys(coloniesByCid)) {
    const c = coloniesByCid[cid];
    if (!c || !c.alive) continue;
    palette[cid] = A.hsl(c.capHue || 0, 60, 64);
  }
  const len = colonyU16.length;
  for (let i = 0; i < len; i++) {
    const cid = colonyU16[i];
    if (cid === 0) continue;
    const rgb = palette[cid];
    if (!rgb) continue;
    const x = i % SHROOM_W;
    const sameN =
      (x > 0              && colonyU16[i - 1]        === cid ? 1 : 0) +
      (x < SHROOM_W - 1   && colonyU16[i + 1]        === cid ? 1 : 0) +
      (i >= SHROOM_W      && colonyU16[i - SHROOM_W] === cid ? 1 : 0) +
      (i < len - SHROOM_W && colonyU16[i + SHROOM_W] === cid ? 1 : 0);
    const alpha =
      sameN <= 1 ? 200 :   // tip — bright
      sameN === 2 ? 90  :  // chain
      sameN === 3 ? 50  :  // branch
                    15;    // interior mat — barely glows
    const o = i * 4;
    data[o]     = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = alpha;
  }
  off.getContext('2d').putImageData(img, 0, 0);
  return off;
}

function paintOverlays(ctx, cfg, colonyU16, coloniesByCid, t = 0) {
  const tSec = t / 1000;
  const A = window.ShroomAtoms;
  const sx = CANVAS_W / SHROOM_W;
  const sy = CANVAS_H / SHROOM_H;

  // ── sun/moon bloom (additive radial). ────────────────────────────
  if (cfg.body) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    const b = cfg.body;
    const bx = b.x * sx, by = b.y * sy;
    if (b.kind === 'sun') {
      const r = b.r * sx * 6;
      const rgb = A.hsl(b.hue || 24, 80, 70);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0,    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`);
      g.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.18)`);
      g.addColorStop(1,    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    } else {
      const r = b.r * sx * 5;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0,   'rgba(196, 212, 232, 0.32)');
      g.addColorStop(0.4, 'rgba(196, 212, 232, 0.08)');
      g.addColorStop(1,   'rgba(196, 212, 232, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── hyphae glow — HERO LIGHT, cell-grid honest. ──────────────────
  // Build a per-pixel glow buffer from the colony grid (tip pixels emit
  // bright, interior pixels dim), then upscale + blur + additive
  // composite. What you see follows the sim exactly: 1 new cell = 1
  // new emitter. Budget clamp scales overall alpha when many colonies
  // are alive (layering doc caps combined ≤ ~0.65).
  const budgetScale = cfg.aliveCount > 4
    ? Math.min(1, Math.sqrt(4 / cfg.aliveCount))
    : 1;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter';
  if (colonyU16 && coloniesByCid) {
    const glowCanvas = buildHyphaeGlowCanvas(colonyU16, coloniesByCid, A);
    // Slow breathing pulse — the network feels alive between sim ticks.
    const breathe = 0.82 + 0.18 * Math.sin(tSec * 0.7);
    ctx.filter = 'blur(3px)';
    ctx.globalAlpha = 0.65 * budgetScale * breathe;
    ctx.drawImage(glowCanvas, 0, 0, CANVAS_W, CANVAS_H);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }

  // ── mushroom cap glow — dusk/night only, cool-blue ~3× warm. ─────
  // Per-cap glow is also budgeted — clamp by sqrt(mushrooms/8) so a
  // heavy fruiting wave doesn't go nova.
  const isDim = cfg.sky.hour < 7 || cfg.sky.hour > 19;
  const capBudget = cfg.mushrooms.length > 8
    ? Math.min(1, Math.sqrt(8 / cfg.mushrooms.length))
    : 1;
  if (isDim) {
    for (const m of cfg.mushrooms) {
      if (!m.mature) continue;
      const inCool = m.hue >= 180 && m.hue <= 240;
      const baseAlpha = (inCool ? 0.30 : 0.10) * capBudget;
      const rgb = A.hsl(m.hue, 70, 70);
      const cx0 = m.x * sx;
      const cy0 = (m.baseY - m.stemH) * sy;
      const r   = (m.capR + 4) * sx * (inCool ? 1.4 : 1.1);
      const g   = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, r);
      g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${baseAlpha})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx0, cy0, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // ── real sim spores (smoothed motes at actual positions). ────────
  // The kit mock had 14 decorative motes hardcoded in upper sky; those
  // were placeholder visuals and read as glowing magma when stacked
  // against the hyphae bloom. Real spores from snap.spores are smaller,
  // dimmer, and only appear when colonies actually release them.
  if (cfg.spores && cfg.spores.length) {
    ctx.save();
    for (const sp of cfg.spores) {
      // Gentle oscillating drift — each spore floats independently.
      const driftX = Math.sin(tSec * 0.45 + sp.x * 0.28) * 1.8;
      const driftY = Math.cos(tSec * 0.35 + sp.y * 0.22) * 0.9;
      const sxx = (sp.x + driftX) * sx;
      const syy = (sp.y + driftY) * sy;
      const ageFade = Math.max(0, 1 - (sp.age || 0) / 200);
      const r = 1.2 * sx;
      ctx.fillStyle = `rgba(232, 220, 180, ${0.32 * ageFade})`;
      ctx.beginPath(); ctx.arc(sxx, syy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(232, 220, 180, ${0.08 * ageFade})`;
      ctx.beginPath(); ctx.arc(sxx, syy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── autumn fog (low band). ───────────────────────────────────────
  if (cfg.autumnFog) {
    ctx.save();
    const fogTop = (A.GRASS_Y - 6) * sy;
    const fogBot = (A.GRASS_Y + 14) * sy;
    const grd = ctx.createLinearGradient(0, fogTop, 0, fogBot);
    grd.addColorStop(0,   'rgba(180, 150, 130, 0)');
    grd.addColorStop(0.4, 'rgba(180, 150, 130, 0.32)');
    grd.addColorStop(1,   'rgba(180, 150, 130, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, fogTop, CANVAS_W, fogBot - fogTop);
    ctx.restore();
  }

  // ── falling leaves (autumn). ─────────────────────────────────────
  // Each leaf falls at its own speed, sways, and rotates. They wrap back
  // to the top so the layer is always populated without extra state.
  if (cfg.fallingLeaves) {
    ctx.save();
    const lrng  = A.mkRng(311);
    const leafColors = [A.hsl(22, 75, 42), A.hsl(42, 70, 48), A.hsl(12, 65, 36)];
    const grassPx = A.GRASS_Y * sy;
    for (let i = 0; i < 12; i++) {
      const baseX    = lrng() * CANVAS_W;
      const phase    = lrng() * grassPx;          // stagger start positions
      const fallSpd  = 10 + lrng() * 18;          // px/s
      const swayAmp  = 14 + lrng() * 22;
      const swayFreq = 0.35 + lrng() * 0.55;
      const c        = leafColors[(lrng() * 3) | 0];
      const rotSpd   = 0.6 + lrng() * 1.4;
      const lx  = baseX + Math.sin(tSec * swayFreq + i * 1.3) * swayAmp;
      const ly  = (phase + tSec * fallSpd) % grassPx;
      const rot = tSec * rotSpd + i * 0.9;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.82)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.2 * sx, 1.1 * sx, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── persona wisp (Nigehban — smokeless fire, dusk only). ─────────
  if (cfg.personaWisp) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    const wx = cfg.personaWisp.x * sx;
    const wy = cfg.personaWisp.y * sy;
    // Hot core
    const grd = ctx.createRadialGradient(wx, wy, 0, wx, wy, 22 * sx / 4);
    grd.addColorStop(0,   'rgba(255, 200, 120, 0.95)');
    grd.addColorStop(0.4, 'rgba(220, 110, 60, 0.4)');
    grd.addColorStop(1,   'rgba(220, 110, 60, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(wx, wy, 22 * sx / 4, 0, Math.PI * 2); ctx.fill();
    // Upward flicker — narrow trail of ellipses, time-driven oscillation.
    for (let i = 0; i < 5; i++) {
      const trailY = wy - (i * 6 + 4) * sy / 4;
      const a = 0.32 - i * 0.05;
      ctx.fillStyle = `rgba(255, 180, 110, ${a})`;
      ctx.beginPath();
      ctx.ellipse(wx + Math.sin(i * 1.4 + tSec * 4.5) * 3, trailY,
        (3 - i * 0.4) * sx / 4, (4 - i * 0.4) * sx / 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── glass edge + diagonal highlight. ─────────────────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(168, 196, 176, 0.16)';
  ctx.lineWidth = sx;
  ctx.strokeRect(sx * 0.5, sy * 0.5, CANVAS_W - sx, CANVAS_H - sy);
  const hgrad = ctx.createLinearGradient(0, 0, CANVAS_W * 0.7, CANVAS_H * 0.4);
  hgrad.addColorStop(0,   'rgba(255, 255, 255, 0.05)');
  hgrad.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hgrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  // ── deep-soil cool haze + vignette. ──────────────────────────────
  ctx.save();
  const hazeTop = (A.GRASS_Y + 4) * sy;
  const haze = ctx.createLinearGradient(0, hazeTop, 0, CANVAS_H);
  haze.addColorStop(0,   'rgba(6, 5, 10, 0)');
  haze.addColorStop(0.5, 'rgba(6, 5, 10, 0.28)');
  haze.addColorStop(1,   'rgba(6, 5, 10, 0.6)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hazeTop, CANVAS_W, CANVAS_H - hazeTop);
  const vg = ctx.createRadialGradient(
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.45,
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

// ── React component ──────────────────────────────────────────────────
// Exact same signature as the old canvas.js: <ShroomCanvas snapshot={...} />.

function ShroomCanvas({ snapshot, hoveredColonyId }) {
  const ref = React.useRef(null);
  // Stash hoveredColonyId in a ref so the rAF loop reads the latest value
  // without restarting on every hover change (which would also drop the
  // scene mid-frame).
  const hoverRef = React.useRef(hoveredColonyId);
  React.useEffect(() => { hoverRef.current = hoveredColonyId; }, [hoveredColonyId]);
  React.useEffect(() => {
    if (!ref.current || !snapshot) return;
    const ctx = ref.current.getContext('2d');
    let raf = 0;
    const tick = (t) => {
      drawScene(ctx, snapshot, t, { hoveredColonyId: hoverRef.current });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snapshot]);

  // Wrapper maintains the 16:9 aspect ratio inside whatever container it's
  // placed in. The canvas itself just fills the wrapper pixel-for-pixel.
  // maxWidth: native size — never upscale past the pixel buffer resolution.
  // maxHeight: 100% — when the container is more portrait than 16:9, the
  //   wrapper shrinks from the height side and the width follows via aspect-ratio.
  //
  // Depth-pass frame: the canvas reads as nested into the page via a
  // hairline outer border + inset shadow on the wrapper. Pairs with the
  // elevated right-rail panels (DarkPanel.elevation) so the page reads
  // as a stack of planes instead of a flat surface.
  return (
    <div style={{
      width: '100%',
      maxWidth: CANVAS_W,
      aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
      maxHeight: '100%',
      flexShrink: 0,
      position: 'relative',
      // Hairline outer border + inner shadow ring — makes the canvas
      // sit "in" the page. Using a 2px outer dark hairline so the pixel
      // edge stays crisp, plus a soft inner shadow that draws the eye
      // toward the diorama interior.
      border: '1px solid rgba(8, 6, 4, 0.85)',
      boxShadow: [
        '0 0 0 1px rgba(232,223,200,0.04)',                // outer rim highlight
        'inset 0 0 0 1px rgba(0,0,0,0.55)',                // inset crisp ring
        'inset 0 12px 32px rgba(0,0,0,0.35)',              // soft inner top shadow
        'inset 0 -12px 32px rgba(0,0,0,0.25)',             // soft inner bottom shadow
      ].join(', '),
    }}>
      <canvas
        ref={ref}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          background: COL.inkDeep,
        }}
      />
    </div>
  );
}

window.ShroomCanvas = ShroomCanvas;
