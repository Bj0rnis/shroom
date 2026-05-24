# Agents working on shroom

Orientation for Claude (and any other agent dropped into this repo).
`CLAUDE.md` is the contract — *what you must and must not do*. This
file is the map — *where things are and how to start*.

---

## First five minutes

1. Read `README.md` sections **What it is** and **How it's built**.
   Understand that shroom is a vibe-coding project — design decisions
   come from the maintainer, you do most of the typing.
2. Read `CLAUDE.md` fully. It's short. The Voice section is
   load-bearing — match it in any user-facing copy.
3. If the task is in the lab, read `app/lib/sim-lab/PROCESS.md` before
   touching anything. It tells you what an agent may decide alone and
   what must escalate.
4. Skim the most recent entries in `app/lib/sim-lab/NOTES.md` to know
   where the research stands.

---

## Repo map

```
app/
├── lib/
│   ├── sim.js              ← the simulation engine. Read CLAUDE.md
│   │                          "Sim constants" before changing anything.
│   ├── world.js            ← world creation, sowing, grid
│   ├── genome.js           ← per-colony genome vector
│   ├── nigehban.js         ← the jinn who writes the journal
│   ├── persistence.js      ← world.json save/load
│   ├── lab.js              ← lab driver (sim runner for the lab)
│   └── sim-lab/            ← the research lab
│       ├── PROCESS.md       ← the agent contract for lab work
│       ├── RESEARCH.md      ← vision targets and reasoning
│       ├── NOTES.md         ← iteration journal (terse, one per iter)
│       ├── driver.js        ← runs a scenario across N seeds
│       ├── targets.js       ← scorers
│       ├── shape.js         ← painting-similarity scorer
│       └── test.js          ← smoke tests + baseline guards
├── public/                  ← frontend. No bundler — files are served
│   │                          directly. Babel transpiles JSX at runtime.
│   ├── index.html           ← the world
│   ├── engine.html          ← field guide to the sim
│   ├── preview.html         ← design kit workshop
│   ├── app.js               ← the index app
│   ├── canvas.js            ← the diorama renderer
│   ├── kit/                 ← the design system. See KIT.md inside.
│   └── ...
├── cli/lab.js               ← lab CLI entry point
├── server.js                ← Express server, API endpoints
└── data/                    ← bind-mounted runtime state (gitignored)

BALANCE.md         ← live record of sim balance decisions
CLAUDE.md          ← working contract — read this first
INSTALL.md         ← user-facing install guide
README.md          ← project overview, voice, current state
docs/archive/      ← historical docs (Evochora notes, May 18 design audit) —
                     read-only record, not steering
```

---

## Common tasks

### Run the app locally

```bash
cd app
MOCK=true npm run dev          # http://localhost:3000
```

`MOCK=true` skips the Docker socket check. Without `ANTHROPIC_API_KEY`,
Nigehban stays silent — the sim keeps ticking.

### Run the research lab

```bash
node app/cli/lab.js baseline                   # full vision-1 report
node app/cli/lab.js baseline --label "iter-N"  # tagged for the journal
```

The lab is deterministic — same seed + same sim constants always
produce the same output. That's the point.

### Run smoke tests (always before a PR that touches sim or scorers)

```bash
node app/lib/sim-lab/test.js
```

If you change a sim constant or mechanic, the baseline-guard assertions
will fail. Re-run, read the new cell counts, update the `BASELINES`
array in the same PR.

### Open a PR

`main` is protected — no direct push, no force-push. Always:

```bash
git checkout -b kebab-case-description
# ...edit...
git add ...
git commit -m "imperative lowercase commit message"
git push -u origin kebab-case-description
gh pr create
```

When the PR merges, the branch is auto-deleted (squash + delete).

---

## Where the journals live

| File | What it is | When to read |
|---|---|---|
| `app/lib/sim-lab/NOTES.md` | Lab iteration journal. One entry per iter. | Before any lab work. |
| `app/lib/sim-lab/RESEARCH.md` | Vision targets and why. | When you're unsure what "good" means. |
| `app/lib/sim-lab/PROCESS.md` | Lab agent contract. | Before iterating. |
| `app/lib/sim-lab/1-1.md` | Maintainer/agent direction-setting chats. | Before opening a new branch. |
| `BALANCE.md` | Sim balance decisions. | Before tuning a sim constant. |
| `CLAUDE.md` | Working contract for the whole repo. | First. Always first. |
| `docs/archive/design-review.md` | The May 2026 UI audit kanban (archived; record only). | If a code comment points you here for design rationale. |
| `docs/archive/evochora-notes.md` | Pre-build research from Evochora (archived; record only). | If you're wondering where a mechanic came from. |

---

## Voice

Shroom has a voice. The README's *Voice* section is load-bearing for
any user-facing copy — journal prompts, UI labels, error messages,
landing pages.

In short: spiritual but not vague, serious but not dry, old-world
without affectation, no emoji, no exclamation marks. Urdu words appear
where they belong (the jinn is called *Nigehban*, the storm is *toofan*).

The journal voice is technical and terse. The README voice is
contemplative. The kit voice is precise. Match the surface you're on.

---

## Common gotchas

- **Never commit to `main`.** Branch protection blocks it; the human
  policy backs it up. PR or nothing.
- **Never hardcode hex colours or font strings in pages.** They live in
  `app/public/kit/tokens.jsx`. The kit is the source of truth.
- **Never silence Nigehban's errors** without logging them. Quiet
  failures are hard to diagnose.
- **Never touch `data/` on the server during a deploy.** The world is
  in there.
- **The Dockerfile bakes the code** into the image. Changes to
  `app/public/` or `app/lib/` require a rebuild (`up -d --build`), not
  just `restart`.
- **Lab is deterministic.** If a run produces different output for the
  same seed + same constants, something is wrong (probably an unseeded
  `Math.random()` somewhere).
- **The `MOCK=true` env var** is for local development. Production runs
  without it.

---

## When to ask the maintainer

The lab `PROCESS.md` has the formal escalation list. In general: ask
when you're about to make a decision that changes *what the project is*
rather than *how it works*. Retargeting a vision, removing a passing
scorer, introducing a dependency, exposing new public endpoints — those
are maintainer calls.

Refactors, constant tweaks, kit additions, new mechanics inside an
existing vision, doc edits — those are yours to run with.

---

*Welcome to shroom. The sim is the soul of the project. Don't break it.*
