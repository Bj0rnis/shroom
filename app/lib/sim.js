// home-server Shroom — simulation tick.
// Order each tick: clock → grow → fruit → spores → germinate → decay → toofan-roll.

const {
  W, H, GRASS_Y, AIR, SOIL, GRASS, LOG, FRUIT, TREE,
  sowAt, logEvent, neighborOffsets,
} = require('./world');
const { mutate, randomGenome, genomeToObj, phenotypeWords } = require('./genome');
const {
  TICKS_PER_HOUR, TICKS_PER_DAY, TICKS_PER_WEEK, TICKS_PER_MONTH, TICKS_PER_YEAR,
  TICKS_PER_SEASON, DAYS_PER_SEASON,
} = require('./time');

// Optional hook bag. server.js injects { onSeasonChange, onToofanWarning,
// onToofan, onFirstFruit, onColonyDeath } so sim.js stays decoupled.
const hooks = {};
function setHooks(h) { Object.assign(hooks, h); }
function fire(name, ...args) { try { hooks[name]?.(...args); } catch {} }

// ── Time anchors ─────────────────────────────────────────
// 1 sim day = 1 real day at TICK_INTERVAL_MS=3000. Kept as exports for the
// snapshot and observability layers that pre-date lib/time.js.
const TICKS_PER_SIM_DAY   = TICKS_PER_DAY;       // 28,800
const SIM_DAYS_PER_SEASON = DAYS_PER_SEASON;     // 91 real days

// ── Cell-level growth / absorption ──────────────────────
const NUTRIENT_CONSUMPTION   = 1;
const SIDE_ABSORPTION        = 1;
const SIDE_ABSORPTION_FLOOR  = 20;
const THICKNESS_BOX_RADIUS   = 2;
const THICKNESS_MAX          = 3;
const NUTRIENT_MAX           = 100;  // soft cap matching world.js generators

// ── Decay-feeds-substrate ───────────────────────────────
// Dead mycelium decomposes into the substrate beneath it. The cell that died
// gets a deposit at its location; substrate-neighbors bleed a smaller amount,
// producing a visible halo of richer ground around a dying colony.
const DECAY_DEPOSIT          = 15;
const DECAY_NEIGHBOR_DEPOSIT = 4;

// ── Cell aging + dieback ─────────────────────────────────
// Cells turn over within a real week; replacement keeps the colony alive.
const HYPHA_DEATH_THRESHOLD  = 5;
const HYPHA_AGE_LIMIT        = TICKS_PER_WEEK;   // 201,600

// Per-tick dieback risks — kept tiny so colony lifespans land in months.
// At full pressure each contributes ~1e-4 → cell half-life ~6 real hours.
const STARVATION_DIE_RISK    = 0.0005;           // cell with nutrient < threshold
const TURNOVER_DIE_RISK      = 0.0002;           // aged cell turnover
const WINTER_DIE_RISK        = 0.00005;
const BLIGHT_DIE_RISK        = 0.0001;

// ── Colony-level aging ───────────────────────────────────
// Old-age decline curves up between prime and old-age thresholds (real days).
const COLONY_PRIME_DAYS      = 60;               // up to here, no old-age decline
const COLONY_OLD_AGE_DAYS    = 365;              // by here, full old-age pressure
const OLD_AGE_DIE_RISK_MAX   = 0.0003;           // per-cell at full old-age

// ── Fruiting / spores ────────────────────────────────────
const FRUIT_BASE_RATE        = 0.0025;
const FRUIT_MATURE_TICKS     = 80;
const SPORE_DRIFT_GRAVITY    = 0.02;
const SPORE_AGE_LIMIT        = 200;
const SPORE_HARD_CAP         = 250;

// ── Toofan ───────────────────────────────────────────────
// Rare and selective. ≥1 real year between toofans. Daily roll past the gate
// with a tiny baseline plus a pressure boost — typical cadence works out to
// roughly one toofan every 1–2 real years. The world is NOT reset: each
// colony rolls a phenotype-aware survival check, so a toofan usually leaves
// 1–2 survivors and a damaged but continuous world.
const TOOFAN_MIN_TICKS_BETWEEN  = TICKS_PER_YEAR;
const TOOFAN_DAILY_BASE_PROB    = 0.0010;  // ~30% over a year with no pressure
const TOOFAN_DAILY_PRESSURE_MAX = 0.0050;  // +0.5% per day at full log exhaustion
const TOOFAN_BASE_SURVIVAL      = 0.10;    // every colony has a small floor
const TOOFAN_PHENOTYPE_WEIGHT   = 0.55;    // up to +0.55 for ideally adapted phenotype
const TOOFAN_FLAVORS            = ['flood', 'fire', 'frost', 'wind'];

// ── Auto-bootstrap (silent safety net) ──────────────────
// If the world is empty for this long, drop a fresh spore at a viable spot.
// Independent of Nigehban — he may also intervene, but the world shouldn't
// depend on him to come back to life.
const AUTO_BOOTSTRAP_AFTER_TICKS = 2 * TICKS_PER_HOUR;

// ── Trees ────────────────────────────────────────────────
// Saplings grow up through the soil band, mature over weeks, and eventually
// fall horizontally — becoming the next log a colony can colonise.
// Species vary in height, crown size, lifespan, and the nutrient richness of
// the log they leave behind. This is the closed-loop replenishment that
// keeps the world fertile without needing a cataclysm to reset substrate.
const TREE_SPECIES = [
  { name: 'oak',    maxHeight: 50, crownRadius: 12, lifespanDays: 240, logRichness: 92 },
  { name: 'birch',  maxHeight: 45, crownRadius:  9, lifespanDays: 180, logRichness: 78 },
  { name: 'pine',   maxHeight: 60, crownRadius:  9, lifespanDays: 300, logRichness: 60 },
  { name: 'willow', maxHeight: 35, crownRadius: 14, lifespanDays: 140, logRichness: 70 },
];
const TREE_STEM_HALF_WIDTH    = 1;                            // 3-wide trunk
const TREE_GROW_INTERVAL      = Math.floor(TICKS_PER_DAY / 2); // ~one cell per half real day
const SAPLING_CHECK_INTERVAL  = Math.floor(TICKS_PER_DAY);
const SAPLING_SPAWN_PROB      = 0.06;                          // ~6%/day check → ~once per 2 weeks
const MAX_TREES               = 3;
const TREE_BUFFER_X           = 14;                            // min horizontal gap to existing tree/log

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const SEASON_GROWTH_MULT  = { spring: 1.0, summer: 1.4, autumn: 0.9, winter: 0.4 };
const SEASON_FRUIT_MULT   = { spring: 0.5, summer: 1.0, autumn: 1.6, winter: 0.2 };
const SEASON_SPORE_MULT   = { spring: 1.6, summer: 0.9, autumn: 0.7, winter: 0.2 };

const NEIGHBORS_4 = neighborOffsets();

function simDay(world) { return Math.floor(world.meta.tick / TICKS_PER_SIM_DAY); }
function simSeasonIndex(world) { return Math.floor(simDay(world) / SIM_DAYS_PER_SEASON) % SEASONS.length; }

function tick(world) {
  world.meta.tick++;
  advanceSeasons(world);
  growTrees(world);
  maybeSpawnSapling(world);
  growHyphae(world);
  decayHyphae(world);
  handleFruiting(world);
  driftSpores(world);
  germinateSpores(world);
  rollToofan(world);
  recountColonies(world);
  checkAutoBootstrap(world);
  // weather clears after its hold window
  if (world.meta.weather && world.meta.weather !== 'clear' &&
      world.meta.weatherUntilTick && world.meta.tick >= world.meta.weatherUntilTick) {
    world.meta.weather = 'clear';
    world.meta.weatherUntilTick = null;
  }
}

// ── Trees ───────────────────────────────────────────────

function maybeSpawnSapling(world) {
  if (world.meta.tick % SAPLING_CHECK_INTERVAL !== 0) return;
  if (!world.meta.trees) world.meta.trees = [];
  const aliveTrees = world.meta.trees.filter(t => t.alive).length;
  if (aliveTrees >= MAX_TREES) return;
  if (Math.random() > SAPLING_SPAWN_PROB) return;
  spawnSapling(world);
}

function spawnSapling(world) {
  const { kind } = world.grid;
  // Mark columns occupied by an existing log or tree (any cell in that x)
  const occupied = new Uint8Array(W);
  for (let i = 0; i < kind.length; i++) {
    const k = kind[i];
    if (k === LOG || k === TREE) occupied[i % W] = 1;
  }
  // Find a clear column with TREE_BUFFER_X gap on each side
  let x = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const cand = 12 + Math.floor(Math.random() * (W - 24));
    let clear = true;
    for (let dx = -TREE_BUFFER_X; dx <= TREE_BUFFER_X; dx++) {
      const xx = cand + dx;
      if (xx < 0 || xx >= W) continue;
      if (occupied[xx]) { clear = false; break; }
    }
    if (clear) { x = cand; break; }
  }
  if (x < 0) return;
  const species = TREE_SPECIES[Math.floor(Math.random() * TREE_SPECIES.length)];
  if (!world.meta.trees) world.meta.trees = [];
  if (!world.meta.nextTreeId) world.meta.nextTreeId = 1;
  const t = {
    id: world.meta.nextTreeId++,
    species: species.name,
    x,
    maxHeight:    species.maxHeight,
    crownRadius:  species.crownRadius,
    lifespanTicks: species.lifespanDays * TICKS_PER_DAY,
    logRichness:  species.logRichness,
    height:       1,
    foundedTick:  world.meta.tick,
    alive:        true,
  };
  world.meta.trees.push(t);
  logEvent(world, 'sapling', `a ${species.name} sapling sprouted at x=${x}`);
}

function growTrees(world) {
  if (!world.meta.trees || !world.meta.trees.length) return;
  const tick = world.meta.tick;

  // Grow + paint each alive tree
  for (const t of world.meta.trees) {
    if (!t.alive) continue;
    if (t.height < t.maxHeight && tick % TREE_GROW_INTERVAL === 0) t.height++;
    paintTree(world, t);

    const ageTicks = tick - t.foundedTick;
    if (ageTicks >= t.lifespanTicks) {
      t.alive = false;
      t.felledTick = tick;
      fellTree(world, t);
      const ageDays = (ageTicks / TICKS_PER_DAY).toFixed(0);
      logEvent(world, 'tree-fall', `${t.species} (${ageDays}d) fell — a new log lies on the soil`);
    }
  }

  // Prune long-dead tree entries so the array doesn't grow forever
  if (world.meta.trees.length > 12) {
    world.meta.trees = world.meta.trees.filter(t => t.alive || (tick - (t.felledTick || 0)) < TICKS_PER_MONTH);
  }
}

function paintTree(world, t) {
  const { kind } = world.grid;
  const baseY = GRASS_Y - 1;
  // Stem
  for (let dy = 0; dy < t.height; dy++) {
    const y = baseY - dy;
    if (y < 0) break;
    for (let dx = -TREE_STEM_HALF_WIDTH; dx <= TREE_STEM_HALF_WIDTH; dx++) {
      const x = t.x + dx;
      if (x < 0 || x >= W) continue;
      const i = y * W + x;
      if (kind[i] === AIR || kind[i] === TREE) kind[i] = TREE;
    }
  }
  // Crown — round blob at the top, scaled by how grown the tree is.
  if (t.height > 8) {
    const grown = Math.min(1, t.height / t.maxHeight);
    const r = Math.max(2, Math.floor(t.crownRadius * grown));
    const cy = baseY - t.height + Math.floor(r * 0.4);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = t.x + dx, y = cy + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = y * W + x;
        if (kind[i] === AIR || kind[i] === TREE) kind[i] = TREE;
      }
    }
  }
}

function fellTree(world, t) {
  const { kind, nutrient, moisture } = world.grid;
  // Clear any TREE cells in this tree's footprint (everything within crownRadius+stem of its x).
  const footprint = t.crownRadius + TREE_STEM_HALF_WIDTH + 2;
  for (let y = 0; y < GRASS_Y; y++) {
    for (let dx = -footprint; dx <= footprint; dx++) {
      const x = t.x + dx;
      if (x < 0 || x >= W) continue;
      const i = y * W + x;
      if (kind[i] === TREE) kind[i] = AIR;
    }
  }
  // Lay a new horizontal log near the tree base, falling left or right.
  const fallDir   = Math.random() < 0.5 ? -1 : 1;
  const logWidth  = Math.max(40, Math.floor(t.maxHeight * 1.6));
  const logHeight = 16 + Math.floor(Math.random() * 6);
  const baseX     = t.x + fallDir * (TREE_STEM_HALF_WIDTH + 2);
  const x0        = fallDir === 1 ? baseX : baseX - logWidth;
  const yTop      = GRASS_Y - logHeight;
  paintLogCapsule(world, x0, yTop, logWidth, logHeight, t.logRichness, t.species);
}

function paintLogCapsule(world, x0, yTop, logWidth, logHeight, richness, species) {
  const { kind, nutrient, moisture } = world.grid;
  const r       = logHeight / 2;
  const cy      = yTop + r;
  const xCoreL  = x0 + r;
  const xCoreR  = x0 + logWidth - r;
  for (let dy = 0; dy < logHeight; dy++) {
    for (let dx = 0; dx < logWidth; dx++) {
      const x = x0 + dx, y = yTop + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      let inside = false;
      if (x >= xCoreL && x <= xCoreR)       inside = Math.abs(y - cy) <= r;
      else if (x < xCoreL)                   inside = Math.hypot(x - xCoreL, y - cy) <= r;
      else                                    inside = Math.hypot(x - xCoreR, y - cy) <= r;
      if (!inside) continue;
      const i = y * W + x;
      // Only paint into empty air — don't overwrite existing log/colony/soil.
      if (kind[i] !== AIR) continue;
      kind[i] = LOG;
      const n = richness - 12 + Math.floor(Math.random() * 24);
      const m = 55 + Math.floor(Math.random() * 20);
      nutrient[i] = Math.max(0, Math.min(NUTRIENT_MAX, n));
      moisture[i] = Math.max(0, Math.min(100, m));
    }
  }
}

// ── Seasons ─────────────────────────────────────────────

function advanceSeasons(world) {
  const newSeason = SEASONS[simSeasonIndex(world)];
  if (newSeason !== world.meta.season) {
    const old = world.meta.season;
    world.meta.season = newSeason;
    logEvent(world, 'season', `season turned: ${old} → ${newSeason}`);
    for (const c of Object.values(world.colonies)) if (c.alive) c.seasonsSurvived++;
    fire('onSeasonChange', world, { old, next: newSeason });
  }
}

// ── Hyphae growth ───────────────────────────────────────

function growHyphae(world) {
  const { kind, nutrient, colony, age } = world.grid;
  const seasonMult = SEASON_GROWTH_MULT[world.meta.season];

  // Snapshot ownership at tick start so newly-extended cells don't act this tick
  // and thickness checks see a consistent state.
  const startSnapshot = colony.slice();

  for (let i = 0; i < startSnapshot.length; i++) {
    const cid = startSnapshot[i];
    if (cid === 0) continue;
    const col = world.colonies[cid];
    if (!col || !col.alive) continue;

    // Self-consume + age
    nutrient[i] = Math.max(0, nutrient[i] - NUTRIENT_CONSUMPTION);
    age[i] = Math.min(65535, age[i] + 1);

    const gene = col.genome;
    const growthRate   = gene[0]; // 0.5–2.0
    const chemotaxis   = gene[1]; // 0–1
    const verticalBias = gene[2]; // 0–1

    // Walk 4 neighbors once. Each substrate-non-colony neighbor is:
    //   • a side-absorption target (drain at end of cell step), and
    //   • possibly an extension candidate (if it passes nutrient + thickness checks).
    const candidates = [];
    const drainTargets = [];
    let totalW = 0;
    let freeCount = 0;
    for (let ni = 0; ni < 4; ni++) {
      const off = NEIGHBORS_4[ni];
      const j = i + off;
      if (j < 0 || j >= startSnapshot.length) continue;
      if (off === -1 && (i % W) === 0)         continue;
      if (off ===  1 && (i % W) === W - 1)     continue;
      if (startSnapshot[j] !== 0) continue;
      const k = kind[j];
      if (k !== SOIL && k !== LOG && k !== GRASS) continue;
      drainTargets.push(j);
      if (nutrient[j] <= 0) continue;

      // Thickness cap: refuse extension into crowded zones. The free-count tier
      // below stops interior cells from acting; this stops tips from filling.
      if (occupiedInBox(startSnapshot, j) > THICKNESS_MAX) continue;

      freeCount++;
      let w = 1 + chemotaxis * (nutrient[j] / 50);
      if (off === -W && kind[i] === SOIL) w *= 1 + verticalBias * 1.5;
      candidates.push({ j, w });
      totalW += w;
    }

    // Extension decision — two-tier branching by freeCount.
    //   freeCount ≥ 3 = a real tip, extends reliably.
    //   freeCount = 2 = junction, low prob → occasional fork.
    //   freeCount = 1 = chain interior, almost never extends.
    if (freeCount > 0) {
      let baseExtend;
      if (freeCount >= 3)       baseExtend = 0.30  * growthRate * seasonMult;
      else if (freeCount === 2) baseExtend = 0.04  * growthRate * seasonMult;
      else                       baseExtend = 0.005 * growthRate * seasonMult;
      if (Math.random() <= baseExtend) {
        let r = Math.random() * totalW;
        let chosen = candidates[0].j;
        for (const c of candidates) {
          r -= c.w;
          if (r <= 0) { chosen = c.j; break; }
        }
        colony[chosen] = cid;
        age[chosen] = 0;
      }
    }

    // Side-absorption: drain substrate neighbors but stop at the floor. The
    // floor keeps cells survivable as extension targets — without it the tip
    // depletes its own forward neighbors before extending, and the colony
    // starves in place.
    for (const j of drainTargets) {
      if (colony[j] !== 0) continue;
      if (nutrient[j] > SIDE_ABSORPTION_FLOOR) {
        nutrient[j] = Math.max(SIDE_ABSORPTION_FLOOR, nutrient[j] - SIDE_ABSORPTION);
      }
    }
  }
}

function occupiedInBox(snapshot, j) {
  const cx = j % W;
  const cy = (j - cx) / W;
  let count = 0;
  for (let dy = -THICKNESS_BOX_RADIUS; dy <= THICKNESS_BOX_RADIUS; dy++) {
    const ny = cy + dy;
    if (ny < 0 || ny >= H) continue;
    for (let dx = -THICKNESS_BOX_RADIUS; dx <= THICKNESS_BOX_RADIUS; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      if (nx < 0 || nx >= W) continue;
      if (snapshot[ny * W + nx] !== 0) count++;
    }
  }
  return count;
}

function decayHyphae(world) {
  const { nutrient, colony, age, kind } = world.grid;
  const tick = world.meta.tick;
  const isWinter = world.meta.season === 'winter';
  for (let i = 0; i < colony.length; i++) {
    const cid = colony[i];
    if (cid === 0) continue;
    const col = world.colonies[cid];
    if (!col) { colony[i] = 0; continue; }
    const decayResistance = col.genome[4];

    // Accumulate dieback risk + remember dominant cause so we can attribute
    // a death-cause to the colony when it eventually dies.
    let dieRisk = 0;
    let topCause = null;
    let topContrib = 0;
    function add(cause, contrib) {
      if (contrib <= 0) return;
      dieRisk += contrib;
      if (contrib > topContrib) { topContrib = contrib; topCause = cause; }
    }

    if (nutrient[i] < HYPHA_DEATH_THRESHOLD) {
      add('starvation', STARVATION_DIE_RISK * (1 - decayResistance));
    }
    if (age[i] > HYPHA_AGE_LIMIT) {
      add('turnover', TURNOVER_DIE_RISK * (1 - decayResistance));
    }
    // Colony old-age decline — curves up between prime and old-age thresholds.
    const colAgeDays = (tick - col.foundedTick) / TICKS_PER_DAY;
    if (colAgeDays > COLONY_PRIME_DAYS) {
      const span = COLONY_OLD_AGE_DAYS - COLONY_PRIME_DAYS;
      const fade = Math.min(1, (colAgeDays - COLONY_PRIME_DAYS) / span);
      add('old-age', OLD_AGE_DIE_RISK_MAX * fade);
    }
    if (isWinter) add('winter', WINTER_DIE_RISK);
    if (col.blightedUntil && tick < col.blightedUntil) add('blight', BLIGHT_DIE_RISK);
    if (col.sparedUntil   && tick < col.sparedUntil)   dieRisk *= 0.2;

    if (dieRisk > 0 && Math.random() < dieRisk) {
      colony[i] = 0;
      age[i] = 0;
      // Decay-feeds-substrate: deposit at the dead cell + bleed to 4-neighbors.
      nutrient[i] = Math.min(NUTRIENT_MAX, nutrient[i] + DECAY_DEPOSIT);
      for (let ni = 0; ni < 4; ni++) {
        const off = NEIGHBORS_4[ni];
        const j = i + off;
        if (j < 0 || j >= colony.length) continue;
        if (off === -1 && (i % W) === 0)     continue;
        if (off ===  1 && (i % W) === W - 1) continue;
        if (colony[j] !== 0) continue;
        const k = kind[j];
        if (k !== SOIL && k !== LOG && k !== GRASS) continue;
        nutrient[j] = Math.min(NUTRIENT_MAX, nutrient[j] + DECAY_NEIGHBOR_DEPOSIT);
      }
      if (topCause) {
        col.deathCounts = col.deathCounts || {};
        col.deathCounts[topCause] = (col.deathCounts[topCause] || 0) + 1;
      }
    }
  }
}

// ── Fruiting ────────────────────────────────────────────

function handleFruiting(world) {
  const { kind, colony } = world.grid;
  const seasonMult = SEASON_FRUIT_MULT[world.meta.season];

  // age existing fruits
  for (const f of world.fruits) {
    if (f.spent) continue;
    f.age++;
    if (!f.mature && f.age >= FRUIT_MATURE_TICKS) {
      f.mature = true;
      const col = world.colonies[f.colonyId];
      if (col) {
        col.fruitCount++;
        if (col.fruitCount === 1) fire('onFirstFruit', world, col);
      }
      logEvent(world, 'fruit', `colony ${f.colonyId} fruited at (${f.x},${f.y})`);
      releaseSpores(world, f);
      f.spent = true;
      // remove FRUIT cell — collapse
      const fi = f.y * W + f.x;
      if (kind[fi] === FRUIT) kind[fi] = AIR;
    }
  }
  // garbage collect spent fruits occasionally
  if (world.fruits.length > 200) {
    world.fruits = world.fruits.filter(f => !f.spent);
  }

  // Walk all hypha-on-log cells whose 'above' cell is AIR.
  // Random sampling missed these — they're <0.5% of the grid. Direct scan is cheap.
  for (let i = 0; i < kind.length; i++) {
    const cid = colony[i];
    if (cid === 0) continue;
    if (kind[i] !== LOG) continue;
    const above = i - W;
    if (above < 0 || kind[above] !== AIR) continue;
    const col = world.colonies[cid];
    if (!col || !col.alive || col.cellCount < 30) continue;
    const fruitThreshold = col.genome[3];
    const prob = FRUIT_BASE_RATE * seasonMult * (0.3 + fruitThreshold * 1.4);
    if (Math.random() > prob) continue;
    kind[above] = FRUIT;
    world.fruits.push({
      x: above % W, y: Math.floor(above / W),
      colonyId: cid, age: 0, mature: false, spent: false,
    });
  }
}

function releaseSpores(world, fruit) {
  const col = world.colonies[fruit.colonyId];
  if (!col) return;
  const seasonMult = SEASON_SPORE_MULT[world.meta.season];
  const count = Math.floor(col.genome[5] * seasonMult);
  for (let s = 0; s < count; s++) {
    if (world.spores.length >= SPORE_HARD_CAP) break;
    world.spores.push({
      x: fruit.x + (Math.random() * 4 - 2),
      y: fruit.y - 2,
      vx: (Math.random() * 2 - 1) * 0.3,
      vy: -Math.random() * 0.4,
      age: 0,
      genome: mutate(col.genome),
    });
  }
}

// ── Spores ──────────────────────────────────────────────

function driftSpores(world) {
  const { season } = world.meta;
  const wind = season === 'autumn' ? 0.15 : season === 'spring' ? 0.05 : 0;
  const surviving = [];
  for (const sp of world.spores) {
    sp.x  += sp.vx + wind * (Math.random() * 2 - 1);
    sp.y  += sp.vy + SPORE_DRIFT_GRAVITY;
    sp.vy += SPORE_DRIFT_GRAVITY * 0.5;
    sp.age++;
    if (sp.x < 0 || sp.x >= W || sp.y < 0 || sp.y >= H) continue;
    if (sp.age >= SPORE_AGE_LIMIT) continue;
    surviving.push(sp);
  }
  world.spores = surviving;
}

function germinateSpores(world) {
  const { kind, nutrient, colony } = world.grid;
  const seasonMult = SEASON_SPORE_MULT[world.meta.season];
  const remaining = [];
  for (const sp of world.spores) {
    const ix = Math.floor(sp.x);
    const iy = Math.floor(sp.y);
    const i  = iy * W + ix;
    const k  = kind[i];
    const onSubstrate = (k === LOG || (k === SOIL && iy >= GRASS_Y + 1));
    if (!onSubstrate || colony[i] !== 0 || nutrient[i] < 10) {
      // continue drifting if still in air, else die
      if (k === AIR) remaining.push(sp);
      continue;
    }
    // small germination prob, season-modulated
    const prob = 0.25 * seasonMult;
    if (Math.random() > prob) { remaining.push(sp); continue; }
    const id = sowAt(world, ix, iy, sp.genome);
    if (id) logEvent(world, 'germinate', `colony ${id} sprouted near (${ix},${iy})`);
  }
  world.spores = remaining;
}

// ── Toofan ──────────────────────────────────────────────

function rollToofan(world) {
  // Pressure climbs with log exhaustion. Tracked for narration/UI even when
  // the calendar gate hasn't opened yet.
  const { kind, nutrient } = world.grid;
  let logCells = 0, logNutSum = 0;
  for (let i = 0; i < kind.length; i++) {
    if (kind[i] === LOG) { logCells++; logNutSum += nutrient[i]; }
  }
  const avgNut = logCells > 0 ? logNutSum / logCells : 0;
  const exhaustion = 1 - (avgNut / 80);
  world.meta.toofanPressure = Math.max(0, Math.min(1, exhaustion));

  // Roll once per real day, only past the minimum-gap gate. Daily probability
  // is tiny — most days nothing happens; over a year the cumulative chance is
  // moderate, scaled up by substrate exhaustion.
  if (world.meta.tick - world.meta.lastToofanTick < TOOFAN_MIN_TICKS_BETWEEN) return;
  if (world.meta.tick % TICKS_PER_DAY !== 0) return;
  const dailyProb = TOOFAN_DAILY_BASE_PROB +
                    world.meta.toofanPressure * TOOFAN_DAILY_PRESSURE_MAX;
  if (Math.random() < dailyProb) {
    triggerToofan(world);
  } else if (Math.random() < dailyProb * 6) {
    // Warning days happen ~6× more often than full toofans — the wind picks up,
    // the air feels wrong, colonies brace.
    logEvent(world, 'warning', `toofan-warning: pressure ${(world.meta.toofanPressure * 100).toFixed(0)}%`);
    for (const c of Object.values(world.colonies)) if (c.alive) c.survivedWarning = true;
    fire('onToofanWarning', world);
  }
}

// Per-colony survival check. Phenotype maps to flavor in different ways:
//   frost — decay-resistant, slow-growing genes survive
//   fire  — small caps and small colonies survive
//   flood — colonies sitting higher in the soil/log band survive
//   wind  — short-stemmed phenotypes hold; tall ones snap
function colonySurvivesToofan(world, col, flavor) {
  if (!col.alive) return false;
  const g = col.genome;
  let fit = 0.5; // 50/50 if nothing keys in

  if (flavor === 'frost') {
    const decayResist = g[4];
    const growthRate  = g[0];
    const slowness    = 1 - Math.min(1, (growthRate - 0.5) / 1.5);
    fit = decayResist * 0.6 + slowness * 0.4;
  } else if (flavor === 'fire') {
    const capSize  = g[8];
    const smallCap = 1 - Math.min(1, (capSize - 0.5) / 1.5);
    const smallCol = 1 - Math.min(1, col.cellCount / 200);
    fit = smallCap * 0.5 + smallCol * 0.5;
  } else if (flavor === 'flood') {
    const avgY = colonyAvgY(world, col.id);
    if (avgY == null) return false;
    const aboveGrass = Math.max(0, GRASS_Y - avgY);
    fit = Math.min(1, aboveGrass / 25);
  } else if (flavor === 'wind') {
    const stemLength = g[9];
    fit = 1 - Math.min(1, (stemLength - 0.5) / 1.5);
  }

  const prob = TOOFAN_BASE_SURVIVAL + TOOFAN_PHENOTYPE_WEIGHT * fit;
  return Math.random() < prob;
}

function colonyAvgY(world, cid) {
  let sum = 0, count = 0;
  const { colony } = world.grid;
  for (let i = 0; i < colony.length; i++) {
    if (colony[i] === cid) { sum += Math.floor(i / W); count++; }
  }
  return count > 0 ? sum / count : null;
}

function triggerToofan(world, flavor) {
  const f = flavor || TOOFAN_FLAVORS[Math.floor(Math.random() * TOOFAN_FLAVORS.length)];

  // Selective phenotype survival — most colonies die, 1–2 typically pull through.
  const survivors = [];
  const dying     = [];
  for (const col of Object.values(world.colonies)) {
    if (!col.alive) continue;
    if (colonySurvivesToofan(world, col, f)) survivors.push(col);
    else                                       dying.push(col);
  }

  // Mark the dying and fire the death hook so observability + Nigehban
  // see the toofan deaths the same way they see natural ones. recountColonies
  // skips colonies that are already alive=false, so the hook has to fire here.
  for (const col of dying) {
    col.alive       = false;
    col.deathTick   = world.meta.tick;
    col.deathCause  = f;
    col.deathCounts = col.deathCounts || {};
    col.deathCounts[f] = (col.deathCounts[f] || 0) + 1;
    fire('onColonyDeath', world, col);
  }

  // Clear the dead colonies' cells. Survivors keep their hyphae and substrate.
  const { kind, colony, age } = world.grid;
  for (let i = 0; i < colony.length; i++) {
    const cid = colony[i];
    if (cid === 0) continue;
    const c = world.colonies[cid];
    if (c && !c.alive) {
      colony[i] = 0;
      age[i]    = 0;
    }
  }

  // Air-borne stages don't make it through a toofan.
  for (const fr of world.fruits) {
    if (fr.spent) continue;
    const fi = fr.y * W + fr.x;
    if (kind[fi] === FRUIT) kind[fi] = AIR;
  }
  world.fruits = [];
  world.spores = [];

  // Wind can topple tall trees — taller is more vulnerable.
  if (f === 'wind') {
    for (const t of world.meta.trees || []) {
      if (!t.alive) continue;
      const tallness = Math.min(1, t.height / 40);
      if (Math.random() < tallness * 0.6) {
        t.alive = false;
        t.felledTick = world.meta.tick;
        fellTree(world, t);
        logEvent(world, 'tree-fall', `${t.species} blown over in the ${f}`);
      }
    }
  }

  // Give survivors a couple weeks of breathing room.
  const grace = TICKS_PER_WEEK * 2;
  for (const col of survivors) col.sparedUntil = world.meta.tick + grace;

  // Era marker. Volume number is internal; the surface narration becomes "era"
  // (Nigehban may name it via the onToofan hook). The world is NOT reset —
  // survivors carry on, the soil persists, trees keep growing.
  world.meta.volume++;
  world.meta.lastToofanTick    = world.meta.tick;
  world.meta.weather           = f;
  world.meta.lastToofanFlavor  = f;
  world.meta.weatherUntilTick  = world.meta.tick + Math.floor(TICKS_PER_HOUR * 6);
  world.meta.toofanPressure    = 0;

  logEvent(world, 'toofan',
    `${f}: ${dying.length} colonies lost, ${survivors.length} survived — era ${world.meta.volume} begins`);
  fire('onToofan', world, {
    flavor: f,
    eraEnding:   world.meta.volume - 1,
    eraStarting: world.meta.volume,
    survivors:   survivors.map(c => ({
      id: c.id, name: c.name, phenotype: phenotypeWords(c.genome),
    })),
    dyingCount: dying.length,
  });

  return f;
}

// ── Auto-bootstrap (silent safety net) ──────────────────

function checkAutoBootstrap(world) {
  const aliveCount = Object.values(world.colonies).filter(c => c.alive).length;
  if (aliveCount > 0) {
    world.meta.emptyTicks = 0;
    return;
  }
  world.meta.emptyTicks = (world.meta.emptyTicks || 0) + 1;

  // Notify Nigehban once at the moment the world becomes empty so he has the
  // option to act. He may sow, name a memorial entry, or do nothing — the
  // safety net below fires either way.
  if (world.meta.emptyTicks === 1) fire('onWorldEmpty', world);

  if (world.meta.emptyTicks < AUTO_BOOTSTRAP_AFTER_TICKS) return;
  if (autoBootstrap(world)) world.meta.emptyTicks = 0;
}

function autoBootstrap(world) {
  const { kind, colony, nutrient } = world.grid;
  for (let attempt = 0; attempt < 120; attempt++) {
    const i = Math.floor(Math.random() * kind.length);
    const k = kind[i];
    if (k !== LOG && k !== SOIL && k !== GRASS) continue;
    if (colony[i] !== 0) continue;
    if (nutrient[i] < 10) continue;
    const x = i % W;
    const y = Math.floor(i / W);
    const id = sowAt(world, x, y, randomGenome());
    if (id) {
      const emptyHours = (world.meta.emptyTicks / TICKS_PER_HOUR).toFixed(1);
      logEvent(world, 'auto-sow', `world re-seeded after ${emptyHours} h empty`);
      return true;
    }
  }
  return false;
}

// ── Bookkeeping ─────────────────────────────────────────

function recountColonies(world) {
  for (const c of Object.values(world.colonies)) c.cellCount = 0;
  const { colony } = world.grid;
  for (let i = 0; i < colony.length; i++) {
    const cid = colony[i];
    if (cid !== 0 && world.colonies[cid]) world.colonies[cid].cellCount++;
  }
  for (const c of Object.values(world.colonies)) {
    if (c.alive && c.cellCount === 0 && world.meta.tick - c.foundedTick > 5) {
      c.alive = false;
      c.deathTick = world.meta.tick;
      // Dominant cause of death — whichever cause killed the most cells.
      const counts = c.deathCounts || {};
      let topCause = 'unknown', topCount = 0;
      for (const [cause, count] of Object.entries(counts)) {
        if (count > topCount) { topCause = cause; topCount = count; }
      }
      c.deathCause = topCause;
      const label = c.name ? `${c.name} (${phenotypeWords(c.genome)})` : phenotypeWords(c.genome);
      logEvent(world, 'death', `colony ${c.id} — ${label} — died (${topCause})`);
      fire('onColonyDeath', world, c);
    }
  }
}

module.exports = {
  tick,
  triggerToofan,
  spawnSapling,
  fellTree,
  setHooks,
  TICKS_PER_SIM_DAY,
  SIM_DAYS_PER_SEASON,
  SEASONS,
};
