// Shroom — simulation tick.
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
const SIDE_ABSORPTION_FLOOR  = 10;   // lowered from 20 — frontier cells can
const THICKNESS_BOX_RADIUS   = 2;
const THICKNESS_MAX          = 3;
const NUTRIENT_MAX           = 100;  // soft cap matching world.js generators

// ── Decay-feeds-substrate ───────────────────────────────
// Dead mycelium decomposes into the substrate beneath it. The cell that died
// gets a deposit at its location; substrate-neighbors bleed a smaller amount,
// producing a visible halo of richer ground around a dying colony.
const DECAY_DEPOSIT          = 15;
const DECAY_NEIGHBOR_DEPOSIT = 4;

// ── Branching shape ─────────────────────────────────────
// Tips have a chance to extend in TWO directions in one tick, producing
// Y-shaped forks instead of a single thread. Combined with the inner
// extension roll (~30% at a tip) this yields an effective fork rate of
// ~12%/tick — first Y-branch by cell ~8 on a healthy colony. Tuned for
// "roots, not worms" with THICKNESS_MAX still capping mature density.
const TIP_BIFURCATION_PROB = 0.40;

// ── Substrate slow regeneration ─────────────────────────
// Decomposer microbes and rainfall slowly restore substrate richness between
// colony pulses. nutrient is Uint8Array so regen works as integer pulses:
// every SUBSTRATE_REGEN_INTERVAL ticks every LOG/SOIL cell gains +1, capped
// at NUTRIENT_MAX. An empty log cell recovers 0 → 100 in ~17 real days.
const SUBSTRATE_REGEN_INTERVAL = 4896;

// ── Log decay ───────────────────────────────────────────
// Wood-decay fungi consume their substrate. A LOG cell that has been eaten
// down to zero nutrient (consumption outpacing regen → a colony is actively
// on it) has a small chance per tick to crumble into SOIL. ~5h half-life at
// full depletion: slow enough to forgive brief overconsumption, fast enough
// to witness a log shrink over weeks of colonisation. Closes the loop on
// tree-fall: sapling → tree → log → consumed → soil → next sapling.
const LOG_DECAY_PROB = 0.00005;

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
// Reserves economy:
//   • EXTEND_COST: every new hypha cell costs this much from col.reserves.
//     Colonies have to *invest* absorbed nutrient to grow — networks that
//     just sit and recycle their own dieback can't expand. Pairs with
//     FRUIT_COST so the colony pays for both infrastructure and offspring.
//   • FRUIT_COST: base cost of a fruit body. Discounted by col.fruitCount
//     (handleFruiting) so a colony that's already invested in a fruiting
//     network gets cheaper subsequent fruits — rewards specialization.
const EXTEND_COST            = 2;
const FRUIT_COST             = 500;
const FRUIT_COST_FLOOR       = 80;
const FRUIT_DISCOUNT_PER_FRUIT = 0.8;   // multiplicative: 500, 400, 320, 256, …
const FRUIT_MATURE_TICKS     = 80;          // ~4 real min from emergence to spore release
const FRUIT_CAP_DECAY_TICKS  = TICKS_PER_DAY * 2;  // cap stays visible 2 sim days post-emergence
// Minimum horizontal source-res cell-distance between simultaneously-active
// caps from the same colony. The locked-vision mocks let caps cluster too
// tightly; the renderer's smoothed cap-glow piles up and reads as a
// gradient blob instead of individual mushrooms. 5 cells ~= 20px at 4×.
const FRUIT_MIN_X_SPACING    = 5;
// Per-substrate fruiting multipliers. Log is king — that's where wood-decay
// fungi mostly fruit. Grass-line caps are visible second; soil fruiting is
// rare (colony deep in soil sending a body up through the grass).
const FRUIT_SUBSTRATE_MULT_LOG   = 1.0;
const FRUIT_SUBSTRATE_MULT_GRASS = 0.4;
const FRUIT_SUBSTRATE_MULT_SOIL  = 0.35;
const FRUIT_MAX_RISE_ROWS        = 20;       // how far up we'll walk to find AIR
const SPORE_DRIFT_GRAVITY    = 0.02;
const SPORE_AGE_LIMIT        = 60;
const SPORE_HARD_CAP         = 60;

// ── Toofan ───────────────────────────────────────────────
// Stochastic, decoupled from substrate. One roll per sim day at fixed
// probability — mean ~1 toofan per sim year, with natural Poisson variance.
// Pressure is purely narrative: time-since-last as a 0→1 gauge (>1 = overdue).
// The world is NOT reset: each colony rolls a phenotype-aware survival check.
const TOOFAN_DAILY_PROB         = 1 / 365;   // mean 1 per sim year
const TOOFAN_BASE_SURVIVAL      = 0.10;
const TOOFAN_PHENOTYPE_WEIGHT   = 0.55;
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
// Lifespans tuned so each tree spends ~half its life as an observable mature
// tree, then falls on a real-weeks timescale. With log-decay closing the loop
// (LOG_DECAY_PROB below) the substrate cycle no longer needs sim-seasons of
// replenishment, so the cycle can run 4× faster and actually be witnessed.
const TREE_SPECIES = [
  { name: 'oak',    maxHeight: 50, crownRadius: 12, lifespanDays: 60, logRichness: 92 },
  { name: 'birch',  maxHeight: 45, crownRadius:  9, lifespanDays: 45, logRichness: 78 },
  { name: 'pine',   maxHeight: 60, crownRadius:  9, lifespanDays: 75, logRichness: 60 },
  { name: 'willow', maxHeight: 35, crownRadius: 14, lifespanDays: 35, logRichness: 70 },
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
  regenSubstrate(world);
  growHyphae(world);
  decayHyphae(world);
  cascadeIsolationDeath(world);
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
  const { kind } = world.grid;
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

  // Record the new log so the renderer can paint it as its actual species
  // (oak/birch/pine/willow) instead of always-oak. Older logs accrue moss
  // visually based on (currentTick - foundedTick); see canvas state translator.
  world.meta.logs = world.meta.logs || [];
  world.meta.logs.push({
    id: world.meta.nextLogId || (world.meta.logs.length + 1),
    x0, y0: yTop, w: logWidth, h: logHeight,
    species: t.species,
    foundedTick: world.meta.tick,
    mossy: false,    // age-derived in the renderer
  });
  world.meta.nextLogId = (world.meta.nextLogId || (world.meta.logs.length)) + 1;
}

function paintLogCapsule(world, x0, yTop, logWidth, logHeight, richness, species) {
  const { kind, nutrient } = world.grid;
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
      nutrient[i] = Math.max(0, Math.min(NUTRIENT_MAX, n));
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

    // Self-consume + age. Track absorbed nutrient on the colony — drives the
    // fruit-cost gate below. Use the actual draw, not the constant, so cells
    // sitting on empty substrate don't earn phantom reserves.
    const selfDraw = Math.min(NUTRIENT_CONSUMPTION, nutrient[i]);
    nutrient[i] -= selfDraw;
    col.reserves = (col.reserves || 0) + selfDraw;
    age[i] = Math.min(65535, age[i] + 1);

    const gene = col.genome;
    const growthRate   = gene[0]; // 0.5–2.0
    const chemotaxis   = gene[1]; // 0–1
    // gene[2] is reserved (formerly verticalBias — kept in the genome shape
    // so existing colonies load cleanly, but no longer drives growth).

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
      // Pure chemotaxis: weight by neighbor nutrient, no directional bias.
      // Substrate design (pockets, log richness) does all the steering.
      let w = 1 + chemotaxis * (nutrient[j] / 50);
      candidates.push({ j, w });
      totalW += w;
    }

    // Extension decision — three-tier branching by freeCount.
    //   freeCount ≥ 3 = a real tip — extends reliably, can bifurcate.
    //   freeCount = 2 = junction — branches at meaningful rate (lateral shoots).
    //   freeCount = 1 = chain interior — occasional deep side-branch.
    // Gated on col.reserves: each new cell costs EXTEND_COST. A colony that
    // isn't absorbing enough nutrient can't grow.
    if (freeCount > 0 && (col.reserves || 0) >= EXTEND_COST) {
      let baseExtend;
      if (freeCount >= 3)       baseExtend = 0.30  * growthRate * seasonMult;
      else if (freeCount === 2) baseExtend = 0.14  * growthRate * seasonMult;  // was 0.04
      else                       baseExtend = 0.02  * growthRate * seasonMult;  // was 0.005
      if (Math.random() <= baseExtend) {
        let r = Math.random() * totalW;
        let chosen = candidates[0].j;
        for (const c of candidates) {
          r -= c.w;
          if (r <= 0) { chosen = c.j; break; }
        }
        colony[chosen] = cid;
        age[chosen] = 0;
        col.reserves -= EXTEND_COST;

        // Bifurcation — tips can split into two directions at once, producing
        // Y-shaped branching instead of a single worm. Probability tuned by
        // TIP_BIFURCATION_PROB; gated on ≥2 candidates and reserves for a
        // second EXTEND_COST.
        if (freeCount >= 3 && candidates.length >= 2 && (col.reserves || 0) >= EXTEND_COST) {
          if (Math.random() < TIP_BIFURCATION_PROB) {
            const others = candidates.filter(c => c.j !== chosen && colony[c.j] === 0);
            if (others.length > 0) {
              const ow = others.reduce((s, c) => s + c.w, 0);
              let r2 = Math.random() * ow;
              let chosen2 = others[0].j;
              for (const c of others) { r2 -= c.w; if (r2 <= 0) { chosen2 = c.j; break; } }
              colony[chosen2] = cid;
              age[chosen2] = 0;
              col.reserves -= EXTEND_COST;
            }
          }
        }
      }
    }

    // Side-absorption: drain substrate neighbors but stop at the floor. The
    // floor keeps cells survivable as extension targets — without it the tip
    // depletes its own forward neighbors before extending, and the colony
    // starves in place. Actual draw is credited to col.reserves.
    for (const j of drainTargets) {
      if (colony[j] !== 0) continue;
      if (nutrient[j] > SIDE_ABSORPTION_FLOOR) {
        const drained = Math.min(SIDE_ABSORPTION, nutrient[j] - SIDE_ABSORPTION_FLOOR);
        nutrient[j] -= drained;
        col.reserves = (col.reserves || 0) + drained;
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

// Real mycelium is a transport network: tips at the frontier absorb nutrients
// and pass them back through the chain to fuel growth and fruiting. The TIP
// is the most exposed cell — it should die first when conditions sour, and
// the colony then shrinks back from the frontier toward its anchor. Cells in
// the middle of an established mat are protected by being well-connected;
// they should NOT randomly die and leave isolated pixels behind. We scale
// the accumulated dieRisk by same-colony-neighbour count to enforce that.
//
// Companion: cascadeIsolationDeath() handles the rare case where the trunk
// gets cut anyway (blight, toofan, unlucky roll) — the stranded sub-chain
// then dies fast on its own.
function decayHyphae(world) {
  const { nutrient, colony, age, kind } = world.grid;
  const tick = world.meta.tick;
  const isWinter = world.meta.season === 'winter';
  const len = colony.length;
  for (let i = 0; i < len; i++) {
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

    // Connectivity scaling — tips full risk, interior cells barely die.
    const x = i % W;
    let sameN = 0;
    if (x > 0       && colony[i - 1] === cid) sameN++;
    if (x < W - 1   && colony[i + 1] === cid) sameN++;
    if (i >= W      && colony[i - W]  === cid) sameN++;
    if (i < len - W && colony[i + W]  === cid) sameN++;
    const connectivityMult =
      sameN <= 1 ? 1.00 :
      sameN === 2 ? 0.30 :
      sameN === 3 ? 0.15 :
                    0.08;
    dieRisk *= connectivityMult;

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

// ── Isolation cascade ───────────────────────────────────
// Safety net for the rare case where decayHyphae's connectivity protection
// doesn't prevent stranding (toofan, blight, or an unlucky roll severs a
// chain). Per the biological model: when the trunk is cut, the side without
// continuous network back to the colony's main mass cannot transport
// nutrients and dies within hours.
//
// Implementation: per colony with >4 cells, union-find connected components
// over same-colony 4-neighbour adjacency. Largest component is the trunk —
// survives normally. Cells in smaller components die at 50% per tick, so
// stranded sub-chains are gone within ~5–7 ticks instead of lingering as
// orphan pixels. Uses one Int32Array parent allocation per tick (cheap).
function cascadeIsolationDeath(world) {
  const { colony, age } = world.grid;
  const len = colony.length;

  // Build parent array (DSU). Self-loop = root. -1 = empty.
  const parent = new Int32Array(len);
  for (let i = 0; i < len; i++) parent[i] = colony[i] === 0 ? -1 : i;

  function find(x) {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    // path compression
    while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; }
    return r;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Union 4-neighbours of same colony
  for (let i = 0; i < len; i++) {
    const cid = colony[i];
    if (cid === 0) continue;
    const x = i % W;
    if (x < W - 1 && colony[i + 1] === cid) union(i, i + 1);
    if (i < len - W && colony[i + W] === cid) union(i, i + W);
  }

  // Tally component sizes; track largest root per colony
  const sizeByRoot = new Map();
  for (let i = 0; i < len; i++) {
    if (colony[i] === 0) continue;
    const r = find(i);
    sizeByRoot.set(r, (sizeByRoot.get(r) || 0) + 1);
  }

  const trunkByColony = new Map();    // cid → root of largest component
  const trunkSize     = new Map();    // cid → size of largest component
  for (const [root, size] of sizeByRoot) {
    const cid = colony[root];
    if (cid === 0) continue;
    const cur = trunkSize.get(cid) || 0;
    if (size > cur) {
      trunkSize.set(cid, size);
      trunkByColony.set(cid, root);
    }
  }

  // Kill 50% of cells in non-trunk components, for colonies large enough
  // that we care about topology (small colonies are noise either way).
  for (let i = 0; i < len; i++) {
    const cid = colony[i];
    if (cid === 0) continue;
    const col = world.colonies[cid];
    if (!col || col.cellCount <= 4) continue;
    const trunk = trunkByColony.get(cid);
    if (find(i) === trunk) continue;
    if (Math.random() < 0.50) {
      colony[i] = 0;
      age[i]    = 0;
      col.deathCounts = col.deathCounts || {};
      col.deathCounts['stranded'] = (col.deathCounts['stranded'] || 0) + 1;
    }
  }
}

// ── Fruiting ────────────────────────────────────────────

function handleFruiting(world) {
  const { kind, colony } = world.grid;
  const seasonMult = SEASON_FRUIT_MULT[world.meta.season];

  // age existing fruits — maturity (spore release) is now decoupled from
  // cap decay (visual removal). A mature cap stays visible for ~2 sim days
  // before its FRUIT cell is cleared.
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
      const fname = col ? (col.name || col.placeholderName || `colony ${f.colonyId}`) : `colony ${f.colonyId}`;
      logEvent(world, 'fruit', `${fname} fruited at (${f.x},${f.y})`);
      releaseSpores(world, f);
      // NOTE: cap stays visible after maturity; FRUIT cell persists.
    }
    if (f.mature && f.age >= FRUIT_CAP_DECAY_TICKS) {
      f.spent = true;
      const fi = f.y * W + f.x;
      if (kind[fi] === FRUIT) kind[fi] = AIR;
    }
  }
  // garbage collect spent fruits occasionally
  if (world.fruits.length > 200) {
    world.fruits = world.fruits.filter(f => !f.spent);
  }

  // Per-colony list of x positions for currently-active (not spent) caps,
  // including any placed earlier in this same tick. Used to enforce
  // FRUIT_MIN_X_SPACING so caps don't pile up into a smear of glow.
  const activeX = new Map();
  for (const f of world.fruits) {
    if (f.spent) continue;
    let arr = activeX.get(f.colonyId);
    if (!arr) { arr = []; activeX.set(f.colonyId, arr); }
    arr.push(f.x);
  }

  // Walk all hypha cells. For each one, if its substrate (LOG/GRASS/SOIL)
  // allows fruiting, walk upward to find the first AIR cell — that's where
  // the mushroom emerges. Log surface caps spawn at the log; grass/soil
  // caps emerge through the lawn at row 62.
  const len = kind.length;
  for (let i = 0; i < len; i++) {
    const cid = colony[i];
    if (cid === 0) continue;
    const k = kind[i];
    let substrateMult;
    if      (k === LOG)   substrateMult = FRUIT_SUBSTRATE_MULT_LOG;
    else if (k === GRASS) substrateMult = FRUIT_SUBSTRATE_MULT_GRASS;
    else if (k === SOIL)  substrateMult = FRUIT_SUBSTRATE_MULT_SOIL;
    else continue;

    // Walk upward to find the first AIR cell. Bounded so we don't scan the
    // whole sky from a deep-soil cell.
    let above = i - W;
    let rise = 1;
    while (above >= 0 && rise <= FRUIT_MAX_RISE_ROWS) {
      if (kind[above] === AIR) break;
      above -= W;
      rise++;
    }
    if (above < 0 || rise > FRUIT_MAX_RISE_ROWS || kind[above] !== AIR) continue;

    const col = world.colonies[cid];
    if (!col || !col.alive || col.cellCount < 30) continue;
    // Reserves gate with declining cost per successful fruit. First fruit is
    // expensive (~500), subsequent fruits exponentially cheaper down to the
    // floor — a colony that's built a fruiting network gets rewarded for it.
    const fruitCost = Math.max(
      FRUIT_COST_FLOOR,
      FRUIT_COST * Math.pow(FRUIT_DISCOUNT_PER_FRUIT, col.fruitCount || 0)
    );
    if ((col.reserves || 0) < fruitCost) continue;
    const fruitThreshold = col.genome[3];
    const prob = FRUIT_BASE_RATE * seasonMult * substrateMult * (0.3 + fruitThreshold * 1.4);
    if (Math.random() > prob) continue;

    const fx = above % W;
    const xs = activeX.get(cid);
    if (xs) {
      let tooClose = false;
      for (let k2 = 0; k2 < xs.length; k2++) {
        if (Math.abs(xs[k2] - fx) < FRUIT_MIN_X_SPACING) { tooClose = true; break; }
      }
      if (tooClose) continue;
    }

    kind[above] = FRUIT;
    col.reserves -= fruitCost;
    world.fruits.push({
      x: fx, y: Math.floor(above / W),
      colonyId: cid, age: 0, mature: false, spent: false,
    });
    if (world.meta.lifetime) world.meta.lifetime.fruitsTotal++;
    let arr = activeX.get(cid);
    if (!arr) { arr = []; activeX.set(cid, arr); }
    arr.push(fx);
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
      vx: (Math.random() * 2 - 1) * 1.5,
      // vy range [-0.3, 0.2] — slight drift, gentle fall. Combined with the
      // gravity term in driftSpores this lands spores across both log and
      // soil layers instead of launching them off the canvas top.
      vy: (Math.random() * 0.5 - 0.3),
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
    // Small germination prob, season-modulated. Most spores must fail —
    // a single fruit releases up to ~13 spores at peak season, and even
    // a couple of successful germinations per fruit floods the world.
    // 0.005 × spring (1.6) over a 60-tick spore lifetime ≈ 30% chance to
    // sprout while drifting on substrate; tunes to ~1–2 new colonies per
    // fruit at peak, fewer off-season.
    const prob = 0.005 * seasonMult;
    if (Math.random() > prob) { remaining.push(sp); continue; }
    const id = sowAt(world, ix, iy, sp.genome);
    if (id) {
      const sprout = world.colonies[id];
      const nm = (sprout && (sprout.name || sprout.placeholderName)) || `colony ${id}`;
      logEvent(world, 'germinate', `${nm} sprouted near (${ix},${iy})`);
    }
  }
  world.spores = remaining;
}

// ── Toofan ──────────────────────────────────────────────

function rollToofan(world) {
  const tick = world.meta.tick;
  // Pressure = time-since-last as a 0→1 narration gauge. Caps at 1 in the UI
  // but the underlying ratio can exceed it (read as "overdue").
  const ticksSince = tick - (world.meta.lastToofanTick || 0);
  world.meta.toofanPressure = Math.max(0, Math.min(1, ticksSince / TICKS_PER_YEAR));

  // One roll per sim day, fixed probability — Poisson, ~1/year on average.
  if (tick % TICKS_PER_DAY !== 0) return;
  if (Math.random() < TOOFAN_DAILY_PROB) {
    triggerToofan(world);
  } else if (Math.random() < TOOFAN_DAILY_PROB * 6) {
    logEvent(world, 'warning', `toofan-warning`);
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
    if (world.meta.lifetime && world.meta.lifetime.deathsByCause) {
      const bucket = world.meta.lifetime.deathsByCause;
      bucket[f] = (bucket[f] || 0) + 1;
    }
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
  if (world.meta.lifetime && world.meta.lifetime.toofansByFlavor) {
    world.meta.lifetime.toofansByFlavor[f] = (world.meta.lifetime.toofansByFlavor[f] || 0) + 1;
  }

  // Era scar — a persistent visual mark on the substrate. Fades over
  // ~3 real weeks via age in the renderer (see paintEraScar). Dying-colony
  // bboxes were cleared above, so the log span is the best signal we have.
  let x1 = W, x2 = 0;
  if (world.meta.logs && world.meta.logs.length) {
    const lg = world.meta.logs[0];
    x1 = lg.x0;
    x2 = lg.x0 + lg.w - 1;
    // For wind, widen the scar across both ends since debris scatters.
    if (f === 'wind') { x1 = Math.max(0, x1 - 30); x2 = Math.min(W - 1, x2 + 30); }
  }
  world.meta.eraScars = world.meta.eraScars || [];
  world.meta.eraScars.push({
    kind: f, x1, x2,
    foundedTick: world.meta.tick,
    eraEnded: world.meta.volume - 1,
  });
  // Cap scar history at 4 — older ones are off-screen narrative.
  if (world.meta.eraScars.length > 4) world.meta.eraScars.shift();

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

function regenSubstrate(world) {
  const doRegen = world.meta.tick % SUBSTRATE_REGEN_INTERVAL === 0;
  const { kind, nutrient } = world.grid;
  for (let i = 0; i < kind.length; i++) {
    const k = kind[i];
    if (k === LOG) {
      if (doRegen && nutrient[i] < NUTRIENT_MAX) nutrient[i]++;
      else if (nutrient[i] === 0 && Math.random() < LOG_DECAY_PROB) {
        // Consumed faster than regen can restore — crumble to soil.
        kind[i] = SOIL;
      }
    } else if (k === SOIL) {
      if (doRegen && nutrient[i] < NUTRIENT_MAX) nutrient[i]++;
    }
  }
  // Once per sim day, prune log entries whose footprint has been fully
  // converted to soil. Frees the spawning columns for new saplings.
  if (world.meta.tick % TICKS_PER_DAY === 0) pruneEmptyLogs(world);
}

function pruneEmptyLogs(world) {
  const logs = world.meta.logs;
  if (!logs || !logs.length) return;
  const { kind } = world.grid;
  world.meta.logs = logs.filter(lg => {
    for (let dy = 0; dy < lg.h; dy++) {
      const y = lg.y0 + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = 0; dx < lg.w; dx++) {
        const x = lg.x0 + dx;
        if (x < 0 || x >= W) continue;
        if (kind[y * W + x] === LOG) return true;
      }
    }
    return false;
  });
}

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
      if (world.meta.lifetime && world.meta.lifetime.deathsByCause) {
        const bucket = world.meta.lifetime.deathsByCause;
        bucket[topCause] = (bucket[topCause] || 0) + 1;
      }
      const named = c.name || c.placeholderName;
      const label = named ? `${named} (${phenotypeWords(c.genome)})` : phenotypeWords(c.genome);
      logEvent(world, 'death', `colony ${c.id} — ${label} — died (${topCause})`);
      fire('onColonyDeath', world, c);
    }
  }
}

const CONSTANTS = {
  TICKS_PER_SIM_DAY, SIM_DAYS_PER_SEASON,
  NUTRIENT_CONSUMPTION, SIDE_ABSORPTION, SIDE_ABSORPTION_FLOOR,
  THICKNESS_BOX_RADIUS, THICKNESS_MAX, NUTRIENT_MAX,
  DECAY_DEPOSIT, DECAY_NEIGHBOR_DEPOSIT,
  SUBSTRATE_REGEN_INTERVAL, LOG_DECAY_PROB,
  HYPHA_DEATH_THRESHOLD, HYPHA_AGE_LIMIT,
  STARVATION_DIE_RISK, TURNOVER_DIE_RISK, WINTER_DIE_RISK, BLIGHT_DIE_RISK,
  COLONY_PRIME_DAYS, COLONY_OLD_AGE_DAYS, OLD_AGE_DIE_RISK_MAX,
  FRUIT_BASE_RATE,
  EXTEND_COST, TIP_BIFURCATION_PROB,
  FRUIT_COST, FRUIT_COST_FLOOR, FRUIT_DISCOUNT_PER_FRUIT,
  FRUIT_MATURE_TICKS, FRUIT_CAP_DECAY_TICKS, FRUIT_MIN_X_SPACING,
  FRUIT_SUBSTRATE_MULT_LOG, FRUIT_SUBSTRATE_MULT_GRASS, FRUIT_SUBSTRATE_MULT_SOIL,
  FRUIT_MAX_RISE_ROWS,
  SPORE_DRIFT_GRAVITY, SPORE_AGE_LIMIT, SPORE_HARD_CAP,
  TOOFAN_DAILY_PROB, TOOFAN_BASE_SURVIVAL, TOOFAN_PHENOTYPE_WEIGHT, TOOFAN_FLAVORS,
  AUTO_BOOTSTRAP_AFTER_TICKS,
  TREE_SPECIES,
  TREE_STEM_HALF_WIDTH, TREE_GROW_INTERVAL, SAPLING_CHECK_INTERVAL, SAPLING_SPAWN_PROB, MAX_TREES, TREE_BUFFER_X,
  SEASONS, SEASON_GROWTH_MULT, SEASON_FRUIT_MULT, SEASON_SPORE_MULT,
};

module.exports = {
  tick,
  triggerToofan,
  spawnSapling,
  fellTree,
  setHooks,
  TICKS_PER_SIM_DAY,
  SIM_DAYS_PER_SEASON,
  SEASONS,
  CONSTANTS,
};
