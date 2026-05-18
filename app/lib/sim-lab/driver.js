// Lab driver — runs a single scenario across N seeds, scores each run
// against a vision target, returns aggregated metrics. Pure node; uses
// the same lab.runScenario plumbing as the legacy /lab UI but with the
// rng-determinism foundation in place, so identical (seed, sim) → identical
// output.

const lab = require('../lab');

async function runVisionTarget(vision, opts = {}) {
  const seeds = opts.seeds ?? [42, 1337, 314, 271, 555];
  const results = [];

  for (const seed of seeds) {
    const run = await lab.runScenario(vision.scenarioId, { seed });
    const world = reconstructWorld(run);
    const scores = vision.scorers.map(s => ({
      name: s.name,
      ...s.fn(world, s.opts || {}),
    }));
    const passed = scores.filter(s => s.ok).length;
    results.push({
      seed,
      runId: run.id,
      ticks: run.metrics.tick,
      coloniesAlive: run.metrics.coloniesAlive,
      hyphaeCells: run.metrics.hyphaeCells,
      maxColonyCells: run.metrics.maxColonyCells,
      fruitsTotal: run.metrics.births != null
        ? (run.metrics.deathsTotal != null ? (world.meta.lifetime?.fruitsTotal || 0) : 0)
        : 0,
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

  return { vision, seeds, results, aggregate };
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

module.exports = { runVisionTarget };
