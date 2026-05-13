// home-server Shroom — StatusStrip
// Ported from claude.ai design's locked-vision kit (ui.jsx). Replaces the
// dev-console-style status header. Three groups: identity (vol/era/day),
// season+weather, and live counts in mono.

const _uiPlex = '"IBM Plex Sans", system-ui, sans-serif';
const _uiMono = '"IBM Plex Mono", monospace';
const _uiSerif = '"IM Fell English", serif';
const _uiSerifSC = '"IM Fell DW Pica SC", serif';

// Sim era → text. Until we have proper era names, "era N" (Roman-ish).
function eraName(volume) {
  return `era ${volume || 1}`;
}

// Pretty Roman-ish day number padded.
function dayText(meta) {
  const TICKS_PER_DAY = 28800;
  const days = Math.floor((meta.tick || 0) / TICKS_PER_DAY);
  return `day ${String(days).padStart(3, '0')}`;
}

function StatusStrip({ snapshot }) {
  if (!snapshot) return null;
  const m = snapshot.meta;
  const c = (() => {
    // Counts derived from the snapshot.
    let hyphae = 0;
    let alive = 0;
    for (const col of Object.values(snapshot.colonies || {})) {
      if (col.alive) { alive++; hyphae += col.cellCount || 0; }
    }
    return {
      alive,
      hyphae,
      fruits: (snapshot.fruits  || []).length,
      spores: (snapshot.spores  || []).length,
      pressure: Math.round((m.toofanPressure || 0) * 100),
    };
  })();
  const seasonColour = {
    spring: 'linear-gradient(135deg, #b4d4e8 0%, #c8d4dc 100%)',
    summer: 'linear-gradient(135deg, #f0d090 0%, #e8c878 100%)',
    autumn: 'linear-gradient(135deg, #d89058 0%, #b06030 100%)',
    winter: 'linear-gradient(135deg, #d4dce8 0%, #b8c4d4 100%)',
  }[m.season] || 'linear-gradient(135deg, #d4cdb8 0%, #c8c1ad 100%)';
  const weatherTxt = m.weather && m.weather !== 'clear' ? m.weather : 'clear';

  return (
    <div style={{
      background: '#0a0908', color: '#d4cdb8', padding: '14px 20px',
      fontFamily: _uiPlex, display: 'flex', alignItems: 'center',
      gap: 24, flexWrap: 'wrap', borderRadius: 2,
      border: '1px solid #1f1c17',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flex: '0 0 auto' }}>
        <span style={{ fontFamily: _uiSerifSC, fontSize: 20, color: '#e8dfc8', letterSpacing: '0.04em' }}>
          vol&nbsp;{String(m.volume || 1).padStart(2, '0')}
        </span>
        <span style={{ width: 1, height: 14, background: '#3a342a' }} />
        <span style={{ fontFamily: _uiSerif, fontStyle: 'italic', fontSize: 16, color: '#c8c1ad' }}>
          {eraName(m.volume)}
        </span>
        <span style={{ fontFamily: _uiMono, fontSize: 10, color: '#7a7060', letterSpacing: '0.08em' }}>
          {dayText(m)}
        </span>
      </div>

      <div style={{ flex: 1, height: 1, minWidth: 20,
        background: 'linear-gradient(to right, transparent, #2a261f, transparent)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16,
        fontFamily: _uiMono, fontSize: 10, color: '#7a7060' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 4,
            background: seasonColour,
            boxShadow: '0 0 6px rgba(180,212,232,0.4)',
          }} />
          {m.season} · {weatherTxt}
        </span>
        <span style={{ color: '#3a342a' }}>·</span>
        <Stat label="alive"    v={c.alive} />
        <Stat label="hyphae"   v={c.hyphae} />
        <Stat label="spores"   v={String(c.spores).padStart(2, '0')} />
        <Stat label="fruits"   v={String(c.fruits).padStart(2, '0')} />
        <Stat label="pressure" v={`${c.pressure}%`} warn={c.pressure > 60} />
      </div>
    </div>
  );
}

function Stat({ label, v, warn }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ color: '#5a5240', fontSize: 9,  letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: warn ? '#c89058' : '#c8c1ad', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v}</span>
    </span>
  );
}

window.StatusStrip = StatusStrip;
