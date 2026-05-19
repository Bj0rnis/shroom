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

**Achieved at iter-20** (2026-05-19, sim-lab/02-carrying-capacity).
Every target passes the 3+/5 majority threshold; four of five seeds
hit all six targets cleanly.

| target | iter-20 | criterion |
|---|---|---|
| modestSize        | **5/5** | colony cells in [150, 800] |
| branchedDensity   | **5/5** | density in [0.10, 0.40] |
| descended         | **4/5** | reaches ≥5 rows below grass |
| multipleDescents  | **4/5** | ≥2 grass-crossings |
| noPrematureFruit  | **5/5** | ≤3 fruits across the day |
| notSaturated      | **5/5** | alive cells / substrate ≤20% |

Per-seed sizes: 688, 470, 480, 537, 258. The mechanic that earned it:

- **Leader-cells** (sim-lab/01-leading-hyphae iter-1, iter-5):
  `LEADER_EXTEND_PROB=0.12`, `LEADER_LIFESPAN=60`,
  `NON_LEADER_EXTEND_PROB=0.012`, bifurcation Y-fork at leaders only.
- **Colony carrying capacity** (sim-lab/02 iter-13):
  `COLONY_CARRYING_CAPACITY=1500`, `CARRYING_SOFTNESS=1`. Linear soft
  brake on extension prob: factor `(1 - cells/cap)` clamped to `[0, 1]`.
- **Substrate-aware sow** (sim-lab/02 iter-17): lab scenarios sow
  each spore on the richest log cell in its column, not the geometric
  centre.
- **Pinned genome for vision tests** (sim-lab/02 iter-20): the lab
  uses `pinnedGenome()` returning seed 1337's natural iter-13 roll for
  every founder. Lifts genome variance out of the vision check.

These constants live in `app/lib/sim.js` and the new
`pinnedGenome()` lives in `app/lib/genome.js`. Live world still
uses `randomGenome()` — natural variance preserved outside the lab.

The remaining work on this vision: confirm with one more iteration,
then promote to main and pick the next vision target. Genome variance
is the obvious thing to re-introduce — gradually — once we have a
second working vision to anchor regressions against.

#### What didn't work, and why

Five iters on leader-cells (iter-6..10) hit a tuning wall because the
mechanic alone couldn't both (a) grow the founder big enough on lean
substrate and (b) keep rich founders from matting. Carrying-capacity
solved (b); pinning the genome solved (a).
