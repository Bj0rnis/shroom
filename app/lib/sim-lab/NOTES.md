# Shroom · Lab · Notes

Private notebook. Terse — one entry per session. ~50–100 words each.
For the *why* in prose, see `RESEARCH.md`. For *how the loop runs*, see
`PROCESS.md` — read it before iterating.

Entry format:

```
## YYYY-MM-DD · branch-or-config-name · iter-N · [tag]
Agent: claude-<model-id>
Plain: one plain-English sentence for the maintainer — what we tried and what came out.
Hypothesis: one sentence (technical OK).
Setup: scorer set, seeds, constants touched, mechanic added/removed.
Result: aggregate pass-counts + the surprising number.
Reading: what I now think.
Next: one move.
```

`Plain:` is the line the /research dashboard shows first. Translate the
code-talk: "extend" → "grow", "aggregate pass-rate" → "how many seeds
pass," "saturated" → "matted." See `PROCESS.md` "Voice" section for the
full translation register. Keep it short — one sentence.

Tags: `[tweak]` (constant change), `[mechanic]` (new code path),
`[rewrite]` (structural change), `[stuck]` (mechanic class abandoned),
`[observe]` (no code change, just reading prior runs).

The `Agent:` line records which model ran the iteration. Use the model
ID (`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`). Future
us will want to A/B model choices; this is the audit trail.

---

## 2026-05-19 · sim-lab/02-carrying-capacity · iter-11 · [mechanic]
Agent: claude-opus-4-7
Plain: First try with a colony-wide soft cap (500 cells, on top of lead cells). The brake works — no matting and no early fruiting on any seed — but cap-plus-lead-cells is too much braking. Colonies came out as small lumps (1-94 cells) and didn't reach down into the soil at all. Next move is to try the cap on its own, without lead cells underneath.
Hypothesis: A colony-wide soft cap (factor `(1 - cells/cap)²` on extension prob, cap=500) is the brake that leader-cells couldn't reliably provide. Layered on top of current leader-cells, the cap should bound size while leader-cells continues to shape the front.
Setup: New COLONY_CARRYING_CAPACITY=500, CARRYING_SOFTNESS=2 in sim.js. Soft-cap factor applied to baseExtend and to bifurcation prob. Leader-cells stack left intact.
Result: modestSize 0/5, branchedDensity 3/5, descended 0/5, multipleDescents 1/5, noPrematureFruit 5/5, notSaturated 5/5. Per-seed cells: 13, 94, 61, 1, 63. notSaturated and noPrematureFruit clean across the seed set — the cap removes the runaway tail.
Reading: The mechanic works as designed — the cap removes the matting failure mode entirely. But stacked on top of leader-cells, it double-brakes: leader-cells already gates *which cells* grow, and the soft cap further damps the *rate* they grow at. The colony never gets big enough to descend. Two paths forward: (a) lift cap to 800-1000 so leader-cells can do its lateral spread before the cap bites, (b) remove leader-cells so the cap is the sole brake — a cleaner test of the carrying-cap class.
Next: iter-12 — disable leader-cells entirely (set NON_LEADER == LEADER rates), keep cap at 500. Tests whether the cap alone produces the painting shape.

## 2026-05-18 · sim-lab/01-leading-hyphae · iter-3 · [tweak]
Plain: Slowed the lead cells way down. Too slow — colonies stayed tiny (some only 5 cells) and didn't reach into the soil.
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
Plain: Split the difference at a middle growth rate. One seed came out beautiful (481 cells, branched), but the noisy seed still matted and the lean one still died.
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
Plain: Raised the size needed before fruiting. Didn't help — colonies still grew past the gate inside day 1 on rich seeds and fruited anyway.
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
Plain: Made lead cells retire after 60 grows. Seed 42 came out lovely (255 cells, branched) — but bifurcation kept making fresh leads, so the colony never really slowed.
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
Plain: First try with "lead cells" — a few tips grow fast, the rest crawl. Shape looked right (root-like on the median seed), but rich seeds still matted and colonies fruited too early.
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
Plain: Baseline run on stock numbers. The world matted exactly the way we'd expect — that's the problem we're trying to solve. Lab pipeline itself works (same seed gives the same world every time).
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
