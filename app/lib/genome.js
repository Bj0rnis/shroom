// Shroom — genome
// 10-float gene vector per colony. Substitution-only mutation with
// scale-proportional perturbation (Evochora archaeology verdict #1).

const { createRng } = require('./rng');

const GENES = [
  { name: 'growth_rate',           min: 0.5, max: 2.0,   continuous: true },
  { name: 'spread_bias_nutrient',  min: 0,   max: 1,     continuous: true },
  { name: 'vertical_bias',         min: 0,   max: 1,     continuous: true },
  { name: 'fruit_threshold',       min: 0,   max: 1,     continuous: true },
  { name: 'decay_resistance',      min: 0,   max: 1,     continuous: true },
  { name: 'spore_count',           min: 2,   max: 8,     continuous: true },
  { name: 'cap_hue',               min: 0,   max: 360,   continuous: true },
  { name: 'cap_shape',             min: 0,   max: 3,     continuous: false }, // 0=round 1=conical 2=flat 3=frilly
  { name: 'cap_size',              min: 0.5, max: 2.0,   continuous: true },
  { name: 'stem_length',           min: 0.5, max: 2.0,   continuous: true },
];

const MUTATION_RATE_PER_GENE = 0.15;
const SHAPE_MUTATION_RATE    = 0.05;
const SCALE_EXPONENT         = 0.5;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// rng is an optional callable returning a float in [0, 1). Falls back to
// Math.random for callers that haven't been threaded yet (e.g. one-off CLI
// utilities). Sim and lab callers should always pass world.rng so output
// is deterministic for the (seed, config) pair.
function randomGenome(rng) {
  const r = rng || Math.random;
  return GENES.map(g => {
    if (g.continuous) return g.min + r() * (g.max - g.min);
    return Math.floor(r() * (g.max - g.min + 1)) + g.min;
  });
}

// Pinned reference genome — used by sim-lab vision tests so the loop can
// iterate on the mechanic without rolling the genome lottery. Live world
// still uses randomGenome with rng for natural variance; lab scenarios
// that want a pinned founder explicitly opt in.
//
// Values come from seed 1337's natural roll at iter-13 — the only genome
// that produced the painting (421 cells, 6/6 targets). Pinning all lab
// seeds to this DNA means we're testing the mechanic against a known-
// working phenotype rather than against the genome midpoint. iter-20.
const PINNED_DEFAULTS = {
  growth_rate:          1.95,
  spread_bias_nutrient: 0.51,
  vertical_bias:        0.06,
  fruit_threshold:      0.18,
  decay_resistance:     0.90,
  spore_count:          6.43,
  cap_hue:              359,
  cap_shape:            2,
  cap_size:             0.68,
  stem_length:          0.94,
};
function pinnedGenome(overrides = {}) {
  return GENES.map(g => {
    if (g.name in overrides) return overrides[g.name];
    if (g.name in PINNED_DEFAULTS) return PINNED_DEFAULTS[g.name];
    if (g.continuous) return (g.min + g.max) / 2;
    return g.min;
  });
}

// Genome variance (sim-lab/05). Starts from the pinned reference genome but
// applies per-colony tilts on selected genes so each founder has a distinct
// phenotype. Draws tilt values from an isolated RNG (not world.rng) seeded
// from the world seed — deterministic per (seed, scenario) without touching
// the simulation stream.
//
// iter-57: ±0.40 growth_rate and ±0.15 chemotaxis — too wide, most seeds collapsed.
// iter-58: ±0.20 growth_rate — still regressed; extra world.rng() call shuffled sim.
// iter-59: isolated RNG (worldSeed ^ 0xDEADCAFE); growth_rate ±0.30.
//          Confirmed isolation works, but growth_rate is a bifurcation parameter —
//          2.6% difference compounded over 28800 ticks → 4× cell count difference.
//          Not a useful lever; pivot needed.
// iter-60: pivot to vertical_bias (gene[2]). Re-activated in sim.js as a soil
//          descent weight multiplier. Vary it in [0, 0.8] per seed. This is a
//          directional geometry gene, not a probability scalar — effect is
//          predictable and monotone: higher value → stronger southward pull in soil.
//          growth_rate stays pinned at 1.95.
// iter-61: range tightened [0, 0.8] → [0, 0.3]. Max south-boost goes from 3.4×
//          to 1.9×. Hypothesis: lower ceiling preserves perpendicular-bias
//          lattice at the high end while still varying depth.
// iter-62: middle ground at [0, 0.5]. Max south-boost 2.5×. Probing whether
//          shape median recovers without losing iter-61's multipleDescents win.
//          Result: aggregate flat at 23, multipleDescents regressed — revert.
// iter-63: back to [0, 0.3] and stack a new mechanic (DLA edge preference) on top.
const GENOME_VARIANCE_VERTICAL_BIAS_MIN = 0.0;
const GENOME_VARIANCE_VERTICAL_BIAS_MAX = 0.3;

// Draw a varied genome for lab use. `worldSeed` is world.meta.seed — used to
// seed a separate RNG that doesn't touch the simulation's world.rng stream.
// The simulation plays out identically to the pinned baseline except the
// founder's vertical_bias (gene[2]) is drawn uniformly in [0, 0.8].
function variedGenome(worldSeed, overrides = {}) {
  // Mix the world seed with a magic constant so this stream is decorrelated
  // from the main simulation stream (which starts at createRng(worldSeed)).
  // The constant 0xDEAD_CAFE is arbitrary; what matters is it differs from 0.
  const r = createRng((worldSeed ^ 0xDEADCAFE) >>> 0);
  const tilts = {
    vertical_bias: GENOME_VARIANCE_VERTICAL_BIAS_MIN
      + r() * (GENOME_VARIANCE_VERTICAL_BIAS_MAX - GENOME_VARIANCE_VERTICAL_BIAS_MIN),
  };
  return GENES.map(g => {
    if (g.name in overrides) return overrides[g.name];
    if (g.name in tilts) return tilts[g.name];
    if (g.name in PINNED_DEFAULTS) return PINNED_DEFAULTS[g.name];
    if (g.continuous) return (g.min + g.max) / 2;
    return g.min;
  });
}

function mutate(parent, rng) {
  const r = rng || Math.random;
  const child = parent.slice();
  for (let i = 0; i < GENES.length; i++) {
    const g = GENES[i];
    if (!g.continuous) {
      if (r() < SHAPE_MUTATION_RATE) {
        const span = g.max - g.min + 1;
        const step = r() < 0.5 ? -1 : 1;
        child[i] = ((child[i] - g.min + step + span) % span) + g.min;
      }
      continue;
    }
    if (r() < MUTATION_RATE_PER_GENE) {
      const span = g.max - g.min;
      const eps  = 0.01 * span;
      const offsetFromMin = Math.abs(child[i] - g.min) + eps;
      const delta = Math.max(eps, Math.pow(offsetFromMin, SCALE_EXPONENT) * 0.1 * span / Math.pow(span, SCALE_EXPONENT));
      const perturb = (r() * 2 - 1) * delta;
      child[i] = clamp(child[i] + perturb, g.min, g.max);
    }
  }
  return child;
}

function genomeToObj(genome) {
  const o = {};
  GENES.forEach((g, i) => { o[g.name] = genome[i]; });
  return o;
}

function phenotypeWords(genome) {
  const o = genomeToObj(genome);
  const hue = o.cap_hue;
  const colorWord =
    hue < 30 ? 'red' :
    hue < 55 ? 'orange' :
    hue < 80 ? 'yellow-brown' :
    hue < 150 ? 'green' :
    hue < 200 ? 'teal' :
    hue < 260 ? 'blue' :
    hue < 320 ? 'violet' : 'pink';
  const shapeWord = ['round','conical','flat','frilly'][Math.floor(o.cap_shape)] || 'round';
  const sizeWord  = o.cap_size < 0.8 ? 'small' : o.cap_size > 1.4 ? 'large' : 'medium';
  return `${colorWord}, ${shapeWord}, ${sizeWord}`;
}

module.exports = {
  GENES,
  randomGenome,
  pinnedGenome,
  variedGenome,
  mutate,
  genomeToObj,
  phenotypeWords,
};
