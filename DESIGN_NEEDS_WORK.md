# Shroom · Design Kit · Needs Work

Pre-kanban funnel for the locked-vision handoff from claude.ai design
(bundle: `AbzrdHOvwW6q-sChNcZ96Q`). Items here are gaps and rough edges
from the slice ports — some missing pieces, some mocks that don't
survive contact with the live sim, some spots where the design Claude
clearly ran out of context.

Add to this file as we hit issues during the implementation slices.
Items move from here into the [kanban](docs/design/REVIEW.md) once they
become actionable, or back to design-Claude when they need a real design
decision before code.

---

## Open

- **Mushroom min-spacing rule.** Mocks placed caps too close together.
  Tells us the kit has no min-spacing rule — needs to live sim-side:
  enforce a minimum cell-distance between fruiting events per colony,
  or cap fruit density per log section. *Deferred polish.* Promoted to
  kanban as [#12](docs/design/REVIEW.md).

- **Mushroom bloom alpha verification.** Design dropped warm
  0.20→0.10 and cool 0.62→0.30 after Björn flagged "way too high"
  mid-design. The drop landed in code but was never verified against 8+
  live mushrooms in `autumn-dusk`-equivalent lighting. Promoted to
  kanban as [#13](docs/design/REVIEW.md).

- **Mushroom outline `hsl(hue, sat-12, 22)`** — goes near-black on dark
  hues; can read as a flat ring. Conditional cosmetic — flag if it
  looks off in the wild. Promoted to kanban as [#14](docs/design/REVIEW.md).

## Open questions for design-Claude

(File when slice 4 lands so we have specific gaps to point at.)

- Mobile portrait layout — the kit ships desktop only. See kanban
  [#01](docs/design/REVIEW.md), blocked on this.

---

## Resolved

- **Era scars: all four implemented in `paintEraScar`.** fire/flood/
  frost/wind all land in `canvas-atoms.js:797` (slice 4, commit
  `c86a264`). Verified 2026-05-21.

- **Sun & moon driven from trajectory, not hardcoded.** `canvas.js:200-217`
  computes position from `sky.hour` (slice 3, commit `252f80d`). The
  old hardcoded `x:256,y:54` / `x:56,y:22` pair is gone.

- **Persona wisp follows a chosen log.** `canvas.js:225-231` picks the
  log deterministically by world seed; visible 19:00–19:30 local
  (slice 3, commit `252f80d`).

- **Glow-budget cap enforced.** Hyphae glow scales by
  `Math.sqrt(4 / aliveCount)` past 4 colonies (`canvas.js:407-409`);
  mushroom cap glow scales by `Math.sqrt(8 / mushrooms.length)` past
  8 caps (`canvas.js:428-430`). Slice 3.

- **Three of the four "confirmed gaps" listed at audit-time were
  already done by code that landed across slices 3 and 4** — the file
  was stale. Verified by walking the renderer on 2026-05-21.
