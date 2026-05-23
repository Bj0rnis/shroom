// Extended-window observation: grow a single colony at the current sim.js
// constants for N sim-days, snapshot ASCII at day boundaries. Probe for
// "does the painting geometry hold past day 1, or does the colony mat?"
//
// Run: node app/lib/sim-lab/grow-extended.js [seed] [days]
//   defaults: seed=1337, days=3
//
// One-shot — not part of the lab harness, doesn't persist. Useful for
// sanity-checking a parked config under longer time horizons before the
// next iteration class.

const { createWorld, sowAt, W, H, GRASS_Y, LOG } = require('../world');
const { randomGenome } = require('../genome');
const { tick } = require('../sim');
const { TICKS_PER_DAY } = require('../time');

const SEED = parseInt(process.argv[2], 10) || 1337;
const DAYS = parseInt(process.argv[3], 10) || 3;

function findLogCenter(world) {
  const { kind } = world.grid;
  for (let y = 0; y < H; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (kind[i] === LOG) { if (x0 < 0) x0 = x; x1 = x; }
    }
    if (x0 >= 0) return { x: ((x0 + x1) / 2) | 0, y };
  }
  return { x: (W / 2) | 0, y: GRASS_Y - 5 };
}

function asciiSnap(world, colId) {
  const { kind, colony } = world.grid;
  let minX = W, maxX = 0, maxY = 0;
  for (let i = 0; i < colony.length; i++) {
    if (colony[i] === colId) {
      const x = i % W, y = (i / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (minX > maxX) return '(empty)';
  const cx = ((minX + maxX) / 2) | 0;
  const x0 = Math.max(0, cx - 40), x1 = Math.min(W - 1, cx + 40);
  const y0 = Math.max(0, GRASS_Y - 8), y1 = Math.min(H - 1, maxY + 2);
  const lines = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (colony[i] === colId) row += '1';
      else if (colony[i] !== 0) row += '+'; // a child colony
      else if (kind[i] === LOG) row += '=';
      else if (y === GRASS_Y) row += '~';
      else if (y > GRASS_Y) row += '.';
      else row += ' ';
    }
    lines.push(row);
  }
  return lines.join('\n');
}

function countDescent(world, colId) {
  const { colony } = world.grid;
  let maxDepth = 0;
  const crossings = [];
  let run = 0;
  for (let x = 0; x < W; x++) {
    const i = GRASS_Y * W + x;
    if (colony[i] === colId) run++;
    else if (run > 0) { crossings.push(run); run = 0; }
  }
  if (run > 0) crossings.push(run);
  for (let i = 0; i < colony.length; i++) {
    if (colony[i] === colId) {
      const y = (i / W) | 0;
      if (y > GRASS_Y && y - GRASS_Y > maxDepth) maxDepth = y - GRASS_Y;
    }
  }
  // Collapse adjacent crossings into "descent columns" using a gap threshold
  const descents = crossings.length;
  return { maxDepth, descents };
}

console.log(`# extended-window observation`);
console.log(`# seed=${SEED}  days=${DAYS}  W×H=${W}×${H}  TICKS_PER_DAY=${TICKS_PER_DAY}`);

const w = createWorld(SEED);
const center = findLogCenter(w);
const id = sowAt(w, center.x, center.y, randomGenome(w.rng));
console.log(`# founder at (${center.x}, ${center.y}) → colony ${id}\n`);

for (let d = 1; d <= DAYS; d++) {
  for (let t = 0; t < TICKS_PER_DAY; t++) tick(w);
  const col = w.colonies[id];
  const allHyphae = Object.values(w.colonies).reduce((s, c) => s + (c.cellCount || 0), 0);
  const alive = Object.values(w.colonies).filter(c => c.alive).length;
  const fruits = w.fruits ? w.fruits.filter(f => !f.spent).length : 0;
  const fruitsTotal = w.meta.lifetime?.fruitsTotal || 0;
  if (!col || !col.alive) {
    console.log(`## day ${d}: founder DIED  (other colonies alive=${alive}, totalHyphae=${allHyphae})`);
    console.log(asciiSnap(w, id));
    continue;
  }
  const desc = countDescent(w, id);
  console.log(`## day ${d}`);
  console.log(`founder: cells=${col.cellCount}  leaders=${col.leaders?.length || 0}  reserves=${col.reserves}  fruits=${col.fruitCount || 0}`);
  console.log(`world  : aliveColonies=${alive}  totalHyphae=${allHyphae}  activeFruits=${fruits}  fruitsTotal=${fruitsTotal}`);
  console.log(`geom   : descents=${desc.descents}  maxDepth=${desc.maxDepth} rows`);
  console.log(asciiSnap(w, id));
  console.log();
}
