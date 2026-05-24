# docs/archive

Historical documents. Kept for record, not for steering.

If you're an agent looking for current guidance, **these files are not it.**
Live docs at the repo root (`CLAUDE.md`, `AGENTS.md`, `BALANCE.md`,
`README.md`, `INSTALL.md`) and in `app/lib/sim-lab/`
(`PROCESS.md`, `RESEARCH.md`, `NOTES.md`) are.

## What's in here

| File | What it is | Why it's archived |
|---|---|---|
| `evochora-notes.md` | Pre-build research from reading the upstream Evochora alife project. Source-of-ideas for substitution-only mutation, no-fitness selection, decay-on-death, persist-state-not-history. | Shroom is built. The ideas it took are live in `app/lib/sim.js`, `app/lib/genome.js`, `app/lib/persistence.js`. The original notes are kept because two code comments still tag mechanics as "Evochora archaeology verdict". |
| `design-review.md` | The May 18 design audit kanban — 14 findings across bones, kit, and pixel-art buckets. | All 14 items shipped or were retired. Two code comments still point here (`app/lib/world.js`, `app/public/kit/primitives.jsx`) as anchors for the *why* behind specific design choices. |

## Rules

- **Read-only.** Don't update archived files. If a decision recorded here
  changes, write the new decision in a live doc and leave the archive alone.
- **Don't promote.** If something archived starts driving work again,
  that's a signal to write a fresh live doc, not to move the archive
  back to the root.
