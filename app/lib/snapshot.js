// Shroom — Nigehban's snapshot.
// Compact JSON the LLM reads. Phenotype words, not raw genomes.
// Target ~500 tokens.

const { phenotypeWords } = require('./genome');
const { rankCandidates } = require('./salience');
const { TICKS_PER_DAY, ticksToHuman } = require('./time');

// Kept as a helper for callers that still think in "days". 1 sim day = 1 real day.
function simDay(world) { return Math.floor(world.meta.tick / TICKS_PER_DAY); }

function stockholmTimeOfDay() {
  // Per HANDOVER §2: visual clock is real Stockholm time.
  try {
    return new Intl.DateTimeFormat('en-SE', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Stockholm', hour12: false,
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(11, 16);
  }
}

function colonyState(col) {
  if (!col.alive) return 'dying';
  if (col.cellCount < 30)  return 'young';
  if (col.cellCount < 150) return 'growing';
  return 'mature';
}

function colonyLocation(world, col) {
  // Lightweight cue — average position of hyphae cells. Returns "mid-log",
  // "near-knot", "wet-patch", etc. v1 keeps it crude: "in the log" / "in soil".
  // Without scanning the grid every snapshot, fall back to a generic phrase.
  return 'on the log';
}

// Wake reasons that warrant showing him the action toolbox. On a periodic
// wake we hide it — keeps him watching, not casting about for something to do.
const ACTION_WAKE_REASONS = new Set([
  'colony-death', 'first-fruit', 'toofan', 'toofan-warning',
  'empty-world', 'manual-wake',
]);

function buildSnapshot(world, journal, hall, recentEvents, reason) {
  const day = simDay(world);
  const daysSinceLastToofan = day - simDay({ meta: { tick: world.meta.lastToofanTick } });
  const showActions = ACTION_WAKE_REASONS.has(reason);

  // Named colonies — those with a name set
  const named = Object.values(world.colonies)
    .filter(c => c.alive && c.name)
    .map(c => {
      const ageTicks = world.meta.tick - c.foundedTick;
      return {
        name: c.name,
        age:      ticksToHuman(ageTicks),
        age_days: +(ageTicks / TICKS_PER_DAY).toFixed(1),
        size: c.cellCount < 30 ? 'small' : c.cellCount < 150 ? 'medium' : 'large',
        phenotype: phenotypeWords(c.genome),
        state: colonyState(c),
        location: colonyLocation(world, c),
        fruit_count: c.fruitCount,
        notable: c.notable || null,
      };
    });

  // Recent events — last ~10 lines, plain text. Time anchored in real days.
  const eventLines = (recentEvents || world.events || [])
    .slice(-10)
    .map(e => {
      const ageTicks = world.meta.tick - e.tick;
      const when = ageTicks < TICKS_PER_DAY
        ? ticksToHuman(ageTicks) + ' ago'
        : `${(ageTicks / TICKS_PER_DAY).toFixed(1)} days ago`;
      return `${when}: ${e.text}`;
    });

  // His recent journal entries (last 8)
  const hisEntries = (journal || []).slice(-8).map(j => j.text);

  // Hall of fame summary
  const hallSummary = (hall || []).slice(-6).map(h => ({
    name: h.name,
    volume: h.volume,
    phenotype: h.phenotype,
    reason: h.reason,
  }));

  // Naming candidates
  const candidates = rankCandidates(world, 3);

  // Action availability per cooldowns
  const tools = world.tools || {};
  const sowUsed   = tools.sowUsedInVolume === world.meta.volume;
  const kindleUsed = tools.kindleUsedInSeason === world.meta.season;
  const blightUsed = tools.blightUsedInSeason === world.meta.season;
  const spareUsed  = tools.spareUsedInSeason  === world.meta.season;

  const out = {
    world: {
      era:    world.meta.volume,
      day,
      days_since_last_toofan: Math.max(0, daysSinceLastToofan),
      season: world.meta.season,
      time_of_day: stockholmTimeOfDay(),
      weather: world.meta.weather || 'clear',
      toofan_pressure: Number(world.meta.toofanPressure?.toFixed(2) || 0),
    },
    named_colonies: named,
    recent_events: eventLines,
    his_recent_entries: hisEntries,
    hall_of_fame: hallSummary,
    naming_candidates: candidates,
  };
  if (showActions) {
    out.actions_available = {
      sow:    !sowUsed,
      kindle: !kindleUsed,
      blight: !blightUsed,
      spare:  !spareUsed,
    };
  }
  return out;
}

module.exports = { buildSnapshot, simDay };
