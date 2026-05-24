# Shroom · Design Review · Kanban

Eleven findings from the 2026-05-18 index audit. All decisions taken;
this file tracks which ones have shipped.

The original audit (the long-form HTML with pros/cons per item) lived at
`app/public/_audit.html` and was parked from main in commit a92fcf5 so it
wouldn't get served as a live route. The full reasoning per item is
recoverable from `git show a92fcf5^:app/public/_audit.html`. This kanban
is the live surface.

**Shipped:** 5 / 14 (last reviewed 2026-05-23). Sweep on 2026-05-23
moved #08, #09, and #11 to Done; #04 refreshed with sim-lab/03 parked
state. Retire-sweep same day: #13 closed after verification (no code
change needed), #12 retired as won't-do (sim-engine side, deferred per
the maintainer), #14 retired as won't-do (the conditional never tripped — dark-
hue mushrooms look fine in practice), #07 decided kept-as-is (the depth
pass made the framed-window stance load-bearing — see card). Cards
#12–14 came from an earlier design-backlog pre-kanban.

Items added after the audit land in **Todo** with a short note about
where they came from.

---

## Legend

**Buckets** — the audit's three groupings:
- `bones` — layout, IA, sim correctness; the broken things.
- `kit` — CLAUDE.md violations, debt that grows quietly.
- `polish` — pixel art and voice.

**Severity** — `bug · arch · debt · polish · voice`. Shown after the
bucket when it adds something the bucket name doesn't.

**Card fields** — `Now:` what's true today. `Decision:` from the audit.
`Depends on:` / `Blocked by:` other cards or external work.

---

## Doing

### 04 · Hyphae grow as a mat, not a network
`bones · bug` · sim-side
**Now:** parked at sim-lab/03 iter-10 (PR #38, merged 2026-05-23).
Aggregate **22/35** (up from 14-19/35 at iter-37). Breakthrough: founder
gets a 50-reserve head start at sow (`world.js:254`), which unblocks
lean-seed founders that were stalling in the bootstrap absorption
window. Four of five seeds now reach painting size; seed 314 hits 6/7
targets. Apical-dominance + faster leaders + frontier-gated lazy revival
all in place. **Shape median still 0.165 vs 0.60 threshold** — the
colonies are painting-sized but single-bundle, not the two-column root
the painting wants. Remaining gap is structural (lateral spread), not
volumetric. See [NOTES.md](../../app/lib/sim-lab/NOTES.md) iter-1..10
on the `sim-lab/03-persistence` arc.
**Decision:** Sim-side fix is the priority. Investigate root cause in
growth/turnover balance. Use /lab to validate. Renderer halo only if sim
alone doesn't restore legibility.
**Next mechanic class** (open): lateral chemotaxis bias, wider apical
dominance, or genome-variance over the seed set. The buffet in
`sim-lab/PROCESS.md` still has untried items.

---

## Todo

### 01 · Mobile / tablet are unusable
`bones · bug` · responsive
**Now:** rail still fixed at `width: 300, flexShrink: 0` (app.js:129);
no media queries in `style.css`. Layout unchanged since audit.
**Decision:** Fix mobile + tablet. Desktop first, then tablet, then
mobile — accept the desktop "ambient dashboard" feel won't fully survive
the stack.
**Blocked by:** mobile portrait layout guidance from design-Claude
(open question in [DESIGN_NEEDS_WORK.md](../../DESIGN_NEEDS_WORK.md)).

### 02 · Nav lives in the wrong place
`bones · bug` · IA
**Now:** /engine, /lab, dev-tools triggers still in TopColony header
(app.js:22-26). StatusLeft (shell.jsx:36) still holds only vol/era/day.
**Decision:** Move to StatusLeft as small labeled chips. Keep the gear
visible — don't hide it behind ⌘. alone. **Scope addition 2026-05-23:**
the maintainer called out that `/research` (the sim-lab dashboard) is currently
not surfaced anywhere in the shell — add it as a chip alongside /engine
and /lab so the lab research surface is one click away.

### 03 · Rail names disconnected from the field
`bones · bug` · interaction
**Now:** no hover-bloom anywhere; rail entries don't link to canvas
colonies.
**Decision:** Hover the rail entry → soft outline blooms around that
colony on the canvas, F57 label appears with the bloom. No permanent
labels — preserve the diorama.
**Depends on:** #10 (F57 first use). #11 (new names) shipped
2026-05-22 — the hover-bloom will debut against the new cultivar register
either way.

### 05 · ~58 hardcoded hex strings, despite COL tokens existing
`kit · debt` · sweep
**Now:** rough count ~126 hex occurrences across kit and JS. `H_*`
aliases in overlays.jsx:12-16 and `_CH_*` aliases in chronicle.js:13-17
still present and used inline.
**Decision:** Sweep all hex → COL in one focused PR. Delete `H_*` and
`_CH_*` aliases. Replace local font strings with `MONO`/`SERIF`/
`SERIF_BODY`. Add 1–2 missing tokens rather than approximate.
Screenshots before/after at desktop + tablet.

### 06 · TICKS_PER_DAY declared in 5 places
`kit · arch` · drift risk
**Now:** still scattered — `server.js:16`, `canvas.js:32`, `app.js:4`
(literal 28800), `chronicle.js:34` (`_CHRON_TICKS_PER_DAY`),
`shell.jsx:16` (literal 28800). Not yet in snapshot.meta.
**Decision:** Ship `ticksPerDay` in `/api/world/snapshot` meta. Do it
next time we touch the snapshot shape — bundle, don't standalone.

### 10 · F57 / F35 bitmap fonts are underused
`polish`
**Now:** F57/F35 still only in `atmosphere.jsx:54` and design-side
`preview.js`. No in-world labels.
**Decision:** Use F57 for in-world labels (the hover-bloom from #03 is
the natural first use). F35 micro-stats reserved for a later round.
Don't replace serif/mono — augment.
**Depends on:** #03.

---

## Done

### 07 · Canvas is parsimonious on big screens
`polish` · surface · **kept-as-is**
**Decided 2026-05-23.** Audit said remove the `maxWidth: 1280` cap and
let the canvas scale up. the maintainer's call after the depth pass shipped:
keep the cap. The depth pass (PR #44) added a vignette + hairline frame
around the canvas, which makes it read as a shadow-box diorama — a
window *into* the world. That framed-window effect only works if the
canvas is bounded; scaling it up turns the diorama into "a big screen"
and would force re-tuning bloom + vignette at every scale. Also fits
the shroom voice better — something you *watch*, not a game filling
the viewport. On ultra-wide screens, the surrounding dark space + the
radial vignette is the feature, not the bug.

### 13 · Verify mushroom bloom alpha in live UI
`polish` · verification
**Verified 2026-05-23.** Force-injected 10 mushrooms (5 cool hues
200–240, 5 warm hues 20–60 + 320–340) on the local mock-world's log,
autumn night. Effective alpha under capBudget (sqrt(8/10) ≈ 0.89):
cool 0.27, warm 0.09. Halos read as intended — hue-tinted, present
but contained, no smearing across the log. The cool-vs-warm 3:1 ratio
lands. No tune required; constants at `canvas.js:435` stay.

### 12 · Mushroom min-spacing rule
`bones · arch` · sim-side · **won't-do**
**Retired 2026-05-23.** Sim-engine work for unclear payoff — the
piling-up that flagged this in the mocks hasn't shown up in the
live world, and touching the fruit-trigger logic is high risk while
sim-lab is mid-loop. If real pile-ups appear later this can come
back as a new card.

### 14 · Mushroom outline near-black on dark hues
`polish` · cosmetic · **won't-do**
**Retired 2026-05-23.** The conditional ("if it looks off in the
wild") never tripped — the #13 verification pass included dark-cool
hues (purple 320, blues 200–240) and the outlines read as edges,
not flat rings. Leave as-is; reopen if a future hue tweak surfaces
the problem.

### 11 · Colony names are off-voice
`polish · voice` · naming
**Shipped:** PR #32, commit `2fade62` (2026-05-22). Generator rewritten
in `app/lib/world.js` — made-up names in the psilocybin-cultivar
register (place-names, physical-trait descriptors, mystical/weird) replace
the old `Wiggle Cap` / `Bobble Spore` set.

### 09 · Loading state is off-voice
`polish · voice` · first impression
**Shipped:** PR #31, commit `076572e` (2026-05-22). "awakening…" in dim
mono replaced with an italic-serif passage across `app.js`, `research.js`,
and `engine.js`.

### 08 · TopColony tells you almost nothing
`polish`
**Shipped:** PR #33, commit `67b0234` (2026-05-22). Rail rows render a
`HallMushroom` preview at size=24 (cap shape from genome) plus real
age-in-days alongside the existing hyphae count.

---

## Related

- [DESIGN_NEEDS_WORK.md](../../DESIGN_NEEDS_WORK.md) — pre-kanban list
  of gaps in the locked-vision handoff from claude.ai design (slice
  ports from bundle `AbzrdHOvwW6q-sChNcZ96Q`). After the 2026-05-21
  sweep, four items resolved (era scars, sun/moon trajectory, persona
  wisp, glow-budget clamp) and three promoted here as #12–14.
  Mobile-portrait guidance is still the standing open question to
  design-Claude (blocks kanban #01).
- `git show a92fcf5^:app/public/_audit.html` — the original audit with
  full pros/cons per finding.
