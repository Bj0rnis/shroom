# Shroom · Lab · Research

This is the readable paper. Vision targets are defined here, with the
reasoning behind each one. When a finding lands in `sim.js` on `main`, the
relevant section is updated. The terse session-by-session work lives in
`NOTES.md`; this file is for understanding *what we're trying to grow*.

---

## Lab philosophy

The shroom sim has many tunable constants and a few mechanisms whose
emergent output is hard to predict. We pick a **vision target** — a
qualitative shape the world should produce — and translate it into
numeric scorers a run can be judged against. Then we iterate: edit
mechanics, run the lab over a fixed seed set, read the report, decide
the next move.

The seeded RNG (`app/lib/rng.js`, mulberry32) makes `(seed, sim)` →
identical output, so a single seed sweep across 5 seeds gives a real
signal instead of noise. The seed set is small on purpose — the lab is
for fast feedback, not statistical rigor. If a config passes targets
on 5 seeds, that's enough to ship to a longer run on the live world.

Findings only graduate into `sim.js` on `main` when they pass the
target across the seed set AND match the vision when watched. The
journal here writes a section explaining *why* a change worked.

Iteration is not bound to tuning the existing knobs. If a vision target
keeps failing because the *design space* is missing a mechanism — a
pressure, a feedback loop, a trait — add the mechanism. Inter-colony
predation, genome selection effects, environmental gradients we haven't
modelled — all are fair game. The lab is the right place to prototype
them; this file is where they're written up when they prove their worth.

---

## Vision 1 — day-1 root

The simulation's foundational scenario: one spore sown at the centre of
the initial log. After 1 sim-day (28,800 ticks), the founding colony
should look like a **young branched root system** — not a saturating
mat, not a single thread, not a tight blob.

### Painting (target)

Hand-drawn by the maintainer (May 2026), rotated 90° clockwise so the painting's
vertical log maps to the sim's horizontal log at the top of the canvas.
The colony is bigger than its on-log marks alone — it continues *past
the grass row* into the upper soil, with two visible descent points
that each fork into Y-branched roots.

### My ASCII reading of the target

```
                            ====1=1==================                           
                            ===11=11=================                           
                            ====1=1==================                           
                            ====1===1================                           
~~~~~~~~~~~~~~~~~~~~~~~~~~~~====1===1================~~~~~~~~~~~~~~~~~~~~~~~~~~~
................................1...1..........................................
................................1...1..........................................
...............................1.....1.........................................
..............................1.......1........................................
.............................1.1.....1.1.......................................
............................1...1...1...1......................................
...........................1.....1.1.....1.....................................
..........................1.......1.......1....................................
.........................1.1.....1.1.....1.1...................................
........................1...1...1...1...1...1..................................
.......................1.....1.1.....1.1.....1.................................
......................1.......1.......1.......1................................
```

Approved (May 18). Real sim output will be lumpier, asymmetric, and may
spread further laterally — the ASCII is qualitative, not prescriptive.
Lateral growth to the left and right of the log centre is welcome; only
the qualitative properties below have to hold.

### Numeric scorers

In `targets.js` as `VISION_1_DAY1_ROOT`. Each is run on every seed and
either passes or fails. A config passes the vision when *all* targets
pass on a majority of the seed set (3+ of 5).

| target | scorer | criterion | reason |
|---|---|---|---|
| modestSize | `modestSize` | colony cells in [150, 800] | Not 24,000 (saturation). Not 30 (died). The range covers "small but structured network." |
| branchedDensity | `branchedDensity` | cells / bbox area in [0.10, 0.40] | Below 0.10 is single threads; above 0.40 is blob fill. Real root systems sit in this band. |
| descended | `descended` | colony reaches ≥5 rows below grass | The colony has to *go down* — log-surface colonies don't count as vision-1. |
| multipleDescents | `multipleDescentPoints` | ≥2 distinct cell-runs cross the grass row | Two visible descent points is the painting's signature. One is a thread; two is a root. |
| noPrematureFruit | `noPrematureFruit` | ≤3 fruits across the full sim-day | A founder shouldn't fruit before it's built a network. Premature fruiting → premature children → competing mats. |
| notSaturated | `notSaturated` | alive cells / substrate cells ≤20% | World shouldn't be a `1` mat. Plenty of empty substrate stays untouched. |

### Status

_In progress — early scorer pass at iter-20 was misleading._

iter-20 cleared all six original scorers (modestSize, branchedDensity,
descended, multipleDescents, noPrematureFruit, notSaturated) but the
resulting grids weren't the painting — they were dense caps on the log
with single fat taps, not a branched root system. The scorers were
counting "≥2 grass-crossings within the bbox" and "bbox density in
range," which a stake-with-a-cap can pass without producing any
network behaviour in the soil.

**Real status: shape scoring is being rebuilt.** A new `shape.js`
extracts structural features directly from the painting ASCII and
from each run's ASCII, then compares them. The vision will pass when
the shape score crosses a meaningful threshold, not when arbitrary
numeric proxies clear. See `NOTES.md` for the in-flight work; the
sim-side mechanic stack from iter-1..20 stays as a reasonable
starting point for the next iter cycle.

#### Configurations explored so far (not yet passing the real bar)

- **Leader-cells** (sim-lab/01 iter-1, iter-5): a few designated tips
  extend fast, rest crawl, leaders age out after 60 grows.
- **Colony carrying capacity** (sim-lab/02 iter-13): soft brake
  `cap=1500`, `softness=1` on extension prob.
- **Substrate-aware sow** (sim-lab/02 iter-17): plant on richest log
  cell in each spore's column.
- **Pinned genome for tests** (sim-lab/02 iter-20): lab seeds use a
  fixed reference genome. Removes the genome lottery from the test
  signal.

Live world still uses `randomGenome()` — natural variance preserved
outside the lab.

#### Latest park (sim-lab/03 iter-10)

Founder gets a 50-reserve head start at sow (was 0) — solves the
lean-seed bootstrap stall. Combined with the iter-4 frontier-revival
bugfix (renewal of leaders when the cohort senesces), the day-1 painting
now lands at painting volume on 4 of 5 seeds. Aggregate **22/35** (up
from 14-19/35 at iter-37).

| scorer | iter-37 | iter-10 |
|---|---|---|
| shape | 0/5 (med 0.205, max 0.446) | 0/5 (med 0.165, max 0.191) |
| modestSize | 1/5 | **4/5** |
| soilDispersion | 3/5 | 3/5 |
| descended | 2/5 | 3/5 |
| multipleDescents | 3/5 | 3/5 |
| noPrematureFruit | 5/5 | 4/5 |
| notSaturated | 5/5 | 5/5 |

Per-seed: 42=5/7 (was 3/7), 1337=3/7 (was 5/7), 314=**6/7** (best-ever
on the branch), 271=5/7, 555=3/7.

Vision 1 is **not yet achieved** — shape median 0.165 vs threshold 0.60.
The colonies are now painting-sized but still single-bundle in geometry,
not the painting's two-column root system. Mechanic class is correct;
the remaining gap is structural (lateral spread), not volumetric.

#### Earlier park (sim-lab/02 iter-37 · merged via PR #36)

Apical-dominance + faster-leaders config — aggregate 14/35,
multipleDescents 3/5, shape max 0.446 on seed 1337. The painting's
two-column geometry landed on three of five seeds but no seed reached
painting volume on lean substrate. See NOTES.md iter-27..37 for the arc.

---

## Vision 2 — Week-long persistence (in progress, 2026-05-23)

**Trigger:** an extended-window observation on the iter-37 parked config
([`grow-extended.js`](grow-extended.js)) showed every seed produces a
beautiful day-1 painting and then *collapses by day 2-3*. Founders die,
auto-bootstrap drops fresh spores, the surface looks alive but no single
colony actually persists. The day-2 cliff happens because leaders senesce
at LIFESPAN=120 extensions and the non-leader extension rate (0.012) can't
replace what dies — the network just retracts.

Observed (parked iter-37):

| seed | day 1 cells | day 2 | day 3 |
|---|---|---|---|
| 1337 | 148 (2 descents, depth 8) | 4 | 2 |
| 555 | 15 (depth 12) | founder dead | founder dead |

The collapse is **pre-existing** — iter-25 main also dies by day 3; the
older liquid-mat configs all show the same pattern. Vision 1's 28800-tick
window is too short to see it.

**the maintainer's call (2026-05-23):** "A colony should survive for a long time."
This is a real shroom-world requirement, not an artifact of measurement.

### Painting (target)

No new painting yet — the spec is functional: at day 7, the founder
colony is still alive, has held a meaningful size, and the shape that
landed at day 1 hasn't been dismantled to bare threads.

### Numeric scorers

In `targets.js` as `VISION_2_PERSISTENCE`. Defined and wired (sim-lab/03
iter-1). The shape threshold sits at 0.30 — half of Vision 1's 0.60 —
because the painting comparison is structural and the week-old colony may
have shifted laterally without losing its character.

| target | criterion | reason |
|---|---|---|
| `survivesToWeek` | founder colony still `alive` at end-of-run | the basic "didn't die" |
| `nonTrivialAtWeek` | founder cells ≥ 150 at day 7 (Vision 1's modestSize floor) | not just one surviving cell |
| `shapeStillHolds` | shape match at day 7 ≥ 0.30 | the painting wasn't temporary |
| `noAutoBootstrap` | `lifetime.autoBootstraps === 0` for the whole run | founder must persist on its own merit, not via succession |

The founder is identified by `pickFounderColony` (lowest `foundedTick`,
i.e. the colony sown at tick 0 by the scenario setup), not by `pickFocalColony`
(largest current colony) — succession would otherwise mask the founder's
death by surfacing a child colony as "focal."

### Cost

Lab runs become ~7× longer. At ~85 sec/sim-day, a 7-day single-seed run
is ~10 minutes; a 5-seed sweep is ~50 minutes per iteration. The
iteration loop slows from minutes to ~an hour per move. The signal is
worth the time — persistence is load-bearing for the live world.

### Suggested first moves (for the next session)

The mechanic likely needs a **lifespan-renewal path**:

- Currently every leader senesces after LIFESPAN extensions with no
  replacement; once all leaders are gone the colony is locked in retreat.
- The bifurcation-promoted leaders refresh the pool *while leaders exist*
  but can't kickstart it from zero.
- A *cell-lineage renewal* mechanic (a static cell at the frontier can
  re-promote to leader at low probability when the colony has no active
  leaders) would let the network keep extending past the LIFESPAN wall.

Hypothesis buffet starting points:

1. **Cell-lineage renewal** — non-leader extension creates a fresh leader
   if `col.leaders.length === 0` and the cell is on the colony perimeter.
2. **LIFESPAN gated by reserves** — leaders that still have reserves to
   spend don't senesce. Burns less arbitrary, more biological.
3. **Apical-tip relay** — when a leader senesces, the most recently
   bifurcated child inherits its leader status. Already partial; make it
   guaranteed instead of probabilistic.
4. **Slow non-leader extension** isn't slow — it's *zero* once leaders are
   all gone. Audit: does any growth happen post-leader-extinction?

Status: **paused (2026-05-23, mid-session redirect).** Scaffolding shipped
in sim-lab/03 iter-1 (scorers, `pickFounderColony`, persistence config,
auto-bootstrap counter). The frontier-revival fix (iter-4) addressed a real
bug in the leader code that *would* have masked Vision 2 results — that
fix stays in `sim.js`. Active optimisation against Vision 2 is paused
until Vision 1 is closer to shipping. the maintainer's call: extending the test
window past day 1 introduces noise when day-1 isn't load-bearing yet.
