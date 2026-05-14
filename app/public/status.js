// Almari Shroom — StatusStrip
// Pixel-dark panel (DarkPanel) with IBM Plex typography. Season indicator is
// a 4×4 pixel-art color chip; pressure has a small pixel bar meter.

const _uiPlex    = '"IBM Plex Sans", system-ui, sans-serif';
const _uiMono    = '"IBM Plex Mono", monospace';
const _uiSerif   = '"IM Fell English", serif';
const _uiSerifSC = '"IM Fell DW Pica SC", serif';

function eraName(volume) {
  return `era ${volume || 1}`;
}

function dayText(meta) {
  const TICKS_PER_DAY = 28800;
  const days = Math.floor((meta.tick || 0) / TICKS_PER_DAY);
  return `day ${String(days).padStart(3, '0')}`;
}

// Stats derived from snapshot — shared by StatusLeft and StatusRight.
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

function StatusLeft({ snapshot }) {
  if (!snapshot) return null;
  const m = snapshot.meta;
  return (
    <DarkPanel seed={7} style={{ color: '#d4cdb8', fontFamily: _uiPlex }}>
      <div style={{
        position: 'relative',
        padding: '10px 16px',
        display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: _uiSerifSC, fontSize: 18, color: '#e8dfc8', letterSpacing: '0.04em' }}>
          vol&nbsp;{String(m.volume || 1).padStart(2, '0')}
        </span>
        <span style={{ width: 1, height: 12, background: '#3a342a', alignSelf: 'center' }} />
        <span style={{ fontFamily: _uiSerif, fontStyle: 'italic', fontSize: 14, color: '#c8c1ad' }}>
          {eraName(m.volume)}
        </span>
        <span style={{ fontFamily: _uiMono, fontSize: 10, color: '#7a7060', letterSpacing: '0.08em' }}>
          {dayText(m)}
        </span>
      </div>
    </DarkPanel>
  );
}

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
  const pct = Math.min(1, c.pressure / 100);
  const mSrc = 30;

  return (
    <DarkPanel seed={7} style={{ color: '#d4cdb8', fontFamily: _uiPlex }}>
      <div style={{
        position: 'relative',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        fontFamily: _uiMono, fontSize: 10, color: '#7a7060',
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
          <span style={{ color: '#5a5240', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>pres</span>
          <span style={{ color: c.pressure > 60 ? '#c89058' : '#c8c1ad', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
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

function Stat({ label, v, warn }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ color: '#5a5240', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: warn ? '#c89058' : '#c8c1ad', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v}</span>
    </span>
  );
}

window.StatusLeft  = StatusLeft;
window.StatusRight = StatusRight;
