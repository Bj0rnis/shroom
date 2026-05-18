// Shroom — genome
// 10-float gene vector per colony. Substitution-only mutation with
// scale-proportional perturbation (Evochora archaeology verdict #1).

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
  mutate,
  genomeToObj,
  phenotypeWords,
};
