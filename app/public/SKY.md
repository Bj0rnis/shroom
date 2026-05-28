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
6. **Toofan visual signatures.** ✅ Shipped (#66) — driven by
   `snap.meta.weather`:
   - Fire — orange-pink sky cast + three narrow smoke columns
   - Flood — cool overcast tint + ~160 diagonal rain streaks
   - Frost — quiet snow flurries (reuses the winter snow block)
   - Wind — warm horizontal dust streaks

### Depth (spatial)

7. **Spore size and opacity variance.** ✅ Shipped (#66) — per-spore
   depth hashed from position; near ones larger and brighter, far
   ones small and faint.
8. **Star brightness variance.** ✅ Shipped (#66) — magnitude curve
   ^2.5 makes most stars dim with a long bright tail; only bright
   stars get the rare shine pixel.
9. **Mist band between far and near layers.** ✅ Shipped (#66) — a
   subtle sky-bot tinted haze ribbon at the far-tree midline. Time-
   of-day agnostic; complements the dawn/dusk mist from item 4.

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

All nine items shipped on PR #66 — the whole sky scope is done.
Merge, deploy, and let it run. Worth sitting with the live world for
a few sim days before opening anything new; the sky just gained five
sources of motion and four toofan signatures, and it's easy to
over-cook from here.

If a follow-up surfaces, the obvious places to look are:
- Smoke column polish — they read pale at small canvas sizes; may
  want a higher base alpha or denser bottom.
- Toofan signature fade-in/out — currently pops in/out the moment
  `weather` changes. A 1–2 second ramp would feel less abrupt.
- Frost-specific tweaks — right now the frost storm looks the same as
  a quiet winter day. May want extra density and a bluer tint when
  `weather === 'frost'`.
