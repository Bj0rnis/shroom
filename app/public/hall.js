// Almari Shroom — hall of fame thumbnail strip.
// Each entry is a tiny mushroom sprite drawn from the saved phenotype genes.

const HALL_THUMB_W = 64;
const HALL_THUMB_H = 80;

function HallThumbnail({ entry, onClick, theme: t }) {
  const ref = React.useRef();
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    drawHallMushroom(ctx, entry, HALL_THUMB_W, HALL_THUMB_H);
  }, [entry]);
  return (
    <button
      onClick={onClick}
      title={`${entry.name} · vol ${entry.volume}`}
      style={{
        background: 'transparent', border: '1px solid transparent',
        padding: 6, borderRadius: 6, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
    >
      <canvas ref={ref} width={HALL_THUMB_W} height={HALL_THUMB_H} style={{ display: 'block', imageRendering: 'pixelated' }} />
      <div style={{ fontFamily: t.type.mono, fontSize: 10, color: 'inherit', letterSpacing: '0.05em' }}>{entry.name}</div>
    </button>
  );
}

function drawHallMushroom(ctx, e, w, h) {
  ctx.clearRect(0, 0, w, h);
  // very faint backdrop ground line
  ctx.fillStyle = 'rgba(40, 35, 28, 0.4)';
  ctx.fillRect(0, h - 6, w, 6);

  const cx = w / 2;
  const baseY = h - 8;
  const matureT = 1;
  const stem = (e.stem_length || 1) * 22;
  const capR = (e.cap_size  || 1)   * 14;
  const capY = baseY - stem;
  const hue  = ((e.cap_hue || 30) % 360 + 360) % 360;

  // stem
  ctx.fillStyle = '#ddd0b3';
  ctx.fillRect(cx - 2, capY, 4, stem);

  // cap
  ctx.fillStyle = `hsl(${hue} 60% 55%)`;
  ctx.strokeStyle = `hsl(${hue} 35% 35%)`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  switch (e.cap_shape) {
    case 1: // conical
      ctx.moveTo(cx - capR, capY);
      ctx.lineTo(cx, capY - capR * 1.6);
      ctx.lineTo(cx + capR, capY);
      ctx.closePath();
      break;
    case 2: // flat
      ctx.ellipse(cx, capY - 1, capR * 1.15, capR * 0.45, 0, 0, Math.PI * 2);
      break;
    case 3: // frilly
      ctx.moveTo(cx - capR, capY);
      for (let i = -capR; i <= capR; i += capR / 3) {
        ctx.lineTo(cx + i, capY - capR * (0.7 + Math.sin(i * 1.3) * 0.2));
      }
      ctx.lineTo(cx + capR, capY);
      ctx.closePath();
      break;
    case 0:
    default:
      ctx.arc(cx, capY, capR, Math.PI, 0);
      ctx.lineTo(cx + capR, capY);
      ctx.lineTo(cx - capR, capY);
      ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

function HallStrip({ theme: t, entries, onSelect }) {
  if (!entries || entries.length === 0) {
    return (
      <Card theme={t} style={{ padding: 12 }}>
        <div style={{ fontSize: 10, color: t.muted, fontFamily: t.type.mono, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          hall of fame · empty
        </div>
        <div style={{ marginTop: 6, fontFamily: t.type.serif, fontSize: 12, color: t.muted }}>
          no colony has yet been inscribed.
        </div>
      </Card>
    );
  }
  return (
    <Card theme={t} style={{ padding: 12 }}>
      <div style={{ fontSize: 10, color: t.muted, fontFamily: t.type.mono, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
        hall of fame · {entries.length}
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: 4, paddingBottom: 4, color: t.fg }}>
        {entries.map((e, i) => (
          <HallThumbnail key={i} entry={e} theme={t} onClick={() => onSelect && onSelect(e)} />
        ))}
      </div>
    </Card>
  );
}

function HallDetail({ theme: t, entry, onClose }) {
  if (!entry) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.cardElev || t.card, color: t.fg,
          maxWidth: 460, width: '90%', padding: 24,
          borderRadius: 12, border: `1px solid ${t.border}`,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <DetailMushroom entry={entry} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: t.type.serif, fontSize: 22, color: t.fg }}>{entry.name}</div>
            <div style={{ fontFamily: t.type.mono, fontSize: 10, color: t.muted, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              volume {entry.volume} · {entry.phenotype}
            </div>
          </div>
        </div>
        {entry.reason && (
          <div style={{ fontFamily: t.type.mono, fontSize: 11, color: t.muted, letterSpacing: '0.05em' }}>
            cause: {entry.reason}
          </div>
        )}
        {entry.epitaph && (
          <div style={{ fontFamily: t.type.serif, fontSize: 15, lineHeight: 1.55, color: t.fg, fontStyle: 'italic' }}>
            "{entry.epitaph}"
          </div>
        )}
      </div>
    </div>
  );
}

function DetailMushroom({ entry }) {
  const ref = React.useRef();
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    drawHallMushroom(c.getContext('2d'), entry, 100, 130);
  }, [entry]);
  return <canvas ref={ref} width={100} height={130} style={{ imageRendering: 'pixelated' }} />;
}

window.HallStrip = HallStrip;
window.HallDetail = HallDetail;
