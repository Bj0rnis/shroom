// Shroom — kit · primitives
// DarkPanel, Section, KV, Subhead, Aside, Stat.
// Depends on: tokens, motifs, atmosphere (window.SHROOM_TOKENS, window.PIX,
//             window.SectionGlyph).

(function () {

const { MONO, SERIF, SERIF_RUN, COL } = window.SHROOM_TOKENS;
// SectionGlyph is available from motifs.jsx (loads before primitives).
const SectionGlyph = window.SectionGlyph;

// ── DarkPanel ─────────────────────────────────────────────────────────────
// Pixel-art dark surface that fills its container. Children must have
// position: relative (or any non-static) to appear above the canvas layer.
function DarkPanel({ children, style, seed = 3, onClick }) {
  const { useRef, useState, useLayoutEffect } = React;
  const wrapRef = useRef(null);
  const [dim, setDim] = useState({ w: 80, h: 40 });

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const SCALE = 3;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDim({
        w: Math.max(20, Math.floor(width / SCALE)),
        h: Math.max(10, Math.floor(height / SCALE)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PIX = window.PIX;
  return (
    <div style={{ position: 'relative', ...style }} onClick={onClick}>
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {PIX && (
          <PIX.PixelStage
            w={dim.w} h={dim.h} scale={1}
            deps={[dim.w, dim.h]}
            draw={(pb) => PIX.panel(pb, 0, 0, dim.w, dim.h, { surface: 'dark', seed })}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        )}
      </div>
      {children}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────
// Full engine-page section: DarkPanel + accent stripe + glyph + title/sub.
function Section({ seed, num, kicker, title, sub, accent, glyph, children }) {
  return (
    <DarkPanel seed={seed} style={{ color: COL.text, marginBottom: 14 }}>
      <div style={{ position: 'relative', zIndex: 1, padding: '20px 24px 24px' }}>
        {/* left accent stripe */}
        <div style={{
          position: 'absolute', left: 0, top: 14, bottom: 14, width: 2,
          background: accent, opacity: 0.85,
        }} />
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <SectionGlyph kind={glyph} color={accent} />
          <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            <span style={{ color: accent, marginRight: 8 }}>{num}</span>{kicker}
          </span>
        </div>
        <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 26, lineHeight: 1.05, marginBottom: 10 }}>
          {title}
        </div>
        {sub && (
          <div style={{ fontFamily: SERIF_RUN, color: COL.text2, fontSize: 14, lineHeight: 1.45, maxWidth: 740, marginBottom: 16, fontStyle: 'italic' }}>
            {sub}
          </div>
        )}
        {children}
      </div>
    </DarkPanel>
  );
}

// ── KV ────────────────────────────────────────────────────────────────────
// Key / value grid with an accented value column.
function KV({ rows, accent }) {
  const ac = accent || COL.hyphaHi;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'max-content max-content 1fr',
      columnGap: 14, rowGap: 6,
      fontFamily: MONO, fontSize: 11, color: COL.text,
    }}>
      {rows.map(([k, v, note], i) => (
        <React.Fragment key={i}>
          <div style={{ color: COL.dim }}>{k}</div>
          <div style={{ color: ac, fontWeight: 500 }}>{v}</div>
          <div style={{ color: COL.text2 }}>{note || ''}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Subhead ───────────────────────────────────────────────────────────────
function Subhead({ accent, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 8, marginTop: 4,
    }}>
      <div style={{ width: 8, height: 8, background: accent }} />
      <div style={{ fontFamily: SERIF, fontSize: 16, color: COL.textHi }}>{children}</div>
    </div>
  );
}

// ── Aside ─────────────────────────────────────────────────────────────────
// Pull-quote / "why" note block.
function Aside({ children, accent }) {
  return (
    <div style={{
      borderLeft: `2px solid ${accent || COL.emberLo}`,
      padding: '6px 14px',
      marginTop: 14,
      fontFamily: SERIF_RUN, fontStyle: 'italic',
      color: COL.text2, fontSize: 13, lineHeight: 1.5, maxWidth: 720,
    }}>
      {children}
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────
// Inline label + value chip used in status strips.
function Stat({ label, v, warn }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ color: '#5a5240', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: warn ? '#c89058' : '#c8c1ad', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v}</span>
    </span>
  );
}

window.DarkPanel = DarkPanel;
window.Section   = Section;
window.KV        = KV;
window.Subhead   = Subhead;
window.Aside     = Aside;
window.Stat      = Stat;

})();
