// home-server Shroom — naming-candidate salience.
// Score = age*size base + bonus points for memorable behaviour.
// Surface top 3 unnamed colonies above threshold.

const { phenotypeWords } = require('./genome');
const { TICKS_PER_SIM_DAY } = require('./sim');

const THRESHOLD = 5;

function score(world, col) {
  if (!col.alive) return 0;
  if (col.name) return 0;
  const age = (world.meta.tick - col.foundedTick) / TICKS_PER_SIM_DAY;
  const size = col.cellCount;
  let s = (age * size) * 0.005;
  if (col.seasonsSurvived >= 1) s += 1.5;
  if (col.seasonsSurvived >= 2) s += 1.5;
  if (col.fruitCount >= 1)      s += 1.0;
  if (col.fruitCount >= 3)      s += 1.5;
  if (col.survivedWarning)      s += 2.0;
  if (col.outOfSeasonFruit)     s += 1.5;
  return s;
}

function rankCandidates(world, max = 3) {
  const items = [];
  for (const col of Object.values(world.colonies)) {
    const s = score(world, col);
    if (s < THRESHOLD) continue;
    items.push({
      candidate_id: `c${col.id}`,
      colony_id: col.id,
      score: s,
      phenotype: phenotypeWords(col.genome),
      cell_count: col.cellCount,
      age_days: Math.floor((world.meta.tick - col.foundedTick) / TICKS_PER_SIM_DAY),
      fruit_count: col.fruitCount,
      seasons_survived: col.seasonsSurvived || 0,
      notes: candidateNotes(col),
    });
  }
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, max);
}

function candidateNotes(col) {
  const out = [];
  if (col.seasonsSurvived >= 2) out.push(`survived ${col.seasonsSurvived} seasons`);
  if (col.fruitCount >= 3)      out.push(`fruited ${col.fruitCount} times`);
  if (col.survivedWarning)      out.push('survived a toofan-warning');
  if (col.outOfSeasonFruit)     out.push('fruited out of season');
  return out.join(', ');
}

module.exports = { score, rankCandidates };
