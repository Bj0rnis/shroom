// Shroom — Lab harness.
//
// Runs scenarios in a sandbox world (separate from the live world running in
// server.js), persists each run as sim-N.json, and produces an AI-friendly
// markdown artifact the user can paste into chat. Pure node, no DOM, no
// dependence on server.js or persistence.js (other than reusing DATA_DIR).
//
// Each run produces:
//   - the full grid snapshot (canvas-renderable)
//   - structured metrics + per-colony summaries
//   - a sparse time-series sampled ~10× per sim-day
//   - an event timeline (deaths, first-fruits, toofans, sim-side logEvent)
//   - an 80×45 ASCII view of the final grid (for the markdown / chat artifact)

const fs   = require('fs');
const path = require('path');

const { createWorld, sowAt, W, H, GRASS_Y, AIR, SOIL, GRASS, LOG, FRUIT, TREE } = require('./world');
const { randomGenome, pinnedGenome, phenotypeWords } = require('./genome');
const { tick, setHooks, CONSTANTS, TICKS_PER_SIM_DAY } = require('./sim');
const { buildGridSnapshot } = require('./grid-snapshot');
const { DATA_DIR } = require('./persistence');

const LAB_DIR  = path.join(DATA_DIR, 'lab');
const RUNS_DIR = path.join(LAB_DIR, 'runs');
const SEQ_PATH = path.join(LAB_DIR, 'seq.json');

const HISTORY_LIMIT = 20;   // keep only the 20 newest sim-N.json files

// In-flight run state for the progress endpoint. Only one run at a time.
let currentJob = null;

function getCurrentJob() {
  return currentJob;
}

// ── Scenarios ───────────────────────────────────────────
// Each scenario is data: id, label, duration, and a setup(world) hook that
// places the initial colonies/spores after createWorld has run. Add new
// entries here; the harness, log format, and page picker pick them up.

const SCENARIOS = [
  {
    id: 'first-day-on-log',
    name: 'First day on log',
    description: 'One colony, log center — 1 sim-day. Does it grow into roots?',
    durationDays: 1,
    setup(world) { sowOnLog(world, 1); },
  },
  {
    id: 'week-on-log',
    name: 'Week on log',
    description: 'One colony, log center — 7 sim-days. Mature shape, first fruits.',
    durationDays: 7,
    setup(world) { sowOnLog(world, 1); },
  },
  {
    id: 'soil-germination',
    name: 'Soil germination',
    description: 'Three spores in a fertile soil pocket — 5 sim-days.',
    durationDays: 5,
    setup(world) {
      const target = findRichSoil(world);
      if (!target) return;
      const rng = world.rng;
      for (let k = 0; k < 3; k++) {
        world.spores.push({
          x: target.x + (rng() * 4 - 2),
          y: target.y + (rng() * 4 - 2),
          vx: 0, vy: 0, age: 0,
          genome: randomGenome(rng),
        });
      }
    },
  },
  {
    id: 'spore-rain',
    name: 'Spore rain',
    description: '50 spores released over the canvas at tick 1 — 3 sim-days.',
    durationDays: 3,
    setup(world) {
      const rng = world.rng;
      for (let s = 0; s < 50; s++) {
        world.spores.push({
          x: rng() * W,
          y: 10 + rng() * 30,
          vx: (rng() * 2 - 1) * 1.5,
          vy: rng() * 0.5 - 0.3,
          age: 0,
          genome: randomGenome(rng),
        });
      }
    },
  },
  {
    id: 'eaten-log',
    name: 'Eaten log',
    description: 'Four colonies on the log — 14 sim-days. Log shrinks visibly.',
    durationDays: 14,
    setup(world) { sowOnLog(world, 4); },
  },
];

function sowOnLog(world, count) {
  const lb = world.meta.logBounds;
  if (!lb) return;
  const sownCount = Math.max(1, count);
  for (let k = 0; k < sownCount; k++) {
    // Sim-lab iter-17: substrate-aware sow. The painting target represents a
    // successful founder, not a lottery-loser one — find the richest log cell
    // in this spore's "neighbourhood" instead of dropping it on the geometric
    // centre. Splits the log into `sownCount` columns so multi-sow scenarios
    // still spread spores across the log; within a column, pick the richest
    // cell. Deterministic — uses no rng calls, so the seed sweep stays clean.
    const colW = Math.floor(lb.w / sownCount);
    const colX0 = lb.x0 + k * colW;
    const colX1 = lb.x0 + (k + 1) * colW;
    let bestI = -1, bestN = -1;
    const { kind, nutrient } = world.grid;
    for (let yy = lb.y0; yy < lb.y0 + lb.h; yy++) {
      for (let xx = colX0; xx < colX1; xx++) {
        const i = yy * W + xx;
        if (kind[i] !== LOG) continue;
        if (world.grid.colony[i] !== 0) continue;
        if (nutrient[i] > bestN) { bestN = nutrient[i]; bestI = i; }
      }
    }
    if (bestI >= 0) {
      const x = bestI % W;
      const y = Math.floor(bestI / W);
      // Sim-lab iter-18: pinned genome for vision tests. The lottery roll
      // on growth_rate (0.5-2.0) was the dominant cause of seed-to-seed
      // variance. Pinning to the midpoint lets us iterate on the mechanic
      // without "doomed by birth" seeds. Live world still uses random.
      sowAt(world, x, y, pinnedGenome());
    }
  }
}

function findRichSoil(world) {
  const { kind, nutrient } = world.grid;
  for (let attempt = 0; attempt < 400; attempt++) {
    const i = Math.floor(world.rng() * kind.length);
    if (kind[i] === SOIL && nutrient[i] > 50) {
      return { x: i % W, y: Math.floor(i / W) };
    }
  }
  return null;
}

// ── Persistence ─────────────────────────────────────────

function ensureLabDirs() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

function nextSimId() {
  ensureLabDirs();
  let next = 1;
  if (fs.existsSync(SEQ_PATH)) {
    try { next = JSON.parse(fs.readFileSync(SEQ_PATH, 'utf8')).next || 1; } catch {}
  }
  const tmp = SEQ_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ next: next + 1 }));
  fs.renameSync(tmp, SEQ_PATH);
  return `sim-${next}`;
}

function persistRun(run) {
  ensureLabDirs();
  const p   = path.join(RUNS_DIR, `${run.id}.json`);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(run));
  fs.renameSync(tmp, p);
  trimHistory();
}

// Keep only the HISTORY_LIMIT newest sim-N.json files. Called after every
// successful run. We sort by sim number (id), not mtime, because that's the
// user-visible ordering.
function trimHistory() {
  if (!fs.existsSync(RUNS_DIR)) return;
  const files = fs.readdirSync(RUNS_DIR).filter(f => /^sim-\d+\.json$/.test(f));
  if (files.length <= HISTORY_LIMIT) return;
  files.sort((a, b) => simNum(b.replace(/\.json$/, '')) - simNum(a.replace(/\.json$/, '')));
  for (const stale of files.slice(HISTORY_LIMIT)) {
    try { fs.unlinkSync(path.join(RUNS_DIR, stale)); } catch {}
  }
}

function loadRun(id) {
  const p = path.join(RUNS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function listRuns() {
  if (!fs.existsSync(RUNS_DIR)) return [];
  const files = fs.readdirSync(RUNS_DIR).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8'));
      out.push({
        id:           r.id,
        scenarioId:   r.scenarioId,
        scenarioName: r.scenarioName,
        seed:         r.seed,
        startedAt:    r.startedAt,
        durationMs:   r.durationMs,
        durationDays: r.durationDays,
        metrics: {
          hyphaeCells:    r.metrics?.hyphaeCells || 0,
          coloniesAlive:  r.metrics?.coloniesAlive || 0,
          fruitsInAir:    r.metrics?.fruitsInAir || 0,
          births:         r.metrics?.births || 0,
          deathsTotal:    r.metrics?.deathsTotal || 0,
        },
      });
    } catch { /* skip corrupt */ }
  }
  out.sort((a, b) => simNum(b.id) - simNum(a.id));   // newest first
  return out;
}

function deleteRun(id) {
  const p = path.join(RUNS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

function simNum(id) {
  const m = /^sim-(\d+)$/.exec(id || '');
  return m ? parseInt(m[1], 10) : 0;
}

// ── Metric & summary helpers ────────────────────────────

function collectMetrics(world) {
  const colonies = Object.values(world.colonies);
  const alive    = colonies.filter(c => c.alive);
  const { kind, nutrient } = world.grid;
  let logCells = 0, logNutSum = 0;
  for (let i = 0; i < kind.length; i++) {
    if (kind[i] === LOG) { logCells++; logNutSum += nutrient[i]; }
  }
  const fruitsActive  = world.fruits.filter(f => !f.spent);
  const fruitsMature  = fruitsActive.filter(f => f.mature).length;
  const lifetime      = world.meta.lifetime || {};
  const deathsByCause = lifetime.deathsByCause || {};
  return {
    coloniesAlive:   alive.length,
    coloniesTotal:   colonies.length,
    hyphaeCells:     alive.reduce((s, c) => s + (c.cellCount || 0), 0),
    maxColonyCells:  alive.length ? Math.max(...alive.map(c => c.cellCount || 0)) : 0,
    fruitsInAir:     fruitsActive.length,
    fruitsMature,
    sporesInAir:     world.spores.length,
    logCells,
    avgLogNutrient:  logCells ? Math.round(logNutSum / logCells) : 0,
    simDay:          Math.floor(world.meta.tick / TICKS_PER_SIM_DAY),
    tick:            world.meta.tick,
    births:          lifetime.births || 0,
    deathsTotal:     Object.values(deathsByCause).reduce((s, n) => s + n, 0),
    deathsByCause,
  };
}

function summarizeColonies(world) {
  return Object.values(world.colonies).map(c => ({
    id:              c.id,
    foundedTick:     c.foundedTick,
    deathTick:       c.deathTick || null,
    deathCause:      c.deathCause || null,
    cellCount:       c.cellCount || 0,
    fruitCount:      c.fruitCount || 0,
    reserves:        Math.round(c.reserves || 0),
    alive:           !!c.alive,
    genome:          Array.from(c.genome),
    phenotypeWords:  phenotypeWords(c.genome),
    name:            c.name || null,
    placeholderName: c.placeholderName || null,
  }));
}

function captureSample(world) {
  const m = collectMetrics(world);
  return {
    tick:            world.meta.tick,
    simDay:          +(world.meta.tick / TICKS_PER_SIM_DAY).toFixed(2),
    coloniesAlive:   m.coloniesAlive,
    hyphaeCells:     m.hyphaeCells,
    fruitsInAir:     m.fruitsInAir,
    sporesInAir:     m.sporesInAir,
    logCells:        m.logCells,
    avgLogNutrient:  m.avgLogNutrient,
  };
}

// ── ASCII renderer ──────────────────────────────────────
// 4×4 block downsample of the 320×180 grid into 80×45 chars.
// Priority: colony > fruit > tree crown/trunk > log > grass > rich soil >
// soil > spore-in-air > air.

function renderAscii(world) {
  const { kind, nutrient, colony } = world.grid;
  const block = 4;
  const ascW  = Math.floor(W / block);
  const ascH  = Math.floor(H / block);

  // Pre-index fruits and spores by block coords for O(1) lookup.
  const fruitsByBlock = new Map();
  for (const f of world.fruits) {
    if (f.spent) continue;
    const bx = Math.floor(f.x / block), by = Math.floor(f.y / block);
    fruitsByBlock.set(by * ascW + bx, true);
  }
  const sporesByBlock = new Map();
  for (const s of world.spores) {
    const bx = Math.floor(s.x / block), by = Math.floor(s.y / block);
    if (bx < 0 || by < 0 || bx >= ascW || by >= ascH) continue;
    sporesByBlock.set(by * ascW + bx, true);
  }

  const rows = [];
  for (let by = 0; by < ascH; by++) {
    let row = '';
    for (let bx = 0; bx < ascW; bx++) {
      // Counts for this 4×4 block
      let logCount = 0, grassCount = 0, richSoilCount = 0, soilCount = 0;
      let treeCrownCount = 0, treeTrunkCount = 0;
      const colonyCounts = {};

      for (let dy = 0; dy < block; dy++) {
        for (let dx = 0; dx < block; dx++) {
          const x = bx * block + dx, y = by * block + dy;
          const i = y * W + x;
          if (colony[i] !== 0) {
            colonyCounts[colony[i]] = (colonyCounts[colony[i]] || 0) + 1;
            continue;
          }
          const k = kind[i];
          if      (k === LOG)   logCount++;
          else if (k === GRASS) grassCount++;
          else if (k === SOIL)  { if (nutrient[i] > 60) richSoilCount++; else soilCount++; }
          else if (k === TREE)  { if (y < GRASS_Y - 5) treeCrownCount++; else treeTrunkCount++; }
        }
      }

      // Pick char by priority.
      let topId = 0, topN = 0;
      for (const k of Object.keys(colonyCounts)) {
        const n = colonyCounts[k];
        if (n > topN) { topN = n; topId = parseInt(k, 10); }
      }
      if (topId > 0)                              row += String(((topId - 1) % 9) + 1);
      else if (fruitsByBlock.has(by * ascW + bx)) row += '*';
      else if (treeCrownCount > 0)                row += 'T';
      else if (treeTrunkCount > 0)                row += '|';
      else if (logCount > 0)                      row += '=';
      else if (grassCount > 0)                    row += '~';
      else if (richSoilCount > 0)                 row += ':';
      else if (soilCount > 0)                     row += '.';
      else if (sporesByBlock.has(by * ascW + bx)) row += '·';
      else                                         row += ' ';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

// ── Run a scenario ──────────────────────────────────────

async function runScenario(scenarioId, { seed, restoreHooks } = {}) {
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) throw new Error(`unknown scenario: ${scenarioId}`);

  const world = createWorld(seed);
  scenario.setup(world);

  const events = [];
  const samples = [];
  const seenWorldEvents = new Set();
  const tsInterval = Math.max(1, Math.floor(TICKS_PER_SIM_DAY / 10));

  // Hook for events. Filter by world identity so the lab doesn't capture
  // events from the live world (which keeps ticking during this run).
  setHooks({
    onColonyDeath: (w, c) => {
      if (w !== world) return;
      events.push({
        tick: w.meta.tick, kind: 'death',
        text: `colony ${c.id} died (${c.deathCause || 'unknown'})`,
        colonyId: c.id, cause: c.deathCause,
      });
    },
    onFirstFruit: (w, c) => {
      if (w !== world) return;
      events.push({
        tick: w.meta.tick, kind: 'first-fruit',
        text: `colony ${c.id} pushed its first fruit`,
        colonyId: c.id,
      });
    },
    onSeasonChange: (w) => {
      if (w !== world) return;
      events.push({ tick: w.meta.tick, kind: 'season', text: `season → ${w.meta.season}` });
    },
    onToofan: (w) => {
      if (w !== world) return;
      events.push({ tick: w.meta.tick, kind: 'toofan', text: `toofan: ${w.meta.weather || '?'}` });
    },
    onToofanWarning: () => {},
    onWorldEmpty:    () => {},
  });

  function ingestWorldEvents() {
    for (const ev of world.events) {
      const key = `${ev.tick}|${ev.kind}|${ev.text}`;
      if (seenWorldEvents.has(key)) continue;
      seenWorldEvents.add(key);
      events.push({ ...ev });
    }
  }

  const totalTicks = scenario.durationDays * TICKS_PER_SIM_DAY;
  const t0 = Date.now();
  samples.push(captureSample(world));

  currentJob = {
    scenarioId,
    scenarioName: scenario.name,
    startedAt:    new Date(t0).toISOString(),
    totalTicks,
    currentTick:  0,
    seed:         world.meta.seed,
  };

  try {
    for (let i = 0; i < totalTicks; i++) {
      tick(world);
      if (i % tsInterval === 0) {
        samples.push(captureSample(world));
        ingestWorldEvents();
      }
      // Update progress + yield event loop in the same window so polls land
      // on a consistent currentTick.
      if (i % 100 === 0) {
        currentJob.currentTick = i;
        await new Promise(r => setImmediate(r));
      }
    }
    if (currentJob) currentJob.currentTick = totalTicks;
  } finally {
    if (typeof restoreHooks === 'function') restoreHooks();
  }

  ingestWorldEvents();
  samples.push(captureSample(world));
  events.sort((a, b) => a.tick - b.tick);

  const run = {
    id:            nextSimId(),
    scenarioId,
    scenarioName:  scenario.name,
    seed:          world.meta.seed,
    startedAt:     new Date(t0).toISOString(),
    durationMs:    Date.now() - t0,
    durationDays:  scenario.durationDays,
    constants:     CONSTANTS,
    metrics:       collectMetrics(world),
    colonies:      summarizeColonies(world),
    events,
    samples,
    snapshot:      buildGridSnapshot(world),
    ascii:         renderAscii(world),
  };
  persistRun(run);
  currentJob = null;
  return run;
}

// ── Markdown rendering ──────────────────────────────────
// This is the AI artifact. Optimised for paste-into-chat readability:
// short headers, dense tables, ASCII grid in a fenced block, no fluff.

function renderRunMarkdown(run) {
  const lines = [];
  const sc = SCENARIOS.find(s => s.id === run.scenarioId);

  lines.push(`# ${run.id} — ${run.scenarioName}`);
  lines.push('');
  lines.push(`**scenario**: ${run.scenarioId} — ${sc?.description || ''}`);
  lines.push(`**seed**: ${run.seed}`);
  lines.push(`**started**: ${run.startedAt}`);
  lines.push(`**real duration**: ${fmtMs(run.durationMs)}`);
  lines.push(`**sim duration**: ${run.durationDays} day(s) · ${run.metrics.tick.toLocaleString()} ticks`);
  lines.push('');

  lines.push('## constants (snapshot at run time)');
  for (const k of Object.keys(run.constants).sort()) {
    const v = run.constants[k];
    if (v === null || v === undefined)         continue;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
      lines.push(`${k}: ${v}`);
    } else if (Array.isArray(v)) {
      if (v.length === 0 || typeof v[0] !== 'object') {
        lines.push(`${k}: [${v.join(', ')}]`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
      }
    } else if (typeof v === 'object') {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push('');

  const m = run.metrics;
  lines.push('## final state');
  lines.push(`- colonies alive: ${m.coloniesAlive} (total seen: ${m.coloniesTotal})`);
  lines.push(`- births: ${m.births}`);
  const causes = Object.entries(m.deathsByCause).filter(([_, n]) => n > 0)
    .map(([c, n]) => `${c}: ${n}`).join(', ') || 'none';
  lines.push(`- deaths: ${m.deathsTotal} (${causes})`);
  lines.push(`- hyphae cells: ${m.hyphaeCells}`);
  lines.push(`- max colony cells: ${m.maxColonyCells}`);
  lines.push(`- fruits in air: ${m.fruitsInAir} (${m.fruitsMature} mature)`);
  lines.push(`- spores in air: ${m.sporesInAir}`);
  lines.push(`- log cells: ${m.logCells}`);
  lines.push(`- avg log nutrient: ${m.avgLogNutrient}`);
  lines.push('');

  lines.push('## final shape (80×45 ascii downsample)');
  lines.push('```');
  lines.push(run.ascii);
  lines.push('```');
  lines.push('legend: `1`–`9`=colony (id mod 9) · `*`=fruit · `T`=tree crown · `|`=trunk · `=`=log · `~`=grass · `:`=rich soil (>60) · `.`=soil · `·`=spore in air · ` `=air');
  lines.push('');

  lines.push('## timeline (key events)');
  if (!run.events || run.events.length === 0) {
    lines.push('_no notable events captured_');
  } else {
    const keys = run.events.length <= 40 ? run.events : sampleEvenly(run.events, 40);
    for (const e of keys) {
      const day = (e.tick / TICKS_PER_SIM_DAY).toFixed(2);
      lines.push(`- day ${day} (tick ${e.tick}) — ${e.kind}: ${e.text}`);
    }
    if (run.events.length > 40) lines.push(`_(showing 40 of ${run.events.length} events, sampled evenly)_`);
  }
  lines.push('');

  lines.push('## colonies');
  lines.push('| id | cells | fruits | reserves | founded | died | status | cause | phenotype |');
  lines.push('|----|-------|--------|----------|---------|------|--------|-------|-----------|');
  for (const c of run.colonies) {
    const founded = (c.foundedTick / TICKS_PER_SIM_DAY).toFixed(2) + 'd';
    const died    = c.deathTick ? (c.deathTick / TICKS_PER_SIM_DAY).toFixed(2) + 'd' : '—';
    const status  = c.alive ? 'alive' : 'dead';
    const cause   = c.deathCause || '—';
    const pheno   = c.phenotypeWords || '—';
    const name    = c.name || c.placeholderName || '';
    const idLabel = name ? `${c.id} (${name})` : String(c.id);
    lines.push(`| ${idLabel} | ${c.cellCount} | ${c.fruitCount} | ${c.reserves} | ${founded} | ${died} | ${status} | ${cause} | ${pheno} |`);
  }
  lines.push('');

  lines.push('## time-series');
  lines.push('| tick | day | colonies | hyphae | fruits | spores | log cells | avg log nut |');
  lines.push('|------|-----|----------|--------|--------|--------|-----------|-------------|');
  for (const s of run.samples) {
    lines.push(`| ${s.tick} | ${s.simDay} | ${s.coloniesAlive} | ${s.hyphaeCells} | ${s.fruitsInAir} | ${s.sporesInAir} | ${s.logCells} | ${s.avgLogNutrient} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function fmtMs(ms) {
  if (ms < 1000)    return `${ms}ms`;
  if (ms < 60_000)  return `${(ms / 1000).toFixed(1)}s`;
  const mn = Math.floor(ms / 60_000);
  const sc = Math.floor((ms % 60_000) / 1000);
  return `${mn}m ${sc}s`;
}

function sampleEvenly(arr, n) {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

module.exports = {
  SCENARIOS,
  runScenario,
  getCurrentJob,
  listRuns, loadRun, deleteRun,
  renderRunMarkdown,
  renderAscii,
};
