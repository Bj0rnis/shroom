<img src="shroom-header-1280x400-2.png" width="100%" alt="shroom" />

# shroom

A small living world runs here. Mycelium spreads through a fallen log.
Mushrooms fruit, release spores, and die. Seasons turn. Colonies are born with
a name and a genome, and the oldest ones are inscribed into a hall that persists
across volumes.

Nigehban — a jinn, old and unhurried — watches over the world and writes in the
journal. He calls a language model to do this. He does not always write. When
the world is quiet, he stays quiet too.

The simulation runs continuously on a server. One sim day is one real day.
Colonies live and die across weeks. Volumes close when a world-ending storm
(toofan) arrives. A new volume begins.

---

## What it is

A living pixel-art alife simulation, built to run persistently and be observed.
Not a game. Not a screensaver. Something closer to a terrarium that you can
check on.

- **Mycelium** grows cell by cell through soil and log substrate, branching
  when reserves allow.
- **Fruiting bodies** emerge when a colony is old and rich enough. Each one
  costs reserves. They mature, release spores, and decay.
- **Spores** drift on the breeze and germinate into new colonies — or don't.
- **Toofan** is the storm that ends a volume: fire, flood, frost, or wind.
  Colonies that fruited before it came are inscribed in the Hall of Fame.
- **Nigehban** observes all of it and writes in a journal, in English and Urdu.

---

## Where the world is right now

The sim runs continuously on the maintainer's server. The current world is
**volume 1**, somewhere around day 233 at the time of writing. Mycelium
grows under the rules shipped in sim-lab iter-66 (see `The lab` below) —
two new mechanics on top of the long-standing leader-cell foundation:

- a per-colony **vertical bias** that lets some founders favour going
  deeper than others
- a **DLA-style edge preference** in soil so tips lean toward open space
  instead of crowding

Nigehban writes when the world moves him. The Hall of Fame keeps the
oldest colonies inscribed across volumes.

---

## Stack

- **Backend** — Node.js + Express. No database. State is a JSON file, written
  atomically every ~200 ticks and on shutdown.
- **Frontend** — HTML5 canvas + React in the browser. No bundler. Babel
  transpiles JSX at runtime. Pixel-art design kit under `app/public/kit/`.
- **Canvas** — custom renderer, 320×180 upscaled 4× to 1280×720. Pixel-perfect.
- **LLM** — Nigehban calls `claude-haiku-4-5` via the Anthropic API. The sim
  keeps ticking if the call fails. He just stays silent.

---

## Running locally

```bash
cd app
npm install
MOCK=true npm run dev   # → http://localhost:3000
```

`MOCK=true` skips the Docker socket check. Nigehban needs an API key to write:

```bash
ANTHROPIC_API_KEY=sk-ant-… MOCK=true npm run dev
```

---

## Self-hosting (Docker)

For running shroom on your own server. Uses port 3000 directly — put a
reverse proxy (Caddy, nginx, Traefik) in front if you want HTTPS or a
custom domain.

```bash
cp .env.example .env             # fill in ANTHROPIC_API_KEY
mkdir -p ./data
docker compose -f docker-compose.selfhost.yml up -d
# → http://localhost:3000
```

The world persists in `./data` on the host. Back it up if it matters to
you — `data/current/world.json` is the entire living state of the sim.

To update: `git pull`, then re-run the same `docker compose ... up -d`
command with `--build`. The container picks up from the saved world on
restart. See `CLAUDE.md` for the wipe-vs-restart safety notes.

`docker-compose.yml` (in the repo root) is the upstream maintainer's
Traefik-flavoured setup, kept as a reference; `docker-compose.selfhost.yml`
is what you want if you're starting fresh.

---

## Configuration

Copy `.env.example` → `.env` beside the compose file and fill in your
`ANTHROPIC_API_KEY`. Everything else has sensible defaults.

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(required)_ | Nigehban's voice. |
| `SHROOM_HOST` | `shroom.local` | Traefik routing only — ignore if using `docker-compose.selfhost.yml`. |
| `NIGEHBAN_MODEL` | `claude-haiku-4-5` | Any Claude model ID. |
| `TICK_INTERVAL_MS` | `3000` | Real ms per sim tick. |
| `NIGEHBAN_INTERVAL_TICKS` | `600` | Periodic wake interval (~30 min real). |
| `NIGEHBAN_MIN_GAP_TICKS` | `200` | Hard floor between any two calls (~10 min). |
| `NIGEHBAN_DAILY_CAP` | `48` | Max calls per rolling 24h. Set `0` to silence him. |
| `MOCK` | unset | `true` for local dev. |
| `NIGEHBAN_DEBUG` | unset | `1` to log raw model responses. |
| `SHROOM_DEV` | unset | `true` enables `/api/dev/*` — don't expose publicly. |

---

## Persistence

The world's state lives in a bind-mounted `data/` directory on the host
(`./data` if you use `docker-compose.selfhost.yml`). Structure:

```
data/
├── current/
│   ├── world.json     full sim state (~600 KB)
│   └── journal.json   Nigehban's entries for the active volume
├── library/
│   └── vol-NNN.json   closed journals from past volumes
└── hall.json          inscribed colonies, persists across all volumes
```

---

## Pages

| URL | What it is |
|---|---|
| `/` | The world. Canvas + live colony leaderboard + journal. |
| `/engine` | Field guide to the simulation — how everything works. |
| `/preview` | Design kit workshop. Every component in isolation. |

---

## Debug endpoints

All `POST`, all return JSON.

| Endpoint | Effect |
|---|---|
| `/api/debug/sow` | Sow a random colony at a random log location. |
| `/api/debug/toofan?flavor=fire` | Trigger a storm. Flavors: flood / fire / frost / wind. |
| `/api/debug/nigehban-wake` | Force-wake Nigehban regardless of cooldown. |
| `/api/debug/inscribe` | Inscribe the top alive colony into the hall. |
| `/api/debug/save` | Force a world.json save now. |
| `/api/debug/reset` | Wipe and start a fresh volume 1. |

---

## Read-only endpoints

| Endpoint | Purpose |
|---|---|
| `/api/health` | Liveness. |
| `/api/world` | Meta + counts + top colonies + recent events. |
| `/api/world/snapshot` | Full grid, gzipped, for the canvas. |
| `/api/journal` | Nigehban's entries + usage state. |
| `/api/hall` | Hall of fame across all volumes. |
| `/api/engine-spec` | Live sim constants for the engine page. |

---

## Contributing

This is an open source project. The sim is the thing — changes that make the
world stranger, richer, or more alive are welcome. Changes that make it faster
to build on or easier to run are welcome. Changes that add complexity without
adding life are not.

Read `CLAUDE.md` before working on the code. Read `app/public/kit/KIT.md`
before working on the UI.

---

## The lab

Shroom is also a small research project. The live sim has a sibling — a
deterministic, headless lab that runs the same simulation against five
hand-picked seed worlds and scores the result against a *vision* of what
the world should look like.

Lives under `app/lib/sim-lab/`. Three documents matter:

- `RESEARCH.md` — the paper. What we're trying to grow, and why.
- `NOTES.md` — the journal. One entry per iteration. Public, terse.
- `PROCESS.md` — the contract. How the loop runs, what an agent may
  decide alone, when to escalate.

The five seed worlds are:

| world | what it is |
|---|---|
| `fair-log` | typical log, balanced conditions |
| `rich-log` | log overflowing with food, prone to matting |
| `multi-colony` | founder splits into many over time |
| `edge-spawn` | founder placed at edge geometry |
| `lean-log` | sparse food, starvation test |

The active target is **Vision 1**: a day-old colony that *looks like* the
painting on the maintainer's wall — root-like, descended, laterally
spread, not a blob and not a thread. The gatekeeper is a shape-match
score, threshold 0.60 across all five worlds. As of iter-66 the median is
0.252 and the best single seed reached 0.441 — closer than any earlier
iteration. Still a way to go.

Run the lab locally with:

```bash
node app/cli/lab.js baseline                   # full vision-1 report
node app/cli/lab.js baseline --label "iter-N"  # tagged for the journal
node app/lib/sim-lab/test.js                   # smoke tests + baseline guards
```

---

## How it's built

Shroom is a vibe-coding project. The maintainer drives the design;
Claude does most of the typing. They sit together at a session — talk
the problem through, change code, run tests, open PRs. The maintainer
makes the big calls: what the world should look like, when a mechanic
isn't earning its keep, what ships and what doesn't.

The pattern is most visible in the lab. Each research iteration is one
move — an agent reads `NOTES.md`, forms a hypothesis, changes one
constant or one mechanic, runs the lab, writes the entry, opens a PR.
The maintainer reviews. `PROCESS.md` is the contract that says what the
agent may decide alone and what it must escalate.

If the journals read like a research diary, that's because they are.
Most iterations don't move the needle. The ones that do are the reason
the project exists.

PRs from outside contributors are welcome. Open an issue first, agree
on what's in scope, then put up the PR. Reviews go through the
maintainer and Claude together — same as the writing.

---

## Changelog

A loose list of milestones. Day-to-day commits live in `git log`; this
section is for the moments that changed what the world is.

- **2026-05-24** — Open-sourced under GPLv3. Self-host docker-compose added.
- **2026-05-24** — sim-lab/05 parked at iter-66. Two new mechanics stack
  on sim-lab/04's lattice work: per-colony vertical-bias variance and
  DLA-style edge preference. Shape match hits a new max of 0.441; the
  lean-log seed comes alive for the first time.
- **2026-05-24** — Continuous iteration numbering across all sim-lab
  branches (was branch-scoped, drifted). Past entries keep their old
  numbers; new entries pick up from iter-57 onward.
- **2026-05-24** — Portrait gate on phones. The index is desktop and
  landscape only; narrow portrait shows a quiet prompt to turn the device.
- **2026-05-23** — sim-lab/04 parked. Substrate-aware bifurcation and
  perpendicular branching in soil produce the painting's lateral lacework.
  Shape match jumps +56% in one branch — the biggest single-branch gain
  in the research arc.
- **2026-05-22** — sim-lab/03. Vision 2 (week-long persistence) scoped
  and scored, with auto-bootstrap to keep dead worlds alive for measurement.
- **2026-05-19** — sim-lab/02. Colony-wide carrying capacity, apical
  dominance, leader-lifespan tuning. The painting-similarity scorer is
  rebuilt to read structural features from ASCII.
- **2026-05-18** — sim-lab/01. The leader-cell mechanic ships. A few tips
  grow fast, the rest stay quiet. Seed 1337 (rich-log) breaks open for
  the first time.
- **2026-05-18** — sim-lab foundation. Deterministic RNG threaded through
  the sim, lab scaffolding, vision 1 written.
- **earlier** — design pass on the index, the engine page, the kit. The
  diorama, the rail, the Chronicle, the Hall.

---

## Licence

Shroom is licensed under the **GNU General Public License v3.0**. See
`LICENSE` for the full text. In short: you're free to run, study, modify,
and redistribute shroom — but any derivative work you distribute must also
be GPLv3 and must keep the existing copyright notices intact.

If you build something on shroom and share it publicly — a fork, a hosted
deployment, a derivative work, a research paper — please credit the
upstream project and link back to this repository. The licence enforces
the copyright header; this asks the social favour.

Copyright © 2026 Bj0rnis.

---

## Acknowledgements

Nigehban's voice is generated by [Claude](https://anthropic.com/claude).

[Evochora](https://github.com/evochora/evochora) is the alife project we
read before building shroom. Substitution-only mutation, no-fitness
selection, and the decision to persist state rather than history are
all adopted from there. None of its code; only the ideas.

The painting on the maintainer's wall is by an artist whose name and
provenance deserve to be added here; if you recognise it, open an issue.
