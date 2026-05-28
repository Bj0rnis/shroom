# Shape-scorer audit — 2026-05-28

**Question on the table:** sim-lab has been chasing a shape median ≥ 0.60
gate for seven branches. Median has climbed from 0.165 → 0.282 and stalled.
Before opening sim-lab/08, is the 0.60 target reachable?

**Answer:** yes. The scorer is well-calibrated. 0.60 is reachable. The
problem is that the sim's actual output isn't a network — it's a fat
column with a cap on top. The gatekeeper feature inside the composite
(`soilDispersion`, weight 0.35) demands isolated cells in soil; the sim's
output puts adjacent cells everywhere.

## What was tested

Nine ASCII shapes fed through `shape.js` against the painting in
`RESEARCH.md`. Three were "ideal" (variations of the painting topology),
two were degenerate (stake, blob), three were realistic sim approximations,
one was a verbatim copy of iter-13's actual best ASCII (seed 1337, 421
cells, first 6/6 pass).

Reproduce: `node app/lib/sim-lab/audit-shape.js`

## Results

| shape | composite | latSpread | descCols | maxDepth | soilDisp | soilLogR | notes |
|---|---:|---:|---:|---:|---:|---:|---|
| A. painting (copy)        | **1.000** | 5  | 2 | 12 | 1.000 | 0.789 | sanity check ✓ |
| B. tight lattice          | 0.696 | 3  | 1 | 10 | 1.000 | 0.745 | descents merge, still passes |
| C. wide lattice           | **0.892** | 9  | 2 | 11 | 1.000 | 0.786 | over the gate by a wide margin |
| D. stake (1 fat thread)   | 0.551 | 13 | 1 | 11 | 1.000 | 0.151 | single isolated thread reads as max dispersion |
| E. fat blob               | 0.305 | 13 | 1 | 11 | 0.077 | 0.698 | killed by soilDispersion |
| F. two-thread (idealised) | **0.887** | 7  | 2 | 11 | 1.000 | 0.551 | what iter-74 *should* look like if drawn cleanly |
| G. heavy lattice          | 0.688 | 9  | 1 | 11 | 1.000 | 0.765 | over the gate; lateral spread too wide for full credit |
| H. iter-71 outlier        | 0.297 | 11 | 1 | 11 | 0.125 | 0.659 | single fat-bundle founder — looks like a stake |
| I. **iter-13 REAL**       | **0.212** | 5  | 1 | 5  | 0.167 | 0.563 | actual sim output. fat cap, single triangular descent |

## Findings

**1. Scorer is calibrated.** Painting → 1.000. Ideal lattices and clean
two-descent networks → 0.69–0.89. Degenerate shapes (stake, blob,
single-bundle founder) → 0.30–0.55. The 0.60 gate sits in the right
place — it rejects degenerates and admits plausible networks. No
recalibration needed.

**2. The sim isn't producing networks.** The real iter-13 ASCII scores
0.212 because:
  - `descentColumns` = 1 (a single fat descent, not two separated ones) → **0** of 0.20
  - `soilDispersion` = 0.167 (cells are adjacent, not dispersed) → **0** of 0.35
  - `maxDepth` = 5 (founder didn't reach far enough down) → **0.006** of 0.20

  That's 0.55 of the 0.85 weight lost on three features. The shape
  composite can't recover from that.

**3. `soilDispersion` is the gatekeeper inside the gatekeeper.** Weight
0.35 — by far the largest. Painting target = 1.0 (every soil cell
isolated by dots). To get full credit a run needs every soil cell
non-adjacent to its left/right neighbour. A clumpy network — even one
that scores fine on the *standalone* `soilDispersion` scorer (gate
≥ 0.50) — gets weak partial credit here. Running the numbers:

  | run soilDisp | shape contribution from this feature |
  |---:|---:|
  | 0.50 (standalone gate) | 0.058 of 0.35 (17%) |
  | 0.70 | 0.175 of 0.35 (50%) |
  | 0.85 | 0.262 of 0.35 (75%) |
  | 1.00 (painting) | 0.350 of 0.35 (100%) |

  So **the standalone gate at 0.50 and the shape composite at 0.60 are
  inconsistent.** A run that passes soilDispersion 5/5 (every seed ≥ 0.50)
  may still get almost nothing from this feature inside the shape
  composite. The standalone scorer is a much weaker bar than what
  `shape ≥ 0.60` actually demands.

**4. The topology bottleneck is real and matches the 1-1.md hypothesis.**
With `MAX_LEADERS_PER_COLONY = 5`, growth concentrates in a narrow
corridor, leaders eat through local substrate, and the colony ends up as
a fat trunk. Five concentrated drillers cannot produce isolated lacework
under any tuning of how they extend — the topology cap *is* the cap.

## What this means for sim-lab/08

**The audit doesn't move the target.** The work is finding mechanics, as
the maintainer said.

**The strongest single move is the many-slow-leaders hypothesis already
in the 1-1.md hypothesis buffet.** Raise `MAX_LEADERS_PER_COLONY` from 5
to ~30, drop `LEADER_EXTEND_PROB` proportionally so total growth rate
stays flat. More tips spread wider → more cells isolated in their soil
rows → higher `soilDispersion`. This is a direct mechanic for the
gatekeeper feature. It may also address the survival issue (broader
exploration finds live substrate before the starvation streak runs out)
in the same change.

**Likely secondary moves:**
- `descentColumns = 1` is also unsolved — only 2/5 seeds at iter-74 produce
  the painting's two separated descents. More leaders should also help here
  by giving the founder more independent crossing points at the grass row.
- The standalone `soilDispersion` gate at 0.50 is too lenient relative to
  what shape needs. Either raise it to 0.85 (so it actually predicts the
  shape composite) or rely on shape alone. Not urgent; diagnostic only.

## Don't do this

- **Don't lower the shape threshold.** 0.60 is calibrated — lattices clear
  it, blobs don't. Lowering it would admit blobs.
- **Don't rewrite the scorer.** Painting → 1.0, degenerates → < 0.55, ideal
  networks → 0.7–0.9. This is healthy behaviour.
- **Don't change weights without re-auditing.** The current weights make
  `soilDispersion` the dominant signal, which is correct — the painting *is*
  about a network in soil, not about how wide the colony is.

## Confidence

High. The painting copy scores exactly 1.0 (no implementation bug). The
ranking of hand-drawn shapes matches intuition. The real iter-13 ASCII
scores in the same range as the sim's measured median (0.21 audit vs
0.16 measured), confirming the scorer reads the same signal end-to-end.

Time spent: ~30 min from branch to memo.

— claude-sonnet-4-7
