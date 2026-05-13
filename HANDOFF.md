# Almari Shroom — build pause / handoff

> Pausing the v1 build at end of step 9. Continuing with a fresh agent.
> This doc is what that agent needs. Read it cold and you should be ready
> to pick up at step 10 without re-deriving anything.

## Where we are

- **Branch:** `shroom/build`
- **PR:** [Almari#25](https://github.com/saniakhushbakhtjamil/Almari/pull/25) (draft)
- **Tracking issue:** [Bj0rnis/Black-Flower#47](https://github.com/Bj0rnis/Black-Flower/issues/47)
- **Done:** steps 1–9. **Remaining:** steps 10 (acceptance), 11 (deploy), 12 (polish).
- **Last commit:** `chore(shroom): deploy prep — gzip, prod env defaults, README`

The build is **functionally complete for MVP**. It has not yet been deployed
to the server (`shroom.almari` is dark). All work has been local against
`http://localhost:3000`.

## What's been built (steps 1–9 in plain words)

1. **Archaeology.** Read upstream `evochora/evochora @ v0.4.0` (the previous
   attempt's source). Findings + verdict table in
   [EVOCHORA_NOTES.md](EVOCHORA_NOTES.md). One-line summary: port the
   philosophy (substitution-only mutation, scale-proportional perturbation,
   no fitness function, decay-on-death pattern, three-hook plugin shape);
   skip the architecture (H2/Parquet, queues, terabytes-of-replay).
2. **Scaffold.** Stack at `stacks/shroom/` from the dashboard template.
   Express + kit, traefik labels for `shroom.almari`, JSON volume mount.
3. **World sim.** 320×180 grid; genome (10 floats with substitution-only
   mutation); hyphae grow → decay → fruit → spores drift → germinate →
   toofan rolls. Atomic JSON persistence every 200 ticks + on shutdown.
   Volume rotation on toofan (4 flavours).
4. **Nigehban.** Calls Ollama, parses JSON, applies entry / name / action /
   inscribe. Graceful skip on any failure. Tools: sow (per volume),
   kindle / blight / spare (per season). Salience-driven naming candidates.
5. **Canvas renderer.** Three-band cross-section: sky (Stockholm-clock
   gradient with stars), grass + log (capsule shape), soil. Hyphae glow
   (Noita-style bloom; tips brighter than interior). Mushrooms drawn from
   per-colony genes. Spores as drifting motes. Toofan flourish per flavour.
6. **Chronicle + hall of fame.** Right rail: scrolling journal feed grouped
   by volume. Below it: thumbnail strip of inscribed mushrooms across all
   volumes; click for epitaph modal.
7. **Deploy prep.** gzip on `/api/world/snapshot` (234 KB → 26 KB), prod
   env defaults in compose, README written.

## Live state on disk

- Local dev data: `stacks/shroom/app/data/` (gitignored). World is
  persisted; restart picks up where it left off.
- Server data target: `/opt/almari/data/shroom/` (will be created on first
  deploy). Gets backed up by the existing host restic cron automatically.

## Things the next agent needs to know that aren't in commits

**Local Ollama gotcha.** The Mac currently has only `qwen2.5-coder:14b`
installed, not `llama3.2:3b`. The production model is `llama3.2:3b` (lives
in `stacks/ai/` on the server, used by the dashboard's Nigehban chat).
For local dev, either:
```bash
ollama pull llama3.2:3b
```
…or override:
```bash
NIGEHBAN_MODEL=qwen2.5-coder:14b npm run dev
```
qwen-coder is more verbose / florid than llama3.2:3b will be on the
server. The voice on prod will land closer to the handover spec.

**Local dev tick rate.** Production runs `TICK_INTERVAL_MS=3000` and
`NIGEHBAN_INTERVAL_TICKS=600` (~30 min real between Nigehban's time-based
wakes per handover §4). For testing it's useful to run faster:
```bash
MOCK=true TICK_INTERVAL_MS=1000 NIGEHBAN_INTERVAL_TICKS=20 \
  NIGEHBAN_MODEL=qwen2.5-coder:14b \
  node /Users/bjorn/Documents/Projects/Almari/stacks/shroom/app/server.js
```

**Branching is rough.** Hyphae extension uses a two-tier threshold (cells
with 3+ free neighbours extend reliably, junctions occasionally fork,
interior cells dormant). Visibly better than the original "every cell
extends" but still fills denser regions over time. Proper fix wants
per-cell direction memory so tips prefer continuation. **Tracked in polish.**

**Nigehban repetition.** Even with the explicit "do not loop" prompt
addition, entries echo each other. The model sees its last 8 entries in
the snapshot — the more it sees, the more it riffs on same themes. Two
levers for polish: (a) drop `his_recent_entries` from 8 → 3 in
`lib/snapshot.js`; (b) sharpen the prompt's anti-loop instruction.
**Tracked in polish.**

**Per-cell direction memory** would help (b) and (c) of polish, but it's
a real refactor: add a `direction` field to the grid and update
`growHyphae` to score continuation > fork > backfill. Worth doing if
deeper polish round.

**`weather` field.** A toofan sets `world.meta.weather` to the flavor
name and `weatherUntilTick` to `tick + 8`. The tick loop clears it after
that. The canvas reads `weather` to draw the flourish for those 8 ticks.
Don't optimise this away.

**Fruit is a sim marker, not a sprite.** In the sim, a fruit is one cell
of `kind=FRUIT` with metadata `{x, y, colonyId, age, mature, spent}`. The
visual mushroom (cap shape, stem, colour) is drawn by the renderer, not
stored in the grid. So a "mushroom" you see is reading from
`world.fruits[]` and looking up the colony's genome.

**Bootstrap colony pattern.** Both the initial volume-1 boot and the
post-toofan rotation in the debug `/api/debug/toofan` endpoint call
`bootstrapColony(world)` to drop one starter spore on the log. **Step 5
will eventually replace this with Nigehban's actual `sow` tool** — the
bootstrap is a stand-in. Today, Nigehban CAN sow via the JSON output, but
he's only allowed to once per volume, so the bootstrap fires first.
Removing the bootstrap means empty volumes until Nigehban acts (which is
fine for prod feel, not great for testing).

## Step 10 — what to do next

Walk the acceptance checklist from issue #47:

```
[ ] World boots fresh on first start
[ ] Sim ticks visibly in the browser
[ ] State persists across container restart
[ ] Nigehban writes when Ollama is up
[ ] Nigehban gracefully skips when Ollama is down
[ ] Manual toofan works
[ ] Reachable at https://shroom.almari over Tailscale  ← step 11
[ ] Smell test                                         ← step 11
```

Verifying procedure:

```bash
# Start fresh
cd stacks/shroom/app
rm -rf data
MOCK=true TICK_INTERVAL_MS=1000 NIGEHBAN_INTERVAL_TICKS=20 \
  NIGEHBAN_MODEL=qwen2.5-coder:14b npm run dev

# In another shell
curl http://localhost:3000/api/health         # boots
curl http://localhost:3000/api/world          # ticks > 0 after a few seconds
curl -X POST http://localhost:3000/api/debug/toofan       # volume rolls
curl http://localhost:3000/api/journal | jq '.entries|length'   # nigehban writes

# Persistence: kill server with Ctrl-C, restart — tick should resume from saved value, not 0
# Graceful Ollama failure: stop ollama (`pkill ollama` or quit the app) and continue
# triggering wakes; sim keeps ticking, no exceptions, lastError populated in /api/journal
```

Document each pass/fail in a short report. Land any fixes needed.

## Step 11 — deploy

```bash
# Mark PR ready, merge to main
gh pr ready 25 --repo saniakhushbakhtjamil/Almari
gh pr merge  25 --repo saniakhushbakhtjamil/Almari --merge

# Pull on server, bring stack up
ssh agent@192.168.50.11 -p 2222 "cd /opt/almari/repo && git pull"
ssh bjorn@192.168.50.11 -p 2222 "cd /opt/almari/repo/stacks/shroom && docker compose up -d --build"

# Verify reachable, on the user's Tailscale-connected machine
curl -k https://shroom.almari/api/health
```

Then run a real "smell test" — leave the world running for a workday and
check whether: sky has shifted, something happened, Nigehban has written
something worth reading, ≥1 colony looks visibly different from yesterday.
That's the §0 "it's not science, it's fun" gate.

## Step 12 — polish (deferred, all tracked)

Pulled directly from the running todo list:

- (a) Sparse soil-nutrient pockets so mycelium has incentive to grow
  downward and form deep networks (currently soil decreases with depth →
  hyphae bunch near the grass line).
- (b) Slower log exhaustion so volumes last long enough for visible
  evolution within a single volume (currently the log can run out before
  many generations have passed).
- (c) Sharper hypha branching — per-cell direction memory or harsher
  branch threshold. Current two-tier threshold helps but still fills.
- (d) Randomise spore germination spots across log + soil + grass (today
  bootstrap always lands on log).
- (e) Subtle per-colony hypha tint at growing tips (currently all
  cream-yellow; visual identity is only via mushroom caps).
- (f) Nigehban repetitiveness — entries still echo each other. Try
  dropping `his_recent_entries` from 8→3, or sharper prompt.
- (g) Websocket instead of 1 Hz polling, if polling feels janky.

Target: do all of these in step 12, in feel-tuning mode, with the live
sim open. None are correctness fixes; all are "make the world feel right."

## Files & key paths

```
stacks/shroom/
├── README.md            — config + endpoints + deploy
├── HANDOVER.md          — original design (read for context)
├── EVOCHORA_NOTES.md    — what to port/avoid from the prior attempt
├── HANDOFF.md           — this file
├── docker-compose.yml
└── app/
    ├── Dockerfile
    ├── package.json
    ├── server.js         — wiring + endpoints + tick loop
    ├── lib/
    │   ├── world.js      — grid + log generation + sowAt
    │   ├── sim.js        — tick: hyphae/decay/fruit/spores/toofan
    │   ├── genome.js     — 10-float gene + substitution mutation
    │   ├── persistence.js— atomic JSON read/write + journal + hall
    │   ├── snapshot.js   — Nigehban's snapshot (~500 tokens)
    │   ├── salience.js   — naming candidate scoring
    │   ├── grid-snapshot.js — packed grid for canvas
    │   ├── nigehban.js   — Ollama call, parse, apply
    │   └── nigehban-prompt.txt — persona + few-shot + JSON schema
    └── public/
        ├── index.html
        ├── app.js        — root layout, polling, state
        ├── canvas.js     — main scene renderer
        ├── chronicle.js  — journal feed component
        ├── hall.js       — hall of fame strip + modal
        └── style.css

data/                     — gitignored, persistent state
├── current/{world,journal,meta}.json
├── library/vol-NNN.json
└── hall.json
```

## Open decisions deferred to feel-tuning

- Final tick rate (3 s? slower?)
- Time-mapping math (handover wants 1 real day ≈ 1 sim week, but
  current TICKS_PER_SIM_DAY = 50 doesn't tile to that — needs thought
  during the smell test)
- Toofan probability curve (current `prob * 0.08` for fire, `* 0.5` for
  warning — picked by feel, may need tuning after watching long runs)
- Whether to remove the bootstrap colony stand-in once Nigehban's `sow`
  is reliable
- Whether to add subtle hypha tint at tips (handover says cream-yellow
  globally, user noted hard-to-tell-apart visually)
