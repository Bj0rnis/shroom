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

The server is at `the maintainer@shroom-server`.
The repo lives at `/opt/home-server/shroom`, owned by the `agent` user.
Pull and restart as:

```bash
sudo -u agent bash -c 'cd /opt/home-server/shroom && git pull'
docker compose restart shroom
```

**Static JS changes** (anything under `app/public/` or `app/lib/`): restart only, no rebuild.

**Dockerfile or dependency changes**: `docker compose up -d --build`.

Data persists at `/opt/home-server/data/shroom`. Never touch it during a deploy unless
explicitly migrating. The world.json is the living state of the sim — treat it
with care.

`/lab` runs (scenario sandbox) accumulate under `data/lab/runs/sim-N.json` and a
sequence counter at `data/lab/seq.json`. Safe to remove individual run files
to free space — they're regenerable. The lab never touches the live world.

Verify after deploy: `docker logs shroom | tail -10`. Look for `loaded world.json`
and the tick number. A clean restart picks up from the last saved tick.

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
| `THICKNESS_BOX_RADIUS` | 2 | 5×5 box around a candidate cell checked for density |
| `FRUIT_COST` | 500 | Base reserves cost for first fruiting body |
| `FRUIT_COST_FLOOR` | 80 | Minimum cost after repeat-fruiting discount |
| `FRUIT_DISCOUNT_PER_FRUIT` | 0.8 | Multiplicative discount per prior fruit |
| `HYPHA_AGE_LIMIT` | 1 week | Individual cell lifespan |
| `COLONY_PRIME_DAYS` | 60 | Days before old-age decline begins |
| `COLONY_OLD_AGE_DAYS` | 365 | Days at which old-age pressure is maximum |

Branching is controlled by the `freeCount` probability tiers in `growHyphae`:
- `freeCount >= 3` (tip): 30% base extension chance
- `freeCount === 2` (junction): 14% base extension chance
- `freeCount <= 1` (interior): 2% base extension chance

Tips also have a 40% chance of bifurcation (`TIP_BIFURCATION_PROB`) — extending
in two directions in one tick to produce Y-shaped branches. Tuned for
"roots, not worms"; first Y-branch appears around cell ~8 on a healthy colony.

All growth is multiplied by `growthRate` (genome) and `seasonMult` (season).
Winter suppresses growth significantly; spring amplifies it.

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
