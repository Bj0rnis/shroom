# CLAUDE.md — shroom

Working rules for this codebase. Read before touching anything.

---

## What shroom is

A persistent alife simulation. Mycelium grows, fruits, and dies. Seasons pass.
A jinn watches and writes. The world runs on a server and is meant to be
observed over days and weeks, not played in minutes.

The sim is the soul of the project. UI changes serve it. Infrastructure changes
support it. New features must make the world stranger or more alive — not just
more complex.

---

## Git workflow

- Always work on a feature branch. Never commit directly to `main`.
- Open a PR. Merge after verification.
- Branch naming: `kebab-case-description` (e.g. `hyphae-branching`, `kit-refactor`).
- Commit messages: imperative, lowercase, specific. `fix: canvas aspect ratio in flex container` not `updated stuff`.

---

## Deploy

The server is reached via the SSH alias `shroom-server` (configured in
the maintainer's `~/.ssh/config` — not committed). The alias resolves to
the home server's hostname/port/user, so `ssh shroom-server` is enough.

The repo lives at `~/shroom` on that host (a symlink to the actual
checkout, set up so the deploy path is clean). The `agent` user that
the alias logs in as owns it.

Pull and rebuild:

```bash
ssh shroom-server 'cd ~/shroom && git pull && git log -1 --format=%H%n%s > app/BUILD_INFO && docker compose up -d --build shroom'
```

The Dockerfile bakes the code into the image (`COPY . .`) — the container
has no bind mount for `/app`. Any change to `app/public/` or `app/lib/`
requires a rebuild, not just a restart. `docker compose restart shroom`
will look like it worked but actually serves the previous image.

The `git log > app/BUILD_INFO` step records the live commit + subject so
`/api/research` can surface a LIVE badge on the matching iter card in the
`/research` dashboard. The file is gitignored — it's a build artifact,
written fresh on every deploy.

Data persists at `/opt/shroom/data/shroom` (separate from the repo path).
Bind-mounted into the container at `/app/data`. Never touch
it during a deploy unless explicitly migrating. The world.json is the
living state of the sim — treat it with care.

`/lab` runs (scenario sandbox) accumulate under `data/lab/runs/sim-N.json` and a
sequence counter at `data/lab/seq.json`. Safe to remove individual run files
to free space — they're regenerable. The lab never touches the live world.

Verify after deploy: `docker logs shroom | tail -10`. Look for `loaded world.json`
and the tick number. A clean restart picks up from the last saved tick.

**Fresh-world wipe — order matters.** To start a fresh sim you must
`docker compose stop shroom` *before* removing `data/shroom/current/`. The
server saves world.json on graceful shutdown, so `docker compose up
--build` (which gracefully stops the old container before swapping
images) will resurrect a wiped world during shutdown. The safe order is:
`stop` → `rm current/world.json current/journal.json` → `up -d`. Build
ahead of time if needed; `--build` is fine on the second `up`.

---

## No bundler

There is no build step. Files under `app/public/` are served directly to the
browser. Babel transpiles JSX at runtime via CDN. Do not introduce a bundler
without planning the deploy workflow change first.

If you add a new `kit/*.jsx` file, add a `<script type="text/babel">` tag to
`index.html`, `engine.html`, and `preview.html` in dependency order:
`tokens → motifs → atmosphere → primitives → overlays → shell → charts`.

---

## Design kit

UI components live in `app/public/kit/`. The layering is:

| File | What it provides |
|---|---|
| `tokens.jsx` | Color palette (`C`), font strings, bitmap fonts (`F57`, `F35`) |
| `motifs.jsx` | Pixel SVG glyphs — `SectionGlyph`, `StageGlyph` |
| `atmosphere.jsx` | `PIX` paint helpers, `PageWallpaper`, canvas surface primitives |
| `primitives.jsx` | `DarkPanel`, `Section`, `KV`, `Subhead`, `Aside`, `Chip` |
| `overlays.jsx` | `HallModal`, `HallDetail`, `DevDashboard` |
| `shell.jsx` | `StatusLeft`, `StatusRight`, `HallTrigger`, `Chronicle` |
| `charts.jsx` | `FruitLadder`, `ReservesFlow`, `TerrainDiagram`, and friends |

New components go into the appropriate kit file first, get demoed on `/preview`,
then get consumed by pages. Never inline a surface that already exists in the kit.
Never hardcode a hex color — use `C.*` from tokens. Read `app/public/kit/KIT.md`
for full kit rules.

---

## Sim constants

Key numbers in `app/lib/sim.js` and what they control:

| Constant | Value | Controls |
|---|---|---|
| `EXTEND_COST` | 2 | Reserves spent per new hypha cell |
| `THICKNESS_MAX` | 3 | Max filled neighbors before extension is blocked |
| `THICKNESS_BOX_RADIUS` | 1 | 3×3 box around a candidate cell checked for density |
| `FRUIT_COST` | 500 | Base reserves cost for first fruiting body |
| `FRUIT_COST_FLOOR` | 300 | Minimum cost after repeat-fruiting discount |
| `FRUIT_DISCOUNT_PER_FRUIT` | 0.8 | Multiplicative discount per prior fruit |
| `HYPHA_AGE_LIMIT` | ~2 months | Individual cell lifespan (cells are network spine) |
| `COLONY_PRIME_DAYS` | 20 | Days before old-age decline begins |
| `COLONY_OLD_AGE_DAYS` | 365 | Days at which old-age pressure is maximum |
| `STARVATION_GRACE_TICKS` | ~6 sim hours | Grace before colony-level starvation retraction starts |
| `STARVATION_RAMP_TICKS` | ~18 sim hours | Additional ticks to ramp to full starvation pressure |

Hyphae cells do **not** die when the pixel of substrate beneath them is
exhausted — they persist as transport pipes connecting absorbing tips to
fruit sites. Starvation is *colony-level*: a network whose total intake
stalls (every tip on dead ground, side-absorption pinned at floor) accrues
a starvation streak and the **perimeter retracts** toward the trunk while
the interior holds. Recovery is 4× faster than buildup — if any tip finds
fresh ground, the streak unwinds. See `BALANCE.md` for the rationale and
any future revisions.

Growth is leader-driven (sim-lab/01). Each colony tracks up to
`MAX_LEADERS_PER_COLONY = 5` "leader" cells — the active exploring tips.
Leaders extend at `LEADER_EXTEND_PROB = 0.15` (tip, freeCount ≥ 3) or
`LEADER_EXTEND_JUNCTION = 0.05` (junction, freeCount = 2). Every other cell
in the network extends at the much slower `NON_LEADER_EXTEND_PROB = 0.012`
and `NON_LEADER_EXTEND_JUNC = 0.002`. On extension, leadership *moves* to the
new cell — the parent becomes static transport infrastructure. Apical
dominance forbids a new bif-born leader within `APICAL_DOMINANCE_RADIUS = 15`
cells of another leader, forcing spatial separation between concurrent
descents. Leaders senesce after `LEADER_LIFESPAN = 120` extensions.

Bifurcation produces Y-shaped branches: when a leader extends, it rolls a
second extension into a different free neighbour at `TIP_BIFURCATION_PROB =
0.30` (above grass) or `TIP_BIFURCATION_PROB_SOIL = 0.55` (in soil — added
sim-lab/04 for lattice formation). In soil the bif-child also gets a 4×
weight bias toward neighbours perpendicular to the parent's move — that's
what produces the painting's lateral lacework instead of a fat single
bundle.

All growth is multiplied by `growthRate` (genome) and `seasonMult` (season).
Winter suppresses growth significantly; spring amplifies it.

---

## Sim lab

The lab under `app/lib/sim-lab/` is where sim-tuning iterations happen. Three
docs, three concerns:

| File | What it is |
|---|---|
| `RESEARCH.md` | The paper — vision targets and the reasoning behind them. Update when a vision is achieved or retired. |
| `NOTES.md` | The journal — one terse entry per iteration. Hypothesis, result, reading, next. |
| `PROCESS.md` | The contract — how the loop runs, what the agent may decide alone, when to escalate. **Read before iterating.** |

The lab is *semi-automated*: the agent runs the loop without checking in,
but PRs to main are the surface where the maintainer sees the work. `PROCESS.md`
defines escalation criteria — read it before assuming you need permission,
and read it before assuming you don't.

The active mechanic (leader-cells today) is a hypothesis, not a contract.
`PROCESS.md` lists alternatives the agent is licensed to try.

---

## Nigehban

Nigehban is the jinn who observes the world and writes in the journal. He is
implemented in `app/lib/nigehban.js` and called from `app/server.js`.

He writes in English and Urdu. He is unhurried. He is triggered by events
(first fruit, colony death, season change, toofan warning) and by a periodic
wake on `NIGEHBAN_INTERVAL_TICKS`. A hard floor (`NIGEHBAN_MIN_GAP_TICKS`) and
a daily cap prevent runaway API spend.

When writing prompts or changing his behavior: keep him ancient, observational,
and emotionally sparse. He notices things. He does not explain them.

---

## Voice

Shroom has a voice — in the journal, in the `/engine` field guide, in this
document. It is:

- Spiritual but not vague. Every word earns its place.
- Serious but not dry. There is strangeness here and it is treated as real.
- Old-world without being affected. No emoji. No exclamation marks.
- Urdu words appear where they belong. They are not decoration.

When writing UI copy, journal prompts, or documentation: match this register.
The world is small and serious and alive. Write accordingly.

---

## What not to do

- Do not add features that do not serve the sim or the people watching it.
- Do not commit to `main`.
- Do not hardcode colors, font strings, or magic numbers in page files —
  they belong in the kit or in sim constants.
- Do not introduce a bundler, a CSS framework, or a component library.
- Do not silence Nigehban's errors without logging them — quiet failures are
  hard to diagnose.
- Do not touch `data/` on the server during a deploy.
