// home-server Shroom — dev dashboard overlay.
// Hidden by default; opens on ⌘. (Cmd+Period) or the gear icon, closes on
// Esc or backdrop click. Wires the kit's Toggle/Range/Segmented primitives
// to our existing /api/dev/* and /api/debug/* endpoints.

const _dPlex    = '"IBM Plex Sans", system-ui, sans-serif';
const _dMono    = '"IBM Plex Mono", monospace';
const _dSerif   = '"IM Fell English", serif';
const _dSerifSC = '"IM Fell DW Pica SC", serif';

function DevDashboard({ open, onClose, onAction }) {
  // Live dev settings from the server.
  const [status, setStatus] = React.useState(null);
  const [speed,  setSpeed]  = React.useState(1);
  const [aiOff,  setAiOff]  = React.useState(false);
  const [tof,    setTof]    = React.useState('fire');
  const [ffDays, setFfDays] = React.useState(3);
  const [busy,   setBusy]   = React.useState(false);
  const [msg,    setMsg]    = React.useState(null);

  // Esc to close.
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Refresh on open.
  React.useEffect(() => {
    if (!open) return;
    fetch('/api/dev/status')
      .then(r => r.json())
      .then(s => {
        setStatus(s);
        if (s.tickIntervalMs) setSpeed(s.multiplier || 1);
        if (typeof s.nigehbanDisabled === 'boolean') setAiOff(s.nigehbanDisabled);
      })
      .catch(() => { /* dev mode might not have /api/dev/* — that's fine */ });
  }, [open]);

  async function call(path, opts) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(path, opts || { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      setMsg(j.ok === false ? (j.error || 'failed') : 'ok');
      if (onAction) await onAction();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); setTimeout(() => setMsg(null), 2400); }
  }

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0a0908', color: '#d4cdb8', width: '90%', maxWidth: 480,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        borderRadius: 4, border: '1px solid #1f1c17',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', borderBottom: '1px solid #1f1c17',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: '#c89058' }} />
          <span style={{ fontFamily: _dSerifSC, fontSize: 16, letterSpacing: '0.06em' }}>Tools</span>
          <span style={{ fontFamily: _dMono, fontSize: 10, color: '#5a5240' }}>· ⌘.</span>
          <div style={{ flex: 1 }} />
          {msg && <span style={{ fontFamily: _dMono, fontSize: 10, color: msg === 'ok' ? '#8aaa78' : '#c87058' }}>{msg}</span>}
          <button onClick={onClose} style={btn('ghost', { padding: '4px 10px', marginTop: 0 })}>esc</button>
        </div>

        <div style={{ padding: '4px 20px 18px', overflowY: 'auto', fontFamily: _dPlex, fontSize: 12 }}>
          <Section label="simulation">
            <Range k="sim speed" v={speed} min={0.25} max={10} step={0.25}
              fmt={(v) => v.toFixed(2) + '×'}
              onCommit={(v) => call('/api/dev/speed?multiplier=' + v)} />
            <Toggle k="nigehban disabled" v={aiOff}
              onChange={(v) => { setAiOff(v); call('/api/dev/ai?enabled=' + (!v)); }} />
          </Section>

          <Section label="fast-forward">
            <Range k="days" v={ffDays} min={1} max={14} step={1}
              fmt={(v) => v + 'd'}
              onChange={setFfDays} />
            <button disabled={busy} onClick={() => call('/api/dev/fast-forward?days=' + ffDays)} style={btn('warn')}>
              fast-forward {ffDays} sim-days
            </button>
          </Section>

          <Section label="force toofan">
            <Segmented k="kind" options={['flood','fire','frost','wind']} v={tof} onChange={setTof} />
            <button disabled={busy} onClick={() => call('/api/debug/toofan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flavor: tof }) })} style={btn('warn')}>
              summon {tof}
            </button>
          </Section>

          <Section label="colony actions">
            <button disabled={busy} onClick={() => call('/api/debug/sow')}            style={btn()}>sow random</button>
            <button disabled={busy} onClick={() => call('/api/debug/nigehban-wake')}  style={btn()}>wake nigehbān</button>
            <button disabled={busy} onClick={() => call('/api/debug/inscribe')}       style={btn()}>force inscribe topmost</button>
          </Section>

          <Section label="trees">
            <button disabled={busy} onClick={() => call('/api/debug/spawn-tree?grown=1')} style={btn()}>spawn full-grown tree</button>
            <button disabled={busy} onClick={() => call('/api/debug/fell-tree')}          style={btn()}>fell oldest tree</button>
          </Section>

          <Section label="world">
            <button disabled={busy} onClick={() => call('/api/debug/save')}  style={btn()}>save snapshot</button>
            <button disabled={busy} onClick={() => call('/api/debug/reset')} style={btn('danger')}>reset world (keeps hall)</button>
          </Section>

          {status && (
            <div style={{ fontFamily: _dMono, fontSize: 10, color: '#5a5240', marginTop: 10, paddingTop: 10, borderTop: '1px dotted #2a261f' }}>
              tickInterval {status.tickIntervalMs}ms · paused {String(!!status.paused)}
              {typeof status.nigehbanDisabled === 'boolean' ? ' · nigehban ' + (status.nigehbanDisabled ? 'off' : 'on') : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Small wrapper section.
function Section({ label, children }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid #1f1c17' }}>
      <div style={{ fontFamily: _dMono, fontSize: 10, color: '#7a7060', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

// Primitives, ported from ui.jsx (design kit).
function Toggle({ k, v: initial, onChange }) {
  const [v, setV] = React.useState(initial);
  React.useEffect(() => setV(initial), [initial]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
      <span style={{ flex: 1, color: '#c8c1ad' }}>{k}</span>
      <button
        onClick={() => { const nv = !v; setV(nv); onChange && onChange(nv); }}
        style={{
          width: 30, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 0,
          background: v ? '#5a4632' : '#1f1c17', position: 'relative', transition: 'background 0.15s',
        }}>
        <span style={{
          position: 'absolute', top: 2, left: v ? 16 : 2,
          width: 12, height: 12, borderRadius: 6,
          background: v ? '#c89058' : '#5a5240', transition: 'left 0.15s',
        }} />
      </button>
    </div>
  );
}

function Range({ k, v: initial, min, max, step, onChange, onCommit, fmt }) {
  const [v, setV] = React.useState(initial);
  React.useEffect(() => setV(initial), [initial]);
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ flex: 1, color: '#c8c1ad' }}>{k}</span>
        <span style={{ fontFamily: _dMono, fontSize: 10, color: '#a89a78' }}>{fmt ? fmt(v) : v}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { const nv = +e.target.value; setV(nv); onChange && onChange(nv); }}
        onMouseUp={() => onCommit && onCommit(v)}
        onTouchEnd={() => onCommit && onCommit(v)}
        style={{ width: '100%', accentColor: '#c89058', background: 'transparent', height: 16 }} />
    </div>
  );
}

function Segmented({ k, options, v, onChange }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <span style={{ flex: 1, color: '#c8c1ad' }}>{k}</span>
      </div>
      <div style={{ display: 'flex', gap: 2, background: '#161410', padding: 2, borderRadius: 4 }}>
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)} style={{
            flex: 1, padding: '5px 8px', border: 'none', cursor: 'pointer',
            background: o === v ? '#2a241c' : 'transparent',
            color: o === v ? '#e8dfc8' : '#7a7060',
            fontFamily: _dPlex, fontSize: 11, borderRadius: 3,
            transition: 'background 0.12s, color 0.12s',
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function btn(variant, extra) {
  const base = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 12px', border: '1px solid #1f1c17', borderRadius: 3, cursor: 'pointer',
    fontFamily: _dPlex, fontSize: 12, marginTop: 6,
    background: '#0a0908', color: '#c8c1ad',
    transition: 'background 0.12s, border-color 0.12s',
    ...(extra || {}),
  };
  if (variant === 'warn')   return { ...base, color: '#c89058', borderColor: '#5a4632' };
  if (variant === 'danger') return { ...base, color: '#c87058', borderColor: '#5a3232' };
  if (variant === 'ghost')  return { ...base, color: '#7a7060', borderColor: '#2a261f' };
  return base;
}

// ── trigger button (gear) + ⌘. hotkey ──────────────────────────────
function DevDashboardTrigger({ onOpen }) {
  React.useEffect(() => {
    const h = (e) => {
      // Cmd+. (macOS) or Ctrl+. (others)
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onOpen(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onOpen]);
  return (
    <button onClick={onOpen} title="dev tools · ⌘." style={{
      background: 'rgba(20, 16, 12, 0.7)',
      border: '1px solid rgba(168, 196, 176, 0.16)',
      color: '#7a7060', width: 28, height: 28, borderRadius: 14,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', fontFamily: _dMono, fontSize: 14, lineHeight: 1,
      transition: 'color 120ms, border-color 120ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.color = '#c89058'; e.currentTarget.style.borderColor = 'rgba(200,144,88,0.32)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.color = '#7a7060'; e.currentTarget.style.borderColor = 'rgba(168, 196, 176, 0.16)'; }}
    >⚙</button>
  );
}

window.DevDashboard = DevDashboard;
window.DevDashboardTrigger = DevDashboardTrigger;
