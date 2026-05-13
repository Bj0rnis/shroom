const { useEffect, useState } = React;

function App() {
  ensureKitStyles();
  const t = buildTheme('dark', 'calm');
  const [world,    setWorld]    = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [journal,  setJournal]  = useState(null);
  const [hall,     setHall]     = useState(null);
  const [hallSel,  setHallSel]  = useState(null);
  const [err,      setErr]      = useState(null);
  const [busy,     setBusy]     = useState(false);

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

  async function debug(action) {
    setBusy(true);
    try {
      await fetch(`/api/debug/${action}`, { method: 'POST' });
      await Promise.all([refreshFast(), refreshSlow()]);
    } finally { setBusy(false); }
  }

  if (!world || !snapshot) {
    return (
      <Surface theme={t} style={{ minHeight: '100dvh', padding: 32, display: 'flex', alignItems: 'center' }}>
        <div style={{ color: t.muted, fontFamily: t.type.mono }}>
          {err ? `error: ${err}` : 'awakening…'}
        </div>
      </Surface>
    );
  }

  const m = world.meta;
  // (counts now derived inside StatusStrip from the live snapshot.)

  return (
    <Surface theme={t} style={{ minHeight: '100dvh', padding: 24 }}>
      <div style={{
        maxWidth: 1500, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1fr 360px',
        gap: 20, alignItems: 'start',
        height: 'calc(100dvh - 48px)',
      }}>
        {/* ── LEFT: status, canvas, controls, mini-stats ─────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <StatusStrip snapshot={snapshot} />
          <ShroomCanvas snapshot={snapshot} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button theme={t} onClick={() => debug('sow')}            disabled={busy} size="sm">sow random</Button>
            <Button theme={t} onClick={() => debug('toofan')}         disabled={busy} size="sm">trigger toofan</Button>
            <Button theme={t} onClick={() => debug('nigehban-wake')}  disabled={busy} size="sm">wake nigehban</Button>
            <Button theme={t} onClick={() => debug('inscribe')}       disabled={busy} size="sm" variant="ghost">force inscribe</Button>
            <Button theme={t} onClick={() => debug('save')}           disabled={busy} size="sm" variant="ghost">save</Button>
            <Button theme={t} onClick={() => debug('reset')}          disabled={busy} size="sm" variant="danger">reset</Button>
          </div>
          <div style={{ fontFamily: t.type.mono, fontSize: 10, color: t.muted, textAlign: 'right' }}>
            tick {m.tick} · last save tick {m.lastSavedTick ?? 0} ·
            {' '}nigehban: {journal?.nigehban.callCount ?? 0} calls · {journal?.entries?.length ?? 0} entries · {journal?.nigehban.model ?? '-'}
            {journal?.nigehban.lastError ? ` · ⚠ ${journal.nigehban.lastError}` : ''}
          </div>
        </div>

        {/* ── RIGHT: chronicle (top, expanding) + hall strip (bottom) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, height: '100%' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <Chronicle entries={journal?.entries} />
          </div>
          <HallStrip entries={hall?.entries} onSelect={setHallSel} />
        </div>
      </div>
      <HallDetail entry={hallSel} onClose={() => setHallSel(null)} />
    </Surface>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
