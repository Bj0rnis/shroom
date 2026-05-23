// Shroom — kit · shell
// StatusLeft, StatusRight: the two bottom status strips for the home page.
// Depends on: tokens, atmosphere, primitives (window.SHROOM_TOKENS, window.PIX,
//             window.DarkPanel, window.Stat).

(function () {

const { MONO, SERIF, SERIF_BODY, SANS } = window.SHROOM_TOKENS;

// ── Helpers ───────────────────────────────────────────────────────────────
function eraName(volume) {
  return `era ${volume || 1}`;
}

function dayText(meta) {
  const TICKS_PER_DAY = 28800;
  const days = Math.floor((meta.tick || 0) / TICKS_PER_DAY);
  return `day ${String(days).padStart(3, '0')}`;
}

function _statusVitals(snapshot) {
  let hyphae = 0, alive = 0;
  for (const col of Object.values(snapshot.colonies || {})) {
    if (col.alive) { alive++; hyphae += col.cellCount || 0; }
  }
  return {
    alive,
    hyphae,
    fruits:   (snapshot.fruits  || []).length,
    spores:   (snapshot.spores  || []).length,
    pressure: Math.round((snapshot.meta.toofanPressure || 0) * 100),
  };
}

// ── StatusLeft — vol / era / day strip + optional nav chip row ───────────
// `nav` is a React node (typically a fragment of nav triggers). When
// provided, it renders as a second row beneath the vol/era/day line.
// Keeps StatusLeft kit-pure: it doesn't know which routes exist, the
// caller wires them. See kanban #02.
function StatusLeft({ snapshot, nav }) {
  if (!snapshot) return null;
  const m = snapshot.meta;
  return (
    <DarkPanel seed={7} elevation={1} style={{ color: COL.text, fontFamily: SANS }}>
      <div style={{
        position: 'relative',
        padding: '10px 16px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: SERIF, fontSize: 18, color: COL.textHi, letterSpacing: '0.04em' }}>
            vol&nbsp;{String(m.volume || 1).padStart(2, '0')}
          </span>
          <span style={{ width: 1, height: 12, background: COL.divider, alignSelf: 'center' }} />
          <span style={{ fontFamily: SERIF_BODY, fontStyle: 'italic', fontSize: 14, color: COL.textMid }}>
            {eraName(m.volume)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: COL.dim, letterSpacing: '0.08em' }}>
            {dayText(m)}
          </span>
        </div>
        {nav && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            marginLeft: -6,  // bleed the chip's 6px padding back to the panel edge
          }}>
            {nav}
          </div>
        )}
      </div>
    </DarkPanel>
  );
}

// ── StatusRight — season / vitals / pressure bar ─────────────────────────
function StatusRight({ snapshot }) {
  if (!snapshot) return null;
  const m = snapshot.meta;
  const c = _statusVitals(snapshot);
  const seasonRGB = {
    spring: [180, 212, 232],
    summer: [240, 208, 144],
    autumn: [216, 144, 88],
    winter: [212, 220, 232],
  }[m.season] || [212, 205, 184];
  const weatherTxt = m.weather && m.weather !== 'clear' ? m.weather : 'clear';
  const PIX = window.PIX;
  const Stat = window.Stat;
  const pct = Math.min(1, c.pressure / 100);
  const mSrc = 30;

  return (
    <DarkPanel seed={7} elevation={1} style={{ color: COL.text, fontFamily: SANS }}>
      <div style={{
        position: 'relative',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        fontFamily: MONO, fontSize: 10, color: COL.dim,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {PIX && (
            <PIX.PixelStage w={4} h={4} scale={3}
              deps={[m.season]}
              draw={(pb) => pb.rect(0, 0, 4, 4, seasonRGB)}
              style={{ display: 'inline-block', verticalAlign: 'middle', imageRendering: 'pixelated' }}
            />
          )}
          {m.season}·{weatherTxt}
        </span>
        <Stat label="alive"  v={c.alive} />
        <Stat label="hyphae" v={c.hyphae} />
        <Stat label="spores" v={String(c.spores).padStart(2, '0')} />
        <Stat label="fruits" v={String(c.fruits).padStart(2, '0')} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <span style={{ color: COL.dimLo, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>pres</span>
          <span style={{ color: c.pressure > 60 ? COL.ember : COL.textMid, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
            {c.pressure}%
          </span>
          {PIX && (
            <PIX.PixelStage w={mSrc + 2} h={4} scale={2}
              deps={[c.pressure]}
              draw={(pb) => {
                pb.rect(0, 0, mSrc + 2, 4, PIX.C.inkLo);
                pb.rect(1, 1, Math.round(pct * mSrc), 2,
                  c.pressure > 60 ? PIX.C.ember : PIX.C.inkHi);
              }}
              style={{ display: 'inline-block', verticalAlign: 'middle', imageRendering: 'pixelated' }}
            />
          )}
        </span>
      </div>
    </DarkPanel>
  );
}

window.StatusLeft  = StatusLeft;
window.StatusRight = StatusRight;

})();
