# Shroom · Design Kit · Needs Work

Running list of gaps and rough edges in the locked-vision handoff from
claude.ai design (bundle: `AbzrdHOvwW6q-sChNcZ96Q`). Some are missing
pieces; some are mocks that don't survive contact with the live sim;
some are spots where the design Claude clearly ran out of context.

Add to this file as we hit issues during the implementation slices. We
spin issues off the list into the kanban (or back to design-Claude) once
a slice lands.

---

## Confirmed gaps (found in critique pass, before any code)

- **Era scars: only `fire` is implemented in `paintEraScar`.** Notes +
  palette lock all four (fire / flood silt line / frost crack / wind
  stripped patch) — flood/frost/wind we write ourselves from the palette
  tokens. **Slice 4.**

- **Sun & moon hardcoded per `PHASE` preset** (`x:256,y:54` for sun,
  `x:56,y:22` for moon). Live sim wants a trajectory across the day. We
  drive position from our existing `skyForTime()` and feed the atom. The
  kit's atom API accepts `{x,y,r}` already, so the change is local to
  `PHASE` becoming a function. **Slice 3.**

- **Persona wisp position hardcoded `(50,60)`.** Should follow a chosen
  log at a chosen daily hour. Atom gets `{x,y}` from cfg. **Slice 3.**

- **Mock places mushrooms too close together** — purely decorative in the
  mocks, but it tells us the kit has no min-spacing rule. We need that
  sim-side: enforce a minimum cell-distance between fruiting events per
  colony, or cap fruit density per log section. **Deferred polish.**

- **Glow-budget cap (~0.65) is documented but not enforced** in code.
  With many colonies alive the night sky washes out. Cheap clamp:
  `1/sqrt(coloniesAlive)` scaling on tip-glow alpha past N=4.
  **Slice 3.**

- **Mushroom bloom alpha** — design dropped warm 0.20→0.10 and cool
  0.62→0.30 after Björn flagged "way too high" mid-design. Untested in
  app. Verify with 8+ live mushrooms in `autumn-dusk`-equivalent
  lighting and tune if still hot. **Slice 3 / polish.**

- **Mushroom outline uses `hsl(hue, sat-12, 22)`** — goes near-black on
  dark hues; can read as a flat ring. Probably fine; flag if it looks
  off after the port. **Cosmetic.**

## Open questions for design-Claude

(File when slice 4 lands so we have specific gaps to point at.)

- The three missing era scars. Want them designed at parity with
  `fire` (the one mock that exists) so they feel like the same hand.

- A min-spacing or fruit-density rule for cap placement so multiple
  mushrooms on one colony don't pile up.

- Mobile portrait layout — the kit ships desktop only.

---

## Resolved

_Nothing yet. Items move here as we ship the slices._
