# Shroom · Lab · Notes

Private notebook. Terse — one entry per session. ~50–100 words each.
For the *why* in prose, see `RESEARCH.md`.

Entry format:

```
## YYYY-MM-DD · branch-or-config-name · [tag]
Hypothesis: one sentence.
Setup: scorer set, seeds, constants touched.
Result: aggregate pass-counts + the surprising number.
Reading: what I now think.
Next: one move.
```

Tags: `[tweak]` (constant change), `[mechanic]` (new code path),
`[rewrite]` (structural change).

---

## 2026-05-18 · sim-lab/01-leading-hyphae · iter-3 · [tweak]
Hypothesis: leader extend rate is still too high. Three leaders extending at
~0.30/tick × growthRate produce ~1 cell/tick — far past the [150, 800] cell
day-1 target. Cut LEADER_EXTEND_PROB 0.30 → 0.05, junction 0.10 → 0.02.
Setup: same seeds, only those two constants change.
Result: modestSize 0/5 (5-127 cells), branchedDensity 3/5, descended 1/5,
multipleDescents 1/5, noPrematureFruit 5/5, notSaturated 5/5.
Reading: overshot — too slow. The fruit and saturation pressures are now off
(perfect), but founders are too small and don't descend. Sweet spot is between
0.05 and 0.30. Try 0.12.

## 2026-05-18 · sim-lab/01-leading-hyphae · iter-4 · [tweak]
Hypothesis: split the difference. LEADER_EXTEND_PROB 0.05 → 0.12, junction
0.02 → 0.05. ~2.4× faster than iter-3; should land founder ~150-800 cells.
Setup: same seeds, only those two constants.
Result: modestSize 1/5, branchedDensity 3/5, descended 3/5, multipleDescents
3/5, noPrematureFruit 2/5, notSaturated 4/5. Variance is enormous: seed 314
hits 5/6 (481 cells, 691 total — beautiful), seed 1337 still mats (11862),
seed 555 dies (8 cells).
Reading: 0.12 is the right *average* rate, but with no decay/senescence on
leaders the substrate-rich seeds run away (28800 × 0.12 × 3 leaders ~= ∞).
The painting shows leaders that descend, fork twice, then *stop*. Need a
mechanism that stops growth at a few hundred cells regardless of substrate.
Next: leader senescence. Each leader tracks its extension count; after a
threshold it demotes. Caps the runaway and lets quiescent cells become new
leaders only via lazy-promotion (which the leader-die path already triggers).

## 2026-05-18 · sim-lab/01-leading-hyphae · iter-2 · [tweak]
Hypothesis: FRUIT_MIN_CELL_COUNT=300 is crossed inside day 1 by log-rich
founders, releasing spores that mat the canvas. Raising to 800 (top of the
modestSize range) puts fruiting outside the day-1 window for any founder
that is also passing modestSize. Day-1 vision: build the network, don't yet
fruit.
Setup: only constant change. Re-run.
Result: modestSize 1/5, branchedDensity 4/5, descended 5/5, multipleDescents
2/5, noPrematureFruit 0/5, notSaturated 3/5. Raising the gate didn't reduce
fruits: founders still cross 800 inside the sim-day on log-rich seeds, then
fruit + germinate children. Seed 271's founder grew, fruited, then crashed —
fruitsTotal stays high even after die-off.
Reading: the rate of growth is the real problem, not the fruit gate. Three
leaders × ~0.30/tick is roughly 1 cell/tick; over 28800 ticks any founder
hitting log-rich substrate explodes. modestSize 150-800 needs ~30× slower.
Next: cut LEADER_EXTEND_PROB 0.30 → 0.05 (and junction 0.10 → 0.02). Slows
the founder enough that it cannot reach the fruit gate inside day 1.

## 2026-05-18 · sim-lab/01-leading-hyphae · iter-5 · [mechanic]
Hypothesis: leaders never retire — leadership moves with the lineage but the
lineage extends forever. Add LEADER_LIFESPAN (extensions count) per leader.
After 60 extensions, leader is dropped (no replacement). Bifurcation-born
leaders start fresh. Caps a single leader's reach, and once all leaders in
a colony senesce, growth halts until a senesced cell dies and lazy-init
promotes a new one — natural relay handoff.
Setup: only the new mechanic. LEADER_EXTEND_PROB stays at 0.12.
Result: modestSize 1/5, branchedDensity 4/5, descended 4/5, multipleDescents
3/5, noPrematureFruit 2/5, notSaturated 4/5. Seed 42 hits 5/6 (255 cells,
beautifully branched). Seed 1337 still mats (13866).
Reading: senescence per-leader doesn't bound colony growth — bifurcation
keeps refilling leader slots. Colony stays at ~3 active leaders perpetually,
so total ~3 × 0.12 × 28800 = ~10k cells. The fix is in bifurcation: it must
*not* add a new leader. Then founder has 1 leader for life of that leader,
and after senescence the colony slows to non-leader rates (~10× less).

## 2026-05-18 · sim-lab/01-leading-hyphae · iter-1 · [mechanic]
Hypothesis: every cell-with-a-free-neighbour rolls extension every tick → liquid mat.
Constrain growth to a few "leader" tips per colony; non-leaders extend at ~10×
lower probability. Leadership *moves* on extension; bifurcation can add a
leader up to MAX_LEADERS_PER_COLONY. Adapted from `growth-shape-leading-tip`
WIP but threaded through `world.rng` so the lab stays deterministic.
Also: FRUIT_MIN_CELL_COUNT=300 gate, TIP_AGE_DECAY taper on stragglers.
Setup: baseline seeds, vision 1, no other changes.
Result: modestSize 1/5, branchedDensity 4/5, descended 5/5, multipleDescents 4/5,
noPrematureFruit 0/5, notSaturated 3/5. Per-seed cell counts swing 487 → 22293
(seed 1337 still mats). Median seed (555) is genuinely branched and descended
but founders are crossing the 300 fruit gate within the sim-day and seeding
children — fruitsTotal=29 there.
Reading: leaders work. The shape is real (see seed 555 ASCII — root-like).
Failure modes left: (a) some seeds the founder still saturates, (b) fruit gate
of 300 cells is reachable inside a sim-day on log-rich substrate.
Next: raise FRUIT_MIN_CELL_COUNT well past day-1 founder size (500+).

## 2026-05-18 · sim-lab/foundation · [mechanic]
Foundation pass: seeded RNG (mulberry32) threaded through sim/world/genome/lab,
lab scaffolding under `app/lib/sim-lab/`, two journals, vision 1 written into
`RESEARCH.md`.
Setup: baseline config (no constant overrides), 5 seeds, vision 1.
Result: 0/6 targets pass on a majority. modestSize, noPrematureFruit, and
notSaturated all fail on all 5 seeds. descended and multipleDescents both
trivially pass — saturation guarantees them.
Reading: foundation works (determinism confirmed: 3× same seed → identical
state). Baseline reproduces the "liquid mat" exactly as expected. The
mat hits ~20k cells in 1/10 of a sim-day, then starvation chews it down.
Next: branch `sim-lab/01-leading-hyphae`, try the explicit-leader mechanic
from the earlier 10-test pass with the noise filter on.
