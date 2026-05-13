// home-server Shroom — time anchors.
//
// Time constants are anchored in TICKS, calibrated so that 1 sim day = 1 real
// day at the canonical TICK_INTERVAL_MS of 3000. We talk to humans in real
// days / weeks / months; the sim talks to itself in ticks.
//
// Drop TICK_INTERVAL_MS lower to accelerate for testing — math stays valid,
// real-world wall clock just runs faster relative to sim time.

const CANONICAL_TICK_MS = 3000;
const CANONICAL_TICKS_PER_SECOND = 1000 / CANONICAL_TICK_MS; // 0.333…

const TICKS_PER_MINUTE = 60  * CANONICAL_TICKS_PER_SECOND;   // 20
const TICKS_PER_HOUR   = 60  * TICKS_PER_MINUTE;             // 1,200
const TICKS_PER_DAY    = 24  * TICKS_PER_HOUR;               // 28,800
const TICKS_PER_WEEK   = 7   * TICKS_PER_DAY;                // 201,600
const TICKS_PER_MONTH  = 30  * TICKS_PER_DAY;                // 864,000
const TICKS_PER_YEAR   = 365 * TICKS_PER_DAY;                // 10,512,000

// Seasons map onto real seasons (~quarter year each).
const DAYS_PER_SEASON  = 91;
const TICKS_PER_SEASON = DAYS_PER_SEASON * TICKS_PER_DAY;    // 2,620,800

function ticksToHuman(ticks) {
  if (ticks < TICKS_PER_HOUR)  return `${Math.floor(ticks / TICKS_PER_MINUTE)} min`;
  if (ticks < TICKS_PER_DAY)   return `${(ticks / TICKS_PER_HOUR).toFixed(1)} h`;
  if (ticks < TICKS_PER_WEEK)  return `${(ticks / TICKS_PER_DAY).toFixed(1)} days`;
  if (ticks < TICKS_PER_MONTH) return `${(ticks / TICKS_PER_WEEK).toFixed(1)} weeks`;
  if (ticks < TICKS_PER_YEAR)  return `${(ticks / TICKS_PER_MONTH).toFixed(1)} months`;
  return `${(ticks / TICKS_PER_YEAR).toFixed(2)} years`;
}

function ticksToDays(ticks)   { return ticks / TICKS_PER_DAY; }
function ticksToMonths(ticks) { return ticks / TICKS_PER_MONTH; }
function daysToTicks(days)    { return days * TICKS_PER_DAY; }

module.exports = {
  TICKS_PER_MINUTE, TICKS_PER_HOUR, TICKS_PER_DAY,
  TICKS_PER_WEEK, TICKS_PER_MONTH, TICKS_PER_YEAR,
  TICKS_PER_SEASON, DAYS_PER_SEASON,
  ticksToHuman, ticksToDays, ticksToMonths, daysToTicks,
};
