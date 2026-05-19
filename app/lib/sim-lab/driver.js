// Lab driver — runs a single scenario across N seeds, scores each run
// against a vision target, returns aggregated metrics. Pure node; uses
// the same lab.runScenario plumbing as the legacy /lab UI but with the
// rng-determinism foundation in place, so identical (seed, sim) → identical
// output.

const lab = require('../lab');

// Seed personalities — observed regimes across iters 1-10 of sim-lab/01.
// `nominal` produces a clean branched founder; `stress` saturates into mat;
// `lean` tends to die or stay tiny; `branch` is the painting-shape outlier;
// `edge` is the noisy boundary case. Used by the report to group results
// by regime instead of by raw seed number.
const SEED_PERSONALITIES = {
  42:   'nominal',
  1337: 'stress',
  555:  'lean',
  314:  'branch',
  271:  'edge',
};

const DEFAULT_SEEDS = [42, 1337, 314, 271, 555];

async function runVisionTarget(vision, opts = {}) {
  const seedSpec = opts.seeds ?? DEFAULT_SEEDS;
  // Normalize: accept [42, 1337, …] or [{seed: 42, tag: 'nominal'}, …]
  const seeds = seedSpec.map(s => typeof s === 'number'
    ? { seed: s, tag: SEED_PERSONALITIES[s] || 'unknown' }
    : { seed: s.seed, tag: s.tag || SEED_PERSONALITIES[s.seed] || 'unknown' });
  const results = [];

  for (const { seed, tag } of seeds) {
    const run = await lab.runScenario(vision.scenarioId, { seed });
    const world = reconstructWorld(run);
    const scores = vision.scorers.map(s => ({
      name: s.name,
      ...s.fn(world, s.opts || {}, { ascii: run.ascii }),
    }));
    const passed = scores.filter(s => s.ok).length;
    results.push({
      seed,
      tag,
      runId: run.id,
      ticks: run.metrics.tick,
      coloniesAlive: run.metrics.coloniesAlive,
      hyphaeCells: run.metrics.hyphaeCells,
      maxColonyCells: run.metrics.maxColonyCells,
      fruitsTotal: world.meta.lifetime?.fruitsTotal ?? 0,
      ascii: run.ascii,
      scores,
      passedTargets: passed,
      totalTargets: vision.scorers.length,
    });
  }

  // Aggregates across seeds.
  const aggregate = {};
  for (const s of vision.scorers) {
    const vals = results.map(r => r.scores.find(x => x.name === s.name).value);
    vals.sort((a, b) => a - b);
    aggregate[s.name] = {
      min: vals[0],
      median: vals[Math.floor(vals.length / 2)],
      max: vals[vals.length - 1],
      passCount: results.filter(r => r.scores.find(x => x.name === s.name).ok).length,
      passRate: results.filter(r => r.scores.find(x => x.name === s.name).ok).length / results.length,
    };
  }

  return { vision, seeds: seeds.map(s => s.seed), seedSpecs: seeds, results, aggregate };
}

// lab.runScenario returns a serialised run with the snapshot's kind+colony
// as base64-encoded typed arrays. Unpack into a world-shaped object the
// scorer helpers can read.
function reconstructWorld(run) {
  const snap = run.snapshot;
  if (!snap || !snap.kind || !snap.colony) {
    throw new Error('snapshot missing kind/colony — driver requires full grid snapshot');
  }

  const kind   = new Uint8Array(Buffer.from(snap.kind, 'base64'));
  const colony = new Uint16Array(new Uint8Array(Buffer.from(snap.colony, 'base64')).buffer);

  const colonies = {};
  for (const c of run.colonies || []) colonies[c.id] = { ...c };

  return {
    meta: snap.meta || {
      tick: run.metrics.tick,
      lifetime: { fruitsTotal: 0, deathsByCause: run.metrics.deathsByCause || {} },
    },
    grid: { kind, colony },
    colonies,
  };
}

module.exports = { runVisionTarget, SEED_PERSONALITIES, DEFAULT_SEEDS };
