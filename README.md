# Shroom

A small living world: mycelium growing on a fallen log, watched by Nigehban
(the jinn).

## Stack

- **Backend** — Node.js + Express. Sim ticks every 3 seconds in production;
  per-tick: hyphae grow → decay → fruit → spores drift → germinate → toofan
  rolls. State is persisted as JSON files (atomic write-temp + rename) every
  ~200 ticks and on graceful shutdown. No database.
- **Frontend** — HTML5 canvas, no build step. React + Babel-in-browser.
  Pixel-art kit under `app/public/pix/` (canvas itself is custom rendering
  and does not use the kit).
- **LLM** — Nigehban calls the Anthropic API directly with `claude-haiku-4-5`.
  Graceful failure: sim keeps ticking when the call errors, he just stays silent.

## Configuration

`ANTHROPIC_API_KEY` lives in `.env` (next to `docker-compose.yml`). Other env
vars are set in [docker-compose.yml](docker-compose.yml):

| Variable | Default (compose) | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(required)_ | From `.env`. |
| `NIGEHBAN_MODEL` | `claude-haiku-4-5` | Any Claude model ID. |
| `TICK_INTERVAL_MS` | `3000` | Real ms per sim tick. |
| `NIGEHBAN_INTERVAL_TICKS` | `600` | Periodic-wake interval (~30 min real at 3s/tick). |
| `NIGEHBAN_MIN_GAP_TICKS` | `200` | Hard floor between ANY two calls — events included. ~10 min real. |
| `NIGEHBAN_DAILY_CAP` | `48` | Max calls per rolling 24h. ~$0.10/day ceiling at Haiku 4.5. |
| `NIGEHBAN_TIMEOUT_MS` | `30000` | LLM request timeout. |
| `MOCK` | unset | Set `true` for local dev (no docker socket needed). |
| `NIGEHBAN_DEBUG` | unset | Set `1` to log raw model responses. |

Usage stats live at `GET /api/journal` under `.nigehban.usage` — `callsLast24h`,
`callsLastHour`, `dailyCap`, `skippedCount`, `lastSkipReason` (`min-gap` or
`daily-cap`). The counters reset on container restart.

## Persistence

Bind-mounted at `/opt/shroom/data/shroom` on the host:

```
data/
├── current/
│   ├── world.json     full sim state (~600 KB at v1 grid size)
│   └── journal.json   nigehban's entries for the active volume
├── library/
│   └── vol-NNN.json   closed journals from past volumes
└── hall.json          inscribed mushrooms, persists across all volumes
```

## Local dev

```bash
cd app
npm install
MOCK=true npm run dev   # → http://localhost:3000
```

For Nigehban locally, set the API key in your shell (or a local `.env`):
```bash
export ANTHROPIC_API_KEY=sk-ant-…
MOCK=true npm run dev
```
Override the model if you want to try a different tier:
```bash
NIGEHBAN_MODEL=claude-sonnet-4-6 ANTHROPIC_API_KEY=… MOCK=true npm run dev
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
| `/engine` | Field guide to the simulation |
| `/api/engine-spec` | Live sim constants used by the engine page |
