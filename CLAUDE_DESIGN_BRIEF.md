# home-server Shroom — Visual Treatment Brief v2 (for Claude.ai design)

> **How to use this file.** Paste this brief into a fresh chat on claude.ai
> with prototype/canvas mode enabled. Attach the screenshots (§11) and the
> three referenced JS files (`canvas.js`, `hall.js`, `genome.js`). Work
> through the kit one slice at a time — don't try to design everything in
> one go. Bring finalized treatments back as **render specs** (§13) we can
> paste into `canvas.js` / `hall.js` / new modules.

---

## 1. What this is

A small living world that lives on a home server. A side-view cross-section
of a glass case: sky above, grass line, fallen logs on the soil, soil
below. Mycelium colonies grow on the logs and into the soil. Mushrooms
fruit upward. Trees sprout in the soil band, grow into the air, eventually
fall and become new logs. Dead colonies decompose into the substrate.
Seasons turn with the Stockholm clock. Once every couple of years a
**toofan** — flood, fire, frost, or wind — sweeps through and culls;
1–2 colonies usually survive.

The world is **continuous**. There is no reset. An era ends with each
toofan but the soil, the trees, and the survivors carry on.

The reader is not a player. The reader leaves it in a tab and glances at
it across days, weeks, months. **It is not science. It is a garden.**
Every visual choice serves "I want to look at this" over accuracy.

A persona watches over it and writes about it. Right now that persona is
Nigehban (an old tired jinn). Future worlds may have other personas
watching — one at a time, chosen for the colony.

## 2. Aesthetic anchors

- **Terraria** — moody, natural, layered substrate. Refined; Terraria is
  old now, we should go further.
- **Noita** — color and mysticism. Particle granularity. Glow that feels
  alchemical, not neon. Stars dense and twinkly.
- **Juice** — weight, response, life. Subtle wind sway. Dew at dawn. The
  world should feel inhabited even when nothing is happening.

This is a **separate game art kit** — not the dashboard kit. Pixel
native. Inspiration from home-server's mood (dark, calm, restrained) welcome,
but no enforced primitives. You're designing for a 320×180 source canvas
upscaled 4× with `imageRendering: pixelated`. Think pixel game art.

## 3. Three bands + new structure

Top to bottom: **atmosphere · surface · soil**. **The subject lives
underground — soil should dominate the canvas, not sky.** Current v1 has
`GRASS_Y = 99` (55% sky / 45% soil), which over-weights atmosphere. We'll
move `GRASS_Y` up — propose new proportions; ~35% sky / 65% soil is the
starting target. The sim doesn't care; the renderer + log placement
follow `GRASS_Y`. Hyphae get more room to read as filaments, trees stand
taller, sky becomes a strip of mood rather than a stage.

New since v1:

- **Multiple logs** can coexist (trees fall over time, leaving new logs).
  Old logs are slowly eaten down by colonies, then decompose. So at any
  moment you might see one big log + a thin remnant + a fresh fallen log.
- **Trees** stand in the soil band, growing up into the air band over
  real weeks. Four species: oak / birch / pine / willow. Each has a
  trunk and a crown. They eventually fall horizontally and become logs.
- **Dead colony mycelium decays in place** — leaves a slightly darker /
  richer stain in the substrate before being fully cycled back.
- **Eras**, not volumes. The world is continuous; a toofan ends one era
  and begins the next, but the soil, the trees, and the survivors carry
  through. The chronicle should reflect this — the journal isn't reset.

## 4. Time model

**1 sim day = 1 real day.** When something is "old," it has been on the
server for actual months. A typical colony lives 3–6 real months; a
legend can live 1–2 real years. Trees take 3–4 real weeks to mature and
4.5–10 real months to fall. Toofans happen once every 1–2 real years.

This matters for visual aging: a colony you've watched for a month should
look meaningfully different from one that's been there a week. The hall
of fame collects the dead, not the deposed — a colony only ends up there
because she actually lived a long time.

## 5. Grid + canvas dimensions

- Source grid: **320 × 180** (16:9).
- Render canvas: **1280 × 720** (4× nearest-neighbor upscale).
- World layer: crisp pixel art at source resolution.
- Glow / mushrooms / weather overlays: drawn at full 1280×720 with
  smoothing on.
- Grass line: y = 99 in source pixels.

## 6. Genome → render mapping (unchanged from v1)

Each colony has 10 genes; the last four affect rendering directly:

| Index | Gene | Range | Render effect |
|---|---|---|---|
| 6 | `cap_hue` | 0–360 | HSL hue of mushroom cap |
| 7 | `cap_shape` | 0–3 | 0 round · 1 conical · 2 flat · 3 frilly |
| 8 | `cap_size` | 0.5–2.0 | Cap radius multiplier (base 7 px source) |
| 9 | `stem_length` | 0.5–2.0 | Stem height multiplier (base 14 px source) |

Genes 0–5 affect sim behaviour (growth rate, decay resistance, fruit
threshold, spore count, vertical bias, chemotaxis) and don't render
directly — but they shape which mushrooms survive, so the gene pool
visibly drifts over months.

Cap colour in code today: `hsl(${hue} 60% 55%)` fill, `hsl(${hue} 35% 35%)`
outline. Propose better treatments per shape. Each cap shape should have
**depth and weight** — they look like flat decals today.

---

## 7. The kit

Everything we want design-Claude to deliver, in render-spec form. **Don't
try to design all of these at once.** §9 picks the first slice.

### A — Sky + atmosphere
- Day/night gradient with richer dawn/dusk
- Sun position by Stockholm clock, with halo
- Moon with phase (computable from date)
- Stars — Noita-dense, twinkly, occasional shooting star
- Cloud layer that drifts (denser in autumn, sparse in winter)

### B — Weather overlays
- Rain — particles, splashes on log/grass, lingering wet sheen
- Snow — drift accumulation on logs/branches in winter
- Fog — low band on autumn mornings
- Godrays through trees at dawn/dusk
- Mist / heat haze on warm days

### C — Substrate + ground decoration
- Soil — dark, moody, depth gradient with organic flecks
- Log bark — species-tinted, with knots, mossy patches, wet/dry zones
- Grass blades — animated sway, seasonal color shift
- **Stones** — scattered, mossy on the shaded side
- **Moss patches** — on old logs and stones
- **Visible tree roots** — descend into soil from each tree base

### D — Mycelium + mushrooms
- **Hypha tip vs interior** — tips bright cream-yellow + larger glow; older
  hyphae drier, rust-toned, less glow. Subtle per-colony hue at tips
  (desaturated `cap_hue`) so different colonies are visually distinct.
  Should read as **filaments**, not patches.
- **Mushroom caps** — 4 shapes (round / conical / flat / frilly) with
  shading. Highlight implies light from the sky band above. Frilly should
  read as a cluster of small bumps, not a zigzag.
- **Mushroom stems** — slight curve, base flare, species-aware coloring.
- **Spore particles** — Noita-style points with subtle bloom, alpha-fading.
- **Spore puff** when a fruit matures — visible cloud release, ~8 ticks.
- **Bioluminescence at night** — certain mushrooms glow softly after dusk
  (use a gene-derived flag, e.g. `cap_hue` in the cool-blue band 180–240).

### E — Trees
Four species. Each needs:
- Trunk texture (bark style + color)
- Crown shape (broad / sparse / conical / drooping)
- Leaf color per season (spring/summer/autumn/winter)
- Bare-branch look in winter for deciduous species (oak, birch, willow)

Species table:
| Species | Crown | Bark | Notes |
|---|---|---|---|
| oak    | broad, round   | rough, dark         | classic |
| birch  | sparse         | pale, striated      | white trunk |
| pine   | conical        | deeply ridged, dark | needles year-round |
| willow | drooping       | slender, smooth     | yellow-green |

Plus: **falling leaves** in autumn from deciduous trees, accumulating
briefly on the log before decaying.

### F — Toofan flourishes
Each should be distinctive at a glance and hint at *why* this storm
exhausts the world. The flourish holds for ~6 real hours of weather state
after the toofan fires.
- **Flood** — waterline rising, ripples on the surface, reflections
- **Fire** — flicker overlay, embers, ash drift after
- **Frost** — crystals creeping across the logs, breath plumes
- **Wind** — debris streaks, bent grass, leaves/needles torn loose

### G1 — Surface + air life (juice — restraint matters)
Small things to watch for above ground. Restraint matters: too many makes
the world busy. Pick the few that feel right.
- A beetle crossing a log occasionally
- Glowworms near logs at night
- A bird silhouette overhead (rare, season-keyed)
- A spider in a corner of the case — weaves a web, appears and disappears
- Dew drops at dawn on log + grass, gone by midmorning
- Subtle wind sway across grass, tree leaves, tall mushroom caps

### G2 — Underground life (juice in the main band)
The soil is now the dominant band — empty soil reads as void. We need
movement and texture down here without distracting from the hyphae. All
visual only, no sim interaction; they move past the hyphae, around them.
- Earthworms — long segmented bodies, slow burrowing tracks
- Springtails — tiny dots that hop between substrate cells
- Ants — sometimes visible nests, foragers crossing
- Centipedes — fast, long, rare
- Pillbugs / woodlice — slow, segmented, hanging around moist patches
- Fungus gnats — small flying dots that hover at the soil/air boundary
- Beetles burrowing — visible occasionally, leave a small track
- Mycelium-eating mites — appear in dense hypha zones (rare, atmospheric)

Density rule: at any moment there should be **maybe 2–4 small things
moving** in the soil band, not a swarm. They should feel like the world
is alive without making it feel infested.

### H — Personas + journal
**One persona watches at a time.** Nigehban is the active one. Design 3–4
**candidate personas** as alternates we can choose from for future worlds.
Each persona is a sprite + a voice direction + a single line on when this
persona would feel right for a world.

Defaults that fit our universe:
- **Nigehban** (definite) — old tired jinn, smokeless fire, weary BBC
  voice. Urdu words slip out when something moves him. Long memory.
- Other candidates (suggestions, not required) — design-Claude proposes:
  a watching crow, a moth that lives in the case, a small dragon coiled
  around the moon, a child ghost in the soil, an old gardener spirit.
  Each non-human, each otherworldly.

**The journal/chronicle panel** is the persona's writing. It should look
**organic and ancient** — old paper, weathered, dim ink, slight bleed
between letters. Not a chat thread. Not a digital log. The reader is
looking over the persona's shoulder at handwritten observations on
parchment that has aged with the world. Each entry shows date (real days
elapsed) + the entry text. No timestamps to the minute. The current
chronicle panel (white sans-serif on dark) is the *anti-pattern* — we
want the opposite.

If you propose typography it should feel handwritten or like an old
font — design-Claude picks. The aging should be subtle — paper texture,
not novelty.

### I — Hall of fame thumbnails
Memorial sprites. Still and quiet, like museum exhibits. Slight
desaturation. Painterly. Possibly a faint silver/grey halo (memory, not
life). A small name plate beneath.

The reader visits the hall to remember. The hall should feel **sacred** —
slower, more deliberate than the live world.

## 8. Palette

The canvas world has its own palette — not dashboard tokens. The
right column (chronicle + hall) takes design cues from the persona, not
from the home-server kit. Propose a canvas palette spec:
- Sky stops (per time-of-day phase)
- Soil gradient (top to bottom)
- Log base colors (per species)
- Hypha cream
- Mushroom cap saturation curve
- Stone, moss, water (toofan), fire, frost crystals

The world should feel **of a piece** — muted earths and night-darks
dominate; saturation lives in the mushroom caps, the glow, the rare bird,
the dew at dawn.

## 9. How to engage — review the whole plan, then deliver element by element

Don't start producing render specs immediately. The kit only works if
elements share a visual language — palette, density rules, layering
order, what reads at distance vs. when zoomed in. Slicing without that
shared frame gives us locally good elements that don't cohere as a world.

So the flow we want is:

### Step 1 — Critique pass (one response)
Read the whole brief. Then push back on it as a designer would:

- **What's missing?** Elements we haven't listed but the world needs.
- **What conflicts?** E.g. snow on mushroom caps in winter — does that
  read, or does it obscure the cap shape? Frost-toofan crystals vs. the
  winter sky palette. Glow at night vs. the bioluminescence brief — is
  this two systems or one?
- **What assumptions should we challenge?** Band proportions (§3 is a
  starting target — propose your own), the 4 cap shapes, the persona
  candidates, the kit organization itself.
- **What's the right zoom level for the world?** Should the case glass
  be visible as a frame? Should we see beyond the case? (Currently no
  frame — your call on whether to add one.)
- **Anything else that makes the world feel alive that we missed.**

### Step 2 — Locked vision (one response)
Once we've agreed on the kit shape:

- **Palette spec** — sky stops, soil gradient, log species colors, hypha
  cream curve, mushroom saturation range, all the special-purpose colors
  (rain, frost, fire embers, glow, moss, stones, water reflections).
- **Density + layering rules** — what's drawn over what; how many things
  can be on screen at once for each element type; restraint policy.
- **One-line treatment for each kit element** (A–I, every sub-item),
  showing they all sit in the same world.
- **Optional: a single anchor mock** — a wide screenshot-style sketch
  showing many elements together so we can see them cohere.

### Step 3 — Element-by-element render specs
Now produce paste-ready specs, one element at a time. Each spec follows
§13. Order is up to you — propose what builds best on what (we'd guess
A → C → D → E → B → F → G1 → G2 → H → I but defer to the visual logic).

The point of this flow is that **Step 2 locks the cohesion** before
individual specs land. We don't want to discover at slice F that the
toofan flourishes don't match the sky palette decided at slice A.

## 10. Files to attach

- `stacks/shroom/app/public/canvas.js` — main renderer
- `stacks/shroom/app/public/hall.js`   — thumbnail + modal renderer
- `stacks/shroom/app/lib/genome.js`    — gene definitions + phenotypeWords

## 11. Reference screenshot

**One** screenshot is attached: a current view of `https://shroom.home-server`
showing the page layout — left canvas, right column with the chronicle
+ hall strip. Use it as a **reference for the UI shell**, not for the
art. The current rendering is the v1 baseline; most of it is what this
brief is replacing. The chronicle column on the right is the
**anti-pattern** described in §7H (white sans-serif on dark — we want
ancient parchment instead). Everything else in the brief is described
in text rather than shown — the v2 world has been freshly reset, the
sim is still being tuned, and showing more screenshots would anchor the
wrong baseline.

Iterate visually inside the design-Claude conversation. We can render
proposed treatments as Canvas 2D sketches in the chat before they ever
hit the codebase.

## 12. Mobile (lightweight responsive)

The world is primarily a desktop experience — Björn or Sania glances at
it on a Tailscale-connected laptop. But it should also **work on a
phone**, not as a full port, just enough to check in.

Mobile spec:
- **Canvas first.** On phone, the canvas takes the screen. The chronicle
  + hall move behind a swipe-up panel or a small button at the bottom.
- **Draggable canvas.** Touch-drag pans the canvas. Pinch-zoom zooms in;
  release returns to fit. Useful because pixel art at full-screen on a
  phone makes mushrooms readable in detail.
- **No tools or editing on mobile.** No debug endpoints exposed in the
  mobile UI. It's a viewer.
- **The chronicle panel** in mobile is a full-screen sheet when opened —
  same ancient-parchment treatment as desktop, just wider line length.

You don't need to design for tablet specifically — landscape phone is
fine, portrait phone is the target.

Propose breakpoints, touch handlers, and the mobile chronicle treatment
as part of step 2's locked vision.

## 13. Technical constraints (don't break these)

- Plain Canvas 2D context only. No PixiJS, Three.js, sprite libraries.
- World layer stays crisp pixel art (nearest-neighbor upscale).
- Glow/mushroom/weather overlays use smoothing.
- The 1 Hz client polling = anything time-varying must read off `tick` or
  `Date.now()` once per draw call. No requestAnimationFrame loops at 60fps.
- Don't change simulation behaviour. This is visual only. If a visual needs
  data the sim doesn't expose, request it as a snapshot-field addition;
  don't pull from somewhere unstable.
- Don't propose features that need persistent storage beyond what already
  exists (`world.json`, `journal.json`, `hall.json`).

## 14. How design-Claude should output

Each treatment as a **render spec**:

- Function signature (e.g. `drawCap(ctx, x, y, r, shape, hue)`)
- New body, as JS pseudocode or actual JS (canvas 2D API)
- 1–2 sentence rationale ("highlight at top-left implies morning light")
- HSL values + the reason for each color, when relevant
- For animated elements, say what derives from `tick` / `Date.now()` and
  what's static

That way we can paste each spec into the matching place in `canvas.js` or
`hall.js` and decide one at a time whether to keep it.

For the journal aesthetic (§7H): also output the HTML/CSS for the
chronicle panel. That panel is React but uses simple primitives; CSS can
be applied directly.

## 15. What NOT to do

- Don't redesign the simulation. The sim is settled. This is about how it
  *looks*.
- Don't introduce new dependencies. Plain Canvas 2D, plain HTML/CSS.
- Don't replace the pixel-art world layer with smoothed graphics — the
  crisp upscale is deliberate.
- Don't propose treatments that need frame-by-frame animation faster
  than 1 Hz client polling.
- Don't try to make the chronicle panel "modern" — we want it to feel
  ancient and organic.
- Don't tie the canvas palette to the dashboard kit — they're
  separate visual universes.

---

*If you're a future Claude reading this from the design session: the live
world is at `https://shroom.home-server` (Tailscale-only). The author is on
Tailscale. The world has been running since the v2 deploy in mid-May 2026;
how it looks right now is the baseline. The hall of fame already has Khoon
×2 — design the hall around the fact that some entries already have lived,
named history.*
