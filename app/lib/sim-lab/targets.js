// Vision target scorers. Each target is a function over a finished run
// snapshot that returns { ok, score, value, note } — a pass/fail plus a
// numeric reading the driver can aggregate across seeds.
//
// Targets describe the *qualitative* goal (e.g. "branched, not blob") as a
// quantitative criterion ("cells / bounding-box area in [0.15, 0.45]"). The
// research paper carries the prose. Add a target here when a new vision is
// being optimised against.

const { W, H, GRASS_Y, LOG, SOIL, GRASS } = require('../world');

// ── Helpers ─────────────────────────────────────────────

function colonyCells(world, cid) {
  const out = [];
  const { colony } = world.grid;
  for (let i = 0; i < colony.length; i++) {
    if (colony[i] === cid) out.push({ i, x: i % W, y: Math.floor(i / W) });
  }
  return out;
}

function boundingBox(cells) {
  if (!cells.length) return null;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (const c of cells) {
    if (c.x < x0) x0 = c.x; if (c.x > x1) x1 = c.x;
    if (c.y < y0) y0 = c.y; if (c.y > y1) y1 = c.y;
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, area: (x1 - x0 + 1) * (y1 - y0 + 1) };
}

// Count distinct runs of colony cells crossing the grass row.
function grassCrossings(world, cid) {
  const { colony } = world.grid;
  let crossings = 0;
  let inRun = false;
  for (let x = 0; x < W; x++) {
    const i = GRASS_Y * W + x;
    const hit = colony[i] === cid;
    if (hit && !inRun) { crossings++; inRun = true; }
    else if (!hit) inRun = false;
  }
  return crossings;
}

function descentDepth(world, cid) {
  const cells = colonyCells(world, cid);
  let maxY = 0;
  for (const c of cells) if (c.y > maxY) maxY = c.y;
  return Math.max(0, maxY - GRASS_Y);
}

// Largest colony in the world (by cellCount). Day-1 single-colony scenario
// has a clear founder; multi-colony scenarios pick the dominant one.
function pickFocalColony(world) {
  const cs = Object.values(world.colonies).filter(c => c.alive);
  if (!cs.length) return null;
  return cs.reduce((a, b) => (a.cellCount > b.cellCount ? a : b));
}

// ── The targets ─────────────────────────────────────────

// modest-size: founding colony in a sane day-1 range.
function modestSize(world, opts = {}) {
  const min = opts.min ?? 150;
  const max = opts.max ?? 800;
  const c = pickFocalColony(world);
  const value = c ? c.cellCount : 0;
  const ok = value >= min && value <= max;
  return { ok, score: value, value, note: `cells=${value} (want [${min}, ${max}])` };
}

// branched-not-blob: cells / bounding-box area ratio in a sparse band.
function branchedDensity(world, opts = {}) {
  const min = opts.min ?? 0.10;
  const max = opts.max ?? 0.40;
  const c = pickFocalColony(world);
  if (!c) return { ok: false, score: 0, value: 0, note: 'no colony' };
  const cells = colonyCells(world, c.id);
  const bb = boundingBox(cells);
  if (!bb) return { ok: false, score: 0, value: 0, note: 'no cells' };
  const density = cells.length / bb.area;
  const ok = density >= min && density <= max;
  return { ok, score: density, value: density,
    note: `density=${density.toFixed(3)} bbox=${bb.w}×${bb.h} (want [${min}, ${max}])` };
}

// descended: founder reached at least N rows below grass.
function descended(world, opts = {}) {
  const min = opts.min ?? 5;
  const c = pickFocalColony(world);
  if (!c) return { ok: false, score: 0, value: 0, note: 'no colony' };
  const d = descentDepth(world, c.id);
  return { ok: d >= min, score: d, value: d, note: `depth=${d} rows below grass (want ≥${min})` };
}

// multiple-descent: at least N distinct cell-runs crossed the grass row.
function multipleDescentPoints(world, opts = {}) {
  const min = opts.min ?? 2;
  const c = pickFocalColony(world);
  if (!c) return { ok: false, score: 0, value: 0, note: 'no colony' };
  const n = grassCrossings(world, c.id);
  return { ok: n >= min, score: n, value: n, note: `${n} grass-crossings (want ≥${min})` };
}

// no-premature-fruit: first-fruit tick should be late, not in the first
// few hundred ticks. Reads world.fruits or lifetime.fruitsTotal at end.
function noPrematureFruit(world, opts = {}) {
  const maxByEnd = opts.maxByEnd ?? 3;
  const lifetime = world.meta.lifetime || {};
  const totalFruits = lifetime.fruitsTotal || 0;
  const ok = totalFruits <= maxByEnd;
  return { ok, score: totalFruits, value: totalFruits,
    note: `fruitsTotal=${totalFruits} (want ≤${maxByEnd})` };
}

// not-saturated: total alive cells / soil-area below half. Catches "liquid
// mat" failure mode where the colony fills the canvas.
function notSaturated(world, opts = {}) {
  const max = opts.max ?? 0.20;
  const { colony, kind } = world.grid;
  let alive = 0, substrate = 0;
  for (let i = 0; i < colony.length; i++) {
    const k = kind[i];
    if (k === LOG || k === SOIL || k === GRASS) substrate++;
    if (colony[i] !== 0) alive++;
  }
  const frac = substrate ? alive / substrate : 0;
  return { ok: frac <= max, score: frac, value: frac,
    note: `alive/substrate=${(frac * 100).toFixed(1)}% (want ≤${max * 100}%)` };
}

// Vision 1 — "day-1 root" — bundle of targets that together describe the
// painting-derived first vision. See RESEARCH.md for the picture.
const VISION_1_DAY1_ROOT = {
  id: 'vision-1-day1-root',
  description: 'Day-1 single colony: branched root, descended through grass, modest size, no premature fruit, no saturation.',
  scenarioId: 'first-day-on-log',
  scorers: [
    { name: 'modestSize',      fn: modestSize,            opts: { min: 150, max: 800 } },
    { name: 'branchedDensity', fn: branchedDensity,       opts: { min: 0.10, max: 0.40 } },
    { name: 'descended',       fn: descended,             opts: { min: 5 } },
    { name: 'multipleDescents',fn: multipleDescentPoints, opts: { min: 2 } },
    { name: 'noPrematureFruit',fn: noPrematureFruit,      opts: { maxByEnd: 3 } },
    { name: 'notSaturated',    fn: notSaturated,          opts: { max: 0.20 } },
  ],
};

module.exports = {
  modestSize, branchedDensity, descended, multipleDescentPoints,
  noPrematureFruit, notSaturated,
  colonyCells, boundingBox, grassCrossings, descentDepth, pickFocalColony,
  VISION_1_DAY1_ROOT,
};
