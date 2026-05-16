require('dotenv').config();
const express     = require('express');
const compression = require('compression');
const path        = require('path');

const MOCK = process.env.MOCK === 'true';
const PORT = process.env.PORT || 3000;
const BASE_TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '3000', 10);
// Dev toggles — gated on SHROOM_DEV=true to keep prod surface narrow.
const DEV_MODE = process.env.SHROOM_DEV === 'true';
let nigehbanDisabled = process.env.NIGEHBAN_DISABLED === 'true';
let tickIntervalMs   = BASE_TICK_INTERVAL_MS;

const { createWorld, sowAt, logEvent, W, H, GRASS_Y } = require('./lib/world');
const { tick, triggerToofan, setHooks, spawnSapling, fellTree, TICKS_PER_SIM_DAY, CONSTANTS } = require('./lib/sim');
const { TICKS_PER_DAY, ticksToHuman } = require('./lib/time');
const { phenotypeWords, randomGenome, GENES } = require('./lib/genome');
const persistence = require('./lib/persistence');
const nigehban = require('./lib/nigehban');
const { buildGridSnapshot } = require('./lib/grid-snapshot');
const observability = require('./lib/observability');

// Sim hooks → Nigehban triggers + tool-cooldown resets
setHooks({
  onSeasonChange: (w) => { nigehban.resetSeasonTools(w); nigehban.onSeasonChange(w); },
  onToofan:       (w) => { persistence.rotateVolume(w.meta.volume); nigehban.resetVolumeTools(w); nigehban.resetSeasonTools(w); nigehban.onToofan(w); },
  onToofanWarning:(w) => { nigehban.onToofanWarning(w); },
  onFirstFruit:   (w, c) => { nigehban.onFirstFruit(w, c); },
  onColonyDeath:  (w, c) => { observability.recordDeath(w, c); nigehban.onColonyDeath(w, c); },
  onWorldEmpty:   (w)    => { nigehban.onWorldEmpty(w); },
});

// ── Boot world ─────────────────────────────────────────
let world = persistence.loadWorld();
if (world) {
  console.log(`shroom: loaded world.json — volume ${world.meta.volume}, tick ${world.meta.tick}`);
} else {
  world = createWorld();
  console.log(`shroom: fresh world (seed ${world.meta.seed})`);
  // First-volume seed: drop one starter spore so the world isn't a void.
  // (In step 5, Nigehban's "sow" tool will replace this.)
  bootstrapColony(world);
}

function bootstrapColony(w) {
  const lb = w.meta.logBounds;
  if (!lb) return;
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = lb.x0 + Math.floor(Math.random() * lb.w);
    const y = lb.y0 + Math.floor(Math.random() * lb.h);
    const id = sowAt(w, x, y, randomGenome());
    if (id) { logEvent(w, 'sow', `bootstrap colony ${id} sown at (${x},${y})`); return id; }
  }
  return null;
}

// ── Tick loop ──────────────────────────────────────────
let ticking = false;
let fastForwarding = false;
let tickHandle     = null;
let lastSaveTick    = world.meta.tick;
let lastMetricsTick = world.meta.tick;
const SAVE_EVERY_TICKS    = 200;
const METRICS_EVERY_TICKS = 100;

function startTickLoop(intervalMs) {
  if (tickHandle) clearInterval(tickHandle);
  tickIntervalMs = intervalMs;
  tickHandle = setInterval(async () => {
    if (ticking || fastForwarding) return;
    ticking = true;
    try {
      tick(world);
      if (!nigehbanDisabled) nigehban.tryWake(world);  // sim never waits for the LLM
      if (world.meta.tick - lastMetricsTick >= METRICS_EVERY_TICKS) {
        observability.recordMetrics(world);
        observability.recordColonies(world);
        lastMetricsTick = world.meta.tick;
      }
      if (world.meta.tick - lastSaveTick >= SAVE_EVERY_TICKS) {
        persistence.saveWorld(world);
        lastSaveTick = world.meta.tick;
      }
    } catch (err) {
      console.error('tick error:', err);
    } finally {
      ticking = false;
    }
  }, intervalMs);
}
startTickLoop(BASE_TICK_INTERVAL_MS);

// Save once on graceful shutdown
function shutdown() {
  try { persistence.saveWorld(world); console.log('shroom: saved world.json on shutdown'); } catch {}
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// ── HTTP ───────────────────────────────────────────────
const app = express();
// /api/world/snapshot is the heaviest endpoint (~200 KB raw); gzip drops it
// to ~30 KB. Important over Tailscale.
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: MOCK ? 'mock' : 'live', service: 'shroom' });
});

app.get('/engine', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'engine.html'));
});

app.get('/preview', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'preview.html'));
});

app.get('/api/engine-spec', (req, res) => {
  res.json({
    constants: CONSTANTS,
    genome:    GENES,
    world:     { W, H, GRASS_Y },
  });
});

app.get('/api/journal', (req, res) => {
  res.json({
    entries: persistence.loadJournal(),
    last:    nigehban.state.lastEntry,
    nigehban: {
      callCount:          nigehban.state.callCount,
      lastInvocationTick: nigehban.state.lastInvocationTick,
      lastError:          nigehban.state.lastError,
      model:              nigehban.MODEL,
      usage:              nigehban.usage(),
    },
  });
});

app.get('/api/hall', (req, res) => {
  res.json({ entries: persistence.loadHall() });
});

app.post('/api/debug/nigehban-wake', async (req, res) => {
  nigehban.notify('manual-wake');
  await nigehban.tryWake(world);
  res.json({
    ok: true,
    lastEntry: nigehban.state.lastEntry,
    error:     nigehban.state.lastError,
  });
});

app.get('/api/world', (req, res) => {
  const colonies = Object.values(world.colonies);
  const alive = colonies.filter(c => c.alive);
  res.json({
    meta: world.meta,
    counts: {
      coloniesAlive: alive.length,
      coloniesTotal: colonies.length,
      hyphaeCells:   alive.reduce((s, c) => s + c.cellCount, 0),
      spores:        world.spores.length,
      fruits:        world.fruits.filter(f => !f.spent).length,
    },
    topColonies: alive
      .sort((a, b) => b.cellCount - a.cellCount)
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        cellCount: c.cellCount,
        fruitCount: c.fruitCount,
        ageDays: Math.floor((world.meta.tick - c.foundedTick) / TICKS_PER_SIM_DAY),
        phenotype: phenotypeWords(c.genome),
      })),
    recentEvents: world.events.slice(-12),
  });
});

app.get('/api/world/snapshot', (req, res) => {
  res.json(buildGridSnapshot(world));
});

// ── Prometheus /metrics ────────────────────────────────
// Live world-state snapshot in Prometheus text format. Scraped by the
// monitoring stack (see stacks/monitoring/prometheus/prometheus.yml).
// Gauges describe present state; counters from world.meta.lifetime
// describe cumulative events since world creation (persisted in world.json).
app.get('/metrics', (req, res) => {
  const colonies = Object.values(world.colonies);
  const alive    = colonies.filter(c => c.alive);
  const lifetime = world.meta.lifetime || {};
  const deathsBy  = lifetime.deathsByCause || {};
  const toofansBy = lifetime.toofansByFlavor || {};

  // Single pass over the grid for LOG stats.
  const kindArr = world.grid.kind;
  const nutrient = world.grid.nutrient;
  let logCells = 0, logNutSum = 0;
  for (let i = 0; i < kindArr.length; i++) {
    if (kindArr[i] === 3) { logCells++; logNutSum += nutrient[i]; }
  }
  const logAvgNut = logCells ? logNutSum / logCells : 0;

  let fruitsActive = 0, fruitsMature = 0;
  for (const f of world.fruits) {
    if (f.spent) continue;
    fruitsActive++;
    if (f.mature) fruitsMature++;
  }

  const lines = [];
  function emitHelp(name, help, type) {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
  }
  function gauge(name, help, value) {
    emitHelp(name, help, 'gauge');
    lines.push(`${name} ${value}`);
  }
  function gaugeLabeled(name, help, rows) {
    emitHelp(name, help, 'gauge');
    for (const [labels, value] of rows) lines.push(`${name}{${labels}} ${value}`);
  }
  function counter(name, help, value) {
    emitHelp(name, help, 'counter');
    lines.push(`${name} ${value}`);
  }
  function counterLabeled(name, help, rows) {
    emitHelp(name, help, 'counter');
    for (const [labels, value] of rows) lines.push(`${name}{${labels}} ${value}`);
  }

  gauge('shroom_colonies_alive',  'Currently alive colonies', alive.length);
  gauge('shroom_hyphae_cells',    'Live cells across all alive colonies', alive.reduce((s, c) => s + c.cellCount, 0));
  gauge('shroom_fruits_active',   'Non-spent fruits', fruitsActive);
  gauge('shroom_fruits_mature',   'Mature non-spent fruits', fruitsMature);
  gauge('shroom_spores_in_air',   'Active spores drifting', world.spores.length);
  gauge('shroom_sim_day',         'Sim days since world creation', Math.floor(world.meta.tick / TICKS_PER_DAY));
  gauge('shroom_volume',          'Current era (volume number)', world.meta.volume);
  gauge('shroom_toofan_pressure', 'Toofan pressure 0..1', world.meta.toofanPressure || 0);
  gauge('shroom_log_avg_nutrient','Average nutrient in LOG cells', logAvgNut);
  gauge('shroom_log_cells',       'Total LOG cells in world', logCells);

  const currentSeason = world.meta.season || 'spring';
  gaugeLabeled('shroom_season', '1 if season is active else 0',
    ['spring', 'summer', 'autumn', 'winter'].map(s => [`season="${s}"`, s === currentSeason ? 1 : 0])
  );

  counter('shroom_births_total', 'Total successful sows since world creation', lifetime.births || 0);
  counter('shroom_fruits_total', 'Total fruits ever spawned', lifetime.fruitsTotal || 0);
  counterLabeled('shroom_deaths_total', 'Total colony deaths by cause',
    Object.entries(deathsBy).map(([cause, value]) => [`cause="${cause}"`, value])
  );
  counterLabeled('shroom_toofans_total', 'Total toofan storms by flavor',
    Object.entries(toofansBy).map(([flavor, value]) => [`flavor="${flavor}"`, value])
  );

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

app.get('/api/world/grid', (req, res) => {
  // ASCII debug view — sub-sampled 2× for readability
  const rows = [];
  for (let y = 0; y < H; y += 2) {
    let row = '';
    for (let x = 0; x < W; x += 2) {
      const i = y * W + x;
      const k = world.grid.kind[i];
      const c = world.grid.colony[i];
      if (k === 4) row += '*';            // FRUIT
      else if (c !== 0) row += '#';       // hypha
      else if (k === 5) row += 'T';       // TREE
      else if (k === 3) row += '=';       // LOG
      else if (k === 2) row += '_';       // GRASS
      else if (k === 1) row += '.';       // SOIL
      else row += ' ';                    // AIR
    }
    rows.push(row);
  }
  res.type('text/plain').send(rows.join('\n'));
});

// ── Debug controls ─────────────────────────────────────

app.post('/api/debug/sow', (req, res) => {
  // No coords given: pick a random spot on the current log.
  let id = null;
  if (req.query.x && req.query.y) {
    const x = parseInt(req.query.x, 10);
    const y = parseInt(req.query.y, 10);
    id = sowAt(world, x, y, randomGenome());
    if (id) logEvent(world, 'sow', `manual sow → colony ${id} at (${x},${y})`);
  } else {
    id = bootstrapColony(world);
  }
  res.json({ ok: !!id, colonyId: id });
});

app.post('/api/debug/toofan', (req, res) => {
  const flavor = req.query.flavor;
  const before = Object.values(world.colonies).filter(c => c.alive).length;
  const f = triggerToofan(world, flavor);
  const after  = Object.values(world.colonies).filter(c => c.alive).length;
  res.json({ ok: true, flavor: f, era: world.meta.volume, survivors: after, died: before - after });
});

app.post('/api/debug/spawn-tree', (req, res) => {
  const before = (world.meta.trees || []).length;
  spawnSapling(world);
  const after = (world.meta.trees || []).length;
  const t = world.meta.trees[after - 1];
  if (t && req.query.grown) t.height = t.maxHeight;
  res.json({ ok: after > before, tree: t || null });
});

app.post('/api/debug/fell-tree', (req, res) => {
  const id = parseInt(req.query.id || '0', 10);
  const t = (world.meta.trees || []).find(x => x.id === id && x.alive)
         || (world.meta.trees || []).find(x => x.alive);
  if (!t) return res.json({ ok: false, error: 'no living tree' });
  t.alive = false;
  t.felledTick = world.meta.tick;
  fellTree(world, t);
  logEvent(world, 'tree-fall', `${t.species} felled manually for testing`);
  res.json({ ok: true, tree: t });
});

app.post('/api/debug/inscribe', (req, res) => {
  // Pick a top alive colony (preferring named) and inscribe it with placeholder
  // reason/epitaph. For visual testing of the hall strip without waiting on
  // Nigehban to naturally inscribe.
  const colonies = Object.values(world.colonies);
  const named   = colonies.filter(c => c.alive && c.name);
  const fallback = colonies.filter(c => c.alive).sort((a, b) => b.cellCount - a.cellCount);
  const target = (named[0] || fallback[0]);
  if (!target) return res.json({ ok: false, error: 'no living colonies' });
  const hall = persistence.loadHall();
  if (hall.find(h => h.volume === world.meta.volume && h.colonyId === target.id)) {
    return res.json({ ok: false, error: 'already inscribed in this volume' });
  }
  hall.push({
    name: target.name || target.placeholderName || `colony-${target.id}`,
    volume: world.meta.volume,
    colonyId: target.id,
    phenotype: phenotypeWords(target.genome),
    cap_hue:    target.genome[6],
    cap_shape:  Math.floor(target.genome[7]),
    cap_size:   target.genome[8],
    stem_length:target.genome[9],
    reason: 'first of its kind',
    epitaph: 'Carried the cap further than the others. The log remembers, briefly.',
  });
  persistence.saveHall(hall);
  logEvent(world, 'inscribe', `debug-inscribe: ${target.name || target.placeholderName || `colony-${target.id}`} (volume ${world.meta.volume})`);
  res.json({ ok: true, name: target.name, volume: world.meta.volume });
});

app.post('/api/debug/save', (req, res) => {
  persistence.saveWorld(world);
  res.json({ ok: true, tick: world.meta.tick });
});

app.post('/api/debug/reset', (req, res) => {
  world = createWorld();
  bootstrapColony(world);
  persistence.saveWorld(world);
  res.json({ ok: true, seed: world.meta.seed });
});

// ── Dev controls (SHROOM_DEV=true) ──────────────────────
// Tuning knobs for fast iteration. Off by default so prod stays predictable.

function devGuard(req, res) {
  if (!DEV_MODE) {
    res.status(403).json({ ok: false, error: 'set SHROOM_DEV=true to enable dev controls' });
    return false;
  }
  return true;
}

app.get('/api/dev/status', (req, res) => {
  if (!devGuard(req, res)) return;
  res.json({
    devMode: DEV_MODE,
    tickIntervalMs,
    nigehbanDisabled,
    tick: world.meta.tick,
    era: world.meta.volume,
    alive: Object.values(world.colonies).filter(c => c.alive).length,
    treesAlive: (world.meta.trees || []).filter(t => t.alive).length,
  });
});

app.post('/api/dev/speed', (req, res) => {
  if (!devGuard(req, res)) return;
  // ?multiplier=10 → 10× faster than canonical (300ms/tick at 3s base)
  // ?ms=100        → set tick interval directly
  let next;
  if (req.query.ms) {
    next = Math.max(10, parseInt(req.query.ms, 10) || BASE_TICK_INTERVAL_MS);
  } else {
    const mult = Math.max(0.1, Math.min(600, parseFloat(req.query.multiplier || '1')));
    next = Math.max(10, Math.round(BASE_TICK_INTERVAL_MS / mult));
  }
  startTickLoop(next);
  res.json({ ok: true, tickIntervalMs: next, multiplier: BASE_TICK_INTERVAL_MS / next });
});

app.post('/api/dev/ai', (req, res) => {
  if (!devGuard(req, res)) return;
  const arg = String(req.query.enabled ?? req.query.on ?? '').toLowerCase();
  if (arg === 'true' || arg === '1' || arg === 'on')      nigehbanDisabled = false;
  else if (arg === 'false' || arg === '0' || arg === 'off') nigehbanDisabled = true;
  res.json({ ok: true, nigehbanDisabled });
});

// Synchronous run of N sim-days. Pauses the live loop while it runs and
// emits a structured summary so we can tune balance without waiting weeks.
//
// Capped at 14 days because each tick does ~4 full grid sweeps, so a 30-day
// run takes ~10 minutes on the home server. The preview-window value is in
// the 1–7 day range; longer balance studies should run the live sim with a
// lower TICK_INTERVAL_MS for an afternoon and read off metrics.ndjson.
app.post('/api/dev/fast-forward', (req, res) => {
  if (!devGuard(req, res)) return;
  const days = Math.max(1, Math.min(14, parseInt(req.query.days || '3', 10)));
  if (fastForwarding) {
    return res.status(409).json({ ok: false, error: 'fast-forward already running' });
  }
  fastForwarding = true;
  const startTick = world.meta.tick;
  const startWall = Date.now();
  const startEra  = world.meta.volume;
  const startAlive = Object.values(world.colonies).filter(c => c.alive).length;
  const startTreesAlive = (world.meta.trees || []).filter(t => t.alive).length;
  const numTicks  = days * TICKS_PER_DAY;
  try {
    for (let i = 0; i < numTicks; i++) tick(world);
    persistence.saveWorld(world);
  } finally {
    fastForwarding = false;
  }
  const endTick = world.meta.tick;

  // Aggregate from world state after the run.
  const deathsByCause = {};
  const lifespans = [];
  for (const c of Object.values(world.colonies)) {
    if (c.deathTick && c.deathTick >= startTick && c.deathTick <= endTick) {
      const cause = c.deathCause || 'unknown';
      deathsByCause[cause] = (deathsByCause[cause] || 0) + 1;
      lifespans.push(c.deathTick - c.foundedTick);
    }
  }
  lifespans.sort((a, b) => a - b);
  const trees = world.meta.trees || [];
  const sprouted = trees.filter(t => t.foundedTick > startTick).length;
  const fell     = trees.filter(t => t.felledTick && t.felledTick > startTick).length;

  // Substrate snapshot
  const { kind: kindArr, nutrient } = world.grid;
  let logCells = 0, logNutSum = 0, soilCells = 0, soilNutSum = 0;
  for (let i = 0; i < kindArr.length; i++) {
    if (kindArr[i] === 3) { logCells++;  logNutSum  += nutrient[i]; }
    if (kindArr[i] === 1) { soilCells++; soilNutSum += nutrient[i]; }
  }

  res.json({
    ok: true,
    days,
    wallMs: Date.now() - startWall,
    ranTicks: endTick - startTick,
    from: { tick: startTick, era: startEra, alive: startAlive, treesAlive: startTreesAlive },
    to:   {
      tick: endTick,
      era: world.meta.volume,
      alive: Object.values(world.colonies).filter(c => c.alive).length,
      treesAlive: trees.filter(t => t.alive).length,
      avgLogNutrient:  logCells  ? Math.round(logNutSum  / logCells)  : 0,
      avgSoilNutrient: soilCells ? Math.round(soilNutSum / soilCells) : 0,
    },
    deaths: {
      total: lifespans.length,
      byCause: deathsByCause,
      lifespan: lifespans.length ? {
        min:    ticksToHuman(lifespans[0]),
        p50:    ticksToHuman(lifespans[Math.floor(lifespans.length * 0.5)]),
        p95:    ticksToHuman(lifespans[Math.floor(lifespans.length * 0.95)]),
        max:    ticksToHuman(lifespans[lifespans.length - 1]),
      } : null,
    },
    trees:   { sprouted, fell },
    toofans: world.meta.lastToofanTick > startTick ? [{
      tick: world.meta.lastToofanTick,
      flavor: world.meta.lastToofanFlavor,
    }] : [],
  });
});

app.listen(PORT, () => {
  console.log(`Shroom running on http://localhost:${PORT} [${MOCK ? 'MOCK' : 'LIVE'}]${DEV_MODE ? ' [DEV]' : ''} · tick every ${tickIntervalMs}ms`);
});
