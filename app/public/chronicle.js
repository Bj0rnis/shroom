// Almari Shroom — Chronicle (parchment).
// Ported from claude.ai design's locked-vision kit (ui.jsx). Aged paper
// background drawn in a canvas, IM Fell English italic body, IM Fell DW
// Pica SC for the signature, Nastaliq for Urdu interjections that come
// out of Nigehban's tools.

const _chPlex    = '"IBM Plex Sans", system-ui, sans-serif';
const _chSerif   = '"IM Fell English", serif';
const _chSerifSC = '"IM Fell DW Pica SC", serif';

// Aged-paper background. Drawn at component mount; pure canvas — no DOM
// blend modes. Foxing, grain, edge darkening, a single deep crease.
function ParchmentBg() {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const grd = ctx.createLinearGradient(0, 0, W * 0.6, H);
    grd.addColorStop(0,   '#d4c3a0');
    grd.addColorStop(0.5, '#cfbe98');
    grd.addColorStop(1,   '#bda782');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    function rng(seed) { let s = seed | 1; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1e6) / 1e6; }; }
    const r = rng(13);
    // Foxing spots.
    for (let i = 0; i < 60; i++) {
      const x = r() * W, y = r() * H, rad = 3 + r() * 16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(120, 90, 60, 0.12)');
      g.addColorStop(1, 'rgba(120, 90, 60, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    // Grain.
    for (let i = 0; i < 2400; i++) {
      const x = (r() * W) | 0, y = (r() * H) | 0;
      ctx.fillStyle = `rgba(120, 90, 60, ${0.04 + r() * 0.05})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Edge burn.
    const edgeY = ctx.createLinearGradient(0, 0, 0, H);
    edgeY.addColorStop(0,   'rgba(80, 50, 30, 0.18)');
    edgeY.addColorStop(0.1, 'rgba(80, 50, 30, 0)');
    edgeY.addColorStop(0.9, 'rgba(80, 50, 30, 0)');
    edgeY.addColorStop(1,   'rgba(80, 50, 30, 0.22)');
    ctx.fillStyle = edgeY; ctx.fillRect(0, 0, W, H);
    const edgeX = ctx.createLinearGradient(0, 0, W, 0);
    edgeX.addColorStop(0,    'rgba(80, 50, 30, 0.18)');
    edgeX.addColorStop(0.06, 'rgba(80, 50, 30, 0)');
    edgeX.addColorStop(0.94, 'rgba(80, 50, 30, 0)');
    edgeX.addColorStop(1,    'rgba(80, 50, 30, 0.18)');
    ctx.fillStyle = edgeX; ctx.fillRect(0, 0, W, H);
    // Crease.
    ctx.strokeStyle = 'rgba(100, 70, 40, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.36 + 6);
    for (let x = 0; x < W; x += 4) ctx.lineTo(x, H * 0.36 + Math.sin(x * 0.02 + 2) * 1.5);
    ctx.stroke();
  }, []);
  return <canvas ref={ref} width={520} height={680}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// Roman lowercase day numbers (1 → "i", 12 → "xii", etc). Goes funny past
// 50 entries but the user will never see that many — the worst case is
// fine. (Decorative; not parsed back.)
const _ROMAN = [
  '', 'i','ii','iii','iv','v','vi','vii','viii','ix','x',
  'xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx',
  'xxi','xxii','xxiii','xxiv','xxv','xxvi','xxvii','xxviii','xxix','xxx',
];
function roman(n) {
  if (n < _ROMAN.length) return _ROMAN[n];
  // crude beyond table — just decimal in a parchment frame.
  return String(n);
}

// Nastaliq glyphs (Arabic script range, including presentation forms) at
// the same fontSize as IM Fell English visually render bigger because
// Nastaliq has tall ascenders + deep descenders. Wrap them in a span
// scaled to 0.75em so they sit within the line rhythm of the body.
const URDU_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+/g;
function renderEntryText(text) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;
  let match;
  let key = 0;
  while ((match = URDU_RANGE.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(
      <span key={'u' + key++} style={{
        fontFamily: '"Noto Nastaliq Urdu", serif',
        fontSize: '0.75em',
        lineHeight: 1,
        verticalAlign: 'baseline',
      }}>{match[0]}</span>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

function Chronicle({ entries }) {
  const ink     = '#3a2a1c';
  const inkSoft = 'rgba(58, 42, 28, 0.7)';

  if (!entries) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 4 }}>
        <ParchmentBg />
        <div style={{ position: 'relative', padding: 36, fontFamily: _chSerif, fontStyle: 'italic', fontSize: 16, color: ink }}>
          loading…
        </div>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 4 }}>
        <ParchmentBg />
        <div style={{ position: 'relative', padding: 36, fontFamily: _chSerif, fontStyle: 'italic', fontSize: 18, color: ink }}>
          khaamoshi <span style={{ fontFamily: '"Noto Nastaliq Urdu", serif', fontSize: 22 }}>خاموشی</span> — he has not yet written.
        </div>
      </div>
    );
  }
  // Newest first.
  const ordered = entries.slice().reverse();
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 4 }}>
      <ParchmentBg />
      <div style={{
        position: 'relative', padding: '32px 36px', height: '100%', overflowY: 'auto',
        fontFamily: _chSerif, color: ink,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontFamily: _chSerifSC, fontSize: 24, margin: 0, color: ink, letterSpacing: '0.04em', fontWeight: 'normal' }}>
            Chronicle
          </h2>
          <span style={{ fontFamily: _chSerif, fontSize: 12, fontStyle: 'italic', color: inkSoft }}>
            kept by Nigehbān
          </span>
        </div>
        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(58,42,28,0.4), transparent)', margin: '10px 0 18px' }} />

        {ordered.map((e, i) => (
          <div key={i} style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: _chSerifSC, fontSize: 11, color: inkSoft, letterSpacing: '0.16em', marginBottom: 4 }}>
              day {roman(e.day)}{e.reason && e.reason !== 'periodic' ? ` · ${e.reason}` : ''}
            </div>
            <div style={{ fontFamily: _chSerif, fontStyle: 'italic', fontSize: 16, lineHeight: 1.55, color: ink, textWrap: 'pretty' }}>
              {renderEntryText(e.text)}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 18, textAlign: 'right' }}>
          <span style={{ fontFamily: _chSerifSC, fontSize: 14, color: ink, letterSpacing: '0.08em' }}>— Nigehbān</span>
        </div>
      </div>
    </div>
  );
}

window.Chronicle = Chronicle;
