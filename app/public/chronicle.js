// Almari Shroom — Chronicle (Nigehban's journal).
// Dark pixel-art panel matching the rest of the chrome. Ink-on-dark
// instead of ink-on-paper, with three small juicy touches:
//   1. A blinking pixel cursor at the end of the most-recent entry,
//      so it reads as "Nigehban is still writing."
//   2. A short ember-colored bar in the left gutter of the latest entry.
//   3. A small pixel-art eye sigil next to "kept by Nigehbān" — he watches.

const _chSerif   = '"IM Fell English", serif';
const _chSerifSC = '"IM Fell DW Pica SC", serif';

// Inks tuned for dark background.
const _CH_TITLE = '#e8dfc8';
const _CH_BODY  = '#c8c1ad';
const _CH_FAINT = '#7a7060';
const _CH_DIM   = '#3a342a';
const _CH_EMBER = '#c89058';

// Roman lowercase day numbers (1 → "i", 12 → "xii", etc). Day 0 shows
// as "0" so dawn entries on a fresh world don't render as bare "day".
const _ROMAN = [
  '0', 'i','ii','iii','iv','v','vi','vii','viii','ix','x',
  'xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx',
  'xxi','xxii','xxiii','xxiv','xxv','xxvi','xxvii','xxviii','xxix','xxx',
];
function roman(n) {
  if (n < _ROMAN.length) return _ROMAN[n];
  return String(n);
}

// Sim-clock constants for hour-of-day labels. Mirror lib/time.js.
const _CHRON_TICK_MS       = 3000;
const _CHRON_TICKS_PER_HR  = (60 * 60 * 1000) / _CHRON_TICK_MS;
const _CHRON_TICKS_PER_DAY = 24 * _CHRON_TICKS_PER_HR;
function hourOfSimDay(tick) {
  if (typeof tick !== 'number') return null;
  return Math.floor((tick % _CHRON_TICKS_PER_DAY) / _CHRON_TICKS_PER_HR);
}

// Nastaliq glyphs render bigger at the same fontSize because of tall
// ascenders + deep descenders. Wrap Urdu spans at 0.75em so they sit on
// the line rhythm of the body.
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

// 7×5 pixel eye sigil — Nigehban watches. Drawn once at module load
// (deps stable), so it doesn't repaint when entries change.
function NigehbanEye() {
  const PIX = window.PIX;
  if (!PIX) return null;
  return (
    <PIX.PixelStage w={7} h={5} scale={2}
      deps={[]}
      draw={(pb) => {
        const ink = _CH_FAINT;
        const pup = _CH_EMBER;
        // Outline (almond shape)
        pb.rect(1, 0, 5, 1, ink);
        pb.rect(0, 1, 7, 1, ink);
        pb.rect(0, 2, 7, 1, ink);
        pb.rect(0, 3, 7, 1, ink);
        pb.rect(1, 4, 5, 1, ink);
        // Interior whites (knock out)
        pb.rect(1, 1, 5, 3, '#15110a');
        // Pupil
        pb.rect(3, 1, 1, 3, pup);
      }}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6, imageRendering: 'pixelated' }}
    />
  );
}

// Blinking pixel cursor at the end of the latest entry. CSS keyframes
// instead of React state so we don't trigger re-renders every 500ms.
function ChronicleCursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: '0.5em', height: '1em',
      marginLeft: 2, verticalAlign: '-0.15em',
      background: _CH_EMBER,
      animation: 'chronicle-blink 1.05s steps(2, end) infinite',
    }} />
  );
}

// One-time style injection for the cursor blink + scrollbar tone.
if (typeof document !== 'undefined' && !document.getElementById('chronicle-style')) {
  const s = document.createElement('style');
  s.id = 'chronicle-style';
  s.textContent = `
    @keyframes chronicle-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }
    .chronicle-body::-webkit-scrollbar { width: 6px }
    .chronicle-body::-webkit-scrollbar-thumb { background: ${_CH_DIM}; border-radius: 3px }
    .chronicle-body::-webkit-scrollbar-track { background: transparent }
  `;
  document.head.appendChild(s);
}

function Chronicle({ entries }) {
  if (!entries) {
    return (
      <DarkPanel seed={11} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ position: 'relative', padding: 24, fontFamily: _chSerif, fontStyle: 'italic', fontSize: 14, color: _CH_FAINT }}>
          loading…
        </div>
      </DarkPanel>
    );
  }
  if (entries.length === 0) {
    return (
      <DarkPanel seed={11} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ position: 'relative', padding: 24, fontFamily: _chSerif, fontStyle: 'italic', fontSize: 15, color: _CH_BODY }}>
          khaamoshi <span style={{ fontFamily: '"Noto Nastaliq Urdu", serif', fontSize: 18 }}>خاموشی</span> — he has not yet written.
          <ChronicleCursor />
        </div>
      </DarkPanel>
    );
  }
  // Newest first.
  const ordered = entries.slice().reverse();
  return (
    <DarkPanel seed={11} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div className="chronicle-body" style={{
        position: 'relative', padding: '16px 18px 14px', height: '100%', overflowY: 'auto',
        fontFamily: _chSerif, color: _CH_BODY,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontFamily: _chSerifSC, fontSize: 18, margin: 0, color: _CH_TITLE, letterSpacing: '0.04em', fontWeight: 'normal' }}>
            Chronicle
          </h2>
          <span style={{ fontFamily: _chSerif, fontSize: 11, fontStyle: 'italic', color: _CH_FAINT, display: 'inline-flex', alignItems: 'center' }}>
            <NigehbanEye />
            kept by Nigehbān
          </span>
        </div>
        <div style={{
          height: 1, margin: '8px 0 14px',
          background: `linear-gradient(to right, transparent, ${_CH_DIM} 20%, ${_CH_DIM} 80%, transparent)`,
        }} />

        {ordered.map((e, i) => {
          const isLatest = i === 0;
          return (
            <div key={i} style={{ marginBottom: 16, position: 'relative', paddingLeft: isLatest ? 10 : 0 }}>
              {isLatest && (
                <span style={{
                  position: 'absolute', left: 0, top: 4, bottom: 4,
                  width: 2, background: _CH_EMBER, opacity: 0.55,
                }} />
              )}
              <div style={{ fontFamily: _chSerifSC, fontSize: 10, color: isLatest ? _CH_EMBER : _CH_FAINT, letterSpacing: '0.16em', marginBottom: 3 }}>
                day {roman(e.day)}
                {(() => { const h = hourOfSimDay(e.tick); return h != null ? ` · ${h}h` : ''; })()}
                {e.reason && e.reason !== 'periodic' ? ` · ${e.reason}` : ''}
              </div>
              <div style={{ fontFamily: _chSerif, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: isLatest ? _CH_TITLE : _CH_BODY, textWrap: 'pretty' }}>
                {renderEntryText(e.text)}
                {isLatest && <ChronicleCursor />}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <span style={{ fontFamily: _chSerifSC, fontSize: 11, color: _CH_FAINT, letterSpacing: '0.08em' }}>— Nigehbān</span>
        </div>
      </div>
    </DarkPanel>
  );
}

window.Chronicle = Chronicle;
