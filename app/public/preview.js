// Shroom — /preview page composition.
// Artboard workshop for the kit: 7 sections × all components.
// Requires full kit stack + design-canvas + tweaks-panel.

const { C, COL, MONO, SERIF, SERIF_RUN, SERIF_BODY, SANS, rgba, mulberry, F57, F35 } = window.SHROOM_TOKENS;
const { useEffect, useState, useMemo } = React;

const DARK = '#1a1612';
const TWEAK_DEFAULTS = { seed: 5, fontScale: 1.0 };

// ── helpers ───────────────────────────────────────────────────────────────────

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── 01 Tokens ─────────────────────────────────────────────────────────────────

function PaletteGrid({ entries, hint }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: COL.dim, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>{hint}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {entries.map(([name, hex]) => (
          <div key={name} style={{ width: 68 }}>
            <div style={{ width: 68, height: 30, background: hex, border: '1px solid rgba(255,255,255,0.07)', marginBottom: 3 }} />
            <div style={{ fontFamily: MONO, fontSize: 9, color: COL.text2, marginBottom: 1 }}>{name}</div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: COL.dim }}>{hex}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FontSamples({ scale }) {
  const stacks = [
    { name: 'MONO',       stack: MONO },
    { name: 'SERIF',      stack: SERIF },
    { name: 'SERIF_RUN',  stack: SERIF_RUN },
    { name: 'SERIF_BODY', stack: SERIF_BODY },
    { name: 'SANS',       stack: SANS },
  ];
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {stacks.map(({ name, stack }) => (
        <div key={name}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: COL.dim, letterSpacing: '0.2em', marginBottom: 6 }}>{name}</div>
          {[10, 14, 20].map(sz => (
            <div key={sz} style={{ fontFamily: stack, fontSize: sz * scale, color: COL.text, marginBottom: 3, lineHeight: 1.3 }}>
              The quick brown fox jumps
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function BitmapDemo({ font, W, H, scale }) {
  const PIX = window.PIX;
  if (!PIX) return null;
  return (
    <div style={{ padding: 16 }}>
      <PIX.PixelStage w={W} h={H} scale={scale} deps={[]}
        draw={(pb) => {
          PIX.paintDark(pb, 0, 0, W, H, { seed: 2 });
          const keys = Object.keys(font);
          const cw = font === F57 ? 5 : 3;
          const ch = font === F57 ? 7 : 5;
          const gap = 2;
          const cols = Math.floor((W - 4) / (cw + gap));
          keys.forEach((char, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const bx = 4 + col * (cw + gap);
            const by = 4 + row * (ch + gap + (font === F57 ? 3 : 2));
            const bits = font[char];
            for (let y = 0; y < bits.length; y++) {
              for (let x = 0; x < cw; x++) {
                if (bits[y] & (1 << (cw - 1 - x))) pb.set(bx + x, by + y, C.text);
              }
            }
          });
        }}
      />
    </div>
  );
}

// ── 02 Atmosphere ─────────────────────────────────────────────────────────────

function PaintFill({ painter, seed, W = 93, H = 60 }) {
  const PIX = window.PIX;
  if (!PIX || !painter) return null;
  return (
    <PIX.PixelStage w={W} h={H} scale={3} deps={[seed]}
      draw={(pb) => painter(pb, 0, 0, W, H, { seed })}
      style={{ display: 'block' }}
    />
  );
}

// ── 03 Primitives ─────────────────────────────────────────────────────────────

const EXAMPLE_KV_ROWS = [
  ['EXTEND_COST',   42,     'reserves drained per new cell'],
  ['FRUIT_COST',    120,    'drained for the first fruit'],
  ['HYPHA_AGE_LIMIT', 8640, 'ticks before turnover-eligible'],
  ['NUTRIENT_MAX',  200,    'soft cap for all generators'],
];

// ── 04 Motifs ─────────────────────────────────────────────────────────────────

const SECTION_KINDS = ['tick', 'substrate', 'hyphae', 'genome', 'toofan', 'nigehban', 'hero'];
const STAGE_KINDS   = ['clock', 'grow', 'fruit', 'spores', 'germinate', 'decay', 'toofan-roll'];
const GLYPH_ACCENTS = [COL.ember, COL.hypha, COL.cool, COL.danger];

// ── 05 Charts ─────────────────────────────────────────────────────────────────

function ChartsSection({ spec }) {
  const { TickPipeline, TerrainDiagram, FruitLadder, ReservesFlow, GenomeTable,
          FirstDayLedger, FruitDecisions, ToofanRoll, FlavorChips } = window;
  if (!spec) return (
    <DCSection id="charts" title="Charts" subtitle="data-driven visualisations · requires /api/engine-spec">
      <DCArtboard id="loading" label="loading spec…" width={300} height={120} style={{ background: DARK }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 11, color: COL.dim }}>awaiting spec…</div>
      </DCArtboard>
    </DCSection>
  );
  const { constants: c, world: w, genome } = spec;
  return (
    <DCSection id="charts" title="Charts" subtitle="data-driven visualisations · numbers live from /api/engine-spec">
      <DCArtboard id="TickPipeline" label="TickPipeline" width={700} height={300} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><TickPipeline /></div>
      </DCArtboard>
      <DCArtboard id="FruitLadder" label="FruitLadder" width={320} height={300} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><FruitLadder c={c} /></div>
      </DCArtboard>
      <DCArtboard id="ReservesFlow" label="ReservesFlow" width={440} height={280} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><ReservesFlow c={c} /></div>
      </DCArtboard>
      <DCArtboard id="TerrainDiagram" label="TerrainDiagram" width={500} height={340} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><TerrainDiagram world={w} /></div>
      </DCArtboard>
      <DCArtboard id="GenomeTable" label="GenomeTable" width={620} height={340} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><GenomeTable genes={genome} /></div>
      </DCArtboard>
      <DCArtboard id="FirstDayLedger" label="FirstDayLedger" width={520} height={320} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><FirstDayLedger c={c} /></div>
      </DCArtboard>
      <DCArtboard id="FruitDecisions" label="FruitDecisions" width={580} height={280} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><FruitDecisions c={c} /></div>
      </DCArtboard>
      <DCArtboard id="ToofanRoll" label="ToofanRoll" width={560} height={260} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><ToofanRoll c={c} /></div>
      </DCArtboard>
      <DCArtboard id="FlavorChips" label="FlavorChips" width={520} height={220} style={{ background: DARK }}>
        <div style={{ padding: 20 }}><FlavorChips flavors={c.TOOFAN_FLAVORS} /></div>
      </DCArtboard>
    </DCSection>
  );
}

// ── 06 Overlays ───────────────────────────────────────────────────────────────

function OverlayTriggers() {
  const [hallOpen, setHallOpen] = useState(false);
  const [devOpen,  setDevOpen]  = useState(false);
  const [hallSel,  setHallSel]  = useState(null);
  const { HallTrigger, HallModal, HallDetail, DevDashboard, DevDashboardTrigger } = window;
  return (
    <>
      <div style={{ display: 'flex', gap: 16, padding: '12px 16px', alignItems: 'center' }}>
        <HallTrigger entries={[]} onOpen={() => setHallOpen(true)} />
        <DevDashboardTrigger onOpen={() => setDevOpen(true)} />
      </div>
      <HallModal open={hallOpen} entries={[]} onClose={() => setHallOpen(false)} onSelect={setHallSel} />
      <HallDetail entry={hallSel} onClose={() => setHallSel(null)} />
      <DevDashboard open={devOpen} onClose={() => setDevOpen(false)} onAction={() => {}} />
    </>
  );
}

// ── 07 Screens ────────────────────────────────────────────────────────────────

function HomeStub() {
  const { StatusLeft, StatusRight } = window;
  const stubSnap = {
    meta: { tick: 345600, volume: 1, season: 'spring', weather: 'clear', toofanPressure: 0.12 },
    colonies: {},
    fruits: [],
    spores: [],
  };
  return (
    <div style={{ height: '100%', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, background: DARK }}>
      <PageWallpaper />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 8, minHeight: 0 }}>
        {/* left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: MONO, fontSize: 10, color: COL.dim }}>
            sim canvas
          </div>
          <StatusLeft snapshot={stubSnap} />
        </div>
        {/* right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SERIF_BODY, fontStyle: 'italic', fontSize: 13, color: COL.dim }}>
            chronicle
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 10,
            fontFamily: MONO, fontSize: 9, color: COL.dim }}>top colony</div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 10,
            fontFamily: MONO, fontSize: 9, color: COL.dim }}>hall of fame</div>
          <StatusRight snapshot={stubSnap} />
        </div>
      </div>
    </div>
  );
}

function EngineStub({ spec }) {
  if (!spec) return (
    <div style={{ padding: 20, fontFamily: MONO, fontSize: 11, color: COL.dim, background: DARK, height: '100%' }}>
      loading spec…
    </div>
  );
  const { c } = { c: spec.constants };
  return (
    <div style={{ padding: 20, background: DARK, minHeight: '100%', overflowY: 'auto' }}>
      <PageWallpaper />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Section seed={15} num="03" kicker="reserves" glyph="hyphae" accent={COL.emberHi}
          title="the hyphae economy"
          sub="Colonies keep a reserves pool. Everything — extending a new cell, pushing a new fruit — is paid from reserves.">
          <ReservesFlow c={c} />
        </Section>
      </div>
    </div>
  );
}

// ── app ───────────────────────────────────────────────────────────────────────

function PreviewApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    fetch('/api/engine-spec').then(r => r.json()).then(setSpec).catch(() => {});
  }, []);

  const { SectionGlyph, StageGlyph, DarkPanel, KV, Subhead, Aside, LoadingPassage, Stat,
          TweaksPanel, TweakSection, TweakSlider, TweakRadio,
          Section, ReservesFlow, PageWallpaper } = window;

  const seeds   = [t.seed, t.seed + 1, t.seed + 2, t.seed + 3];
  const cPalette  = Object.entries(C).map(([name, rgb]) => [name, rgbToHex(rgb)]);
  const colPalette = Object.entries(COL);

  return (
    <>
      <DesignCanvas>

        {/* ── 01 Tokens ─────────────────────────────────────────── */}
        <DCSection id="tokens" title="Tokens" subtitle="palette · fonts · bitmap glyphs — window.SHROOM_TOKENS">
          <DCArtboard id="C-palette" label="C · canvas (RGB)" width={520} height={540} style={{ background: DARK }}>
            <PaletteGrid entries={cPalette} hint="C · canvas palette (displayed as hex)" />
          </DCArtboard>
          <DCArtboard id="COL-palette" label="COL · DOM (hex)" width={520} height={380} style={{ background: DARK }}>
            <PaletteGrid entries={colPalette} hint="COL · DOM hex palette" />
          </DCArtboard>
          <DCArtboard id="fonts" label="Font stacks" width={380} height={500} style={{ background: DARK }}>
            <FontSamples scale={t.fontScale} />
          </DCArtboard>
          <DCArtboard id="F57" label="F57 · 5×7 bitmap" width={360} height={270} style={{ background: DARK }}>
            <BitmapDemo font={F57} W={112} H={84} scale={3} />
          </DCArtboard>
          <DCArtboard id="F35" label="F35 · 3×5 micro" width={330} height={210} style={{ background: DARK }}>
            <BitmapDemo font={F35} W={102} H={66} scale={3} />
          </DCArtboard>
        </DCSection>

        {/* ── 02 Atmosphere ─────────────────────────────────────── */}
        <DCSection id="atmosphere" title="Atmosphere" subtitle="paintDark · paintParchment · paintWood — PIX.*">
          {seeds.map(s => (
            <DCArtboard key={`dark-${s}`} id={`dark-${s}`} label={`paintDark · seed ${s}`} width={279} height={180} style={{ background: DARK, padding: 0 }}>
              <PaintFill painter={window.PIX?.paintDark} seed={s} />
            </DCArtboard>
          ))}
          {seeds.map(s => (
            <DCArtboard key={`parchment-${s}`} id={`parchment-${s}`} label={`paintParchment · seed ${s}`} width={279} height={180} style={{ background: DARK, padding: 0 }}>
              <PaintFill painter={window.PIX?.paintParchment} seed={s} />
            </DCArtboard>
          ))}
          {seeds.map(s => (
            <DCArtboard key={`wood-${s}`} id={`wood-${s}`} label={`paintWood · seed ${s}`} width={279} height={180} style={{ background: DARK, padding: 0 }}>
              <PaintFill painter={window.PIX?.paintWood} seed={s} />
            </DCArtboard>
          ))}
        </DCSection>

        {/* ── 03 Primitives ─────────────────────────────────────── */}
        <DCSection id="primitives" title="Primitives" subtitle="DarkPanel · Section · KV · Subhead · Aside · LoadingPassage · Stat">
          <DCArtboard id="DarkPanel" label="DarkPanel" width={320} height={200} style={{ background: DARK }}>
            <DarkPanel seed={7} style={{ margin: 20, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', zIndex: 1, fontFamily: MONO, fontSize: 10, color: COL.dim, padding: 12 }}>
                DarkPanel · seed 7
              </div>
            </DarkPanel>
          </DCArtboard>
          <DCArtboard id="KV" label="KV" width={480} height={240} style={{ background: DARK }}>
            <div style={{ padding: 20 }}>
              <Subhead accent={COL.ember}>example · key/value table</Subhead>
              <KV accent={COL.emberHi} rows={EXAMPLE_KV_ROWS} />
            </div>
          </DCArtboard>
          <DCArtboard id="Aside" label="Aside" width={400} height={200} style={{ background: DARK }}>
            <div style={{ padding: 20 }}>
              <Aside accent={COL.cool}>
                Why one a year? Earlier builds tied toofan to consumption pressure. The Poisson rewrite decouples it entirely.
              </Aside>
            </div>
          </DCArtboard>
          <DCArtboard id="LoadingPassage" label="LoadingPassage" width={400} height={120} style={{ background: DARK }}>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
              <LoadingPassage />
            </div>
          </DCArtboard>
          <DCArtboard id="Stat" label="Stat" width={360} height={100} style={{ background: DARK }}>
            <div style={{ padding: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Stat label="hyphae" value={42} />
              <Stat label="era" value={3} />
              <Stat label="day" value={12} />
              <Stat label="spores" value={7} />
            </div>
          </DCArtboard>
        </DCSection>

        {/* ── 04 Motifs ─────────────────────────────────────────── */}
        <DCSection id="motifs" title="Motifs" subtitle="SectionGlyph · StageGlyph — window.SectionGlyph / StageGlyph">
          <DCArtboard id="SectionGlyph" label="SectionGlyph" width={560} height={180} style={{ background: DARK }}>
            <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {SECTION_KINDS.map(kind => (
                <div key={kind} style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {GLYPH_ACCENTS.map((col, i) => (
                      <SectionGlyph key={i} kind={kind} color={col} />
                    ))}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: COL.dim }}>{kind}</div>
                </div>
              ))}
            </div>
          </DCArtboard>
          <DCArtboard id="StageGlyph" label="StageGlyph" width={480} height={120} style={{ background: DARK }}>
            <div style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {STAGE_KINDS.map(kind => (
                <div key={kind} style={{ textAlign: 'center' }}>
                  <StageGlyph kind={kind} color={COL.ember} />
                  <div style={{ fontFamily: MONO, fontSize: 8, color: COL.dim, marginTop: 4 }}>{kind}</div>
                </div>
              ))}
            </div>
          </DCArtboard>
        </DCSection>

        {/* ── 05 Charts ─────────────────────────────────────────── */}
        <ChartsSection spec={spec} />

        {/* ── 06 Overlays ───────────────────────────────────────── */}
        <DCSection id="overlays" title="Overlays" subtitle="HallModal · HallDetail · DevDashboard — window.Hall* / DevDashboard*">
          <DCArtboard id="triggers" label="Triggers" width={280} height={100} style={{ background: DARK }}>
            <OverlayTriggers />
          </DCArtboard>
        </DCSection>

        {/* ── 07 Screens ────────────────────────────────────────── */}
        <DCSection id="screens" title="Screens" subtitle="composed page layouts — home · engine section">
          <DCArtboard id="home-stub" label="Home · layout stub" width={900} height={520} style={{ background: DARK, padding: 0, overflow: 'hidden' }}>
            <HomeStub />
          </DCArtboard>
          <DCArtboard id="engine-section" label="Engine · section" width={720} height={480} style={{ background: DARK, padding: 0, overflowY: 'auto' }}>
            <EngineStub spec={spec} />
          </DCArtboard>
        </DCSection>

      </DesignCanvas>

      <TweaksPanel title="shroom · preview">
        <TweakSection label="Atmosphere" />
        <TweakSlider label="Seed base" value={t.seed} min={0} max={96}
          onChange={v => setTweak('seed', v)} />
        <TweakSection label="Typography" />
        <TweakSlider label="Font scale" value={t.fontScale} min={0.8} max={1.5} step={0.05}
          onChange={v => setTweak('fontScale', v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('preview-root')).render(<PreviewApp />);
