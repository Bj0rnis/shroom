// Shroom — world state and log generation.
// Grid is stored as parallel typed arrays indexed by y * W + x.

const { randomGenome } = require('./genome');
const { createRng } = require('./rng');

// Placeholder names for colonies until Nigehban bestows a real one. The
// register is the made-up psilocybin-cultivar register — atmospheric
// adjective + archetypal noun, spaced, capitalised. Examples produced:
// "Pale Bell", "Hollow Teacher", "Ember Witness", "Wormwood Throne".
// All made up — no real cultivar names. Combinatorial (25 × 16 = 400) so
// collisions are rare. See docs/design/REVIEW.md #11.
const NAME_PREFIXES = [
  'Pale', 'Hollow', 'Ember', 'Briar', 'Marrow', 'Mourner', 'Quiet', 'Vow',
  'Bone', 'Ash', 'Tallow', 'Sundown', 'Wormwood', 'Wither', 'Salt', 'Iron',
  'Owl', 'Husk', 'Tinder', 'Stone', 'Velvet', 'Cinder', 'Bramble', 'Dusk',
  'Hush',
];
const NAME_SUFFIXES = [
  'Bell', 'Teacher', 'Witness', 'Mother', 'Mantle', 'Prophet', 'Cap',
  'Crown', 'Saint', 'Lantern', 'Throne', 'Hour', 'Hood', 'Wake', 'Coast',
  'Reach',
];
function pickPlaceholderName(rng) {
  const r = rng || Math.random;
  const a = NAME_PREFIXES[Math.floor(r() * NAME_PREFIXES.length)];
  const b = NAME_SUFFIXES[Math.floor(r() * NAME_SUFFIXES.length)];
  return a + ' ' + b;
}

const W = 320;
const H = 180;
// Grass line at row 63 — soil-dominant 35/65 band proportion, locked by
// the design kit's anchor mocks. Air rows 0..62, grass row 63, soil rows
// 64..179. (Not `Math.floor(H * 0.35)` — that lands at 62 in IEEE 754.)
const GRASS_Y = 63;

// Cell kinds
const AIR   = 0;
const SOIL  = 1;
const GRASS = 2;
const LOG   = 3;
const FRUIT = 4;
const TREE  = 5;

// Lifetime metric counters — survive restarts via world.json persistence.
// Exported so persistence.js can use it for migration of legacy worlds that
// don't have meta.lifetime yet.
function freshLifetime() {
  return {
    births: 0,
    fruitsTotal: 0,
    toofansByFlavor: { flood: 0, fire: 0, frost: 0, wind: 0 },
    deathsByCause: {
      starvation: 0, turnover: 0, 'old-age': 0, winter: 0, blight: 0,
      stranded: 0, flood: 0, fire: 0, frost: 0, wind: 0, unknown: 0,
    },
  };
}

function createWorld(seed) {
  const cellCount = W * H;
  const resolvedSeed = seed ?? Math.floor(Math.random() * 1e9);
  const world = {
    meta: {
      volume: 1,
      tick: 0,
      simStartMs: Date.now(),
      lastToofanTick: 0,
      season: 'spring',
      seed: resolvedSeed,
      weather: 'clear',
      toofanPressure: 0,
      lastSavedTick: 0,
      lifetime: freshLifetime(),
    },
    // Seeded RNG. All Math.random() calls in sim.js/world.js/lab.js/genome.js
    // should go through world.rng() so (seed, config) → identical output.
    // The state is captured here as a non-enumerable property so it survives
    // structuredClone-ish save flows; persistence layer can serialise
    // world.rng.state alongside meta.seed for full save/load determinism.
    rng: createRng(resolvedSeed),
    shape: [W, H],
    grid: {
      kind:     new Uint8Array(cellCount),
      nutrient: new Uint8Array(cellCount),
      colony:   new Uint16Array(cellCount),
      age:      new Uint16Array(cellCount),
    },
    colonies: {},     // id -> { id, genome, foundedTick, cellCount, fruitCount, name?, alive }
    nextColonyId: 1,
    spores: [],       // { x, y, vx, vy, age, genome }
    fruits: [],       // { x, y, colonyId, age, mature, spent }
    events: [],       // recent {tick, kind, text} for snapshot context
    journal: [],      // Nigehban's entries (added in step 5)
  };
  // Trees (v2): saplings → mature trees → fall → become new log capsules.
  world.meta.trees = [];
  world.meta.nextTreeId = 1;
  paintBaseTerrain(world);
  addDeepNutrientPockets(world);
  generateLog(world);
  return world;
}

function addDeepNutrientPockets(world) {
  // Pockets carry all the soil-nutrient variation. The base soil is flat and
  // lean (~25), so anything worth absorbing in the soil band lives here.
  // Centres are biased toward the deep half of the band so mycelium has a
  // reason to tunnel downward. Soil persists across volumes — pockets are
  // generated once and slowly deplete forever.
  const { kind, nutrient } = world.grid;
  const rng = world.rng;
  const soilHeight = H - GRASS_Y;
  const pocketCount = 5 + Math.floor(rng() * 3); // 5–7
  for (let p = 0; p < pocketCount; p++) {
    const px = Math.floor(rng() * W);
    const depthFrac = 0.55 + rng() * 0.4; // 55–95% of soil band
    const py = GRASS_Y + Math.floor(depthFrac * soilHeight);
    const r = 8 + Math.floor(rng() * 6);  // 8–13 cells
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        const x = px + dx, y = py + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = y * W + x;
        if (kind[i] !== SOIL) continue;
        const falloff = 1 - Math.sqrt(d2) / r;
        nutrient[i] = Math.min(100, nutrient[i] + Math.floor(falloff * 65));
      }
    }
  }
}

function paintBaseTerrain(world) {
  const { kind, nutrient } = world.grid;
  const rng = world.rng;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y < GRASS_Y) {
        kind[i] = AIR;
        nutrient[i] = 0;
      } else if (y === GRASS_Y) {
        kind[i] = GRASS;
        // grass is the bridge between log and soil — needs enough nutrient
        // for hyphae to pass through without immediately dying back
        nutrient[i] = 25 + Math.floor(rng() * 10);
      } else {
        kind[i] = SOIL;
        // Flat, lean baseline. The substrate doesn't push hyphae any direction
        // on its own — variation lives in addDeepNutrientPockets, which seeds
        // rich seams in the lower soil band and gives mycelium a reason to
        // tunnel downward.
        nutrient[i] = 22 + Math.floor(rng() * 8);  // 22–29
      }
    }
  }
}

function generateLog(world) {
  const { kind, nutrient } = world.grid;
  const rng = world.rng;
  // Sized so the initial log feels like a fallen oak's worth of wood,
  // matching fellTree's output (oak maxHeight 50 → width ~80, thickness
  // ~16-22). Earlier 100-140 × 22-28 was ~2x bigger than any tree could
  // produce — read as comically massive against the world's tree scale.
  const logWidth  = 72 + Math.floor(rng() * 24);   // 72–96 cells
  const logHeight = 16 + Math.floor(rng() * 6);    // 16–22 cells thick
  const x0 = Math.floor((W - logWidth) / 2 + (rng() * 30 - 15));
  // Log sits ON the grass, no embedding. Bottom row of log = grass row above.
  const yTop = GRASS_Y - logHeight;

  // Internal nutrient bias pockets — a knot (nutrient-poor) and a dry pocket
  // (nutrient-rich) give the log a bit of texture for foragers. Kept local;
  // the rest of the sim never reads them.
  const zone = () => ({
    cx: x0 + Math.floor(rng() * logWidth),
    cy: yTop + Math.floor(rng() * logHeight),
    r:  6 + Math.floor(rng() * 4),
  });
  const knot = zone(), dry = zone();
  world.meta.logBounds = { x0, y0: yTop, w: logWidth, h: logHeight };

  // Renderer needs per-log bounds + species + age so it can paint species-specific
  // bark, moss patches, and aging tints. logs[] is the canonical list; logBounds
  // stays for back-compat (used by hyphae sowing).
  world.meta.logs = world.meta.logs || [];
  world.meta.logs.push({
    id: 1,
    x0, y0: yTop, w: logWidth, h: logHeight,
    species: 'oak',           // initial log is always oak for now
    foundedTick: 0,
    mossy: false,
  });
  world.meta.nextLogId = 2;

  // Horizontal capsule: rectangle core + semicircular caps on each end.
  // Reads as a proper side-view log silhouette.
  const r  = logHeight / 2;
  const cy = yTop + r;
  const xCoreL = x0 + r;
  const xCoreR = x0 + logWidth - r;

  for (let dy = 0; dy < logHeight; dy++) {
    for (let dx = 0; dx < logWidth; dx++) {
      const x = x0 + dx;
      const y = yTop + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;

      let inside = false;
      if (x >= xCoreL && x <= xCoreR) {
        // rectangular core
        inside = Math.abs(y - cy) <= r;
      } else if (x < xCoreL) {
        // left rounded cap
        inside = Math.hypot(x - xCoreL, y - cy) <= r;
      } else {
        // right rounded cap
        inside = Math.hypot(x - xCoreR, y - cy) <= r;
      }
      if (!inside) continue;

      const i = y * W + x;
      kind[i] = LOG;
      let n = 70 + Math.floor(rng() * 25);
      const dKnot = Math.hypot(x - knot.cx, y - knot.cy);
      const dDry  = Math.hypot(x - dry.cx,  y - dry.cy);
      if (dKnot < knot.r) n -= 30;
      if (dDry  < dry.r)  n += 10;
      nutrient[i] = Math.max(0, Math.min(100, n));
    }
  }
}

function sowAt(world, x, y, genome) {
  const i = y * W + x;
  const k = world.grid.kind[i];
  // viable substrate: log, soil, or grass (grass is the bridge between them)
  if (k !== LOG && k !== SOIL && k !== GRASS) return null;
  if (world.grid.colony[i] !== 0) return null;
  if (world.grid.nutrient[i] <= 0) return null;
  const id = world.nextColonyId++;
  const g = genome ?? randomGenome(world.rng);
  world.colonies[id] = {
    id,
    genome: g,
    foundedTick: world.meta.tick,
    cellCount: 1,
    fruitCount: 0,
    seasonsSurvived: 0,
    reserves: 0,
    // Placeholder name shown in UI until Nigehban grants a real one. Kept
    // separate from `name` so salience.js still treats the colony as nameable
    // (col.name remains undefined until Nigehban writes it).
    placeholderName: pickPlaceholderName(world.rng),
    alive: true,
  };
  world.grid.colony[i] = id;
  world.grid.age[i] = 0;
  if (world.meta.lifetime) world.meta.lifetime.births++;
  return id;
}

function logEvent(world, kind, text) {
  world.events.push({ tick: world.meta.tick, kind, text });
  if (world.events.length > 40) world.events.shift();
}

function neighborOffsets() {
  return [-W, W, -1, 1]; // N S W E
}

module.exports = {
  W, H, GRASS_Y, AIR, SOIL, GRASS, LOG, FRUIT, TREE,
  createWorld, sowAt, logEvent, neighborOffsets, freshLifetime,
};
