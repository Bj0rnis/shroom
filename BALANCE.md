# BALANCE.md — shroom

Append-only record of sim-tuning decisions. One entry per balancing pass.
Newest at the top.

The lab's per-run markdown (`/api/lab/runs/:id/markdown`) snapshots all sim
constants at run time, so any historical claim like "with `FRUIT_COST_FLOOR=80`
the colonies fruited 39× in 7 days" is reproducible from the run record.
This file holds the **why**.

Rules:

1. Append only. Never edit a past entry. If a change reverses an earlier one,
   write a new entry referencing the old one.
2. Each entry names the **lab run(s)** that motivated the change.
3. Each entry leaves an "outcome" line that gets filled in by the *next* entry
   — so you can see whether a change worked before deciding what to try next.
4. Inline comments in `sim.js` link back here: `// see BALANCE.md 2026-05-17`.
   When you touch a constant with such a comment, read the entry first.

---

## 2026-05-17 — snake hyphae fix · network as transport spine

**Branch**: `hyphae-as-network`

**Motivating run**: `sim-3` (week-on-log, seed 264593317, 7 sim-days)

**What the lab showed**:
- 6 colonies, 170 total hyphae cells, 48 fruits, zero deaths.
- Reserves piled up to 127k on colonies that wouldn't grow.
- Hyphae count oscillated wildly (62 → 33 → 10 across half a sim-day).
- Colonies sat as tight clusters on the log; no tunneling, no descent into
  soil. Log nutrient depleted to ~10 by day 5 but colonies didn't leave.
- User observation: hyphae "moved like snakes" — growing on the tip,
  dying in the back, never holding shape.

**Root cause read**:
The per-cell starvation gate (`nutrient[i] < HYPHA_DEATH_THRESHOLD` →
`STARVATION_DIE_RISK`) treated mycelium like an animal: when the cell
finished eating the floor beneath it, the cell died. Real mycelium uses
old hyphae as **transport pipes** — they connect absorbing tips to fruit
sites long after their local substrate is consumed. The sim was killing
the network's spine.

Compounding factors:
- `THICKNESS_BOX_RADIUS=2` (5×5 density check) jammed tips inside their
  own colony cluster, so reserves piled up with nowhere to grow.
- `FRUIT_COST_FLOOR=80` made fruiting cheaper than any meaningful growth
  after the first few fruits — colonies dumped accumulated reserves into
  fruit bodies instead of expansion.
- `HYPHA_AGE_LIMIT = TICKS_PER_WEEK` meant every cell aged out within a
  single 7-day lab run; combined with `TURNOVER_DIE_RISK=0.0002` the
  perimeter dissolved faster than tips could advance.

**Changes** (all in `app/lib/sim.js`):

| constant / path | before | after | reason |
|---|---|---|---|
| per-cell `add('starvation', …)` in death loop | active | commented out (kept for reference) | hypha on dead substrate is still useful as a pipe |
| `HYPHA_AGE_LIMIT` | `TICKS_PER_WEEK` (201,600) | `TICKS_PER_WEEK * 8` (~2 mo) | cells persist as network infrastructure, not weekly turnover |
| `TURNOVER_DIE_RISK` | `0.0002` | `0.00002` | when old age does kick in it's a slow prune, not a sweep |
| `THICKNESS_BOX_RADIUS` | `2` (5×5 check) | `1` (3×3 check) | tips can squeeze past their own colony and reach open ground |
| `FRUIT_COST_FLOOR` | `80` | `300` | fruiting expensive enough that growth wins until the colony is genuinely large |

`STARVATION_DIE_RISK` constant retained (not deleted) so a later
colony-level starvation pressure can reuse it without re-introducing a
magic number.

**Hypothesis to verify on next `week-on-log`**:
- Colonies form persistent network shapes (branches that hold, not snake)
- Hyphae count climbs and stays climbed; no wild oscillation
- Cell-to-fruit ratio reverses — more cells, fewer fruits per colony
- Some downward tunneling into soil below the log
- Log nutrient still depletes but later (day 6-7, not 4-5)

**Outcome**: _to be filled in after re-running `week-on-log`._
