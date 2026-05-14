const { useEffect, useState } = React;

function TopColony({ snapshot, onOpenDev }) {
  const TICKS_PER_DAY = 28800;
  const coloniesByKey = snapshot.colonies || {};
  const top = Object.entries(coloniesByKey)
    .map(([key, c]) => ({ key, ...c }))
    .filter(c => c.alive)
    .sort((a, b) => (b.cellCount || 0) - (a.cellCount || 0))
    .slice(0, 3);

  const mono = '"IBM Plex Mono", monospace';
  const serif = '"IM Fell DW Pica SC", serif';

  return (
    <DarkPanel seed={9} style={{ color: '#d4cdb8', flexShrink: 0 }}>
      <div style={{ position: 'relative', padding: '10px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: mono, color: '#7a7060', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            top colony
          </span>
          <DevDashboardTrigger onOpen={onOpenDev} />
        </div>
        {top.length === 0 ? (
          <div style={{ fontFamily: mono, color: '#5a5240', fontSize: 10, fontStyle: 'italic' }}>none</div>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top.map((c, i) => {
              const displayName = c.name || `colony ${c.key}`;
              const ageDays = Math.floor((c.age || 0) / TICKS_PER_DAY);
              return (
                <li key={c.key || i} style={{
                  display: 'grid',
                  gridTemplateColumns: '14px 1fr auto',
                  alignItems: 'baseline',
                  gap: 10,
                  fontFamily: mono, fontSize: 10,
                }}>
                  <span style={{ color: '#5a5240' }}>{i + 1}.</span>
                  <span style={{ fontFamily: serif, fontSize: 13, color: c.name ? '#e8dfc8' : '#7a7060', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  <span style={{ color: '#d4cdb8' }}>
                    <span style={{ color: '#5a5240', marginRight: 4 }}>
                      {ageDays > 0 ? `${ageDays}d ·` : ''}hyphae
                    </span>
                    {c.cellCount || 0}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </DarkPanel>
  );
}

function App() {
  const [world,    setWorld]    = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [journal,  setJournal]  = useState(null);
  const [hall,     setHall]     = useState(null);
  const [hallSel,  setHallSel]  = useState(null);
  const [err,      setErr]      = useState(null);

  async function refreshFast() {
    try {
      const r = await fetch('/api/world/snapshot');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSnapshot(await r.json());
      setErr(null);
    } catch (e) { setErr(e.message); }
  }
  async function refreshSlow() {
    try {
      const [wr, jr, hr] = await Promise.all([
        fetch('/api/world').then(r => r.json()),
        fetch('/api/journal').then(r => r.json()),
        fetch('/api/hall').then(r => r.json()),
      ]);
      setWorld(wr); setJournal(jr); setHall(hr); setErr(null);
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => {
    refreshFast(); refreshSlow();
    const fast = setInterval(refreshFast, 1000);
    const slow = setInterval(refreshSlow, 3000);
    return () => { clearInterval(fast); clearInterval(slow); };
  }, []);

  async function refreshAfterDev() {
    await Promise.all([refreshFast(), refreshSlow()]);
  }

  const [devOpen, setDevOpen] = useState(false);
  const [hallOpen, setHallOpen] = useState(false);

  if (!world || !snapshot) {
    return (
      <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageWallpaper />
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: '#7a7060' }}>
          {err ? `error: ${err}` : 'awakening…'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', padding: 16 }}>
      <PageWallpaper />

      {/* Two-column rectangle. Each column owns its own hero/footer slice so
          the whole page reads as one rectangle split vertically. */}
      <div style={{
        height: 'calc(100dvh - 32px)',
        maxWidth: 1500, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 12,
        minHeight: 0,
      }}>
        {/* ── LEFT — Hero / Canvas / StatusLeft ───────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <ShroomsHeader />
          <DarkPanel seed={4} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="shroom-canvas-wrap" style={{ position: 'relative' }}>
              <ShroomCanvas snapshot={snapshot} />
            </div>
          </DarkPanel>
          <StatusLeft snapshot={snapshot} />
        </div>

        {/* ── RIGHT — Chronicle / Top 3 / Hall trigger / StatusRight */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 80 }}>
            <Chronicle entries={journal?.entries} />
          </div>
          <TopColony snapshot={snapshot} onOpenDev={() => setDevOpen(true)} />
          <HallTrigger entries={hall?.entries} onOpen={() => setHallOpen(true)} />
          <StatusRight snapshot={snapshot} />
        </div>
      </div>

      <HallModal
        open={hallOpen}
        entries={hall?.entries}
        onClose={() => setHallOpen(false)}
        onSelect={(e) => setHallSel(e)}
      />
      <HallDetail entry={hallSel} onClose={() => setHallSel(null)} />
      <DevDashboard open={devOpen} onClose={() => setDevOpen(false)} onAction={refreshAfterDev} />
    </div>
  );
}

function PageWallpaper() {
  const wrapRef = React.useRef(null);
  const [dim, setDim] = React.useState({ w: 200, h: 150 });
  React.useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const SCALE = 3;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDim({
        w: Math.max(60, Math.floor(width / SCALE)),
        h: Math.max(60, Math.floor(height / SCALE)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PIX = window.PIX;
  return (
    <div ref={wrapRef} style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden' }}>
      {PIX && (
        <PIX.PixelStage w={dim.w} h={dim.h} scale={1} deps={[dim.w, dim.h]}
          draw={(pb) => PIX.paintDark(pb, 0, 0, dim.w, dim.h, { seed: 5 })}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
