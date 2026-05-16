// home-server Shroom — observability.
// Append-only NDJSON logs so we can analyze a day's run with jq/sqlite.
// Never throws — sim must never fail because logging failed.

const fs   = require('fs');
const path = require('path');
const { DATA_DIR } = require('./persistence');
const { TICKS_PER_DAY, ticksToHuman } = require('./time');
const { LOG: LOG_KIND, SOIL: SOIL_KIND } = require('./world');
const { phenotypeWords } = require('./genome');

const METRICS_PATH  = path.join(DATA_DIR, 'metrics.ndjson');
const COLONIES_PATH = path.join(DATA_DIR, 'colonies.ndjson');
const NIGEHBAN_PATH = path.join(DATA_DIR, 'nigehban.log');

function append(p, obj) {
  try { fs.appendFileSync(p, JSON.stringify(obj) + '\n'); } catch {}
}

function recordMetrics(world) {
  const { kind, nutrient } = world.grid;
  let logCells = 0, logNutSum = 0;
  let soilCells = 0, soilNutSum = 0;
  for (let i = 0; i < kind.length; i++) {
    if (kind[i] === LOG_KIND)       { logCells++;  logNutSum  += nutrient[i]; }
    else if (kind[i] === SOIL_KIND) { soilCells++; soilNutSum += nutrient[i]; }
  }
  const alive = Object.values(world.colonies).filter(c => c.alive);
  append(METRICS_PATH, {
    ts: new Date().toISOString(),
    tick: world.meta.tick,
    vol: world.meta.volume,
    season: world.meta.season,
    weather: world.meta.weather,
    alive: alive.length,
    hyphae: alive.reduce((s, c) => s + c.cellCount, 0),
    spores: world.spores.length,
    fruits: world.fruits.filter(f => !f.spent).length,
    toofanPressure: Number((world.meta.toofanPressure || 0).toFixed(3)),
    avgLogNutrient: logCells ? Math.round(logNutSum / logCells) : 0,
    avgSoilNutrient: soilCells ? Math.round(soilNutSum / soilCells) : 0,
    logCells,
  });
}

function recordColonies(world) {
  const tick = world.meta.tick;
  const ts   = new Date().toISOString();
  for (const c of Object.values(world.colonies)) {
    if (!c.alive) continue;
    const ageTicks = tick - c.foundedTick;
    append(COLONIES_PATH, {
      ts, tick,
      vol: world.meta.volume,
      id: c.id,
      name: c.name || c.placeholderName || null,
      cells: c.cellCount,
      ageDays: +(ageTicks / TICKS_PER_DAY).toFixed(2),
      ageHuman: ticksToHuman(ageTicks),
      fruits: c.fruitCount,
      seasonsSurvived: c.seasonsSurvived || 0,
      blighted: !!c.blightedUntil,
      spared:   !!c.sparedUntil,
    });
  }
}

// One-shot record when a colony dies. Captures cause-of-death attribution.
function recordDeath(world, c) {
  const tick = world.meta.tick;
  const ageTicks = tick - c.foundedTick;
  append(COLONIES_PATH, {
    ts: new Date().toISOString(),
    tick,
    vol: world.meta.volume,
    id: c.id,
    name: c.name || c.placeholderName || null,
    death: true,
    deathCause: c.deathCause || 'unknown',
    deathCounts: c.deathCounts || {},
    lifespanTicks: ageTicks,
    lifespanDays: +(ageTicks / TICKS_PER_DAY).toFixed(2),
    lifespanHuman: ticksToHuman(ageTicks),
    seasonsSurvived: c.seasonsSurvived || 0,
    fruits: c.fruitCount || 0,
    phenotype: phenotypeWords(c.genome),
  });
}

function recordNigehban(entry) {
  append(NIGEHBAN_PATH, { ts: new Date().toISOString(), ...entry });
}

module.exports = { recordMetrics, recordColonies, recordDeath, recordNigehban };
