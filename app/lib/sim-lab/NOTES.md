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
