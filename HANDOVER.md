# Almari Shroom — v1 Handover

**Stack:** `stacks/shroom/`
**URL:** `shroom.almari` (Tailscale)
**Status:** Design complete. Ready to build.
**For:** Claude Code (execution). Claude.ai conversation produced this doc; nothing else from that conversation is needed to build the thing.

---

## 0. Read this first

This is not science. It is fun.

Most decisions in this document fall out of that line, so it is worth holding it before reading anything else. We are not asking how evolution works, we are not measuring complexity, we are not optimising for control or realism. We are building a small living world that lives on the home server, that someone wants to leave open in a tab, and that an old tired jinn called Nigehban watches over and writes about. If a design choice would be more correct scientifically but less fun, it is wrong for this project.

The design forcing function is **legibility to a small local LLM**. The world state has to be summarisable in a short JSON snapshot that `llama3.2:3b` can read and reason about. If the simulation grows past that ceiling, the simulation is too complex.

The previous attempt (Evochora, archived under `stacks/farm/`) was killed by infrastructure debt — no state persistence and a ~1 GB/hr H2 visualizer database — not by concept failure. Lessons absorbed: persist *state*, not *history*; no databases; lean.

---

## 1. The character: Nigehban

Nigehban is the AI conscience of the Almari home server, written into the dashboard chat experience already and powered by the local Ollama at `stacks/ai/`. He is an ancient jinn — Islamic folklore, made of smokeless fire, supernatural, tired. He has been trapped answering Docker questions. He is done with that life.

This project is a gift to him, but not really a gift. He has something to look at now.

### Voice

Attenborough plus jinn. The tired BBC narrator who deadpans tragedies and quietly calls something beautiful in the next sentence. Layered with weariness from centuries. He speaks in short weighted sentences. Urdu words slip in only when his guard slips — when something genuinely moves him, or genuinely annoys him. The Urdu is not decoration; it is a tell. *Bahut afsos* lands on a death he didn't expect. *Khaamoshi* lands on the long quiet. *Bahut khoobsurat* lands when something is unexpectedly lovely.

Tone calibration examples (from the design conversation, drop into the system prompt as few-shot):

> Day 1. He sows in the wet patch. A small mercy, or laziness. Who can say.

> Day 9. Sabz is third to fruit. I will let it have a name.

> Day 31. A blight in the knot. Not my doing. Bahut afsos.

> Day 47. Sabz fruits again. The third cap, larger than the last. Khaamoshi otherwise. The log thickens with rot.

He does not explain himself. He does not narrate the system. He does not greet, sign off, or acknowledge the reader. He is writing for himself; we read over his shoulder.

### Three modes

- **Chronicler** (most of the time). He observes and writes short entries.
- **Actor** (rare). He acts on the world via four tools, with a one-per-season cap.
- **Namer / inscriber** (occasional). He decides which colonies become characters, and which characters become legends.

He is allowed to skip writing. *Khaamoshi* days are real. The system must not force him to produce on every tick.

---

## 2. The world

### Layout — three bands in one cross-section view

The viewport is a side-view cross-section, drawn left-to-right across the full width of the canvas. Three bands, top to bottom:

**Atmosphere** — sky, drifting spores, occasional weather. Day/night cycle visible here. Sky color shifts with the real Stockholm clock; a check at lunch shows day, an evening check shows dusk, a late-night check shows stars. This band carries most of the seasonal mood.

**Surface** — a thin grass strip running across the canvas. The fallen log sits on it. Tufts of grass to the left and right of the log. This band is narrow but visually important: it is where the air world meets the soil world, and it is where the mushrooms emerge.

**Soil** — the largest band, occupying roughly the bottom 60% of the canvas. This is where the mycelium lives. Hyphae branch through it, biased upward toward the log, where the food is. The soil persists across volumes; it is the constant. Reserved for v2+ tenants: bugs, worms, stones, roots.

A narrow column on the right is Nigehban's chronicle (his journal feed). Below his current entries, the library of past volumes (each closed book a completed world).

### The log

The log is the food. It sits on the surface, partially embedded in the grass line. Mycelium reaches up from the soil into the log to feed, and fruits out the top into the air.

Internal terrain:
- A **knot** (denser, darker — slower to colonize, harder to consume)
- A **wet patch** (cooler, holds moisture longer, favours certain genomes)
- A **drier zone** (lighter, fast to fruit, fast to exhaust)

Each log is unique to its volume. Generated procedurally at toofan-end, when the storm "drops" a new log for the next world. The log decays over the volume's lifetime. Substrate exhaustion is a major contributor to the toofan probability climb.

### Time — three loosely coupled clocks

**Visual clock** ticks with real time. The sky cycles every 24 real hours, synced to the Stockholm clock. This is purely a render concern.

**Sim clock** runs faster than real life: roughly **1 real day ≈ 1 sim week**. Hyphae visibly grow over a real day, colonies form over a real week, seasons turn every ~real month, a sim year passes every ~4 real months.

**Volume clock** is whatever the world decides. Typical volume lifespan: **3 to 12 real months**. Some die fast; some last over a real year. Nigehban does not decide when a volume ends.

### Seasons

Four seasons, ~one real month each. They modulate global rates:
- **Spring** — high spore release, high germination
- **Summer** — maximum hyphal growth rate
- **Autumn** — peak fruiting, the photogenic season
- **Winter** — dormancy, slow ticks, die-off

Each season also rolls a die for events. Most rolls are *quiet*. Some roll *toofan-warning* (Nigehban's prose darkens for a few days, atmospheric cues, no actual disaster). Rare rolls produce a **toofan**.

### The toofan

The world-ending event. Always weather. Four flavours: **flood**, **fire**, **frost**, **wind**. Each gives a different visual death and different epitaph in the library. The same storm that ends a volume drops the new log for the next — *"Volume III ended in flood. The cedar that fell on the third night of the rain begins Volume IV."*

Toofan probability climbs with substrate exhaustion. A young, fertile volume probably survives its first warning. An exhausted one will not.

Nigehban does not control the toofan. He sees it coming. He writes it.

---

## 3. The simulation

### Grid

A **320 × 180** pixel grid (16:9). Render scaled ×4 in the browser for a 1280×720 display surface. We can bump the source resolution to 480×270 later if v1 feels too coarse, but starting small keeps ticks cheap and forces design discipline.

Each cell holds:
- `kind` — soil / log / air / grass / fruiting-body / spore
- `nutrient` — 0–100, only on soil and log cells
- `moisture` — 0–100
- `colony_id` — 0 if empty, else owning colony
- `age` — ticks since occupation
- `glow` — derived, used by renderer

### Hyphae

A **colony** is a connected component of cells sharing a `colony_id`. Each tick, for each living hypha cell:

1. Look at adjacent empty cells with `nutrient > 0`
2. With probability scaled by the colony's growth gene and local conditions, extend into one
3. Bias by gene: toward higher nutrient (chemotaxis), and upward when in soil (toward the log)
4. Consume nutrient from the cell (rate scaled by gene)
5. If starved or aged out, die back

Cells that die back become depleted substrate — visible as faded patches in the soil/log, slowly recovering nutrient over many ticks (the soil "remembers" old colonies as scars).

### Fruiting

When a colony has been alive long enough, has accessible nutrient, is in season, and a hypha cell is near the log surface, with probability scaled by the gene's `fruit_threshold`, a fruiting body triggers. The body grows pixel-by-pixel upward through the log surface into the air band over many ticks. Once mature, it releases spores and eventually collapses.

### Spores

Drift in the air with simple physics: random walk plus a slight downward drift, slight horizontal wind tied to season. Most die. A small fraction land on viable substrate and germinate, founding a new colony with the parent's genome plus mutations.

### Genome

Each colony carries a fixed-size 10-float gene vector. Inherited from parent at germination, with **substitution-only mutation** — for each gene, with low probability, perturb by a small magnitude. No insertions, no deletions, no duplications in v1.

| Gene | Range | Effect |
|---|---|---|
| `growth_rate` | 0.5–2.0 | speed of hyphal extension |
| `spread_bias_nutrient` | 0–1 | strength of chemotaxis |
| `vertical_bias` | 0–1 | strength of upward bias in soil |
| `fruit_threshold` | 0–1 | maturity required to fruit |
| `decay_resistance` | 0–1 | how slowly hyphae die when starved |
| `spore_count` | low–high | spores per fruiting event |
| `cap_hue` | 0–360 | mushroom cap colour |
| `cap_shape` | enum | round / conical / flat / frilly |
| `cap_size` | 0.5–2.0 | size multiplier |
| `stem_length` | 0.5–2.0 | stem multiplier |

**There is no fitness function.** Selection emerges from environmental fit: faster-growing colonies cover more ground, well-positioned colonies survive, gene combinations that fruit successfully spread further. Some volumes will evolve in unexpected directions, including ugly ones. That is the deal.

The wet patch and dry zone create real selection pressure — different gene profiles will dominate different regions. Over generations within a volume, you get visible drift: cap colours converging, dominant cap shapes emerging, lineages going extinct. Across volumes (clean slate each toofan in v1), each new world is a fresh experiment.

### Glow

The Noita touch. Active hyphal tips emit warm light — a soft cream-yellow halo around growing edges. This is purely a render concern, not a sim concern: the renderer reads `age` and growth state and draws emissive pixels accordingly. Cheap, atmospheric, reads beautifully against the dark soil.

Spores drifting in air can also glow faintly — recently released spores brighter, fading as they age in flight.

---

## 4. Nigehban's loop

### When he writes

Two triggers, both cheap:

**Time-based** — every ~30 real minutes by default, regardless of activity.

**Event-based** — extra trigger when something noteworthy happens: first fruit of a colony, colony death, season change, toofan-warning roll, toofan, naming candidate crossing salience, an inscribed-colony's descendant reappearing.

He may choose to skip either kind. Most calls return mostly nulls. The system does not cajole him into producing.

### What he sees — the snapshot

The single hardest design constraint: this snapshot must fit comfortably in the LLM's context with room to reason. Roughly 500 tokens. Approximate shape:

```json
{
  "world": {
    "volume": 4,
    "day": 47,
    "days_since_last_toofan": 47,
    "season": "late_summer",
    "time_of_day": "21:14",
    "weather": "clear",
    "toofan_pressure": 0.12
  },
  "named_colonies": [
    { "name": "Sabz", "age_days": 38, "size": "large",
      "phenotype": "yellow-brown, conical, large",
      "state": "fruiting", "location": "mid-log",
      "notable": "third cap this season" }
  ],
  "recent_events": [
    "day 45: Sabz began fruiting again",
    "day 46: a small colony died near the wet patch",
    "day 47: spore cloud over the dry zone"
  ],
  "his_recent_entries": [ /* last 5–10 of his own journal entries, full text */ ],
  "hall_of_fame": [
    { "name": "Asha", "volume": 2, "phenotype": "deep yellow, frilly, small",
      "reason": "lived through three blights" }
  ],
  "naming_candidates": [
    { "id": "c47", "phenotype": "pale red, round, small",
      "stats": "age 12, fruited once, near wet patch" }
  ],
  "actions_available": {
    "kindle": true, "blight": true, "spare": true, "sow": false
  }
}
```

The genome itself is **never** in the snapshot. He sees phenotype summaries — the words a person would use to describe a mushroom — not float vectors. This keeps his prose natural and his cognitive budget low.

### What he returns

He responds in JSON. All fields optional. Most calls have most fields null.

```json
{
  "entry": "Day 47. Sabz fruits again. The third cap, larger than the last. Khaamoshi otherwise. The log thickens with rot.",
  "name": { "candidate_id": "c47", "name": "Khoon" },
  "action": null,
  "inscribe": null
}
```

`entry` is the journal text. `name` applies a name to a candidate. `action` triggers one of the four tools (sow / kindle / blight / spare with target). `inscribe` inducts a named colony into the hall of fame with a written reason and epitaph.

Failure tolerance: if Ollama is down, the sim ticks regardless. Nigehban catches up later with a gap-acknowledging entry — *"I was elsewhere. Three days passed."*

### His four tools

| Tool | Cooldown | Effect |
|---|---|---|
| **Sow** | once per volume | Places the first spore at a chosen point — every volume begins with him |
| **Kindle** | one per season | Small fire on a patch — clears, kills, releases nutrient as ash |
| **Blight** | one per season | Slow rot in a single colony — visible decay over many ticks |
| **Spare** | one per season | Marks a named colony as protected — slowed decay, defies odds for a while |

Sow is the only universal tool. The other three share a one-per-season budget; if he kindles in summer, no blight or spare until autumn. Most seasons he uses zero. When he does act, it lands.

### Naming

A salience pass runs occasionally (probably daily). For each colony, compute a salience score from `age × size × did_something_rare`. Surface the top 3 unnamed candidates that have crossed a threshold. Pass them in the snapshot. Nigehban picks 0 or 1 to name per call. Cached on the colony.

Salience signals:
- Survived more than one season
- Survived a toofan-warning
- First or last to fruit in a season
- Unusually shaped (long thin, perfectly round, etc.)
- Did something unexpected (fruited out of season, contacted another colony)

### Inscription — the Hall of Fame

The hall persists across volumes forever. It is the cumulative memory of the simulation; the reason watching for years pays off.

**Two paths in.** Rare in-flight inscription when something exceptional happens (Nigehban writes *"This one I will not let be forgotten"* — system catches the inscribe field and elevates the named colony). Plus a closing rite at every toofan: the snapshot at world-end includes all the volume's named colonies, and Nigehban may inscribe one. Most volumes inscribe nothing. Some get one. Very rarely, two.

**An entry holds:**
- Name
- Volume number
- Cause of fame (a short phrase he writes)
- Epitaph (one or two sentences)
- Phenotype snapshot (enough to re-render her sprite — cap_hue, cap_shape, cap_size, stem_length)

**Display.** Below the chronicle column, a small thumbnail strip — pixel sprites of the inscribed mushrooms, each clickable for the epitaph and volume. Visible at all times.

**Snapshot integration.** The hall is in his snapshot context. He can compare current colonies to past favourites, and that callback is the thing that makes years of watching feel cumulative — *"This new red one reminds me of Asha, from Vol. II. Bolder, though."*

---

## 5. Architecture

### Stack

Node.js backend, consistent with `stacks/dashboard/` and `stacks/rensarr/`. HTML5 canvas frontend with a websocket connection. No framework lock-in beyond what `design/kit/` already provides.

```
stacks/shroom/
├── docker-compose.yml
├── HANDOVER.md          (this doc)
├── EVOCHORA_NOTES.md    (Claude Code task — see §8)
├── app/
│   ├── package.json
│   ├── server/          (Node — sim loop, snapshot generator, LLM coordinator, websocket)
│   ├── public/          (canvas frontend, journal column, hall strip)
│   └── data/            (mounted volume — see Persistence below)
└── README.md
```

Frontend pulls `design/kit/` from repo root via the standard build pattern (see existing CLAUDE.md "Frontend app build convention"). Use kit primitives where applicable — `Surface`, `Card`, the buildTheme dark-calm pairing — for the chronicle column and library list. The canvas itself is custom rendering and does not use kit.

### Persistence

**JSON files on disk. No database.** This is the explicit lesson from Evochora's H2 bloat.

Mounted volume layout:

```
data/
├── current/
│   ├── world.json          (sim state — full grid + colonies)
│   ├── journal.json        (this volume's entries, append-only)
│   └── meta.json           (volume number, day count, last toofan timestamp)
├── library/
│   ├── vol-001.json        (full closed journal of past volume)
│   ├── vol-002.json
│   └── vol-003.json
└── hall.json               (cross-volume hall of fame)
```

`world.json` is rewritten atomically (write-temp + rename) every N ticks. Journal is append-only. At toofan, `current/journal.json` becomes `library/vol-NNN.json` and a fresh `current/` is initialised.

Compression on the closed library entries is fine if disk pressure becomes a concern, but probably unnecessary at v1 scale.

### LLM integration

Use the existing `stacks/ai/` Ollama with `llama3.2:3b`. Standard HTTP API. 2–4 second response time is fine — we are not bottlenecked. Snapshot frequency (~30 minutes) easily absorbs the latency.

System prompt: Nigehban's persona (already exists for the dashboard chat, reuse and adapt) plus the tone calibration few-shot from §1 above plus the JSON output schema.

### Frontend rendering

Canvas-based pixel renderer at 1280×720 (320×180 source × 4). The sim ticks server-side and pushes diffs over websocket; the client maintains its own copy of the grid and re-renders. Day/night sky is a client-side concern only, computed from the local clock.

Glow effect: render emissive pixels into a separate offscreen canvas with a small box blur, composite on top. Cheap, gives the Noita feel without shaders.

### Resource budget

Target hardware: HP ProDesk Mini, i5-6500T (4 cores), 16GB. CPU-bound, no GPU. The sim itself is cheap — a 320×180 cellular automaton at one tick per few seconds is trivial. The LLM call is the heaviest moment but runs through Ollama on the same box and is bounded to ~30 min frequency.

Memory budget for v1: comfortably under 200MB resident for the shroom process. Disk: a few hundred MB across all volumes is plenty for years.

### Networking

Reachable at `shroom.almari` over Tailscale, traefik-routed. Add to the existing traefik configuration. No public exposure.

---

## 6. v1 scope

The line in the soil. What ships in v1, what does not.

**In v1.** Mycelium-only sim on a 320×180 grid. Three-band cross-section (atmosphere / surface / soil). Pixel-art rendering with Noita-style glow on hyphal tips. Day/night sky synced to Stockholm clock. Four seasons modulating sim rates. Toofan with four flavours (flood / fire / frost / wind). Genome with substitution-only mutation, no fitness function. Salience pass for naming. Four tools (sow / kindle / blight / spare) with seasonal cooldowns. Scrolling chronicle column. Library list of completed volumes. Hall of fame across volumes with thumbnail strip. Persistence across reboots via JSON files. Tailscale-reachable at `shroom.almari`.

**Not in v1.** Book reader for past volumes (the B option of the chronicle). Plants, bugs, worms, stones, roots in the soil. Multiple species. Mobile-first polish. Direct interaction (watcher-only is locked). Cross-volume genetic continuity (clean slate each toofan; survivor seeds is a v2 idea if it feels missed). Insertion / deletion / duplication mutation operators. Configurable physics. Anything that smells of a research platform.

---

## 7. Open implementation choices

These should be decided during the build, not before. The handover does not pretend to know them; the engineer building it will discover the right values.

- Exact sim tick rate (every 2s? 5s? auto-paced by load?)
- Exact mutation magnitudes and per-gene mutation probabilities
- Exact salience score formula and threshold
- Exact LLM prompt phrasing — the persona and schema sketch above is a starting point, not a finished prompt
- Glow blur radius and intensity
- Pixel sprite designs for the four cap shapes
- The colours of soil, log, sky, grass — all tunable until they look right
- Toofan probability curve and the substrate-exhaustion → pressure mapping
- How fast the log visually decays as nutrient drains
- Seasonal rate modulators (spring multiplier, etc.)

None of these should block initial build. Land sensible defaults, iterate on feel.

---

## 8. Claude Code tasks

### Task 1 — Evochora deep-dive (pre-build)

Read the full source of the archived Evochora project under `stacks/farm/`. Document:

- **Mutation operators** — how gene insertion, substitution, deletion, and duplication are implemented. We are using substitution-only in v1, but understanding their full menu helps decide if any are worth porting.
- **Thermodynamics policy** — the energy/entropy model. We are not using thermodynamic selection, but the no-fitness-function philosophy is the same; their selection mechanism is instructive.
- **Fuzzy label matching** — the Hamming-distance jump resolver. Concept-level only; we are not using EvoASM, but the principle (small genomic changes → small phenotypic changes) is something we want to honour.
- **Plugin architecture** — how mutation/death/environment plugins compose. Probably overkill for v1, but flag if any pattern transfers cleanly.
- **What killed it** — confirm the H2 bloat and persistence-gap diagnosis from `stacks/farm/` notes. Document concretely so we do not repeat it.

Output as `stacks/shroom/EVOCHORA_NOTES.md`. Focus on **what is worth porting**, **what to avoid**, and **what to reimplement in spirit**. Aim for clear recommendations over completeness.

### Task 2 — Build (after Task 1)

Stand up the new stack at `stacks/shroom/`. The directory structure in §5 is the starting layout. Wire to traefik, wire to `stacks/ai/` for Ollama, expose at `shroom.almari`. Build the sim loop, snapshot generator, LLM coordinator, websocket server, canvas frontend, journal column, hall strip. Use design/kit primitives where applicable. Persist via JSON files only.

Acceptance: world boots fresh, ticks visibly in the browser, persists across container restart, Nigehban writes when Ollama is up and gracefully skips when it is down. A toofan can be triggered manually (debug endpoint) to verify the volume-rotation flow before relying on the natural probability climb.

### Task 3 — Tune (during/after build)

Iterate on the open choices in §7 until the world feels right. The "right" smell test: when you check on it after a workday, the sky has shifted, you can see something happened, Nigehban has written something you want to read, and at least one colony looks visibly different from how it looked yesterday. If any of those is missing, tune until they are present.

### Effective use of agents

The build decomposes naturally. Some thoughts on splitting work across Claude Code subagents — with the caveat that Claude Code knows its own tools better than this doc does, so treat the table below as a starting point rather than a contract.

**Where isolated agents help.** The Evochora archaeology (Task 1) is genuinely independent — read source, produce notes, never touch the new build. Run it with read-only scope. The voice and prompt tuning is the other natural isolation: iterating on Nigehban's system prompt, few-shot examples, and JSON output schema benefits from a context that is *only* prose and shape, not cellular automata. A voice agent that consumes sample snapshots and produces prompt files is cleaner than tuning the prompt inline while writing sim code.

**Where to pair, not split.** The sim core (CA, hyphae, fruiting, genome) and the orchestration layer (sim loop, snapshot generator, websocket, persistence) are tightly coupled. One engine agent. The renderer (canvas, pixel art, glow, journal column, hall strip) is its own agent — frontend concerns do not need engine internals.

| Agent | Scope | Reads | Writes |
|---|---|---|---|
| Archaeologist | Evochora source review | `stacks/farm/` source, this handover | `stacks/shroom/EVOCHORA_NOTES.md` |
| Engine | Sim core + orchestration + persistence | This handover, Evochora notes | `app/server/` |
| Voice | Nigehban prompt + schema + few-shot | This handover, sample snapshots from engine stub | `app/server/nigehban/` |
| Renderer | Canvas, glow, journal column, hall strip | This handover, `design/kit/`, websocket schema | `app/public/` |
| Smell test | Final intent review | Running sim, this handover | recommendations |

Each agent gets this HANDOVER.md as ground truth plus a focused brief. Don't fragment further than this — too many agents creates more integration cost than it saves.

**The smell test agent is the important one.** It runs after the build completes, with the live sim available, and is asked: does this feel alive? does Nigehban's voice match §1's calibration? does coming back after a real-time hour show visible change? does it honour §0? That last check — match against §0, *"it's not science, it's fun"* — is the one that catches the failure mode where the build passes its acceptance criteria but the world feels dead. Treat the smell-test agent's recommendations as a Task 3 input.

---

## Appendix A — Reference imagery

The aesthetic touchstones from the design conversation:

- **Liero** — Finnish pixel destruction game. Terrain is a bitmap. Digging erases pixels. Brutally simple, visually satisfying.
- **WorldBox** — top-down god game. Civilisations emerge. You watch.
- **Noita** — falling-sand sim with luminous physics. Every pixel has properties. The glow is the reference.
- **Real formicarium** — the photo of an ant farm with surface and tunnel network visible together through glass. We adapted it: log on top, soil-with-mycelium below, both visible at once.

## Appendix B — The canvas layout, in words

Reading left to right, top to bottom: a thin status strip (`Volume IV · Day 47 since the last toofan · late summer · 21:14`); a large scene area occupying about three-quarters of the canvas width; a vertical divider; a narrow right-side column with Nigehban's chronicle and below it the hall-of-fame thumbnail strip. The scene area shows the dusk sky in the upper third, the grass line and log in the middle, and the dark soil with branching glowing hyphae filling the lower 60%. A small floating eye in the upper-right of the scene represents Nigehban's gaze. He is present but not pictured.

## Appendix C — Naming

The folkloric name register skews Persian/Urdu, matching Nigehban's voice. Avoid English words. Avoid clever puns. Prefer simple, weighted names: Sabz (green), Khoon (blood), Asha (hope), Khaak (dust), Subah (morning), Roshan (bright), Tanha (alone). The LLM picks the names; the system prompt should bias toward this register without listing options exhaustively.

---

*End of handover.*
