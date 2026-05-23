const { useEffect, useState } = React;

function TopColony({ snapshot, onHoverColony, hoveredColonyId }) {
  // Read the sim-time anchor from the snapshot — see kanban #06.
  const TICKS_PER_DAY = snapshot.meta?.ticksPerDay || 28800;
  const coloniesByKey = snapshot.colonies || {};
  const top = Object.entries(coloniesByKey)
    .map(([key, c]) => ({ key, ...c }))
    .filter(c => c.alive)
    .sort((a, b) => (b.cellCount || 0) - (a.cellCount || 0))
    .slice(0, 3);

  const mono = '"IBM Plex Mono", monospace';
  const serif = '"IM Fell DW Pica SC", serif';

  return (
    <DarkPanel seed={9} elevation={2} style={{ color: COL.text, flexShrink: 0 }}>
      <div style={{ position: 'relative', padding: '10px 14px 12px' }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: mono, color: COL.dim, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            top colony
          </span>
        </div>
        {top.length === 0 ? (
          <div style={{ fontFamily: mono, color: COL.dimLo, fontSize: 10, fontStyle: 'italic' }}>none</div>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top.map((c, i) => {
              const displayName = c.name || c.placeholderName || `colony ${c.key}`;
              const ageDays = Math.floor((c.age || 0) / TICKS_PER_DAY);
              const ageLabel = ageDays >= 1 ? `${ageDays}d` : 'today';
              // HallMushroom expects snake_case keys; the snapshot ships
              // camelCase. Adapt inline rather than touching the kit.
              const entry = {
                cap_hue:     c.capHue,
                cap_shape:   c.capShape,
                cap_size:    c.capSize,
                stem_length: c.stemLength,
              };
              const isHovered = hoveredColonyId === c.key;
              return (
                <li key={c.key || i}
                  onMouseEnter={() => onHoverColony && onHoverColony(c.key)}
                  onMouseLeave={() => onHoverColony && onHoverColony(null)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '14px 24px 1fr',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: mono, fontSize: 10,
                    cursor: 'pointer',
                    // Subtle ember tint on the rail row when the bloom is
                    // active on the canvas — closes the connection loop.
                    background: isHovered ? 'rgba(200, 144, 88, 0.06)' : 'transparent',
                    transition: 'background 120ms ease',
                    margin: '0 -6px', padding: '2px 6px',
                  }}>
                  <span style={{ color: COL.dimLo }}>{i + 1}.</span>
                  <HallMushroom entry={entry} size={24} glow={false} />
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{
                      fontFamily: serif, fontSize: 13,
                      color: isHovered ? COL.ember : (c.name ? COL.textHi : COL.dim),
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1,
                      transition: 'color 120ms ease',
                    }}>
                      {displayName}
                    </span>
                    <span style={{ color: COL.dimLo, fontSize: 9, letterSpacing: '0.04em', marginTop: 2 }}>
                      {ageLabel} · {c.cellCount || 0} hyphae
                    </span>
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
  // Rail-row → canvas-bloom hover link (kanban #03). The colony key is
  // the same string used in snapshot.colonies, so a quick equality check
  // in TopColony tells each row whether it's the active one.
  const [hoveredColonyId, setHoveredColonyId] = useState(null);

  if (!world || !snapshot) {
    return (
      <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageWallpaper />
        {err
          ? <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: COL.dim }}>error: {err}</span>
          : <LoadingPassage />}
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', position: 'relative' }}>
      <PageWallpaper />

      {/* ── Canvas — grows to fill all space left of the panel ───────
          ShroomCanvas centers itself and maintains 16:9 within this
          flex item. At 1440px wide: canvas gets ~1116px → 627px tall. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <ShroomCanvas snapshot={snapshot} hoveredColonyId={hoveredColonyId} />
      </div>

      {/* ── Right panel — fixed-width column beside the canvas ────────
          Cards stack vertically; Chronicle takes remaining space. */}
      <div style={{
        width: 300, flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '12px 12px 12px 0',
        minHeight: 0,
      }}>
        <StatusLeft
          snapshot={snapshot}
          nav={
            <>
              <EnginePageTrigger />
              <LabPageTrigger />
              <ResearchPageTrigger />
              <DevDashboardTrigger onOpen={() => setDevOpen(true)} />
            </>
          }
        />
        <div style={{ flex: 1, minHeight: 80, overflow: 'hidden' }}>
          <Chronicle entries={journal?.entries} ticksPerDay={snapshot.meta?.ticksPerDay} />
        </div>
        <TopColony
          snapshot={snapshot}
          onHoverColony={setHoveredColonyId}
          hoveredColonyId={hoveredColonyId}
        />
        <HallTrigger entries={hall?.entries} onOpen={() => setHallOpen(true)} />
        <StatusRight snapshot={snapshot} />
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

// PageWallpaper lives in kit/atmosphere.jsx → window.PageWallpaper

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
