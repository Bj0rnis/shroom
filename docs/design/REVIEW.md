# Shroom · Design Review · Kanban

Eleven findings from the 2026-05-18 index audit. All decisions taken;
this file tracks which ones have shipped.

The original audit (the long-form HTML with pros/cons per item) lived at
`app/public/_audit.html` and was parked from main in commit a92fcf5 so it
wouldn't get served as a live route. The full reasoning per item is
recoverable from `git show a92fcf5^:app/public/_audit.html`. This kanban
is the live surface.

**Shipped:** 0 / 14 (last reviewed 2026-05-21). Cards #12–14 promoted
from `DESIGN_NEEDS_WORK.md` after a sweep on the same day — most of
that pre-kanban list turned out already-resolved by code that shipped
in earlier design-kit slices.

Items added after the audit (or spun off from `DESIGN_NEEDS_WORK.md`)
land in **Todo** with a short note about where they came from.

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
**Now:** active on branch `sim-lab/02-carrying-capacity`. Best result is
iter-25's config (LEADER_LIFESPAN=120, THICKNESS_MAX=2, descent depth
lights up). iter-26 tried doubling bifurcation and was reverted; branch
parked at iter-25 awaiting next mechanic from the buffet (apical
dominance, or MAX_LEADERS_PER_COLONY 3→5). See
[NOTES.md](../../app/lib/sim-lab/NOTES.md).
**Decision:** Sim-side fix is the priority. Investigate root cause in
growth/turnover balance. Use /lab to validate. Renderer halo only if sim
alone doesn't restore legibility.

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
**Decision:** Move all three to StatusLeft as small labeled chips. Keep
the gear visible — don't hide it behind ⌘. alone.

### 03 · Rail names disconnected from the field
`bones · bug` · interaction
**Now:** no hover-bloom anywhere; rail entries don't link to canvas
colonies.
**Decision:** Hover the rail entry → soft outline blooms around that
colony on the canvas, F57 label appears with the bloom. No permanent
labels — preserve the diorama.
**Depends on:** #10 (F57 first use) and #11 (new names). Ship as a
bundle so the hover-bloom debuts with the new register.

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

### 08 · TopColony tells you almost nothing
`polish`
**Now:** still just name + age-in-days + hyphae count (app.js:32-54).
No cap-shape preview, no swatch.
**Decision:** Add cap-shape preview (reuse `HallMushroom` at size=24)
and age in days. Skip trend arrows. Keep the rail in service of
"witness," not "analyst."

### 09 · Loading state is off-voice
`polish · voice` · first impression
**Now:** "awakening…" still in dim mono — app.js:109, research.js:334,
engine.js:38.
**Decision:** Italic serif rewrite first ("the world stirs."). Animation
only if it fits without feeling theatrical.

### 10 · F57 / F35 bitmap fonts are underused
`polish`
**Now:** F57/F35 still only in `atmosphere.jsx:54` and design-side
`preview.js`. No in-world labels.
**Decision:** Use F57 for in-world labels (the hover-bloom from #03 is
the natural first use). F35 micro-stats reserved for a later round.
Don't replace serif/mono — augment.
**Depends on:** #03.

### 11 · Colony names are off-voice
`polish · voice` · naming
**Now:** `NAME_PREFIXES`/`NAME_SUFFIXES` in `app/lib/world.js:10-24`
unchanged — Wiggle, Bobble, Cobble, Bramble + cap/stem/gill/spore/wort.
**Decision:** Rewrite the generator. Made-up names in the
psilocybin-cultivar register (place-names, physical-trait descriptors,
mystical-or-weird). Bundle with #03 so the hover-bloom debuts with the
new register, not the old one.
**Depends on:** #03 (bundled).

### 12 · Mushroom min-spacing rule
`bones · arch` · sim-side
**Now:** no rule enforced. Multiple mushrooms on one colony can pile up
when the fruit-trigger conditions are satisfied at nearby cells in the
same tick. The design mocks placed caps too close together, which
flagged the absence — but the live sim can produce the same pile-up.
**Decision:** Enforce a minimum cell-distance between fruiting events
per colony, or cap fruit density per log section. Sim-side, not
renderer.
**Promoted from:** `DESIGN_NEEDS_WORK.md`, originally "deferred polish."

### 13 · Verify mushroom bloom alpha in live UI
`polish` · verification
**Now:** design dropped warm 0.20→0.10 and cool 0.62→0.30 after Bjorn
flagged "way too high" mid-design. The drop landed in code (visible at
`canvas.js:435`, `baseAlpha = (inCool ? 0.30 : 0.10) * capBudget`) but
was never verified against 8+ live mushrooms in autumn-dusk-equivalent
lighting.
**Decision:** Verification pass — load the live world (or force-seed a
high-mushroom-count scenario), watch under autumn-dusk lighting, tune
if still hot. No code change unless the verification surfaces one.
**Promoted from:** `DESIGN_NEEDS_WORK.md`.

### 14 · Mushroom outline near-black on dark hues
`polish` · cosmetic
**Now:** outline computed as `hsl(hue, sat-12, 22)` in `kit/overlays.jsx`
HallMushroom and in the canvas mushroom painter. At dark hues (purple,
deep-cool) the outline drops near-black and can read as a flat ring
instead of an edge.
**Decision:** Conditional — if it looks off after the next batch of
mushrooms fruits, lift the outline lightness floor (e.g. clamp L ≥ 28
for hues 200–280). Otherwise leave.
**Promoted from:** `DESIGN_NEEDS_WORK.md`.

---

## Needs re-decision

### 07 · Canvas is parsimonious on big screens
`polish` · surface
**Now:** `maxWidth: CANVAS_W` (1280) still in place at canvas.js:600,
but the code grew a comment at canvas.js:594 explicitly defending the
cap: *"maxWidth: native size — never upscale past the pixel buffer
resolution."* That stance is the opposite of the audit's "let it scale
up."
**Audit decision:** Remove maxWidth. Let the canvas scale up (pixelated
rendering preserves crispness). Do it after #04 — re-tune bloom and
vignette as part of the change.
**Tension:** the code now treats the cap as deliberate (preserve pixel
buffer fidelity) rather than parsimonious. Two coherent positions; pick
one before this becomes a ticket. Re-decide with Bjorn.
**Gated on:** #04 regardless.

---

## Done

_Empty. Items move here as PRs ship._

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
