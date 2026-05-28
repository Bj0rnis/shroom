// Lab driver — runs a single scenario across N seeds, scores each run
// against a vision target, returns aggregated metrics. Pure node; uses
// the same lab.runScenario plumbing as the legacy /lab UI but with the
// rng-determinism foundation in place, so identical (seed, sim) → identical
// output.

const fs   = require('fs');
const path = require('path');
const lab  = require('../lab');

// v3: dump telemetry rows to NDJSON for offline reading. One file per
// seed per run, in $DATA_DIR/telemetry/. Cheap (1 row per ~hour of sim).
function dumpTelemetry(run, vision) {
  if (!run.telemetry || !run.telemetry.length) return null;
  const dir = path.join(process.env.DATA_DIR || '/tmp/shroom-lab-scratch', 'telemetry');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${vision.id}-seed${run.seed}-${run.id}.ndjson`);
  const out = run.telemetry.map(r => JSON.stringify({ seed: run.seed, ...r })).join('\n') + '\n';
  fs.writeFileSync(file, out);
  return file;
}

// Seed names — each seed determines an entire world (log position, substrate
// richness, every random decision the sim makes). We run the same mechanic
// across all five so improvements don't ride on a lucky world. Names describe
// what the world IS, not how it behaves under any particular mechanic.
//
//   fair-log     — typical log, balanced conditions, baseline world
//   rich-log     — log overflowing with food, prone to matting
//   multi-colony — founder splits into many over time, branching test
//   edge-spawn   — founder placed at edge geometry, boundary case
//   lean-log     — sparse food, starvation test
//
// Old names (nominal/stress/branch/edge/lean) appear in historical NOTES
// entries — preserved unrenamed for the audit trail. Going forward, use
// these descriptive names in reports, PRs, and new NOTES entries.
const SEED_PERSONALITIES = {
  42:   'fair-log',
  1337: 'rich-log',
  555:  'lean-log',
  314:  'multi-colony',
  271:  'edge-spawn',
};

const DEFAULT_SEEDS = [42, 1337, 314, 271, 555];

async function runVisionTarget(vision, opts = {}) {
  const seedSpec = opts.seeds ?? DEFAULT_SEEDS;
  // Normalize: accept [42, 1337, …] or [{seed: 42, tag: 'fair-log'}, …]
  const seeds = seedSpec.map(s => typeof s === 'number'
    ? { seed: s, tag: SEED_PERSONALITIES[s] || 'unknown' }
    : { seed: s.seed, tag: s.tag || SEED_PERSONALITIES[s.seed] || 'unknown' });
  const results = [];

  for (const { seed, tag } of seeds) {
    const run = await lab.runScenario(vision.scenarioId, { seed });
    const world = reconstructWorld(run);
    const telemetryFile = dumpTelemetry(run, vision);
    // v3: pass per-day snapshots + founder-only ascii to scorers via ctx.
    // Legacy scorers keep reading ctx.ascii; v3-aware scorers use
    // ctx.asciiSnapshots (array of {day, tick, ascii}) and ctx.founderAscii.
    const scores = vision.scorers.map(s => ({
      name: s.name,
      ...s.fn(world, s.opts || {}, {
        ascii:           run.ascii,
        founderAscii:    run.founderAscii,
        asciiSnapshots:  run.asciiSnapshots || [],
        founderColonyId: run.founderColonyId,
      }),
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
      founderAscii:    run.founderAscii,
      asciiSnapshots:  run.asciiSnapshots || [],
      founderColonyId: run.founderColonyId,
      telemetryFile,
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
