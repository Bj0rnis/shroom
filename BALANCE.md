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

## 2026-05-18 — colony-level starvation · perimeter retraction

**Branch**: `hyphae-mortality-tuning`

**Motivating observation**: live world, vol 3 — see "Outcome" of the
2026-05-17 entry below. One colony saturated the grid and sat there fruiting
forever; no natural deaths logged across thousands of ticks.

**Root cause read**:
The 2026-05-17 fix correctly removed the *per-cell* starvation gate (which
created the "snake" pathology), but did not introduce any *colony-level*
replacement. The result was a hyphae mat with no retraction mechanism: once
substrate beneath the network depleted, intake fell to zero, but the network
itself stayed intact. Combined with `COLONY_PRIME_DAYS = 60` (well past the
real-time horizon a colony actually lives in), the only mortality path left
was the toofan — Poisson, once-a-year.

**Changes** (all in `app/lib/sim.js`):

| constant / path | before | after | reason |
|---|---|---|---|
| `STARVATION_DIE_RISK` use | unused per-cell | applied at colony level, gated by streak | retraction without resurrecting the snake bug |
| `STARVATION_INTAKE_PER_CELL` | (new) | `0.01` | min ratio of intake to cell count to count as fed (1%) |
| `STARVATION_GRACE_TICKS` | (new) | `TICKS_PER_HOUR * 6` (~6h) | breathing room before retraction starts |
| `STARVATION_RAMP_TICKS` | (new) | `TICKS_PER_HOUR * 18` (~18h further) | full pressure reached at +24h of stall |
| `STARVATION_RECOVER_RATE` | (new) | `4` | streak unwinds 4× faster than it builds — finding new substrate revives |
| `COLONY_PRIME_DAYS` | `60` | `20` | old-age decline kicks in on the timescale colonies actually reach |

Connectivity multiplier (already in `decayHyphae`) does the perimeter-vs-trunk
gating: `sameN <= 1` cells take full starvation risk, 4-connected interior
cells get `× 0.08`. So a starving colony loses tips first, retracts inward,
and only loses the spine if starvation continues long after the perimeter is
gone. Cells that die release `DECAY_DEPOSIT` (15) back into substrate, so a
shrunken colony lands on a slightly richer pad — natural negative feedback.

**Hypothesis to verify in production**:
- Saturated colonies retract within ~12–24 real hours of stalling.
- Multiple colonies can coexist longer — Tarka-style monoculture goes away.
- `deathsByCause.starvation` becomes the dominant non-toofan death cause.
- World holds 2–4 alive colonies as steady state, not 1.

**Outcome**: _to be filled in after running the new constants for ~1 sim-week
on the live world._

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

**Outcome**: confirmed on the live world (vol 3, ticks 24,156–27,056). The
network-spine model worked — Tarka held shape, grew steadily, no oscillation.
But the fix overshot: without per-cell starvation and with `COLONY_PRIME_DAYS`
at 60, a colony has *no* mortality pressure once it saturates. Tarka grew
15,642 → 23,898 cells in ~3,000 ticks (≈40% of grid), then sat at exactly
23,898 for 14 real hours, fruiting 60 times. Lifetime deathsByCause for vol 3:
0 starvation, 0 turnover, 0 old-age, 0 winter. The world became one colony
waiting for a toofan. Addressed in the 2026-05-18 entry below.
