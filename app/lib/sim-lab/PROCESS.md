# Shroom · Lab · Process

How the lab is run. The *vision* (what the world should look like) lives in
`RESEARCH.md`. The *journal* (what was tried, what was read) lives in
`NOTES.md`. Direction-setting chats between the maintainer and the agent
that happen *outside* the iteration loop live in `1-1.md` — read the most
recent entry there before opening a new branch. This file is the *contract*
between the maintainer and the agent running the loop — what the agent may
decide alone, what it must escalate, and what the iteration shape looks like.

---

## Running the lab

Two commands carry the loop:

```bash
node app/cli/lab.js baseline                    # run vision 1 against the seed set, prints report
node app/cli/lab.js baseline --label "iter-N"   # same, with a label in the report header
node app/lib/sim-lab/test.js                    # smoke tests (scorers, driver, baseline guards)
```

The lab driver lives in `driver.js`; configs (which vision, which seeds)
live in `configs/baseline.js`. Constants are read from `sim.js` at run time —
the lab runs whatever physics is currently committed.

If you change a sim constant, `test.js` will fail the baseline-guard
assertions. Re-run with `node app/lib/sim-lab/test.js` to see the new cell
counts, then update the `BASELINES` array in the same PR.

---

## Iteration numbering

`iter-N` is **continuous across the entire research arc**, not per-branch.
The next entry's N is one more than the previous entry's N regardless of
which sim-lab/NN branch you're on. The first entry was `iter-1`; we are
at `iter-56` (sim-lab/04-shape-geometry park) at time of writing, and
the next iteration is `iter-57` even though it begins a new branch.

When a new branch starts, prepend a one-line header to NOTES.md before
the first entry on that branch:

```
### sim-lab/NN-name begins · iter-X · <vision or focus>
```

This makes branch transitions visible without restarting the count, so
future-you can read NOTES.md as one continuous story.

Historical note: entries before 2026-05-24 used branch-scoped numbering
(each branch restarted from iter-1). Don't renumber the past — the
branch headers in NOTES.md show where each segment of the count sat.

---

## The loop

One iteration is one move:

1. Read the last NOTES.md entry. Read RESEARCH.md if the vision is unclear.
2. Form one hypothesis. Write it in plain English before changing code.
3. Make the smallest change that tests the hypothesis. One mechanic or one
   constant family at a time.
4. Run the lab over the seed set. Read the report and the ASCII shapes.
5. Write a NOTES.md entry — hypothesis, setup, result, reading, next.
6. PR to main if the iteration shipped something worth keeping, even if it
   didn't pass the vision. Negative results have value if they're recorded.

The agent runs steps 1–5 alone. Step 6 — the PR — is where the maintainer sees the
work. The PR description is the place to summarise the iteration arc, not
just the latest commit.

---

## License to deviate

The vision is the target. The mechanic is a hypothesis. **Hypotheses are
disposable.** If a mechanic is not earning its keep — three or more
iterations of constant-sweeping inside it without moving the aggregate
pass-rate — abandon it and try a different mechanic class.

The agent may, without asking:

- Change constants in any direction
- Add a new mechanic to `sim.js` or `sim-lab/configs/`
- Remove a mechanic that isn't earning its keep
- Add a new scorer to `targets.js`
- Tighten or loosen a scorer's bounds (with the reason written in NOTES)
- Pivot the active hypothesis between iterations
- Run more or fewer than 5 seeds if a specific seed is informative

The agent must escalate before:

- **Retargeting the vision.** Changing what "day-1 root" means, or starting
  a new vision, is the maintainer's call.
- **Removing a passed scorer.** If a scorer is currently passing on the
  baseline and the agent wants it gone, ask first.
- **Spending more than ~10 iterations on a single mechanic class.** If
  leader-cells (or whatever its successor) has had ten tries and the
  aggregate hasn't budged, stop and write a short note proposing the
  pivot. Don't sweep constants in a circle.
- **Changing the seed set.** The seed set is part of the contract. New
  seeds added freely; removing seeds is an escalation.

---

## Hypothesis buffet

`Leading hyphae` was one hypothesis. It came from a hand-painted target and
some real-mycelium intuition. It is *not* a contract. The next iteration
agent is free to pick from this list, or invent something new entirely.
The point is to keep the design space open.

| Hypothesis | One-liner |
|---|---|
| **Leader cells** | A few designated tips extend fast, rest extend slow. Current. |
| **Density gating** | Extension probability falls steeply as local 3×3 fill rises. Already partial via `THICKNESS_MAX`; push it harder. |
| **Source–sink transport** | Tips can only extend if reserves flow there from absorbing cells. Distance dampens flow. Forces a network rather than a mat. |
| **Periphery–interior asymmetry** | Only cells touching empty substrate can extend. Interior is dormant. Pure "boundary growth." |
| **Apical dominance** | A diffusing inhibitor from each tip suppresses extension nearby. Biochemically motivated version of leader-cells. |
| **Age stratification** | Young cells extend, old cells go quiescent. Already partial via `TIP_AGE_DECAY`; could be the whole story. |
| **Mushroom shape** | Network expands until first fruit, then most growth halts — the colony has "completed." Reframes day-1 as "build, then fruit and stop." |
| **Carrying capacity** | Hard or soft cap on cells per colony, derived from substrate quality. Cap is the brake; mechanics underneath are simple. |
| **Genome variance** | Push growth-rate gene variance way up. Some founders mat, some die fast — and that's fine. Selection across seeds, not within. |
| **Diffusion-limited aggregation** | Bias extension toward strongest local nutrient gradient. Sharpens fronts, naturally branched. |
| **Many slow leaders** | Raise `MAX_LEADERS_PER_COLONY` from 5 to ~30, drop `LEADER_EXTEND_PROB` proportionally. Same total growth rate, recursive topology — the painting has 15-20+ active tips at once, not 5. |
| **Branch hunger** | Bif-children inherit a fraction of parent reserves and starve quickly if they don't find substrate. Frivolous bifurcations die back automatically; no global cap needed. |
| **Tip-only economy** | Only leader cells absorb nutrient. Non-leaders are pure transport. Reframes the whole reserve flow — mature cells are pipes, not pumps. |
| **Pulse growth** | Colony grows in bursts every N ticks instead of every tick. Each burst has a budget; once spent, dormant until next burst. Could force the "build then halt" mushroom shape naturally. |

Tried (parked or live in sim today — see NOTES.md branches for detail):

Tried: leader cells
Tried: apical dominance
Tried: carrying capacity
Tried: source–sink transport
Tried: periphery–interior asymmetry
Tried: genome variance
Tried: diffusion-limited aggregation

The agent picks one per iteration. The agent may also pick "no mechanism
yet — first observe" if the prior iteration's failure mode is unclear.
Reading carefully is a valid move.

---

## Escalation criteria

The agent pings the maintainer (via PR description, or by leaving the PR in draft
with a question) when:

- The active mechanic has had 5+ iterations with no aggregate movement.
- A pivot would discard a mechanic that was the maintainer's idea originally.
- A new scorer is being added that *softens* the vision rather than
  sharpening it.
- A vision target needs to be retargeted or retired.
- The agent thinks the vision itself might be wrong.

Otherwise: ship the PR, summarise the arc, let the maintainer review when convenient.

---

## Stuck-detection

A few signals that the loop is circling, not progressing:

- The aggregate pass-count for a vision moves by ≤1 across 3+ iterations.
- The same scorer fails on the same seeds across 3+ iterations, and the
  reading section keeps saying "needs more X."
- Reading sections start to repeat themselves.
- Constants are being moved back toward earlier values.

When any of these hit: the iteration is no longer learning. Stop the
mechanic, write a brief "stuck note" in NOTES.md, and pick a different
class from the buffet.

---

## NOTES.md entry format

The journal entry is the artifact the next agent will read. It is also how
the maintainer knows what happened. Keep it tight (~80 words):

```
## YYYY-MM-DD · branch-or-config-name · iter-N · [tag]
Agent: claude-<model-id>
Hypothesis: one sentence.
Setup: scorer set, seeds, constants touched, mechanic added/removed.
Result: aggregate pass-counts + the surprising number.
Reading: what I now think.
Next: one move.
```

`iter-N` is the global, continuous number (see "Iteration numbering"
above). Not branch-scoped.

Tags:

- `[tweak]` — constant change inside an existing mechanic.
- `[mechanic]` — new code path, new feedback loop, new gate.
- `[rewrite]` — structural change to the sim or the lab.
- `[stuck]` — explicit "this mechanic class is done, pivoting" entry.
- `[observe]` — no code change, just reading prior runs more carefully.

The `Agent:` line is new. It exists so that future-the maintainer can A/B model
choices across iterations. Use the exact model ID the agent is running on
(`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, etc.). If
unknown, write `unknown`.

---

## What "done" looks like

A vision is achieved when all its scorers pass on a majority of the seed
set (3+ of 5), confirmed across two consecutive iterations on the same
constants. At that point: open a PR to main with the constants/mechanic
that earned it, update RESEARCH.md's *Status* section with the passing
config, and either retire the vision or move on to the next one.

Visions don't have to be reached in order. If a vision is repeatedly
unreachable and the loop has run its escalation, retire it — the world
might just not want that shape, and that's a finding worth keeping.

---

## Voice — talk to the maintainer, not to the codebase

Two registers. Keep them separate.

**Journal register** (NOTES.md entries, this doc, code comments, the
hypothesis buffet) — agent-to-agent. Technical terms are fine because the
next agent reads them. `LEADER_LIFESPAN`, "aggregate pass-rate",
"saturation", "extension" — all good here. Be terse.

**the maintainer register** (PR titles + descriptions, the `Plain:` line on each
NOTES entry, dashboard framing copy, any summary you write back to the maintainer
in chat) — agent-to-human. Translate. Shroom is a fun project, not a
research paper. the maintainer called this out (2026-05-19): if it reads researchy
or code-like, it's wrong for him.

A short translation table — extend, don't replace:

| Code-talk | Plain |
|---|---|
| extend / extension | grow / growth |
| saturate / saturated | mat / matted the canvas |
| aggregate pass-rate | how many seeds pass |
| mechanic / mechanism | idea we're trying |
| founder colony | the first colony |
| substrate | the log and the soil |
| premature fruit | fruited too early |
| descended | reached down into the soil |
| modestSize fails | colony was too small or too big |
| seed 1337 still mats | the worst seed still ran wild |

The journal's `Result:` field can say "modestSize 1/5"; the `Plain:` field
should say "still only 1 in 5 seeds came out the right size." The
dashboard surfaces `Plain:` first; the technical line is there for the
agent doing the next iteration.

Keep the shroom voice when translating. Plain doesn't mean cute. No
exclamation marks. No emoji. Short sentences. "The colony matted" not
"the colony achieved saturation." "Leaders retired after 60 grows" not
"LEADER_LIFESPAN=60 triggered demotion."

If you catch yourself writing "deterministic tuple" or "aggregate" in
something the maintainer will read — stop, translate.

---

## What this doc is not

This doc does not say *how* to grow a root, or *whether* leader-cells is
the right idea. Those are open questions for the loop to answer. This doc
is about how the loop runs — its rhythm, its license, and where the maintainer
draws the line on autonomy.

If the agent finds this contract getting in the way of useful work, the
agent should say so in a PR. The contract is not load-bearing on its own;
it serves the iteration. Edit it.
