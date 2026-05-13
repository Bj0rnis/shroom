// Almari Shroom — Hall of fame.
// Ported memorial style from claude.ai design's locked-vision kit:
// desaturated mushroom sprites with a faint silver halo, IM Fell italic
// nameplates, quiet warm-ink panel. Pixel-art rendered into a 22×26
// source buffer and 3× upscaled, so it lives in the same visual family
// as the main canvas.

const _hPlex    = '"IBM Plex Sans", system-ui, sans-serif';
const _hMono    = '"IBM Plex Mono", monospace';
const _hSerif   = '"IM Fell English", serif';
const _hSerifSC = '"IM Fell DW Pica SC", serif';

// hsl() returns [r,g,b]. Borrowed from atoms because hall.js may load
// before canvas-atoms.js in flight; safe duplicate.
function _hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// Memorial mushroom — drawn at source resolution (22×26) then nearest-
// neighbour upscaled. Hue desaturated; outline darker than the world
// version. Faint silver halo behind so it reads as memorial.
function HallMushroom({ entry, size = 84 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    // Halo behind.
    const grd = ctx.createRadialGradient(c.width / 2, c.height * 0.45, 4,
                                          c.width / 2, c.height * 0.45, c.height * 0.55);
    grd.addColorStop(0, 'rgba(220, 220, 220, 0.18)');
    grd.addColorStop(1, 'rgba(220, 220, 220, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, c.width, c.height);

    // Source-res draw.
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

    // Faint ground line.
    octx.fillStyle = 'rgba(40, 32, 22, 0.5)';
    octx.fillRect(0, sh - 2, sw, 2);

    // Stem — pale, slight shadow on right.
    octx.fillStyle = `rgb(${_hsl(38, 14, 72).join(',')})`;
    octx.fillRect(sw / 2 - 1, stemTop, 2, stemH);
    octx.fillStyle = `rgb(${_hsl(36, 18, 56).join(',')})`;
    octx.fillRect(sw / 2 + 1, stemTop, 1, stemH);

    // Cap — desaturated by 24pt vs world cap saturation.
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

function HallStrip({ entries, onSelect }) {
  if (!entries || entries.length === 0) {
    return (
      <div style={{ background: '#0e0d0a', padding: '16px 20px', borderRadius: 4, border: '1px solid #1f1c17' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <span style={{ fontFamily: _hSerifSC, fontSize: 14, color: '#d4cdb8', letterSpacing: '0.06em' }}>
            Hall of fame
          </span>
          <span style={{ fontFamily: _hMono, fontSize: 9, color: '#5a5240', letterSpacing: '0.12em' }}>
            · empty
          </span>
        </div>
        <div style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 13, color: '#7a7060' }}>
          no colony has yet been inscribed.
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: '#0e0d0a', padding: '16px 20px', borderRadius: 4, border: '1px solid #1f1c17' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: _hSerifSC, fontSize: 14, color: '#d4cdb8', letterSpacing: '0.06em' }}>
          Hall of fame
        </span>
        <span style={{ fontFamily: _hMono, fontSize: 9, color: '#5a5240', letterSpacing: '0.12em' }}>
          · {entries.length} inscribed
        </span>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #2a261f, transparent)' }} />
        <span style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 11, color: '#7a7060' }}>
          quiet · slower · sacred
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
        {entries.map((e, i) => (
          <button key={i}
            onClick={() => onSelect && onSelect(e)}
            title={`${e.name} · vol ${e.volume}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: 8, borderRadius: 2,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              minWidth: 96, cursor: 'pointer',
              transition: 'background 120ms, border-color 120ms',
            }}
            onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.05)'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
            onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
          >
            <HallMushroom entry={e} size={84} />
            <div style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 13, color: '#d4cdb8' }}>{e.name}</div>
            <div style={{ fontFamily: _hMono, fontSize: 9, color: '#5a5240', letterSpacing: '0.08em' }}>
              vol {e.volume}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function HallDetail({ entry, onClose }) {
  if (!entry) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0e0d0a', color: '#d4cdb8',
        maxWidth: 460, width: '90%', padding: 28,
        borderRadius: 4, border: '1px solid #1f1c17',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
          <HallMushroom entry={entry} size={120} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 24, color: '#e8dfc8' }}>{entry.name}</div>
            <div style={{ fontFamily: _hMono, fontSize: 10, color: '#7a7060', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 6 }}>
              volume {entry.volume} · {entry.phenotype}
            </div>
          </div>
        </div>
        {entry.reason && (
          <div style={{ fontFamily: _hMono, fontSize: 11, color: '#7a7060', letterSpacing: '0.05em' }}>
            cause: {entry.reason}
          </div>
        )}
        {entry.epitaph && (
          <div style={{ fontFamily: _hSerif, fontStyle: 'italic', fontSize: 15, lineHeight: 1.55, color: '#d4cdb8' }}>
            "{entry.epitaph}"
          </div>
        )}
      </div>
    </div>
  );
}

window.HallStrip = HallStrip;
window.HallDetail = HallDetail;
