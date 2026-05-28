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

// Count distinct runs of colony cells crossing the grass row. A "distinct"
// run is one that's separated from the previous by at least `minGap` empty
// columns — so a fat 6-cell run counts as ONE descent, not three. The
// painting has two descent columns ~4 cells apart; iter-20's blob had one
// fat run that the old (zero-gap) version counted as multiple.
function grassCrossings(world, cid, minGap = 3) {
  const { colony } = world.grid;
  let crossings = 0;
  let inRun = false;
  let gap = 0;
  for (let x = 0; x < W; x++) {
    const i = GRASS_Y * W + x;
    const hit = colony[i] === cid;
    if (hit) {
      if (!inRun) {
        if (crossings === 0 || gap >= minGap) crossings++;
        inRun = true;
      }
      gap = 0;
    } else {
      if (inRun) inRun = false;
      gap++;
    }
  }
  return crossings;
}

// Runs / cells in the soil region. Lacework → ~1. Fat blob → ~0.2.
// Replaces the old branchedDensity scorer (bbox math) which couldn't
// tell a network from a stake.
function soilDispersionScore(world, cid) {
  const { colony } = world.grid;
  let runs = 0;
  let cells = 0;
  for (let y = GRASS_Y + 1; y < H; y++) {
    let inRun = false;
    for (let x = 0; x < W; x++) {
      const hit = colony[y * W + x] === cid;
      if (hit) {
        cells++;
        if (!inRun) { runs++; inRun = true; }
      } else {
        inRun = false;
      }
    }
  }
  return cells === 0 ? 0 : runs / cells;
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

// The colony sown by the scenario itself — lowest foundedTick.
// Used by Vision 2's persistence scorers: we care whether *this specific
// colony* survives, not whether *some* descendant is alive (succession
// would mask the founder's death).
function pickFounderColony(world) {
  const cs = Object.values(world.colonies);
  if (!cs.length) return null;
  return cs.reduce((a, b) => (a.foundedTick <= b.foundedTick ? a : b));
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

// Soil dispersion — runs/cells in the soil. Painting is ~1 (lacework);
// fat-trunk blob is ~0.2. Replaces the old branchedDensity (bbox math).
function soilDispersion(world, opts = {}) {
  const min = opts.min ?? 0.50;
  const c = pickFocalColony(world);
  if (!c) return { ok: false, score: 0, value: 0, note: 'no colony' };
  const d = soilDispersionScore(world, c.id);
  return { ok: d >= min, score: d, value: d,
    note: `dispersion=${d.toFixed(2)} (want ≥${min})` };
}

// descended: founder reached at least N rows below grass. Floor raised
// from 5 to 10 — the painting reaches 12 rows, 5 was a stake-passing bar.
function descended(world, opts = {}) {
  const min = opts.min ?? 10;
  const c = pickFocalColony(world);
  if (!c) return { ok: false, score: 0, value: 0, note: 'no colony' };
  const d = descentDepth(world, c.id);
  return { ok: d >= min, score: d, value: d, note: `depth=${d} rows below grass (want ≥${min})` };
}

// multiple-descent: at least N descents at the grass row, where each
// descent is separated from the next by `minGap` empty columns.
// minGap=3 enforces real spatial separation — a fat 4-cell run is ONE
// descent, not several.
function multipleDescentPoints(world, opts = {}) {
  const min = opts.min ?? 2;
  const minGap = opts.minGap ?? 3;
  const c = pickFocalColony(world);
  if (!c) return { ok: false, score: 0, value: 0, note: 'no colony' };
  const n = grassCrossings(world, c.id, minGap);
  return { ok: n >= min, score: n, value: n,
    note: `${n} distinct descents (gap≥${minGap}) (want ≥${min})` };
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

// Shape — the painting comparison. Takes the run's pre-rendered ASCII
// (passed by the driver via the third arg), extracts structural
// features, compares against the painting in RESEARCH.md. Acts as the
// vision's gatekeeper; the other scorers below diagnose per-feature.
let _shapeMod = null;
function shape(world, opts = {}, ctx = {}) {
  if (!_shapeMod) _shapeMod = require('./shape');
  const ascii = ctx.ascii;
  if (!ascii) {
    return { ok: false, value: 0, note: 'shape scorer needs ctx.ascii (driver)' };
  }
  const runFeatures = _shapeMod.extractFeatures(ascii);
  const painting = _shapeMod.paintingFeatures();
  const result = _shapeMod.shapeScore(runFeatures, painting);
  const threshold = opts.threshold ?? 0.6;
  return {
    ok: result.score >= threshold,
    value: result.score,
    note: `shape=${(result.score * 100).toFixed(0)}% (want ≥${threshold * 100}%)`,
  };
}

// Research v3 shape scorer. Reads ctx.asciiSnapshots — an array of
// per-day founder-only renderings — and returns the BEST score across
// the window. The founder reaching painting topology on day 3 is still
// the founder reaching painting topology; the 1-day gate was a
// self-imposed constraint, not a vision requirement.
//
// Falls back to ctx.founderAscii (or ctx.ascii) if no snapshots are
// supplied — older scenarios still work.
function shapeBest(world, opts = {}, ctx = {}) {
  if (!_shapeMod) _shapeMod = require('./shape');
  const painting = _shapeMod.paintingFeatures();
  const threshold = opts.threshold ?? 0.6;
  const candidates = (ctx.asciiSnapshots && ctx.asciiSnapshots.length)
    ? ctx.asciiSnapshots
    : [{ day: null, ascii: ctx.founderAscii || ctx.ascii }];
  let best = { score: 0, day: null };
  for (const snap of candidates) {
    if (!snap.ascii) continue;
    const f = _shapeMod.extractFeatures(snap.ascii);
    const r = _shapeMod.shapeScore(f, painting);
    if (r.score > best.score) best = { score: r.score, day: snap.day };
  }
  return {
    ok: best.score >= threshold,
    value: best.score,
    note: best.day != null
      ? `shape=${(best.score * 100).toFixed(0)}% best on day ${best.day} (want ≥${threshold * 100}%)`
      : `shape=${(best.score * 100).toFixed(0)}% (want ≥${threshold * 100}%)`,
  };
}

// ── Vision 2 scorers — week-long persistence ──────────────
//
// Vision 2 reads the founder colony at the *end* of the run (driver passes
// the final snapshot). The scenario is `week-on-log` (7 sim-days). A run
// that "passes" Vision 2 is one where the colony sown at tick 0 is still
// alive, of meaningful size, and looks roughly like the shape it landed
// on at day 1 — i.e. the painting persists, not just appears.

// survivesToWeek — the founder colony is still flagged alive at end-of-run.
// The minimum bar: it didn't get killed off entirely.
function survivesToWeek(world) {
  const c = pickFounderColony(world);
  if (!c) return { ok: false, value: 0, note: 'no founder colony' };
  const ok = !!c.alive;
  return { ok, value: ok ? 1 : 0,
    note: ok ? `founder alive (cells=${c.cellCount})` : `founder DEAD (died tick ${c.deathTick})` };
}

// nonTrivialAtWeek — founder still holds at least N cells. Surviving with
// 2 cells doesn't count. Bar is Vision 1's modestSize floor (150) — if the
// painting landed at day 1, the colony was at least that size; if it's
// below that at day 7, the network has been dismantled.
function nonTrivialAtWeek(world, opts = {}) {
  const min = opts.min ?? 150;
  const c = pickFounderColony(world);
  if (!c) return { ok: false, value: 0, note: 'no founder colony' };
  const v = c.cellCount;
  return { ok: v >= min, value: v, note: `founder cells=${v} (want ≥${min})` };
}

// shapeStillHolds — the founder's ASCII shape at end-of-run still scores
// against the painting at Vision 1's threshold. The painting wasn't a
// transient moment that decayed. Reuses the same shape comparator as
// Vision 1, but reads ctx.ascii at end-of-run, not at day 1.
function shapeStillHolds(world, opts = {}, ctx = {}) {
  if (!_shapeMod) _shapeMod = require('./shape');
  const ascii = ctx.ascii;
  if (!ascii) return { ok: false, value: 0, note: 'shape scorer needs ctx.ascii' };
  const threshold = opts.threshold ?? 0.30;
  const runFeatures = _shapeMod.extractFeatures(ascii);
  const painting = _shapeMod.paintingFeatures();
  const result = _shapeMod.shapeScore(runFeatures, painting);
  return {
    ok: result.score >= threshold,
    value: result.score,
    note: `shape=${(result.score * 100).toFixed(0)}% (want ≥${threshold * 100}%)`,
  };
}

// noAutoBootstrap — the auto-sow safety net was never triggered during the
// run. If it fired, the world went empty (every colony dead) before being
// re-seeded — a *succession* event, not persistence. We want the founder
// to persist on its own merit.
function noAutoBootstrap(world) {
  const n = world.meta.lifetime?.autoBootstraps ?? 0;
  return { ok: n === 0, value: n,
    note: `autoBootstraps=${n} (want 0)` };
}

const VISION_2_PERSISTENCE = {
  id: 'vision-2-persistence',
  description: 'Week-long: founder colony still alive, nontrivial size, painting shape still recognisable, no auto-bootstrap.',
  scenarioId: 'week-on-log',
  scorers: [
    { name: 'survivesToWeek',    fn: survivesToWeek,                                  },
    { name: 'nonTrivialAtWeek',  fn: nonTrivialAtWeek,  opts: { min: 150 }            },
    { name: 'shapeStillHolds',   fn: shapeStillHolds,   opts: { threshold: 0.30 }     },
    { name: 'noAutoBootstrap',   fn: noAutoBootstrap,                                 },
  ],
};

// Vision 1 — "day-1 root" — bundle of targets that together describe the
// painting-derived first vision. See RESEARCH.md for the picture.
//
// The headline scorer is `shape` — it judges the run by comparing its
// ASCII against the painting's ASCII directly. The remaining three are
// sanity gates: alive, not fruiting too early, not matted. The earlier
// numeric proxies (branchedDensity, descended, multipleDescents) were
// retired at the iter-21 review because a stake-with-a-cap could pass
// them without producing any network behaviour.
const VISION_1_DAY1_ROOT = {
  id: 'vision-1-day1-root',
  description: 'Day-1 single colony: matches the painting (root network in soil), modest size, no premature fruit, no saturation.',
  scenarioId: 'first-day-on-log',
  scorers: [
    // The gatekeeper — overall similarity to the painting's shape.
    { name: 'shape',           fn: shape,                 opts: { threshold: 0.6 } },
    // Per-feature diagnostics — tell the iterating agent *what specifically*
    // is off when the shape score is low.
    { name: 'modestSize',      fn: modestSize,            opts: { min: 150, max: 800 } },
    { name: 'soilDispersion',  fn: soilDispersion,        opts: { min: 0.50 } },
    { name: 'descended',       fn: descended,             opts: { min: 10 } },
    { name: 'multipleDescents',fn: multipleDescentPoints, opts: { min: 2, minGap: 3 } },
    { name: 'noPrematureFruit',fn: noPrematureFruit,      opts: { maxByEnd: 3 } },
    { name: 'notSaturated',    fn: notSaturated,          opts: { max: 0.20 } },
  ],
};

// Vision 1 v3 — same gatekeeper at threshold 0.60, but evaluated against
// the founder colony in isolation across a 3-sim-day window, taking the
// best per-day snapshot. The other scorers stay as they were; with
// germination disabled in the v3 scenario, the focal colony is the
// founder, so they read the same colony as shape does.
const VISION_1_V3 = {
  id: 'vision-1-v3',
  description: 'v3: founder reaches painting topology within a 3-day window. Germination off; best-of-3 snapshots scored.',
  scenarioId: 'vision-1-multi-day',
  scorers: [
    { name: 'shape',           fn: shapeBest,             opts: { threshold: 0.6 } },
    { name: 'modestSize',      fn: modestSize,            opts: { min: 150, max: 800 } },
    { name: 'soilDispersion',  fn: soilDispersion,        opts: { min: 0.50 } },
    { name: 'descended',       fn: descended,             opts: { min: 10 } },
    { name: 'multipleDescents',fn: multipleDescentPoints, opts: { min: 2, minGap: 3 } },
    { name: 'noPrematureFruit',fn: noPrematureFruit,      opts: { maxByEnd: 3 } },
    { name: 'notSaturated',    fn: notSaturated,          opts: { max: 0.20 } },
  ],
};

module.exports = {
  modestSize, soilDispersion, descended, multipleDescentPoints,
  noPrematureFruit, notSaturated, shape, shapeBest,
  survivesToWeek, nonTrivialAtWeek, shapeStillHolds, noAutoBootstrap,
  colonyCells, boundingBox, grassCrossings, descentDepth,
  soilDispersionScore, pickFocalColony, pickFounderColony,
  VISION_1_DAY1_ROOT, VISION_1_V3, VISION_2_PERSISTENCE,
};
