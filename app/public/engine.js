// Shroom — engine page composition.
// All UI comes from window.* kit exports (kit/). This file is composition only:
// data fetching + page-level copy + wiring kit components together.

const { MONO, SERIF, SERIF_RUN, COL } = window.SHROOM_TOKENS;
const { useEffect, useState } = React;

function EngineApp() {
  const [spec, setSpec] = useState(null);
  const [err,  setErr]  = useState(null);

  // Pull kit components from window globals (set by kit/* script tags).
  const {
    PageWallpaper, Section, KV, Subhead, Aside,
    TickPipeline, TerrainDiagram, FruitLadder, ReservesFlow, CycleDiagram,
    GenomeTable, FirstDayLedger, FruitDecisions, ToofanRoll, FlavorChips,
  } = window;

  useEffect(() => {
    fetch('/api/engine-spec')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setSpec)
      .catch(e => setErr(e.message));
  }, []);

  if (err) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageWallpaper />
        <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 12 }}>error: {err}</span>
      </div>
    );
  }
  if (!spec) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageWallpaper />
        <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 12 }}>awakening…</span>
      </div>
    );
  }

  const c = spec.constants;
  const w = spec.world;

  return (
    <div style={{ minHeight: '100dvh', padding: '32px 16px 80px' }}>
      <PageWallpaper />
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Page header (no panel — sits on wallpaper) */}
        <div style={{ padding: '0 6px 14px', marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, color: COL.ember, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>
            shroom · engine
          </div>
          <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
            how this shroom works
          </div>
          <div style={{ fontFamily: SERIF_RUN, color: COL.text2, fontSize: 16, lineHeight: 1.45, fontStyle: 'italic', maxWidth: 740 }}>
            A field guide to the simulation behind <a href="/" style={{ color: COL.emberHi, textDecoration: 'none', borderBottom: `1px dotted ${COL.emberHi}` }}>the live page at /</a>.
            Tuning notes and what we're trying next live at <a href="/research" style={{ color: COL.emberHi, textDecoration: 'none', borderBottom: `1px dotted ${COL.emberHi}` }}>/research</a>.
            Mycelium grows on a {w.W}×{w.H} grid, absorbs nutrients into a reserves
            pool, spends them to extend and to fruit, drifts spores. Saplings rise,
            mature, and fall into logs. Logs are eaten back to soil. Once a sim-year
            a toofan weathers everything. Two quiet loops keep the world alive
            between storms. Numbers come straight from sim.js.
          </div>
        </div>

        {/* 01 — Tick pipeline */}
        <Section seed={7} num="01" kicker="every tick" glyph="tick" accent={COL.hypha}
          title="the tick pipeline"
          sub="Every tick runs the same nine stages, in this order. Clock advances first so everyone sees the new season and weather. Trees and substrate move before colonies do — a new log might fall onto a colony's grow phase, or a soil cell might appear under a tip. Toofan-roll is last so a destroyed colony still got its turn to grow and fruit beforehand.">
          <TickPipeline />
        </Section>

        {/* 02 — Substrate */}
        <Section seed={11} num="02" kicker="terrain" glyph="substrate" accent={COL.ember}
          title="substrate & terrain"
          sub="A flat 320×180 grid. Air on top, a one-row grass line, soil below. The initial log capsule rests on the grass. Deep nutrient pockets are scattered into the lower half of the soil band so mycelium has a reason to tunnel down. The substrate is not static — it slowly regenerates, and consumed logs crumble back to soil.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 24, alignItems: 'start' }}>
            <TerrainDiagram world={w} />
            <KV accent={COL.emberHi} rows={[
              ['grid',             `${w.W} × ${w.H}`,                'cells, indexed y · W + x'],
              ['grass row',        w.GRASS_Y,                         'one-cell bridge between log & soil'],
              ['log',              'oak, 72–96 × 16–22',             'capsule: rect core + rounded caps'],
              ['pockets',          '5–7 of radius 8–13',              'placed 55–95% down the soil band'],
              ['base soil',        'nutrient 22–29',                  'lean, flat — variation lives in pockets'],
              ['log nutrient',     '70–95',                           'knot pockets lean, dry pockets rich'],
              ['NUTRIENT_MAX',     c.NUTRIENT_MAX,                    'soft cap for all generators'],
              ['SUBSTRATE_REGEN_INTERVAL', `${c.SUBSTRATE_REGEN_INTERVAL} ticks`, 'every log/soil cell gains +1 nutrient'],
              ['LOG_DECAY_PROB',   c.LOG_DECAY_PROB,                  'per tick · only empty log cells · crumbles to soil'],
            ]} />
          </div>
        </Section>

        {/* 03 — Hyphae economy */}
        <Section seed={15} num="03" kicker="reserves" glyph="hyphae" accent={COL.emberHi}
          title="the hyphae economy"
          sub="Colonies keep a reserves pool. Everything — extending a new cell, pushing a new fruit — is paid from reserves. Reserves only fill from absorption. This bottleneck is what prevents the old 'eat a few cells, fruit forever' degenerate strategy.">

          <ReservesFlow c={c} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 8 }}>
            <div>
              <Subhead accent={COL.hyphaHi}>absorb · into reserves</Subhead>
              <KV accent={COL.hyphaHi} rows={[
                ['NUTRIENT_CONSUMPTION',   c.NUTRIENT_CONSUMPTION,   'per hypha cell per tick'],
                ['SIDE_ABSORPTION',        c.SIDE_ABSORPTION,        'extra draw per adjacent substrate cell'],
                ['SIDE_ABSORPTION_FLOOR',  c.SIDE_ABSORPTION_FLOOR,  'won\'t drain neighbors below this'],
                ['DECAY_DEPOSIT',          c.DECAY_DEPOSIT,          'returned to substrate on death'],
                ['DECAY_NEIGHBOR_DEPOSIT', c.DECAY_NEIGHBOR_DEPOSIT, 'spread to the 4 neighbors on death'],
              ]} />

              <Subhead accent={COL.hypha}>extend · out of reserves</Subhead>
              <KV accent={COL.hyphaHi} rows={[
                ['EXTEND_COST',     c.EXTEND_COST,     'reserves drained per new cell'],
                ['THICKNESS_MAX',   c.THICKNESS_MAX,   'box-radius cells can fatten to'],
                ['HYPHA_AGE_LIMIT', c.HYPHA_AGE_LIMIT, 'ticks before turnover-eligible'],
              ]} />

              <Subhead accent={COL.cool}>die · per-tick risks</Subhead>
              <div style={{ fontFamily: SERIF_RUN, fontSize: 13, color: COL.text2, lineHeight: 1.5, margin: '4px 0 8px', fontStyle: 'italic' }}>
                Individual cells do not die when their own pixel of substrate is empty — they remain as transport, connecting absorbing tips to fruit sites. Starvation is colony-level: when the whole network's intake stalls, the perimeter retracts toward the trunk. Connectivity decides which cells fall first — tips at full risk, interior cells nearly immune.
              </div>
              <KV accent={COL.cool} rows={[
                ['STARVATION_DIE_RISK',          c.STARVATION_DIE_RISK,          'perimeter risk once a colony has stalled'],
                ['STARVATION_INTAKE_PER_CELL',   c.STARVATION_INTAKE_PER_CELL,   'min nutrient/cell/tick to count as fed'],
                ['STARVATION_GRACE_TICKS',       `${c.STARVATION_GRACE_TICKS} ticks`, 'grace before retraction begins'],
                ['STARVATION_RAMP_TICKS',        `${c.STARVATION_RAMP_TICKS} ticks`, 'streak length to full pressure'],
                ['TURNOVER_DIE_RISK',            c.TURNOVER_DIE_RISK,            'past HYPHA_AGE_LIMIT'],
                ['OLD_AGE_DIE_RISK_MAX',         c.OLD_AGE_DIE_RISK_MAX,         `peak at age ${c.COLONY_OLD_AGE_DAYS}d (prime ends ${c.COLONY_PRIME_DAYS}d)`],
                ['BLIGHT_DIE_RISK',              c.BLIGHT_DIE_RISK,              'when Nigehban blights'],
              ]} />

              <Subhead accent={COL.hyphaTip}>branch · the shape of growth</Subhead>
              <div style={{ fontFamily: SERIF_RUN, fontSize: 13, color: COL.text2, lineHeight: 1.5, margin: '4px 0 8px', fontStyle: 'italic' }}>
                Tips fork Y-branches. Junctions push lateral shoots. Interior cells barely move. The result reads as a root system rather than a single thread.
              </div>
              <KV accent={COL.hyphaTip} rows={[
                ['TIP_BIFURCATION_PROB', c.TIP_BIFURCATION_PROB, 'chance a tip splits in two on the same tick'],
                ['THICKNESS_MAX',        c.THICKNESS_MAX,        'most filled neighbors before extension blocks'],
                ['THICKNESS_BOX_RADIUS', c.THICKNESS_BOX_RADIUS, 'fattening check radius (cells)'],
              ]} />
            </div>
            <div>
              <Subhead accent={COL.ember}>fruit · out of reserves</Subhead>
              <KV accent={COL.emberHi} rows={[
                ['FRUIT_BASE_RATE',          c.FRUIT_BASE_RATE,           'per-tip roll, before gates'],
                ['FRUIT_COST',               c.FRUIT_COST,                'drained for the first fruit'],
                ['FRUIT_COST_FLOOR',         c.FRUIT_COST_FLOOR,          'cheapest a mature colony gets'],
                ['FRUIT_DISCOUNT_PER_FRUIT', c.FRUIT_DISCOUNT_PER_FRUIT,  'multiplicative per past fruit'],
                ['FRUIT_MATURE_TICKS',       c.FRUIT_MATURE_TICKS,        'emergence → spore release'],
                ['log mult',                 c.FRUIT_SUBSTRATE_MULT_LOG,  'rate factor on log'],
                ['grass mult',               c.FRUIT_SUBSTRATE_MULT_GRASS,'rate factor on grass'],
                ['soil mult',                c.FRUIT_SUBSTRATE_MULT_SOIL, 'rate factor on soil'],
              ]} />
              <FruitLadder c={c} />
            </div>
          </div>
        </Section>

        {/* 04 — The cycle */}
        <Section seed={21} num="04" kicker="closed loop" glyph="hyphae" accent={COL.hyphaTip}
          title="the cycle"
          sub="Two loops keep the world running. Spores carry colonies forward through generations. Trees and logs cycle the substrate back to soil. Each closes without help from the toofan.">

          <CycleDiagram />

          <div style={{ marginTop: 18 }}>
            <Subhead accent={COL.hypha}>the spore loop</Subhead>
            <div style={{ fontFamily: SERIF_RUN, fontSize: 14, color: COL.text2, lineHeight: 1.55, fontStyle: 'italic', maxWidth: 740 }}>
              A spore drifts on the breeze, falls onto viable substrate, and germinates at low probability. The colony grows on its reserves. Tips fork. Mature colonies push fruit; fruit ripens; spores release. Wind carries them. Most die. A few find soil. The chain continues.
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <Subhead accent={COL.ember}>the substrate loop</Subhead>
            <div style={{ fontFamily: SERIF_RUN, fontSize: 14, color: COL.text2, lineHeight: 1.55, fontStyle: 'italic', maxWidth: 740 }}>
              Saplings sprout in open soil and grow upward over real weeks. A mature tree falls horizontally and becomes the next log — species-tinted, with the richness it earned in life. Colonies consume it, cell by cell. Empty log cells crumble to soil at <span style={{ color: COL.emberHi, fontFamily: MONO, fontStyle: 'normal' }}>LOG_DECAY_PROB</span>. Soil regenerates. A new sapling finds room.
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <Subhead accent={COL.grass}>tree species · lifespan & log richness</Subhead>
            <KV accent={COL.grass} rows={(c.TREE_SPECIES || []).map(s => [
              s.name,
              `${s.lifespanDays}d · richness ${s.logRichness}`,
              `max height ${s.maxHeight} · crown ${s.crownRadius}`,
            ])} />
          </div>

          <Aside accent={COL.hyphaTip}>
            Before #10 the log only ever depleted — no regen, no decay, no replacement. A single log was the whole world's substrate. Now it's one stage in a self-replenishing system: spores find each new log, colonies eat it down, soil takes its place, the next tree rises.
          </Aside>
        </Section>

        {/* 05 — Genome */}
        <Section seed={19} num="05" kicker="ten floats" glyph="genome" accent={COL.cool}
          title="the genome"
          sub="Ten floats per colony. Spores carry a mutated copy of the parent's genome. Mutation is substitution-only with scale-proportional perturbation — no swapping, no crossover.">
          <GenomeTable genes={spec.genome} />
        </Section>

        {/* 06 — In practice */}
        <Section seed={17} num="06" kicker="worked examples" glyph="hyphae" accent={COL.hyphaTip}
          title="in practice"
          sub="The same economy seen as scenarios — what the numbers feel like from inside a colony.">

          <Subhead accent={COL.hyphaHi}>a first sim-day · single tip on log</Subhead>
          <FirstDayLedger c={c} />

          <div style={{ marginTop: 24 }}>
            <Subhead accent={COL.ember}>fruit decisions · three colonies, same tick</Subhead>
            <FruitDecisions c={c} />
          </div>

          <div style={{ marginTop: 24 }}>
            <Subhead accent={COL.danger}>a toofan roll · one phenotype, all four flavors</Subhead>
            <ToofanRoll c={c} />
          </div>
        </Section>

        {/* 07 — Toofan */}
        <Section seed={23} num="07" kicker="annual event" glyph="toofan" accent={COL.danger}
          title="the toofan"
          sub="Once per simulated year, on a Poisson roll, the world picks a flavor and every colony rolls survival — weighted by how well its phenotype matches the flavor. No warning. No buildup. No pressure meter.">
          <KV accent={COL.danger} rows={[
            ['TOOFAN_DAILY_PROB',       c.TOOFAN_DAILY_PROB.toFixed(5),    `mean one event per ${Math.round(1 / c.TOOFAN_DAILY_PROB)} sim-days`],
            ['TOOFAN_BASE_SURVIVAL',    c.TOOFAN_BASE_SURVIVAL,            'floor for an unsuited phenotype'],
            ['TOOFAN_PHENOTYPE_WEIGHT', c.TOOFAN_PHENOTYPE_WEIGHT,         'how much fit lifts above the floor'],
          ]} />
          <div style={{ marginTop: 14 }}>
            <Subhead accent={COL.danger}>flavors · one per event, sampled uniformly</Subhead>
            <FlavorChips flavors={c.TOOFAN_FLAVORS} />
          </div>
          <Aside accent={COL.danger}>
            Why one a year? Earlier builds tied toofan to consumption pressure — the colony ate the log so fast the pressure meter pinned at 88% within a sim-day. The Poisson rewrite decouples it from substrate state entirely. Time is the only clock.
          </Aside>
        </Section>

        {/* 08 — Nigehban */}
        <Section seed={27} num="08" kicker="the narrator" glyph="nigehban" accent={COL.glow}
          title="nigehban"
          sub="A Claude-backed pass that wakes once a sim-day, reads the recent events, and writes a journal entry for the Chronicle. Bestows real names on standout colonies; otherwise they keep their placeholder name (Wigglecap, Bramblewort, etc.) until they earn one — or die.">
          <KV accent={COL.glow} rows={[
            ['wake cadence', 'once per sim-day',           'capped by NIGEHBAN_DAILY_CAP env'],
            ['inputs',       'last events + colony stats', 'see lib/nigehban.js'],
            ['can bestow',   'name · blight · sparing',    'persisted on the colony record'],
            ['hall',         'durable colony obits',       'written on death, kept forever'],
          ]} />
        </Section>

        {/* 09 — The ambient */}
        <Section seed={29} num="09" kicker="between ticks" glyph="tick" accent={COL.glow}
          title="the ambient"
          sub="The sim ticks every three seconds. Between ticks, the world keeps moving at 60fps — not because anything has changed, but because still air would feel dead. None of it touches gameplay; all of it is for the watcher.">
          <KV accent={COL.glow} rows={[
            ['critters', '3–5 per world', 'worms · beetles · ants · springtails · pillbugs'],
            ['wind',     'autumn · spring', 'biases spore drift along the season'],
            ['sky',      '24h cycle',     'sun arcs by day, moon by night, season tints'],
            ['scars',    '~3 real weeks', 'persistent visual after each toofan flavor'],
          ]} />
        </Section>

        <div style={{ textAlign: 'center', marginTop: 24, fontFamily: MONO, fontSize: 10, color: COL.dim }}>
          all numbers above are read live from <span style={{ color: COL.text2 }}>/api/engine-spec</span>.
        </div>

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('engine-root')).render(<EngineApp />);
