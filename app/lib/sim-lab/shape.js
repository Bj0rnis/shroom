// Shape comparison — the painting is the source of truth.
//
// We extract structural features (lateral spread on log, distinct descent
// columns, max depth below grass, soil branching, soil/log balance) from
// the painting ASCII once, then from each run's ASCII at score time.
// The shape score is a 0-1 number — how close the run's features are to
// the painting's.
//
// This file deliberately stays small. The judgement of "looks like the
// painting" lives here, not scattered across six per-feature scorers.

const fs = require('fs');
const path = require('path');

// Grid chars we care about. The lab snapshot renderer uses `1` for live
// hypha cells, `=` for log cells, `~` for the grass row, `.` for soil,
// `:` for soil with dead-hypha scar (not a live cell). The painting uses
// the same alphabet.
const HYPHA = '1';
const GRASS = '~';

function gridLines(ascii) {
  return ascii.split('\n');
}

// Find the row index of the grass band ('~~~...'). Returns -1 if absent
// (e.g. the painting block missing its grass row).
function findGrassRow(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(GRASS)) return i;
  }
  return -1;
}

// Build a column-major bitmap of hypha cells. Returns { width, rows, cells }
// where cells[r][c] is true if that grid cell is a live hypha.
function bitmap(lines) {
  const rows = lines.length;
  const width = Math.max(...lines.map(l => l.length), 0);
  const cells = lines.map(l => {
    const row = new Array(width).fill(false);
    for (let c = 0; c < l.length; c++) if (l[c] === HYPHA) row[c] = true;
    return row;
  });
  return { width, rows, cells };
}

// Lateral spread on or just above the log — width of the live-cell band
// at the top of the colony. Measured at the row above grass.
function lateralSpread(b, grassRow) {
  const row = b.cells[grassRow - 1] || [];
  let lo = -1, hi = -1;
  for (let c = 0; c < row.length; c++) {
    if (!row[c]) continue;
    if (lo < 0) lo = c;
    hi = c;
  }
  return lo < 0 ? 0 : hi - lo + 1;
}

// Distinct descent columns — count of separated runs of hypha cells in
// the row immediately *below* grass. Runs separated by at least
// `minGap` empty columns count as different descents.
function descentColumns(b, grassRow, minGap = 3) {
  const row = b.cells[grassRow + 1] || [];
  let count = 0;
  let inRun = false;
  let gapSize = 0;
  for (let c = 0; c < row.length; c++) {
    if (row[c]) {
      if (!inRun) {
        // First-ever run OR a new run after a wide-enough gap
        if (count === 0 || gapSize >= minGap) count++;
        inRun = true;
      }
      gapSize = 0;
    } else {
      if (inRun) inRun = false;
      gapSize++;
    }
  }
  return count;
}

// Max depth below grass — deepest row containing a live hypha cell,
// expressed as rows below the grass row. 0 means nothing descended.
function maxDepth(b, grassRow) {
  let depth = 0;
  for (let r = grassRow + 1; r < b.rows; r++) {
    if ((b.cells[r] || []).some(Boolean)) depth = r - grassRow;
  }
  return depth;
}

// Soil dispersion — ratio of distinct cell-runs in the soil to total
// soil cells. A network/lacework hits ~1 (every cell isolated within
// its row). A fat-column blob hits ~0.2 (one fat run per row). This is
// the headline "is it a network" feature — replaces the earlier
// "branching by neighbour count" which had the wrong direction on blobs.
function soilDispersion(b, grassRow) {
  let runs = 0;
  let cells = 0;
  for (let r = grassRow + 1; r < b.rows; r++) {
    const row = b.cells[r];
    if (!row) continue;
    let inRun = false;
    for (let c = 0; c < row.length; c++) {
      if (row[c]) {
        cells++;
        if (!inRun) { runs++; inRun = true; }
      } else {
        inRun = false;
      }
    }
  }
  if (cells === 0) return 0;
  return runs / cells;
}

// Soil / log balance — cells below grass divided by cells on or above
// grass. Painting is mostly-soil; a cap-on-log is mostly-log.
function soilLogRatio(b, grassRow) {
  let above = 0, below = 0;
  for (let r = 0; r < b.rows; r++) {
    const row = b.cells[r] || [];
    for (const c of row) {
      if (!c) continue;
      if (r <= grassRow) above++; else below++;
    }
  }
  if (above === 0 && below === 0) return 0;
  return below / Math.max(1, above + below);
}

function extractFeatures(ascii) {
  const lines = gridLines(ascii);
  const grassRow = findGrassRow(lines);
  if (grassRow < 0) {
    return { ok: false, error: 'no grass row found' };
  }
  const b = bitmap(lines);
  return {
    ok: true,
    grassRow,
    lateralSpread: lateralSpread(b, grassRow),
    descentColumns: descentColumns(b, grassRow),
    maxDepth: maxDepth(b, grassRow),
    soilDispersion: soilDispersion(b, grassRow),
    soilLogRatio: soilLogRatio(b, grassRow),
  };
}

// Per-feature similarity: 1 when run matches target, 0 when run is at
// least `target * tolerance` away (absolute). Saturates at 0 — there's
// no negative score. Caps at 1 — exceeding the target isn't a bonus.
function featureScore(runVal, targetVal, tolerance = 1.0) {
  if (targetVal === 0) {
    // Painting has none of this feature — run is rewarded for also
    // having none, drops linearly as it accumulates the feature.
    const cap = Math.max(1, tolerance);
    return Math.max(0, 1 - runVal / cap);
  }
  const dist = Math.abs(runVal - targetVal) / (targetVal * tolerance);
  return Math.max(0, 1 - dist);
}

// Composite shape score 0-1. Weights reflect what the painting is
// really about: a branched network in soil. soilBranching carries the
// most weight; descentColumns and maxDepth tell the structural story;
// lateral spread and soil/log balance are softer sanity checks.
const FEATURE_WEIGHTS = {
  lateralSpread:  0.10,
  descentColumns: 0.20,
  maxDepth:       0.20,
  soilDispersion: 0.35,
  soilLogRatio:   0.15,
};

const FEATURE_TOLERANCE = {
  lateralSpread:  1.0,
  descentColumns: 0.5,
  maxDepth:       0.6,
  soilDispersion: 0.6,
  soilLogRatio:   1.0,
};

function shapeScore(runFeatures, paintingFeatures) {
  if (!runFeatures.ok || !paintingFeatures.ok) {
    return { score: 0, perFeature: {}, note: 'feature extraction failed' };
  }
  const perFeature = {};
  let total = 0;
  for (const key of Object.keys(FEATURE_WEIGHTS)) {
    const s = featureScore(runFeatures[key], paintingFeatures[key],
                            FEATURE_TOLERANCE[key]);
    perFeature[key] = { run: runFeatures[key], target: paintingFeatures[key], score: s };
    total += s * FEATURE_WEIGHTS[key];
  }
  return { score: total, perFeature };
}

// Load the painting ASCII from RESEARCH.md. The painting lives in the
// first ```...``` block under the "## My ASCII reading of the target"
// heading. If the format ever drifts, return null — callers handle that.
let _cachedPainting = null;
function loadPaintingAscii(researchMd) {
  if (_cachedPainting && !researchMd) return _cachedPainting;
  const md = researchMd != null
    ? researchMd
    : fs.readFileSync(path.join(__dirname, 'RESEARCH.md'), 'utf8');
  const headingIdx = md.indexOf('### My ASCII reading of the target');
  if (headingIdx < 0) return null;
  const after = md.slice(headingIdx);
  const m = after.match(/```\n?([\s\S]*?)```/);
  if (!m) return null;
  if (!researchMd) _cachedPainting = m[1];
  return m[1];
}

let _cachedPaintingFeatures = null;
function paintingFeatures() {
  if (_cachedPaintingFeatures) return _cachedPaintingFeatures;
  const ascii = loadPaintingAscii();
  if (!ascii) return { ok: false, error: 'painting not found in RESEARCH.md' };
  _cachedPaintingFeatures = extractFeatures(ascii);
  return _cachedPaintingFeatures;
}

module.exports = {
  extractFeatures,
  featureScore,
  shapeScore,
  loadPaintingAscii,
  paintingFeatures,
  FEATURE_WEIGHTS,
  FEATURE_TOLERANCE,
};
