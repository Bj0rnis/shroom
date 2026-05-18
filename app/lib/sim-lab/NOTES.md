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
