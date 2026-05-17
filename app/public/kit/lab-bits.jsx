// Shroom — kit · lab-bits
// Lab-page-specific UI pieces: scenario cards, run list rows, ASCII grid,
// progress bar, event/colony/timeseries tables, the "copy markdown" button.
// Depends on: tokens, primitives (DarkPanel, KV). Renders the live snapshot
// through window.ShroomCanvas which is already loaded by lab.html.

(function () {

const { MONO, SERIF, SERIF_RUN, COL } = window.SHROOM_TOKENS;
const { DarkPanel } = window;

// ── LabCanvas ─────────────────────────────────────────────────────────────
// Thin wrapper around ShroomCanvas with a fallback for empty/missing runs.
function LabCanvas({ snapshot }) {
  const ShroomCanvas = window.ShroomCanvas;
  if (!snapshot || !ShroomCanvas) {
    return (
      <div style={{
        width: '100%', aspectRatio: '320 / 180',
        background: '#0a0908',
        fontFamily: MONO, color: COL.dim, fontSize: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        no snapshot
      </div>
    );
  }
  return <ShroomCanvas snapshot={snapshot} />;
}

// ── ScenarioCard ──────────────────────────────────────────────────────────
function ScenarioCard({ scenario, selected, onPick }) {
  const accent = selected ? COL.ember : COL.faint;
  // ~1 sim-day ≈ 60 wall-clock seconds; constants snapshot will validate.
  const estSec = scenario.durationDays * 60;
  const estStr = estSec < 60 ? `~${estSec}s` : `~${Math.round(estSec / 60)}m`;
  return (
    <DarkPanel
      seed={(scenario.id.charCodeAt(0) + scenario.id.length) % 31}
      style={{ cursor: 'pointer' }}
      onClick={onPick}
    >
      <div style={{ position: 'relative', zIndex: 1, padding: '12px 14px 14px' }}>
        <div style={{
          position: 'absolute', left: 0, top: 10, bottom: 10, width: 2,
          background: accent, opacity: selected ? 0.95 : 0.5,
        }} />
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: selected ? accent : COL.dim, marginBottom: 4 }}>
          {scenario.durationDays} sim-day{scenario.durationDays === 1 ? '' : 's'} · {estStr}
        </div>
        <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 16, lineHeight: 1.1, marginBottom: 4 }}>
          {scenario.name}
        </div>
        <div style={{ fontFamily: SERIF_RUN, fontStyle: 'italic', color: COL.text2, fontSize: 12, lineHeight: 1.35 }}>
          {scenario.description}
        </div>
      </div>
    </DarkPanel>
  );
}

// ── RunListItem ───────────────────────────────────────────────────────────
// One row in the history list. Compact — one line of metadata, one of metrics.
function RunListItem({ run, selected, onPick, onDelete }) {
  const accent = selected ? COL.emberHi : COL.dim;
  const m = run.metrics || {};
  return (
    <div
      onClick={onPick}
      style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        padding: '6px 8px',
        cursor: 'pointer',
        borderLeft: `2px solid ${selected ? COL.ember : 'transparent'}`,
        background: selected ? 'rgba(200,144,88,0.06)' : 'transparent',
        fontFamily: MONO, fontSize: 11,
      }}
    >
      <span style={{ color: accent, minWidth: 54 }}>{run.id}</span>
      <span style={{ color: COL.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {run.scenarioName}
      </span>
      <span style={{ color: COL.text2 }}>
        {m.hyphaeCells || 0}c · {m.coloniesAlive || 0}/{m.deathsTotal != null ? (m.deathsTotal + (m.coloniesAlive || 0)) : '?'} alive
      </span>
      {onDelete && (
        <span
          onClick={e => { e.stopPropagation(); onDelete(run.id); }}
          style={{ color: COL.faint, padding: '0 4px', cursor: 'pointer' }}
          title="delete"
        >×</span>
      )}
    </div>
  );
}

// ── AsciiGrid ─────────────────────────────────────────────────────────────
function AsciiGrid({ ascii }) {
  if (!ascii) return null;
  return (
    <pre style={{
      fontFamily: MONO, fontSize: 9, lineHeight: 1.0,
      color: COL.text, background: '#0a0908',
      padding: 10, margin: 0,
      whiteSpace: 'pre', overflowX: 'auto',
      border: `1px solid ${COL.faint}`,
    }}>{ascii}</pre>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────
function ProgressBar({ current, total, label }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 11 }}>
      <div style={{ flex: 1, height: 6, background: COL.ink, border: `1px solid ${COL.faint}`, position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: pct + '%', background: COL.ember, transition: 'width 200ms linear',
        }} />
      </div>
      <span style={{ color: COL.text2, minWidth: 100, textAlign: 'right' }}>
        {label || `${pct}%`}
      </span>
    </div>
  );
}

// ── EventLog ──────────────────────────────────────────────────────────────
function EventLog({ events, ticksPerDay }) {
  if (!events || events.length === 0) return (
    <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 11 }}>no events captured</div>
  );
  return (
    <div style={{ maxHeight: 220, overflowY: 'auto', fontFamily: MONO, fontSize: 11, color: COL.text }}>
      {events.map((e, i) => {
        const day = ticksPerDay ? (e.tick / ticksPerDay).toFixed(2) : e.tick;
        return (
          <div key={i} style={{ padding: '2px 0', borderBottom: `1px solid ${COL.ink}` }}>
            <span style={{ color: COL.dim, marginRight: 8 }}>d{day}</span>
            <span style={{ color: COL.ember, marginRight: 8 }}>{e.kind}</span>
            <span style={{ color: COL.text2 }}>{e.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── ColoniesTable ─────────────────────────────────────────────────────────
function ColoniesTable({ colonies, ticksPerDay }) {
  if (!colonies || colonies.length === 0) return (
    <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 11 }}>no colonies recorded</div>
  );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10, color: COL.text, width: '100%' }}>
        <thead>
          <tr style={{ color: COL.dim, textAlign: 'left' }}>
            <th style={{ padding: '4px 8px' }}>id</th>
            <th style={{ padding: '4px 8px' }}>cells</th>
            <th style={{ padding: '4px 8px' }}>fruits</th>
            <th style={{ padding: '4px 8px' }}>reserves</th>
            <th style={{ padding: '4px 8px' }}>status</th>
            <th style={{ padding: '4px 8px' }}>cause</th>
            <th style={{ padding: '4px 8px' }}>phenotype</th>
          </tr>
        </thead>
        <tbody>
          {colonies.map(c => (
            <tr key={c.id} style={{ borderTop: `1px solid ${COL.ink}` }}>
              <td style={{ padding: '4px 8px', color: COL.emberHi }}>{c.name || c.placeholderName || c.id}</td>
              <td style={{ padding: '4px 8px' }}>{c.cellCount}</td>
              <td style={{ padding: '4px 8px' }}>{c.fruitCount}</td>
              <td style={{ padding: '4px 8px' }}>{c.reserves}</td>
              <td style={{ padding: '4px 8px', color: c.alive ? COL.hyphaHi : COL.danger }}>{c.alive ? 'alive' : 'dead'}</td>
              <td style={{ padding: '4px 8px', color: COL.text2 }}>{c.deathCause || '—'}</td>
              <td style={{ padding: '4px 8px', color: COL.text2 }}>{c.phenotypeWords || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── TimeseriesTable ───────────────────────────────────────────────────────
function TimeseriesTable({ samples }) {
  if (!samples || samples.length === 0) return null;
  return (
    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10, color: COL.text, width: '100%' }}>
        <thead>
          <tr style={{ color: COL.dim, textAlign: 'right', position: 'sticky', top: 0, background: '#0a0908' }}>
            <th style={{ padding: '4px 8px', textAlign: 'left' }}>day</th>
            <th style={{ padding: '4px 8px' }}>colonies</th>
            <th style={{ padding: '4px 8px' }}>hyphae</th>
            <th style={{ padding: '4px 8px' }}>fruits</th>
            <th style={{ padding: '4px 8px' }}>spores</th>
            <th style={{ padding: '4px 8px' }}>log cells</th>
            <th style={{ padding: '4px 8px' }}>avg log nut</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((s, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${COL.ink}`, textAlign: 'right' }}>
              <td style={{ padding: '2px 8px', textAlign: 'left', color: COL.text2 }}>{s.simDay}</td>
              <td style={{ padding: '2px 8px' }}>{s.coloniesAlive}</td>
              <td style={{ padding: '2px 8px' }}>{s.hyphaeCells}</td>
              <td style={{ padding: '2px 8px' }}>{s.fruitsInAir}</td>
              <td style={{ padding: '2px 8px' }}>{s.sporesInAir}</td>
              <td style={{ padding: '2px 8px' }}>{s.logCells}</td>
              <td style={{ padding: '2px 8px' }}>{s.avgLogNutrient}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── LabButton ─────────────────────────────────────────────────────────────
// Pixel-style button used across the page.
function LabButton({ children, onClick, disabled, accent, style }) {
  const ac = accent || COL.ember;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: `1px solid ${disabled ? COL.faint : ac}`,
        color: disabled ? COL.dim : ac,
        padding: '6px 14px',
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

window.LabCanvas        = LabCanvas;
window.ScenarioCard     = ScenarioCard;
window.RunListItem      = RunListItem;
window.AsciiGrid        = AsciiGrid;
window.ProgressBar      = ProgressBar;
window.EventLog         = EventLog;
window.ColoniesTable    = ColoniesTable;
window.TimeseriesTable  = TimeseriesTable;
window.LabButton        = LabButton;

})();
