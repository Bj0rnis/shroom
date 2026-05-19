// Light smoke tests for the lab plumbing. Not unit tests in the strict
// sense — these verify the foundation holds: RNG determinism, scorer
// behaviour on synthetic worlds, and that the driver/report pipeline
// runs end-to-end without crashing.
//
// Run with: node app/lib/sim-lab/test.js
// Exits non-zero on any failure so CI / future agents can gate on it.

const { createRng } = require('../rng');
const { createWorld, sowAt, W, H, GRASS_Y, LOG, SOIL, GRASS } = require('../world');
const { randomGenome } = require('../genome');
const { tick } = require('../sim');
const targets = require('./targets');
const driver = require('./driver');
const { renderReport } = require('./report');
const { renderMarkdown } = require('./render');

let failures = 0;
function expect(name, cond, detail = '') {
  if (cond) {
    process.stdout.write(`  ✓ ${name}\n`);
  } else {
    process.stdout.write(`  ✗ ${name}${detail ? ' — ' + detail : ''}\n`);
    failures++;
  }
}

// ── RNG determinism ─────────────────────────────────────
process.stdout.write('rng\n');
{
  const a = createRng(42);
  const b = createRng(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  expect('same seed → same sequence', JSON.stringify(seqA) === JSON.stringify(seqB));

  const c = createRng(43);
  expect('different seed → different sequence', c() !== seqA[0]);

  const d = createRng(42);
  d(); d(); d();
  const saved = d.state;
  d(); d(); d();
  const expected = d();
  const e = createRng(42);
  e(); e(); e();
  e.state = saved;
  e(); e(); e();
  expect('state save/restore round-trips', e() === expected);
}

// ── Determinism end-to-end ──────────────────────────────
process.stdout.write('sim determinism\n');
{
  function run(seed) {
    const w = createWorld(seed);
    sowAt(w, 150, 50, randomGenome(w.rng));
    for (let i = 0; i < 1000; i++) tick(w);
    return Object.values(w.colonies).reduce((s, c) => s + (c.cellCount || 0), 0);
  }
  const a = run(42), b = run(42), c = run(42);
  expect('3× same seed → identical cell count', a === b && b === c, `${a} vs ${b} vs ${c}`);
  const d = run(99);
  expect('different seed → different cell count', a !== d);
}

// ── Baseline guards ─────────────────────────────────────
// Snapshot of physics on current `main`. Each entry is a (seed, ticks) →
// expected (cells, fruits, deaths) tuple. If you intentionally change a
// sim constant or mechanic, re-run the probe and update these numbers in
// the same PR. If they drift without intent, the change broke something.
//
// Probe: node -e "see app/lib/sim-lab/test.js BASELINES"
process.stdout.write('baseline guards\n');
{
  const BASELINES = [
    { seed: 42,   ticks: 5000, cells: 416, fruits: 0, deaths: 0 },
    { seed: 1337, ticks: 5000, cells: 451, fruits: 0, deaths: 0 },
    { seed: 555,  ticks: 5000, cells: 399, fruits: 0, deaths: 0 },
  ];
  for (const b of BASELINES) {
    const w = createWorld(b.seed);
    sowAt(w, 150, 50, randomGenome(w.rng));
    for (let i = 0; i < b.ticks; i++) tick(w);
    const cells = Object.values(w.colonies).reduce((s, c) => s + (c.cellCount || 0), 0);
    const fruits = w.meta?.lifetime?.fruitsTotal || 0;
    const deaths = Object.values(w.meta?.lifetime?.deathsByCause || {}).reduce((s, n) => s + n, 0);
    expect(`seed ${b.seed} @ ${b.ticks} ticks: ${b.cells} cells`,
      cells === b.cells, `got ${cells}`);
    expect(`seed ${b.seed} @ ${b.ticks} ticks: ${b.fruits} fruits`,
      fruits === b.fruits, `got ${fruits}`);
    expect(`seed ${b.seed} @ ${b.ticks} ticks: ${b.deaths} deaths`,
      deaths === b.deaths, `got ${deaths}`);
  }
}

// ── Scorers on synthetic worlds ─────────────────────────
process.stdout.write('scorers\n');
function makeSyntheticWorld({ cells = [], lifetime = {} } = {}) {
  const colony = new Uint16Array(W * H);
  const kind = new Uint8Array(W * H);
  // Paint substrate: log over grass row, soil below.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y < GRASS_Y) kind[i] = 0; // air
      else if (y === GRASS_Y) kind[i] = GRASS;
      else kind[i] = SOIL;
    }
  }
  // Paint a log band rows 50-62.
  for (let y = 50; y <= 62; y++) for (let x = 130; x <= 200; x++) kind[y * W + x] = LOG;
  // Place colony cells.
  for (const [x, y] of cells) colony[y * W + x] = 1;
  return {
    meta: { tick: 28800, lifetime: { fruitsTotal: 0, ...lifetime } },
    grid: { colony, kind },
    colonies: { 1: { id: 1, alive: true, cellCount: cells.length } },
  };
}

{
  const w = makeSyntheticWorld({ cells: Array.from({ length: 400 }, (_, k) => [150 + (k % 20), 60 + Math.floor(k / 20) * 2]) });
  const r = targets.modestSize(w, { min: 150, max: 800 });
  expect('modestSize accepts 400 cells', r.ok, r.note);
}
{
  const w = makeSyntheticWorld({ cells: [[150, 60], [151, 60]] });
  const r = targets.modestSize(w, { min: 150, max: 800 });
  expect('modestSize rejects 2 cells', !r.ok, r.note);
}
{
  // Sparse network: 50 cells over a 20×20 bbox → density 0.125
  const cells = [];
  for (let n = 0; n < 50; n++) cells.push([130 + (n * 3) % 20, 70 + Math.floor(n / 7)]);
  const w = makeSyntheticWorld({ cells });
  const r = targets.branchedDensity(w, { min: 0.05, max: 0.40 });
  expect('branchedDensity passes for sparse network', r.ok, r.note);
}
{
  // Dense blob: every cell in a 10×10 → density 1.0
  const cells = [];
  for (let y = 70; y < 80; y++) for (let x = 130; x < 140; x++) cells.push([x, y]);
  const w = makeSyntheticWorld({ cells });
  const r = targets.branchedDensity(w, { min: 0.05, max: 0.40 });
  expect('branchedDensity rejects dense blob', !r.ok, r.note);
}
{
  // Two grass-crossings at x=140 and x=170
  const cells = [];
  for (let y = 60; y <= 70; y++) { cells.push([140, y]); cells.push([170, y]); }
  const w = makeSyntheticWorld({ cells });
  const r = targets.multipleDescentPoints(w, { min: 2 });
  expect('multipleDescentPoints counts 2 crossings', r.ok, `n=${r.value}`);
}
{
  // Cells only on log (y=55), none below grass
  const cells = Array.from({ length: 30 }, (_, k) => [140 + k, 55]);
  const w = makeSyntheticWorld({ cells });
  const r = targets.descended(w, { min: 5 });
  expect('descended rejects log-only colony', !r.ok, r.note);
}
{
  const w = makeSyntheticWorld({ cells: [], lifetime: { fruitsTotal: 50 } });
  const r = targets.noPrematureFruit(w, { maxByEnd: 3 });
  expect('noPrematureFruit rejects 50 fruits', !r.ok, r.note);
}

// ── Driver end-to-end ───────────────────────────────────
process.stdout.write('driver pipeline\n');
(async () => {
  // Send any lab persistence to a scratch dir
  process.env.DATA_DIR = '/tmp/shroom-lab-test';
  require('fs').mkdirSync(process.env.DATA_DIR, { recursive: true });

  const tinyVision = {
    ...targets.VISION_1_DAY1_ROOT,
    scenarioId: 'first-day-on-log',
    scorers: targets.VISION_1_DAY1_ROOT.scorers.slice(0, 2), // keep tests fast
  };
  const outcome = await driver.runVisionTarget(tinyVision, { seeds: [42, 99] });
  expect('driver returns 2 results for 2 seeds', outcome.results.length === 2);
  expect('aggregate has both scorers',
    Object.keys(outcome.aggregate).length === 2);
  expect('seed 42 tagged nominal',
    outcome.results.find(r => r.seed === 42).tag === 'nominal');
  expect('seed 99 tagged unknown',
    outcome.results.find(r => r.seed === 99).tag === 'unknown');
  const md = renderReport(outcome, { label: 'test' });
  expect('report includes target table', md.includes('| target | pass'));
  expect('report includes ASCII final shape', md.includes('## final shape'));
  expect('report includes regime column', md.includes('| seed | regime |'));

  // Compare mode: re-run, render with prior, expect delta columns
  const outcome2 = await driver.runVisionTarget(tinyVision, { seeds: [42, 99] });
  const md2 = renderReport(outcome2, { label: 'test2', prior: outcome, priorLabel: 'test' });
  expect('compare adds ∆pass column', md2.includes('∆pass'));
  expect('compare adds ∆median column', md2.includes('∆median'));
  expect('compare shows · for identical run',
    md2.match(/\| [^|]+ \| 0\/2 \| · \|/) || md2.match(/\| ·/));

  // ── Markdown renderer ────────────────────────────────
  process.stdout.write('render\n');
  expect('headings render',  renderMarkdown('# Hi').includes('<h1>Hi</h1>'));
  expect('bold renders',     renderMarkdown('**x**').includes('<strong>x</strong>'));
  expect('italic _ renders', renderMarkdown('a _b_ c').includes('<em>b</em>'));
  expect('italic * renders', renderMarkdown('a *b* c').includes('<em>b</em>'));
  expect('code renders',     renderMarkdown('`x`').includes('<code>x</code>'));
  expect('code block renders', renderMarkdown('```\nabc\n```').includes('<pre><code>abc</code></pre>'));
  expect('table renders',    renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |').includes('<table>'));
  expect('escaping works',   !renderMarkdown('<script>').includes('<script>'));

  process.stdout.write(`\n${failures === 0 ? 'all tests passed' : failures + ' FAILED'}\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
