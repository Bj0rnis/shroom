# home-server Shroom — `shroom.home-server`

A small living world: mycelium growing on a fallen log, watched by Nigehban
(the jinn). Reachable at `https://shroom.home-server` over Tailscale.

The full design is in [HANDOVER.md](HANDOVER.md). The pre-build archaeology
of the previous attempt (Evochora) is in [EVOCHORA_NOTES.md](EVOCHORA_NOTES.md).

## Stack

- **Backend** — Node.js + Express. Sim ticks every 3 seconds in production;
  per-tick: hyphae grow → decay → fruit → spores drift → germinate → toofan
  rolls. State is persisted as JSON files (atomic write-temp + rename) every
  ~200 ticks and on graceful shutdown. No database.
- **Frontend** — HTML5 canvas, no build step. React + Babel-in-browser.
  Pulls `design/kit/` from the repo root for chrome (canvas itself is custom
  rendering and does not use kit).
- **LLM** — Nigehban calls `stacks/ai/` Ollama at `http://ollama:11434` with
  `llama3.2:3b`. Graceful failure: sim keeps ticking when Ollama is down,
  he just stays silent.

## Configuration

All env vars are set in [docker-compose.yml](docker-compose.yml). Override
locally with `.env`:

| Variable | Default (compose) | Notes |
|---|---|---|
| `OLLAMA_URL` | `http://ollama:11434` | Path to Ollama. Use `http://localhost:11434` for local dev. |
| `NIGEHBAN_MODEL` | `llama3.2:3b` | Any pulled Ollama model. |
| `TICK_INTERVAL_MS` | `3000` | Real ms per sim tick. |
| `NIGEHBAN_INTERVAL_TICKS` | `600` | Min ticks between his time-based wakes (~30 min real at 3s/tick). |
| `MOCK` | unset | Set `true` for local dev (no docker socket needed). |
| `NIGEHBAN_DEBUG` | unset | Set `1` to log raw Ollama responses. |

## Persistence

Bind-mounted at `/opt/home-server/data/shroom` on the host:

```
data/
├── current/
│   ├── world.json     full sim state (~600 KB at v1 grid size)
│   └── journal.json   nigehban's entries for the active volume
├── library/
│   └── vol-NNN.json   closed journals from past volumes
└── hall.json          inscribed mushrooms, persists across all volumes
```

Backed up automatically by the host's restic cron (config in main CLAUDE.md).

## Local dev

```bash
cd stacks/shroom/app
npm install
MOCK=true npm run dev   # → http://localhost:3000
```

For Nigehban locally, either pull the right model:
```bash
ollama pull llama3.2:3b
```
…or override with whatever you have installed:
```bash
NIGEHBAN_MODEL=qwen2.5-coder:14b MOCK=true npm run dev
```

## Deploy

```bash
# Local: commit, push
git push

# Server:
ssh agent@shroom-server "cd /opt/home-server/repo && git pull"
ssh the maintainer@shroom-server "cd /opt/home-server/repo/stacks/shroom && docker compose up -d --build"
```

## Debug endpoints

All accept `POST` and return JSON:

| Endpoint | Effect |
|---|---|
| `/api/debug/sow` | Sow a random colony at a random log location (resets per volume cooldown) |
| `/api/debug/toofan?flavor=fire` | Trigger a world-ending storm. flavors: flood / fire / frost / wind |
| `/api/debug/nigehban-wake` | Force-wake Nigehban regardless of cooldown |
| `/api/debug/inscribe` | Inscribe a top alive colony into the hall (placeholder reason/epitaph) |
| `/api/debug/save` | Force a world.json save now |
| `/api/debug/reset` | Wipe and start a fresh volume 1 |

## Read-only endpoints

| Endpoint | Purpose |
|---|---|
| `/api/health` | Service liveness |
| `/api/world` | Meta + counts + top colonies + recent events (3 s poll) |
| `/api/world/snapshot` | Full grid (gzipped, ~30 KB) for the canvas (1 s poll) |
| `/api/world/grid` | ASCII debug view |
| `/api/journal` | Nigehban's entries + nigehban state |
| `/api/hall` | Hall of fame across all volumes |
