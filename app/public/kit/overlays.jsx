// Shroom — kit · overlays
// Hall of Fame (HallMark, HallMushroom, HallTrigger, HallModal, HallDetail)
// and Dev Dashboard (DevDashboard, DevDashboardTrigger).
// Depends on: tokens, atmosphere, primitives (window.SHROOM_TOKENS, window.PIX,
//             window.DarkPanel).

(function () {

const { MONO, SERIF, SERIF_RUN, SERIF_BODY, SANS, COL } = window.SHROOM_TOKENS;

// Palette shortcuts removed in #05 sweep — use COL.* directly. The old
// H_TITLE / H_BODY / H_FAINT / H_DIM / H_EMBER mapped to
// COL.textHi / COL.textMid / COL.dim / COL.divider / COL.ember.

// ── hsl → [r, g, b] ──────────────────────────────────────────────────────
function _hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// ── Hall components ───────────────────────────────────────────────────────

function HallMark() {
  const PIX = window.PIX;
  if (!PIX) return null;
  return (
    <PIX.PixelStage w={7} h={8} scale={2}
      deps={[]}
      draw={(pb) => {
        pb.rect(0, 1, 7, 4, COL.ink);
        pb.rect(1, 1, 5, 1, COL.dim);
        pb.rect(0, 2, 7, 2, COL.dim);
        pb.rect(3, 4, 1, 2, COL.textMid);
        pb.rect(0, 7, 7, 1, COL.divider);
      }}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6, imageRendering: 'pixelated' }}
    />
  );
}

function HallMushroom({ entry, size = 84, pixelScale, glow = true }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    if (glow) {
      const grd = ctx.createRadialGradient(c.width / 2, c.height * 0.45, 4,
                                            c.width / 2, c.height * 0.45, c.height * 0.55);
      grd.addColorStop(0, 'rgba(232, 220, 180, 0.22)');
      grd.addColorStop(1, 'rgba(232, 220, 180, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, c.width, c.height);
    }

    const sw = 22, sh = 26;
    const off = document.createElement('canvas');
    off.width = sw; off.height = sh;
    const octx = off.getContext('2d');
    const hue   = ((entry.cap_hue   || 0)   % 360 + 360) % 360;
    const sizeG = entry.cap_size || 1;
    const stemG = entry.stem_length || 1;
    const r     = Math.max(2, Math.round(sizeG * 5));
    const stemH = Math.max(4, Math.round(stemG * 6));
    const baseY = sh - 3;
    const stemTop = baseY - stemH;

    octx.fillStyle = 'rgba(40, 24, 12, 0.5)';
    octx.fillRect(0, sh - 2, sw, 2);

    octx.fillStyle = `rgb(${_hsl(38, 14, 72).join(',')})`;
    octx.fillRect(sw / 2 - 1, stemTop, 2, stemH);
    octx.fillStyle = `rgb(${_hsl(36, 18, 56).join(',')})`;
    octx.fillRect(sw / 2 + 1, stemTop, 1, stemH);

    const mid     = _hsl(hue, 38, 50);
    const light   = _hsl(hue, 38, 60);
    const shadow  = _hsl(hue, 42, 30);
    const outline = _hsl(hue, 30, 18);
    const cx = sw / 2;
    const cy = stemTop;
    function dot(x, y, c) { octx.fillStyle = `rgb(${c.join(',')})`; octx.fillRect(x, y, 1, 1); }
    const shape = entry.cap_shape | 0;
    if (shape === 0) {
      for (let dy = -r; dy <= 0; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy * 1.15);
          if (d > r) continue;
          let c = mid;
          if (d > r - 1) c = outline;
          else if (dx < -r * 0.3 && dy < -r * 0.3) c = light;
          else if (dy > -1) c = shadow;
          dot(cx + dx, cy + dy, c);
        }
      }
    } else if (shape === 1) {
      const h2 = Math.round(r * 1.7);
      for (let dy = -h2; dy <= 0; dy++) {
        const t = -dy / h2;
        const w = Math.round(r * (1 - t));
        for (let dx = -w; dx <= w; dx++) {
          let c = mid;
          if (Math.abs(dx) === w || dy === -h2) c = outline;
          else if (dx < 0 && t > 0.4) c = light;
          else if (dx > 0) c = shadow;
          dot(cx + dx, cy + dy, c);
        }
      }
    } else if (shape === 2) {
      const w = Math.round(r * 1.4);
      const t = Math.max(2, Math.round(r * 0.45));
      for (let dy = -t; dy <= 0; dy++) {
        for (let dx = -w; dx <= w; dx++) {
          const d = Math.sqrt((dx / w) * (dx / w) + (dy / t) * (dy / t));
          if (d > 1) continue;
          let c = mid;
          if (d > 0.85) c = outline;
          else if (dx < -w * 0.3 && dy < -t * 0.3) c = light;
          else if (dy > -t * 0.4) c = shadow;
          dot(cx + dx, cy + dy, c);
        }
      }
    } else {
      const bumps = 4;
      const br = Math.max(1, Math.round(r * 0.55));
      for (let b = 0; b < bumps; b++) {
        const tt = b / (bumps - 1) - 0.5;
        const bx = Math.round(tt * r * 1.6);
        const by = -Math.round(br * (b === 0 || b === bumps - 1 ? 0.7 : 1));
        for (let dy = -br; dy <= 0; dy++) {
          for (let dx = -br; dx <= br; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy * 1.2);
            if (d > br) continue;
            let c = mid;
            if (d > br - 0.8) c = outline;
            else if (dx < 0 && dy < 0) c = light;
            else if (dy > -0.5) c = shadow;
            dot(cx + bx + dx, cy + by + dy, c);
          }
        }
      }
    }
    ctx.imageSmoothingEnabled = false;
    // pixelScale lets callers shrink the render for inline use (rail). Default
    // keeps the historic 3× draw used by Hall cards. Auto-fit when omitted on
    // smaller canvases so size=24 doesn't overflow.
    const scale = pixelScale ?? Math.max(1, Math.min(3, Math.floor((c.width - 2) / sw)));
    const drawW = sw * scale;
    const drawH = sh * scale;
    const padTop = Math.max(1, Math.min(6, Math.floor(c.height - drawH - 1)));
    ctx.drawImage(off, (c.width - drawW) / 2, padTop, drawW, drawH);
  }, [entry, size, pixelScale, glow]);
  return <canvas ref={ref} width={size} height={Math.round(size * 1.2)}
    style={{ display: 'block', imageRendering: 'pixelated' }} />;
}

function HallTrigger({ entries, onOpen }) {
  const count = entries ? entries.length : 0;
  return (
    <DarkPanel seed={13} style={{ color: COL.textMid, flexShrink: 0 }}>
      <button
        type="button"
        onClick={onOpen}
        title="Hall of fame"
        style={{
          position: 'relative', width: '100%',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          background: 'transparent', border: 0, cursor: 'pointer',
          color: 'inherit', textAlign: 'left',
        }}
      >
        <HallMark />
        <span style={{ fontFamily: SERIF, fontSize: 13, color: COL.textHi, letterSpacing: '0.06em' }}>
          Hall of fame
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: COL.dim, letterSpacing: '0.12em' }}>
          · {count} inscribed
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 10, color: COL.dim }}>open →</span>
      </button>
    </DarkPanel>
  );
}

function HallModal({ open, entries, onClose, onSelect }) {
  if (!open) return null;
  const list = entries || [];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(720px, 92vw)', height: 'min(560px, 86vh)',
        display: 'flex', flexDirection: 'column',
      }}>
        <DarkPanel seed={15} style={{ width: '100%', height: '100%', overflow: 'hidden', color: COL.textMid }}>
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '14px 20px', display: 'flex', alignItems: 'baseline', gap: 12,
              borderBottom: `1px solid ${COL.divider}`,
            }}>
              <HallMark />
              <span style={{ fontFamily: SERIF, fontSize: 18, color: COL.textHi, letterSpacing: '0.04em' }}>
                Hall of fame
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: COL.dim, letterSpacing: '0.12em' }}>
                · {list.length} inscribed
              </span>
              <span style={{ flex: 1 }} />
              <button onClick={onClose} style={{
                background: 'transparent', border: 0, color: COL.dim, cursor: 'pointer',
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', padding: '4px 8px',
              }}>close ✕</button>
            </div>
            {list.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SERIF_BODY, fontStyle: 'italic', fontSize: 15, color: COL.dim }}>
                no colony has yet been inscribed.
              </div>
            ) : (
              <div style={{
                flex: 1, overflowY: 'auto', padding: '14px 16px',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10,
              }}>
                {list.map((e, i) => (
                  <button key={i}
                    onClick={() => onSelect && onSelect(e)}
                    title={`${e.name} · vol ${e.volume}`}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: 10, borderRadius: 2,
                      background: 'rgba(232, 223, 200, 0.04)',
                      border: `1px solid ${COL.divider}`,
                      cursor: 'pointer',
                      transition: 'background 120ms, border-color 120ms',
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(232, 223, 200, 0.08)'; ev.currentTarget.style.borderColor = COL.dim; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(232, 223, 200, 0.04)'; ev.currentTarget.style.borderColor = COL.divider; }}
                  >
                    <HallMushroom entry={e} size={72} />
                    <div style={{ fontFamily: SERIF_BODY, fontStyle: 'italic', fontSize: 13, color: COL.textHi, textAlign: 'center' }}>{e.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: COL.dim, letterSpacing: '0.08em' }}>
                      vol {e.volume}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DarkPanel>
      </div>
    </div>
  );
}

function HallDetail({ entry, onClose }) {
  if (!entry) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(480px, 92vw)',
      }}>
        <DarkPanel seed={17} style={{ width: '100%', overflow: 'hidden', color: COL.textMid }}>
          <div style={{ position: 'relative', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
              <HallMushroom entry={entry} size={120} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SERIF_BODY, fontStyle: 'italic', fontSize: 22, color: COL.textHi }}>{entry.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: COL.dim, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
                  volume {entry.volume}{entry.phenotype ? ` · ${entry.phenotype}` : ''}
                </div>
              </div>
            </div>
            {entry.reason && (
              <div style={{ fontFamily: MONO, fontSize: 11, color: COL.dim, letterSpacing: '0.05em' }}>
                cause: {entry.reason}
              </div>
            )}
            {entry.epitaph && (
              <div style={{ fontFamily: SERIF_BODY, fontStyle: 'italic', fontSize: 14, lineHeight: 1.55, color: COL.textHi }}>
                "{entry.epitaph}"
              </div>
            )}
          </div>
        </DarkPanel>
      </div>
    </div>
  );
}

// ── Dev Dashboard ─────────────────────────────────────────────────────────

function DevDashboard({ open, onClose, onAction }) {
  const [status, setStatus] = React.useState(null);
  const [speed,  setSpeed]  = React.useState(1);
  const [aiOff,  setAiOff]  = React.useState(false);
  const [tof,    setTof]    = React.useState('fire');
  const [ffDays, setFfDays] = React.useState(3);
  const [busy,   setBusy]   = React.useState(false);
  const [msg,    setMsg]    = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    fetch('/api/dev/status')
      .then(r => r.json())
      .then(s => {
        setStatus(s);
        if (s.tickIntervalMs) setSpeed(s.multiplier || 1);
        if (typeof s.nigehbanDisabled === 'boolean') setAiOff(s.nigehbanDisabled);
      })
      .catch(() => {});
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
      <DarkPanel seed={2} onClick={e => e.stopPropagation()} style={{
        color: COL.text, width: '90%', maxWidth: 480,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* header */}
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', borderBottom: `1px solid ${COL.air}`,
        }}>
          <span style={{ width: 7, height: 7, background: COL.ember }} />
          <span style={{ fontFamily: SERIF, fontSize: 16, letterSpacing: '0.06em' }}>Tools</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: COL.dimLo }}>· ⌘.</span>
          <div style={{ flex: 1 }} />
          {msg && <span style={{ fontFamily: MONO, fontSize: 10, color: msg === 'ok' ? COL.grassHi : COL.danger }}>{msg}</span>}
          <button onClick={onClose} style={_dashBtn('ghost', { padding: '4px 10px', marginTop: 0 })}>esc</button>
        </div>

        {/* body */}
        <div style={{
          position: 'relative',
          padding: '4px 20px 18px', overflowY: 'auto', fontFamily: SANS, fontSize: 12, flex: 1,
        }}>
          <_DashSection label="simulation">
            <_Range k="sim speed" v={speed} min={0.25} max={10} step={0.25}
              fmt={(v) => v.toFixed(2) + '×'}
              onCommit={(v) => call('/api/dev/speed?multiplier=' + v)} />
            <_Toggle k="nigehban disabled" v={aiOff}
              onChange={(v) => { setAiOff(v); call('/api/dev/ai?enabled=' + (!v)); }} />
          </_DashSection>

          <_DashSection label="fast-forward">
            <_Range k="days" v={ffDays} min={1} max={14} step={1}
              fmt={(v) => v + 'd'}
              onChange={setFfDays} />
            <button disabled={busy} onClick={() => call('/api/dev/fast-forward?days=' + ffDays)} style={_dashBtn('warn')}>
              fast-forward {ffDays} sim-days
            </button>
          </_DashSection>

          <_DashSection label="force toofan">
            <_Segmented k="kind" options={['flood','fire','frost','wind']} v={tof} onChange={setTof} />
            <button disabled={busy} onClick={() => call('/api/debug/toofan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flavor: tof }) })} style={_dashBtn('warn')}>
              summon {tof}
            </button>
          </_DashSection>

          <_DashSection label="colony actions">
            <button disabled={busy} onClick={() => call('/api/debug/sow')}            style={_dashBtn()}>sow random</button>
            <button disabled={busy} onClick={() => call('/api/debug/nigehban-wake')}  style={_dashBtn()}>wake nigehbān</button>
            <button disabled={busy} onClick={() => call('/api/debug/inscribe')}       style={_dashBtn()}>force inscribe topmost</button>
          </_DashSection>

          <_DashSection label="trees">
            <button disabled={busy} onClick={() => call('/api/debug/spawn-tree?grown=1')} style={_dashBtn()}>spawn full-grown tree</button>
            <button disabled={busy} onClick={() => call('/api/debug/fell-tree')}          style={_dashBtn()}>fell oldest tree</button>
          </_DashSection>

          <_DashSection label="world">
            <button disabled={busy} onClick={() => call('/api/debug/save')}  style={_dashBtn()}>save snapshot</button>
            <button disabled={busy} onClick={() => call('/api/debug/reset')} style={_dashBtn('danger')}>reset world (keeps hall)</button>
          </_DashSection>

          {status && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: COL.dimLo, marginTop: 10, paddingTop: 10, borderTop: `1px dotted ${COL.air}` }}>
              tickInterval {status.tickIntervalMs}ms · paused {String(!!status.paused)}
              {typeof status.nigehbanDisabled === 'boolean' ? ' · nigehban ' + (status.nigehbanDisabled ? 'off' : 'on') : ''}
            </div>
          )}
        </div>
      </DarkPanel>
    </div>
  );
}

// Private dashboard sub-components ─────────────────────────────────────────

function _DashSection({ label, children }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: `1px solid ${COL.air}` }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: COL.dim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function _Toggle({ k, v: initial, onChange }) {
  const [v, setV] = React.useState(initial);
  React.useEffect(() => setV(initial), [initial]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
      <span style={{ flex: 1, color: COL.textMid }}>{k}</span>
      <button
        onClick={() => { const nv = !v; setV(nv); onChange && onChange(nv); }}
        style={{
          width: 30, height: 16, border: `1px solid ${COL.divider}`,
          cursor: 'pointer', padding: 0,
          background: v ? COL.faint : COL.ink, position: 'relative',
        }}>
        <span style={{
          position: 'absolute', top: 2, left: v ? 16 : 2,
          width: 12, height: 12,
          background: v ? COL.ember : COL.dimLo,
        }} />
      </button>
    </div>
  );
}

function _Range({ k, v: initial, min, max, step, onChange, onCommit, fmt }) {
  const [v, setV] = React.useState(initial);
  React.useEffect(() => setV(initial), [initial]);
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ flex: 1, color: COL.textMid }}>{k}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: COL.text2 }}>{fmt ? fmt(v) : v}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { const nv = +e.target.value; setV(nv); onChange && onChange(nv); }}
        onMouseUp={() => onCommit && onCommit(v)}
        onTouchEnd={() => onCommit && onCommit(v)}
        style={{ width: '100%', accentColor: COL.ember, background: 'transparent', height: 16 }} />
    </div>
  );
}

function _Segmented({ k, options, v, onChange }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <span style={{ flex: 1, color: COL.textMid }}>{k}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)} style={{
            flex: 1, padding: '6px 10px',
            border: `1px solid ${COL.air}`,
            cursor: 'pointer',
            fontFamily: MONO, fontSize: 11,
            background: o === v ? COL.ink : 'transparent',
            color: o === v ? COL.textHi : COL.dim,
            ...(o === v ? { borderTopColor: COL.ember } : {}),
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function _dashBtn(variant, extra) {
  const base = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 12px', cursor: 'pointer',
    fontFamily: SANS, fontSize: 12, marginTop: 6,
    background: COL.ember, color: COL.inkDeep,
    border: `1px solid ${COL.faint}`,
    ...(extra || {}),
  };
  if (variant === 'warn')   return { ...base, background: COL.inkDeep, color: COL.ember, border: `1px solid ${COL.faint}` };
  if (variant === 'danger') return { ...base, background: COL.danger, color: COL.inkDeep, border: `1px solid ${COL.faint}` };
  if (variant === 'ghost')  return { ...base, background: 'transparent', color: COL.textMid, border: '1px solid rgba(200,193,173,0.6)' };
  return base;
}

// ── Dev dashboard pixel gear trigger ─────────────────────────────────────
function DevDashboardTrigger({ onOpen }) {
  const [hover, setHover] = React.useState(false);
  React.useEffect(() => {
    const h = (e) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onOpen(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onOpen]);

  return (
    <button onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="dev tools · ⌘."
      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex' }}
    >
      {window.PIX ? (
        <window.PIX.PixelStage w={9} h={9} scale={3}
          deps={[hover]}
          draw={(pb) => {
            const C = window.PIX.C;
            window.PIX.panel(pb, 0, 0, 9, 9, { surface: 'dark', seed: 1 });
            const gc = hover ? C.ember : C.text2;
            pb.rect(3, 3, 3, 3, gc);
            pb.set(4, 1, gc); pb.set(4, 7, gc);
            pb.set(1, 4, gc); pb.set(7, 4, gc);
            pb.set(2, 2, gc); pb.set(6, 2, gc);
            pb.set(2, 6, gc); pb.set(6, 6, gc);
            pb.set(4, 4, C.inkLo);
          }}
        />
      ) : <span style={{ color: COL.dim, fontSize: 14 }}>⚙</span>}
    </button>
  );
}

// ── Page nav triggers (engine / lab) ─────────────────────────────────────
// Small pixel-art anchors that sit alongside DevDashboardTrigger in the
// TopColony header. Use real <a href> so middle-click / cmd-click open in
// a new tab — the lab page is the one you keep open in a second tab while
// the live world ticks here.
function NavLinkTrigger({ href, title, draw }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a href={href} title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'inline-flex', textDecoration: 'none', cursor: 'pointer' }}
    >
      {window.PIX ? (
        <window.PIX.PixelStage w={9} h={9} scale={3}
          deps={[hover]}
          draw={(pb) => draw(pb, window.PIX.C, hover)}
        />
      ) : <span style={{ color: COL.dim, fontSize: 12 }}>·</span>}
    </a>
  );
}

// Tiny open-book glyph for /engine — the field guide.
function EnginePageTrigger() {
  return (
    <NavLinkTrigger
      href="/engine"
      title="engine — field guide"
      draw={(pb, C, hover) => {
        window.PIX.panel(pb, 0, 0, 9, 9, { surface: 'dark', seed: 4 });
        const c = hover ? C.ember : C.text2;
        // Two open pages with a spine down the middle (col 4).
        // Top + bottom borders.
        for (let x = 1; x <= 7; x++) { pb.set(x, 2, c); pb.set(x, 6, c); }
        // Outer sides + spine.
        pb.set(1, 3, c); pb.set(1, 4, c); pb.set(1, 5, c);
        pb.set(7, 3, c); pb.set(7, 4, c); pb.set(7, 5, c);
        pb.set(4, 3, c); pb.set(4, 4, c); pb.set(4, 5, c);
        // Faint "text lines" on each page.
        const t = hover ? C.text2 : C.textFaint;
        pb.set(2, 4, t); pb.set(3, 4, t);
        pb.set(5, 4, t); pb.set(6, 4, t);
      }}
    />
  );
}

// Tiny beaker/flask glyph for /lab — the sandbox.
function LabPageTrigger() {
  return (
    <NavLinkTrigger
      href="/lab"
      title="lab — scenario sandbox"
      draw={(pb, C, hover) => {
        window.PIX.panel(pb, 0, 0, 9, 9, { surface: 'dark', seed: 5 });
        const c = hover ? C.ember : C.text2;
        // Mouth: 3 wide at top.
        pb.set(3, 1, c); pb.set(4, 1, c); pb.set(5, 1, c);
        // Neck.
        pb.set(3, 2, c); pb.set(5, 2, c);
        pb.set(3, 3, c); pb.set(5, 3, c);
        // Flask body widens then closes at the bottom.
        pb.set(2, 4, c); pb.set(6, 4, c);
        pb.set(2, 5, c); pb.set(6, 5, c);
        pb.set(2, 6, c); pb.set(6, 6, c);
        pb.set(2, 7, c); pb.set(3, 7, c); pb.set(4, 7, c); pb.set(5, 7, c); pb.set(6, 7, c);
        // Liquid sits in the bottom of the flask. Brighter when hovered.
        const liq = hover ? C.glow : C.emberLo;
        pb.set(3, 6, liq); pb.set(4, 6, liq); pb.set(5, 6, liq);
      }}
    />
  );
}

window.HallMushroom       = HallMushroom;
window.HallTrigger        = HallTrigger;
window.HallModal          = HallModal;
window.HallDetail         = HallDetail;
window.DevDashboard       = DevDashboard;
window.DevDashboardTrigger = DevDashboardTrigger;
window.NavLinkTrigger     = NavLinkTrigger;
window.EnginePageTrigger  = EnginePageTrigger;
window.LabPageTrigger     = LabPageTrigger;

})();
