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

1. **Cloud drift, multi-layer parallax.** ✅ Shipped (#66) — three depth
   layers, each at its own px/s, wrap-safe.
2. **Star twinkle.** ✅ Shipped (#66) — ~55% of stars wobble with their
   own period and phase, capped at 30% amplitude.
3. **Seasonal sky cues.** ✅ Winter snow shipped (#66) — quiet ambient
   flurries even without a toofan. (Autumn leaves were already
   wired via `cfg.fallingLeaves`.)
4. **Time-of-day mist.** ✅ Shipped (#66) — slim cool ribbon at the
   grass line, peaks at dawn 6.5 and dusk 19.25, all seasons.
5. **Birds passing.** ✅ Shipped (#66) — one V silhouette every ~4
   min of real time, 30s crossing, deterministic per pass.
6. **Toofan visual signatures.** Each storm flavour gets a sky cast
   while the toofan is active and for a window after:
   - Fire — distant smoke columns, orange tint on the sky gradient
   - Flood — falling rain streaks
   - Frost — snow flurries
   - Wind — visible dust streaks, stronger spore and leaf drift

   *Pushed to the back of the queue: toofans are rare events. The sky
   should feel alive on a normal day first.*

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

Items 1–5 shipped on PR #66 — the whole movement scope minus toofan
signatures (which got pushed back: rare events, low payoff per code
line). The remaining items are the three depth refinements (7–9):
spore size/opacity variance, star magnitude variance, mist band
between layers. Mist band may already be partially covered by item
4. Worth merging #66, sitting with it on the live server for a
sim day or two, and revisiting the depth list with fresh eyes.
