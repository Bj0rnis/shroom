# Evochora archaeology

> Pre-build notes for Shroom v1. Source read: upstream `github.com/evochora/evochora` at `v0.4.0` (the same release the previous wrapper pulled). The wrapper only kept Dockerfile, conf, and exporter — so the actual source dive happened against a fresh clone of the upstream Java codebase.

## TL;DR

Evochora is a research-grade artificial-life platform: organisms are programs in a custom spatial assembly language (EvoASM) that live on an n-dimensional toroidal grid, replicate, mutate, and die under thermodynamic constraints. It is well-engineered, well-tested, and built around a non-negotiable design choice: **record every tick, store everything, allow full replay across terabytes of telemetry**. That choice is what killed it on the home server.

For our project that one decision is exactly the one we don't want. The good ideas worth borrowing — fuzzy label matching, plugin SPI, decay-on-death, scale-proportional value mutation — are conceptual, not architectural. We can reimplement them in JavaScript at one-thousandth the size.

The verdict table is at the bottom. Five topics in between.

---

## 1. Mutation operators

Evochora ships four birth-time mutation plugins, all implementing `IBirthHandler.onBirth(child, environment)` which fires once per newborn organism after FORK. Each is configured with a per-newborn probability plus operator-specific knobs.

**Substitution** (`GeneSubstitutionPlugin.java`). Picks one molecule from the newborn's owned cells via weighted reservoir sampling, applies a type-specific mutation, writes back. The clever bits:

- **CODE molecules** flip to a different opcode chosen from one of three pre-computed lookup tables: *operation-flip* (same family + variant, different operation), *family-flip* (same operation + variant, different family), *variant-flip* (same family + operation, different variant — constrained to the same arity group so instruction length never changes). All three tables are built once at init from the registered ISA. Every mutation result is guaranteed valid.
- **REGISTER molecules** are perturbed by ±1 with bank-aware clamping (a DR stays a DR, an FPR stays an FPR).
- **DATA molecules** use **scale-proportional perturbation**: `delta = max(1, round(|value|^exponent))`, then a uniform random offset in `[-delta, +delta]`. Default exponent ~0.5–0.7 means small values change relatively a lot, large values change relatively little. *This is a small but lovely idea.* Smooth fitness landscapes without hardcoded magnitudes.
- **LABEL / LABELREF** flip N random bits in the 19-bit hash. Pairs with the Hamming-distance jump resolver (§3) — small Hamming change ≈ small phenotypic change.
- **ENERGY and STRUCTURE never mutate.** They are world-substance, not genome.

**Insertion** (`GeneInsertionPlugin.java`). Builds a syntactically valid instruction chain (CODE molecule + type-correct argument molecules per the instruction's `OperandSource` list) and places it into a contiguous run of empty cells in the organism's body. Most of the file is the NOP-area finder — scan-line grouping perpendicular to the direction vector, toroidal wrap handling, reservoir sampling among qualifying runs. The mutation idea itself is one paragraph; the spatial bookkeeping is most of the code.

**Deletion** (`GeneDeletionPlugin.java`). Picks a LABEL via weighted sampling (weight = `count^exponent`, biases toward duplicated labels), then walks forward in the organism's direction vector deleting molecules until it hits another LABEL, a STRUCTURE, or a foreign molecule. This couples directly with duplication: redundant copies are preferentially deleted (neutral); unique genes rarely (lethal, filtered by selection).

**Duplication** (`GeneDuplicationPlugin.java`). Reservoir-samples a LABEL, finds the largest empty run on a random scan line, copies the gene there. Inspired explicitly by Ohno's gene-duplication-then-divergence model. The duplicated block is immediately neutral but provides raw material for substitution.

### What's worth porting to shroom

We are using **substitution-only** in v1 by design. The handover is right: it's the simplest operator, gives the smoothest evolution, and our genome is a 10-float vector — no instruction-stream ergonomics to worry about. But borrow:

1. **Scale-proportional perturbation** for our floats. `delta = max(small_eps, |value|^k)` for some `k ∈ [0.3, 0.7]` reads as "values near zero jiggle a lot, values near range-max jiggle a little." Better than uniform `[-eps, +eps]` and cheap. **Reimplement in spirit.**
2. **Per-gene weight on substitution probability.** Not all genes deserve the same mutation rate; `cap_hue` drifts often, `growth_rate` drifts rarely. **Port the concept**, not the code.
3. **No-op-detection.** Evochora skips a substitution if `newValue == oldValue`. Trivial, save the log. **Port.**

### What to skip

Insertion / deletion / duplication don't apply — our genome has no length. The NOP-area finder, scan-line bookkeeping, and toroidal wrap arithmetic are all irrelevant to a fixed-size float vector.

---

## 2. Thermodynamics & selection philosophy

Evochora's headline design claim is **no fitness function**. There is no global culling, no task-based reward, no leaderboard. Selection is *implicit*: every instruction costs energy and accumulates entropy; an organism dies when energy hits zero or entropy crosses a threshold. Survival depends on whether an organism can harvest more energy than it spends.

The mechanism lives in two places. `IThermodynamicPolicy` (`spi/thermodynamics/`) is the SPI: each instruction execution produces an `(energyCost, entropyDelta)` pair given a `ThermodynamicContext` (instruction, organism, environment, resolved operands, optional target cell). `UniversalThermodynamicPolicy` is the concrete one that does almost all the work — a HOCON-driven rule engine with three layers:

- **Base values** (always added — `base-energy`, `base-entropy`).
- **Read rules**, applied when the instruction has a target cell, keyed by ownership (`own` / `foreign` / `unowned`) × molecule type. Reading your own cell is cheap; reading a foreigner's is expensive (default 500× more); reading an ENERGY cell *gives* you energy (`energy-permille = -1000`). This is how organisms eat.
- **Write rules**, applied when a molecule is being written. POKE-ing CODE/DATA *reduces* entropy (negative `entropy`) — writing structured information is order, and order costs.

The `permille` mechanic (per-thousand) lets costs scale with the molecule's value. PEEK-ing an `ENERGY:10000` cell with `energy-permille = -1000` returns 10000 units of energy. POKE-ing a high-value DATA cell costs proportionally more. Five sibling policies exist (`FixedCostPolicy`, `PeekThermodynamicPolicy`, `PokeThermodynamicPolicy`, `PeekPokeThermodynamicPolicy`, `UniversalThermodynamicPolicy`); the universal one subsumes the others and is what the default config uses.

The deep idea here — **selection without a fitness function** — is the part of Evochora's philosophy that the shroom handover already endorsed (§3 of HANDOVER.md). We are *not* doing thermodynamic accounting at the molecule level, but the principle is the same: no global score, no culling, survival emerges from environmental fit.

### What to port

1. **The "no fitness function" stance.** Already in the handover. This is not Evochora's idea — it goes back to Tierra and Avida — but Evochora is the cleanest modern implementation. **Port the philosophy.**
2. **Local-cost selection.** Hyphae cells consume nutrient from their cell. Cells that can't find nutrient die. Cells in good neighbourhoods spread. The "thermodynamic" framing maps onto our `nutrient` field cleanly: a hypha that exhausts its substrate dies; one that finds rich substrate spreads. No fitness function needed. **Reimplement in spirit.**
3. **Reading own vs foreign cells is differently expensive.** Our analogue: a colony spreading into another colony's territory should pay a cost. Not in v1 — colonies don't interact in v1 — but worth holding for v2 when colonies meet.

### What to skip

The whole HOCON rule engine. We have no instructions, no operands, no read-rules-by-ownership. A 50-line tick function with `nutrient -= consumption` is the entire thermodynamics for our world.

---

## 3. Fuzzy label matching (Hamming-distance jump resolver)

Evochora's most distinctive runtime feature. Conventional VMs jump to exact addresses; Evochora jumps to *labels by similarity*. A label is a 19-bit hash; a `LABELREF` in code is also a 19-bit hash; `JMP` finds the **closest** matching label by Hamming distance.

`PreExpandedHammingStrategy` (`runtime/label/`) is the implementation. The trick: store each label only under its exact value, but at search time iterate the query's Hamming neighbours in stages of increasing distance:

- Stage 0: exact match (1 lookup)
- Stage 1: single-bit flips (20 lookups)
- Stage 2: double-bit flips (190 lookups)
- Stage 3: triple-bit flips (1140 lookups)

Bit masks are pre-computed at class load. Each stage's score baseline is `K × hammingWeight`; if the current best score is already below the next stage's baseline, that stage is skipped entirely. Ties broken by physical distance (toroidal Manhattan), then ownership (own labels beat foreign), then owner ID for determinism.

There's a stochastic option (`selectionSpread > 0`) that picks among own-exact-matches with weighted reservoir sampling — a label twice as far away has half the chance. This enables "duplication + divergence": after gene duplication, *both* copies get a chance to be the jump target, weighted by inverse distance. Beautiful idea for genome-level evolution.

### Why this matters for shroom

The principle Evochora is honoring with this design: **small genomic changes produce small phenotypic changes.** A mutation that flips one bit of a label hash usually still resolves to the *same* label (Hamming-1 from itself); occasionally it resolves to a *near* label (Hamming-1 from a different existing label). Step changes, not cliff edges.

For our genome — a 10-float vector — this is automatic. Float perturbation is already smooth. We do not need Hamming-distance machinery.

### What to port

1. **The principle.** Smooth phenotype landscape. Already implicit in our design — float vector with small perturbations on substitution. **Reimplement in spirit, no code needed.**
2. **The aesthetic of "near-miss is fine."** When Nigehban looks at a candidate colony and asks "does this remind me of Asha from Vol. II?", he's doing fuzzy matching by phenotype. Let the LLM do that with words; don't engineer a similarity metric. **Reimplement in spirit, in prose.**

### What to skip

The pre-expanded bit-mask machinery. We have no labels, no jumps, no VM. The Hamming machinery is gorgeous engineering for the wrong problem (for us).

---

## 4. Plugin architecture

Three SPIs, all extending `ISimulationPlugin` (which extends `ISerializable`):

- **`ITickPlugin`** — `execute(simulation)` once per tick, before Plan-Resolve-Execute. Used by `SeedEnergyCreator`, `GeyserCreator`, `SolarRadiationCreator`. Full read/write access to environment + organisms.
- **`IBirthHandler`** — `onBirth(child, environment)` once per newborn, post-FORK, pre-genome-hash. Used by all four mutation operators.
- **`IDeathHandler`** — `onDeath(deathContext)` once per dying organism, with **restricted access** to only the dying organism's cells (so future parallelisation is safe). Used by `DecayOnDeath` (replaces dead organism's molecules with a configured replacement, e.g., `ENERGY:100` for nutrient recycling, or `CODE:0` for empty).

Plugins are loaded by HOCON config: each entry has `className` + `options`, and the loader reflects-instantiates with constructor `(IRandomProvider rng, com.typesafe.config.Config options)`. This is how Evochora keeps its core untouched while letting researchers swap mutation operators, energy distributions, and death behaviours.

The `DecayOnDeath` plugin is the smallest one in the codebase (~80 lines) and a complete example of the pattern: parse `replacement` molecule from config, on each death iterate owned cells via the restricted context, replace non-empty cells.

### What to port

1. **The three-hook decomposition** is sound architecture for any sim with a Plan-Resolve-Execute loop:
   - *tick* (before the step, world-level events)
   - *birth* (on creation, mutation pipeline)
   - *death* (on removal, decay/recycle)
   We will have analogous moments. **Port the hook structure.**
2. **Decay-on-death by parameterised replacement.** When a colony dies, what does it leave behind? Evochora's answer: configurable. Could be empty (`CODE:0`), could be food (`ENERGY:100`). For us: dead hyphae become depleted substrate (nutrient ~0, slowly recovering — the soil "remembers" old colonies as scars). Same pattern: parameterised, not hardcoded. **Port the pattern.**
3. **HOCON-style config for tunable knobs.** Not literally HOCON — JSON or YAML is fine. The shape: every plugin/system reads from a single config object, defaults live in code, overrides in a file. **Port the discipline.**

### What to skip

The reflection-based plugin loader. We have one engine and one renderer; we don't need plugin discovery or hot-swap. Hardcoded `if`/`else` against a `behaviour` config string is enough until we have two of something.

The `ISerializable` machinery (saveState/loadState as `byte[]`). For state persistence we serialise the world to JSON, not bytes. The Evochora pattern is over-built for our scale.

---

## 5. What killed it

The cause-of-death diagnosis from CLAUDE.md ("no state persistence, H2 visualizer DB grew ~1 GB/hr") is *symptomatic*. Reading the source, the deeper diagnosis is **architectural**: Evochora's core design records every tick for full replay. From the README: *"Evochora records every tick for full replay. Allow sufficient disk space for long-running experiments. The default heap size is 8 GB."* From `ARCHITECTURE_DECISIONS.md`: *"the simulation generates megabytes of state data per tick, accumulating to terabytes of telemetry over long evolutionary runs."*

Concretely:

- Every tick produces `TickData` that flows through a queue → persistence service → indexer services → database.
- The default storage is **H2 with Parquet** for the analyzer, plus **H2 topics** for inter-service messaging. `datapipeline/resources/database/h2/` contains five storage strategies; `topics/H2TopicResource.java`, `H2TopicWriterDelegate.java`, etc.
- `evochora.conf` for the home server did the right thing: disabled `h2-console` and `h2-tcp-server`. But that only disables the *consoles* — the storage strategies still run. `pipeline.tuning.samplingInterval = 10` (sampled every 10 ticks instead of every tick) was a downsampling attempt. Not enough.
- The prior Prometheus exporter (`exporter/main.py`) explicitly comments: `Parquet I/O is slow; parallel requests cause contention` — calls had to be sequentialised against the analyzer to avoid stalling.
- The Docker wrapper tried to box it: `cpus: 0.1`, `-Xmx2g`. The architecture doesn't fit boxed. It's designed for *cloud-scaling* (the same arch decisions doc mentions SQS/Kafka/S3 as drop-in replacements). The home server is one i5-6500T with 16 GB RAM.

The H2 visualizer DB growing at ~1 GB/hr was the symptom we noticed first. It would have grown faster on bigger worlds. The persistence-gap (colony state reset on container restart) is a separate symptom — Evochora can resume from a checkpoint, but the wrapper wasn't configured for it, and nobody was going to babysit checkpointing on a home server.

### Lessons for shroom

1. **Persist state, not history.** This is *the* lesson. Our world.json holds a snapshot; journal.json is an append-only chronicle (small text, not sim state); library/ holds closed volumes (final journals + hall sprites, kilobytes each). Years of running shouldn't grow past ~100 MB. **The handover already absorbed this.**
2. **No databases.** JSON files on disk, atomic write-temp + rename. **The handover already absorbed this.**
3. **Cap the simulation surface.** 320 × 180 = 57 600 cells. Each cell maybe 8 bytes packed. Whole grid <500 KB in memory. Tick cost is irrelevant on the i5-6500T. **The handover already absorbed this.**
4. **Don't build for cloud-scale on a home server.** No queues, no topics, no service-oriented architecture. One Node process, one renderer, one Ollama call every 30 minutes. **Implicit in the handover.**
5. **Don't trust a research platform's "low-resource mode."** Even with H2 console disabled and CPU clamped to 0.1, Evochora's storage layer still ate disk. The architecture's gravitational pull wins. If a tool's design philosophy is "record everything for replay", you cannot configure it into "record nothing." **General lesson, not in the handover, but worth holding.**

---

## Verdict table

| Concept | What | Recommendation | How |
|---|---|---|---|
| Substitution-only mutation | Pick one gene, perturb, no insert/delete/duplicate | **Port (already in handover §3)** | Float vector, per-gene mutation rate |
| Scale-proportional perturbation | `delta = max(eps, |v|^k)` | **Port** | Apply to floats during substitution |
| No-fitness selection | Survival emerges from environmental fit, no global culling | **Port (already in handover §3)** | Hyphae die when nutrient runs out, not when ranked low |
| Local cost / local benefit | Reading cells has type- and ownership-dependent cost | **Reimplement in spirit** | Hyphae consume cell nutrient at rate scaled by gene |
| Fuzzy label matching | Hamming-distance jump resolver | **Skip the machinery, port the principle** | Smooth phenotype landscape comes free with float genome |
| Plugin SPI (tick / birth / death) | Three hooks around the loop | **Port the hook structure** | Functions, not classes; one engine, no reflection |
| Decay-on-death | Parameterised replacement molecule | **Port the pattern** | Dead hyphae → depleted substrate, recovers slowly |
| HOCON config + class-loader | External tunables, reflection-based loading | **Port the discipline, skip the loader** | JSON config, hardcoded behaviour switches |
| Record every tick | Full-replay telemetry | **Avoid** | Snapshot state; journal is short text |
| H2 / Parquet / databases | Pipeline persistence stack | **Avoid** | JSON files, atomic write-temp + rename |
| SOA + queues + topics | Decoupled hot/cold path | **Avoid** | One Node process |
| 8 GB default heap | Designed for memory-rich hosts | **Avoid** | <200 MB resident is the v1 target |

**Net:** the conceptual debt to Evochora is real (substitution-only mutation, no-fitness selection, plugin hooks, decay-on-death — all four are improvements over a naive sim). The architectural debt is zero — none of Evochora's infrastructure should appear in shroom. We owe its philosophy a mention; we owe its codebase nothing.

---

*End of notes. Next step: build per HANDOVER.md §8 Task 2.*
