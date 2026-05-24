# Sky additions — planning

The world below feels lived in. Look up and time stops. This file is the
scope of work to fix that, captured before any code lands.

---

## What's already alive

| What | How it moves |
|---|---|
| Sun arc | continuous, hour 6 → 19.5 |
| Moon arc | continuous, nighttime |
| Sun/moon bloom | tracks the body |
| Sky gradient | dawn → day → dusk → night |
| Stars | visible at night (no movement) |
| Spores | real sim spores with oscillating drift |
| Nigehban wisp | smokeless-fire at dusk, 19:00–19:30, hovers over one log |
| Autumn fog band | dawn-only in autumn |
| Dawn dew | timed on log and grass |
| Clouds | placed by season seed but **frozen** |

The depth scaffold also exists: sky at the back, distant hills at the
grass line, far-tree silhouettes in front of the hills, then the
foreground. The pieces are there. They just don't move.

---

## What's missing

The biggest single gap: clouds don't move. Beyond that, the sky has no
narrative connection to toofans — storms happen in the journal but
nothing changes visibly above the world.

---

## Scope, ordered

### Movement (sky aliveness)

1. **Cloud drift, multi-layer parallax.** Clouds at two or three depths
   moving at different horizontal speeds. Foreground clouds wider and
   faster; background clouds smaller and slower. The single biggest
   visible fix and it doubles as depth. Wrap at the edges or repaint
   off-canvas.
2. **Toofan visual signatures.** Each storm flavour gets a sky cast
   while the toofan is active and for a window after:
   - Fire — distant smoke columns, orange tint on the sky gradient
   - Flood — falling rain streaks
   - Frost — snow flurries
   - Wind — visible dust streaks, stronger spore and leaf drift
3. **Star twinkle.** Subtle brightness oscillation at night. Restrained
   register — not Christmas lights.
4. **Birds passing.** Occasional silhouette across the sky. Rare enough
   that catching one feels like a moment, not decoration.
5. **Seasonal sky cues.** Autumn brings drifting leaves from the trees
   we already render; winter brings snow flurries even without a
   toofan.
6. **Time-of-day mist.** Extend the existing autumn-dawn fog idea to a
   year-round dawn and dusk mist band at the grass line.

### Depth (spatial)

7. **Spore size and opacity variance.** Some spores feel close, some
   far. Almost free.
8. **Star brightness variance.** Magnitude differences sell the night
   sky as deep, not a wall.
9. **Mist band between far and near layers.** Physical separation
   between the far-tree silhouettes and the foreground.

Item 1 covers depth-from-clouds already; items 7–9 are further
refinement.

---

## What this won't include

- **Mountains or very-far horizon.** Risks cluttering the simple register.
- **Aurora or other strong atmospheric effects.** Wrong voice register.
- **Calendar-aware cues.** The world doesn't know about holidays.

---

## Where the code lives

| File | Role |
|---|---|
| `app/public/canvas-atoms.js` | Pixel-buffer atoms — `paintClouds`, `paintStars`, `paintSunMoon`, `paintFarLayer`, etc. |
| `app/public/canvas.js` | Composition. Reads `snap.spores`, `cfg.cloudCover`, etc. |
| `A.skyPreset(now, season)` | Time-of-day model. |
| `snap.meta.weather` / `snap.meta.toofanPressure` | Toofan state surfaced to the canvas. |

---

## Next pickup

Start with item 1 — cloud drift and parallax. Single self-contained
change, biggest visible payoff. Then sit with the result for a sim day
or two before picking the next item. Sky changes are easy to over-cook.
