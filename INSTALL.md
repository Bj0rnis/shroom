# Installing shroom

Two paths. Pick one. If you just want shroom to run on your server and
keep ticking, take the Docker path.

---

## Prerequisites

- **Docker path:** Docker Engine 20+ and the `compose` plugin. That's it.
- **Local development path:** Node.js 20+ and npm. Docker is optional.
- An `ANTHROPIC_API_KEY` — without it the world still ticks but the
  journal stays silent. Get one at <https://console.anthropic.com>.
- Disk space — the running container is small; the world's `data/`
  directory grows slowly (~600 KB per saved volume).

---

## Docker (self-hosting)

The simplest path. Maps shroom to `localhost:3000` directly. Put a
reverse proxy (Caddy, nginx, Traefik) in front if you want HTTPS or a
custom domain.

```bash
git clone https://github.com/Bj0rnis/shroom.git
cd shroom
cp .env.example .env
# open .env and fill in ANTHROPIC_API_KEY
mkdir -p ./data
docker compose -f docker-compose.selfhost.yml up -d --build
```

Open <http://localhost:3000>. You should see a pixel-art diorama, a
right-hand rail with the volume number and a journal panel, and a faint
mycelium colony growing somewhere on the log.

### Updating

```bash
git pull
docker compose -f docker-compose.selfhost.yml up -d --build
```

The container picks up the saved world on restart. No data loss unless
you remove `./data/current/world.json` explicitly.

### Stopping

```bash
docker compose -f docker-compose.selfhost.yml stop
```

Shroom saves world state on graceful shutdown.

### Wiping for a fresh world

Order matters — see `CLAUDE.md` "Fresh-world wipe" section. Short version:

```bash
docker compose -f docker-compose.selfhost.yml stop
rm data/current/world.json data/current/journal.json
docker compose -f docker-compose.selfhost.yml up -d
```

### Backing up

`data/current/world.json` is the entire living state of the sim. Copy
it (and `data/current/journal.json`) to back up.

---

## Local development

For editing code, running the lab, debugging.

```bash
git clone https://github.com/Bj0rnis/shroom.git
cd shroom/app
npm install
MOCK=true npm run dev
```

`MOCK=true` skips the Docker socket check. The app serves on
<http://localhost:3000>. The world ticks every 3 seconds by default.

To run Nigehban locally:

```bash
ANTHROPIC_API_KEY=sk-ant-... MOCK=true npm run dev
```

To run the research lab against the standard seed set:

```bash
node app/cli/lab.js baseline
```

To run the smoke tests:

```bash
node app/lib/sim-lab/test.js
```

---

## Troubleshooting

**Container starts then exits immediately.** Check `docker logs shroom`.
Usually a missing or malformed `ANTHROPIC_API_KEY` in `.env`. The world
still runs without a key, but a malformed env file can crash startup.

**The journal stays empty.** Nigehban is silent when (a) there's no
`ANTHROPIC_API_KEY`, (b) the daily cap is hit, (c) the floor between
calls hasn't elapsed, or (d) he simply has nothing to say. The sim keeps
ticking either way.

**Canvas is blank.** Open the browser console. Most often a missing
font load or a Babel transpile error. A hard refresh usually fixes it.

**Port 3000 is in use.** Set `PORT` in `.env` (e.g. `PORT=3017`) and
adjust the `ports:` line in `docker-compose.selfhost.yml` to match.

**`docker compose ... --build` is slow.** First build pulls
`node:20-alpine`. Subsequent builds are layer-cached and quick. If a
build hangs on `npm ci`, check disk space and Docker daemon health.

**Deploy looks like it worked but the world hasn't changed.** Plain
`docker compose restart shroom` serves the previous image. You need
`up -d --build` to actually rebuild. See `CLAUDE.md` "Deploy" section.

---

## What you should see when it works

Open the index at <http://localhost:3000>:

- A pixel-art landscape with a fallen log and a sky that changes
  through the day
- A right-hand rail showing volume, era, day, and a journal panel
- A "Top colony" entry once mycelium gets going
- Faint coloured threads growing under the log within a few minutes

The world is meant to be observed over days. Most of the interesting
behaviour shows up across hours, not seconds. Leave it running.

---

## Reading further

- `README.md` — what shroom is, voice, contributing
- `CLAUDE.md` — working rules for the code, deploy, design kit
- `app/lib/sim-lab/RESEARCH.md` — what the world is *trying* to look
  like, and how progress is measured
