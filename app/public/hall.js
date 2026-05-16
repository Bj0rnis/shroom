// Shroom — Hall of Fame (icon trigger + modal).
// Replaces the inline strip/column with a small dark pixel button that
// opens a modal listing every inscribed colony. The memorial mushroom
// rendering stays — it's the soul of the hall. The surrounding chrome
// is now dark pixel-art, matching Chronicle and the rest of the page.

const _hSerif   = '"IM Fell English", serif';
const _hSerifSC = '"IM Fell DW Pica SC", serif';
const _hMono    = '"IBM Plex Mono", monospace';

const _H_TITLE = '#e8dfc8';
const _H_BODY  = '#c8c1ad';
const _H_FAINT = '#7a7060';
const _H_DIM   = '#3a342a';
const _H_EMBER = '#c89058';

// hsl → [r,g,b]. Borrowed from canvas-atoms; safe duplicate so hall.js
// can paint mushrooms even if it loads earlier.
function _hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// Pixel memorial mark — 7×8, used as the trigger icon. A small
// mushroom on a ground line, with a faint halo.
function HallMark() {
  const PIX = window.PIX;
  if (!PIX) return null;
  return (
    <PIX.PixelStage w={7} h={8} scale={2}
      deps={[]}
      draw={(pb) => {
        // Halo
        pb.rect(0, 1, 7, 4, '#1a160f');
        // Cap
        pb.rect(1, 1, 5, 1, _H_FAINT);
        pb.rect(0, 2, 7, 2, _H_FAINT);
        // Stem
        pb.rect(3, 4, 1, 2, _H_BODY);
        // Ground
        pb.rect(0, 7, 7, 1, _H_DIM);
      }}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6, imageRendering: 'pixelated' }}
    />
  );
}

// Memorial mushroom — drawn at source resolution (22×26) then nearest-
// neighbour upscaled. Used inside the modal entries and the detail view.
function HallMushroom({ entry, size = 84 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    const grd = ctx.createRadialGradient(c.width / 2, c.height * 0.45, 4,
                                          c.width / 2, c.height * 0.45, c.height * 0.55);
    grd.addColorStop(0, 'rgba(232, 220, 180, 0.22)');
    grd.addColorStop(1, 'rgba(232, 220, 180, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, c.width, c.height);

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
    ctx.drawImage(off, (c.width - sw * 3) / 2, 6, sw * 3, sh * 3);
  }, [entry, size]);
  return <canvas ref={ref} width={size} height={Math.round(size * 1.2)}
    style={{ display: 'block', imageRendering: 'pixelated' }} />;
}

// Slim dark trigger button — sits where the old HallColumn lived. Shows
// the count and the small pixel mark; click opens the modal.
function HallTrigger({ entries, onOpen }) {
  const count = entries ? entries.length : 0;
  return (
    <DarkPanel seed={13} style={{ color: _H_BODY, flexShrink: 0 }}>
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
        <span style={{ fontFamily: _hSerifSC, fontSize: 13, color: _H_TITLE, letterSpacing: '0.06em' }}>
          Hall of fame
        </span>
        <span style={{ fontFamily: _hMono, fontSize: 9, color: _H_FAINT, letterSpacing: '0.12em' }}>
          · {count} inscribed
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: _hMono, fontSize: 10, color: _H_FAINT }}>open →</span>
      </button>
    </DarkPanel>
  );
}

// Modal listing all inscribed colonies. Clicking an entry surfaces the
// existing HallDetail (handled by the parent).
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
        <DarkPanel seed={15} style={{ width: '100%', height: '100%', overflow: 'hidden', color: _H_BODY }}>
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '14px 20px', display: 'flex', alignItems: 'baseline', gap: 12,
              borderBottom: `1px solid ${_H_DIM}`,
            }}>
              <HallMark />
              <span style={{ fontFamily: _hSerifSC, fontSize: 18, color: _H_TITLE, letterSpacing: '0.04em' }}>
                Hall of fame
              </span>
              <span style={{ fontFamily: _hMono, fontSize: 10, color: _H_FAINT, letterSpacing: '0.12em' }}>
                · {list.length} inscribed
              </span>
              <span style={{ flex: 1 }} />
              <button onClick={onClose} style={{
                background: 'transparent', border: 0, color: _H_FAINT, cursor: 'pointer',
                fontFamily: _hMono, fontSize: 11, letterSpacing: '0.08em', padding: '4px 8px',
              }}>close ✕</button>
            </div>
            {list.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: _hSerif, fontStyle: 'italic', fontSize: 15, color: _H_FAINT }}>
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
                      border: `1px solid ${_H_DIM}`,
                      cursor: 'pointer',
                      transition: 'background 120ms, border-color 120ms',
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(232, 223, 200, 0.08)'; ev.currentTarget.style.borderColor = _H_FAINT; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(232, 223, 200, 0.04)'; ev.currentTarget.style.borderColor = _H_DIM; }}
                  >
                    <HallMushroom entry={e} size={72} />
                    <div style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 13, color: _H_TITLE, textAlign: 'center' }}>{e.name}</div>
                    <div style={{ fontFamily: _hMono, fontSize: 9, color: _H_FAINT, letterSpacing: '0.08em' }}>
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
        <DarkPanel seed={17} style={{ width: '100%', overflow: 'hidden', color: _H_BODY }}>
          <div style={{ position: 'relative', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
              <HallMushroom entry={entry} size={120} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 22, color: _H_TITLE }}>{entry.name}</div>
                <div style={{ fontFamily: _hMono, fontSize: 10, color: _H_FAINT, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
                  volume {entry.volume}{entry.phenotype ? ` · ${entry.phenotype}` : ''}
                </div>
              </div>
            </div>
            {entry.reason && (
              <div style={{ fontFamily: _hMono, fontSize: 11, color: _H_FAINT, letterSpacing: '0.05em' }}>
                cause: {entry.reason}
              </div>
            )}
            {entry.epitaph && (
              <div style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 14, lineHeight: 1.55, color: _H_TITLE }}>
                "{entry.epitaph}"
              </div>
            )}
          </div>
        </DarkPanel>
      </div>
    </div>
  );
}

window.HallTrigger = HallTrigger;
window.HallModal   = HallModal;
window.HallDetail  = HallDetail;
