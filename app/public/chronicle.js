// home-server Shroom — Nigehban's chronicle column.
// Scrolling vertical list of his journal entries, newest at top.

function Chronicle({ theme: t, entries }) {
  if (!entries) {
    return (
      <Card theme={t} style={{ padding: 16 }}>
        <div style={{ color: t.muted, fontFamily: t.type.mono, fontSize: 12 }}>loading…</div>
      </Card>
    );
  }
  if (entries.length === 0) {
    return (
      <Card theme={t} style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: t.muted, fontFamily: t.type.mono, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>chronicle</div>
        <div style={{ color: t.muted, fontFamily: t.type.serif, fontSize: 14 }}>khaamoshi — he has not yet written.</div>
      </Card>
    );
  }
  // Newest first
  const ordered = entries.slice().reverse();

  // Group by volume → day for header chips
  let lastVol = null;
  return (
    <Card theme={t} style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '14px 16px 8px', fontSize: 11, color: t.muted, fontFamily: t.type.mono, letterSpacing: '0.16em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}` }}>
        chronicle <span style={{ color: t.muted, opacity: 0.6 }}>· {entries.length} entries</span>
      </div>
      <div style={{ overflowY: 'auto', padding: '8px 16px 16px', flex: 1, minHeight: 0 }}>
        {ordered.map((e, i) => {
          const showVolHeader = e.volume !== lastVol;
          lastVol = e.volume;
          return (
            <div key={i} style={{ marginTop: i === 0 ? 4 : 14 }}>
              {showVolHeader && (
                <div style={{ fontFamily: t.type.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.muted, marginBottom: 8, marginTop: i === 0 ? 0 : 6 }}>
                  · volume {e.volume} ·
                </div>
              )}
              <div style={{ fontFamily: t.type.mono, fontSize: 10, color: t.muted, marginBottom: 4 }}>
                day {e.day} {e.reason && e.reason !== 'periodic' ? `· ${e.reason}` : ''}
              </div>
              <div style={{ fontFamily: t.type.serif, fontSize: 14, lineHeight: 1.55, color: t.fg }}>
                {e.text}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

window.Chronicle = Chronicle;
