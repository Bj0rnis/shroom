// Shroom — lab page composition.
// Scenario sandbox UI. Reads /api/lab/* (built in PR 1), drives runs,
// shows progress, viewer, history, and side-by-side compare.

const { MONO, SERIF, SERIF_RUN, COL } = window.SHROOM_TOKENS;
const { useEffect, useState, useRef, useCallback } = React;

const {
  PageWallpaper, DarkPanel,
  LabCanvas, ScenarioCard, RunListItem, AsciiGrid, ProgressBar,
  EventLog, ColoniesTable, TimeseriesTable, LabButton,
} = window;

// Roughly 60s real-time per sim-day on prod. Used for the time-budget display.
const TICKS_PER_SIM_DAY_GUESS = 28800;

function fmtMs(ms) {
  if (ms < 1000)   return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mn = Math.floor(ms / 60_000);
  const sc = Math.floor((ms % 60_000) / 1000);
  return `${mn}m ${sc}s`;
}

// ── Run viewer ────────────────────────────────────────────────────────────
function RunViewer({ run, onPin, onCopyMarkdown, copyState }) {
  const [tab, setTab] = useState('events');   // events | colonies | timeseries

  if (!run) {
    return (
      <DarkPanel seed={17} style={{ minHeight: 320 }}>
        <div style={{ position: 'relative', zIndex: 1, padding: '24px', color: COL.dim, fontFamily: SERIF_RUN, fontStyle: 'italic', fontSize: 14 }}>
          select or run a scenario to view its result.
        </div>
      </DarkPanel>
    );
  }

  const m = run.metrics || {};
  const tpd = run.constants?.TICKS_PER_SIM_DAY || TICKS_PER_SIM_DAY_GUESS;

  return (
    <DarkPanel seed={19} style={{ marginBottom: 14 }}>
      <div style={{ position: 'relative', zIndex: 1, padding: '18px 22px 22px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, color: COL.emberHi, fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{run.id}</span>
          <span style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 18 }}>{run.scenarioName}</span>
          <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 10 }}>seed {run.seed} · {fmtMs(run.durationMs || 0)} real · {run.durationDays}d sim</span>
        </div>

        {/* canvas + ascii side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>canvas</div>
            <LabCanvas snapshot={run.snapshot} />
          </div>
          <div>
            <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>ascii (80×45)</div>
            <AsciiGrid ascii={run.ascii} />
          </div>
        </div>

        {/* metrics strip */}
        <div style={{ fontFamily: MONO, fontSize: 11, color: COL.text, marginBottom: 12, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span><span style={{ color: COL.dim }}>cells</span> {m.hyphaeCells || 0}</span>
          <span><span style={{ color: COL.dim }}>colonies</span> {m.coloniesAlive || 0}/{m.coloniesTotal || 0}</span>
          <span><span style={{ color: COL.dim }}>fruits</span> {m.fruitsInAir || 0} ({m.fruitsMature || 0} mature)</span>
          <span><span style={{ color: COL.dim }}>spores</span> {m.sporesInAir || 0}</span>
          <span><span style={{ color: COL.dim }}>births</span> {m.births || 0}</span>
          <span><span style={{ color: COL.dim }}>deaths</span> {m.deathsTotal || 0}</span>
          <span><span style={{ color: COL.dim }}>log</span> {m.logCells || 0} (nut {m.avgLogNutrient || 0})</span>
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <LabButton onClick={() => onPin('A', run)}>pin to A</LabButton>
          <LabButton onClick={() => onPin('B', run)}>pin to B</LabButton>
          <LabButton onClick={() => onCopyMarkdown(run.id)} accent={COL.glow}>
            {copyState === 'copied' ? 'copied!' : copyState === 'error' ? 'copy failed' : 'copy markdown for AI'}
          </LabButton>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: `1px solid ${COL.faint}` }}>
          {['events', 'colonies', 'timeseries'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'transparent', border: 'none',
                color: tab === t ? COL.emberHi : COL.dim,
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                padding: '6px 12px', cursor: 'pointer',
                borderBottom: `2px solid ${tab === t ? COL.ember : 'transparent'}`,
              }}
            >{t}</button>
          ))}
        </div>

        {tab === 'events'     && <EventLog events={run.events} ticksPerDay={tpd} />}
        {tab === 'colonies'   && <ColoniesTable colonies={run.colonies} ticksPerDay={tpd} />}
        {tab === 'timeseries' && <TimeseriesTable samples={run.samples} />}
      </div>
    </DarkPanel>
  );
}

// ── Compare slot ──────────────────────────────────────────────────────────
function CompareSlot({ label, run, onClear }) {
  return (
    <DarkPanel seed={label === 'A' ? 23 : 29}>
      <div style={{ position: 'relative', zIndex: 1, padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, color: COL.emberHi, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase' }}>slot {label}</span>
          {run && (
            <span onClick={onClear} style={{ fontFamily: MONO, color: COL.faint, fontSize: 10, cursor: 'pointer' }}>clear ×</span>
          )}
        </div>
        {!run ? (
          <div style={{ fontFamily: SERIF_RUN, color: COL.dim, fontSize: 12, fontStyle: 'italic' }}>
            pin a run to compare.
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: MONO, color: COL.text, fontSize: 11, marginBottom: 6 }}>
              <span style={{ color: COL.emberHi }}>{run.id}</span> · {run.scenarioName}
            </div>
            <LabCanvas snapshot={run.snapshot} />
            <div style={{ fontFamily: MONO, fontSize: 10, color: COL.text2, marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <span><span style={{ color: COL.dim }}>cells </span>{run.metrics?.hyphaeCells || 0}</span>
              <span><span style={{ color: COL.dim }}>colonies </span>{run.metrics?.coloniesAlive || 0}</span>
              <span><span style={{ color: COL.dim }}>fruits </span>{run.metrics?.fruitsInAir || 0}</span>
              <span><span style={{ color: COL.dim }}>deaths </span>{run.metrics?.deathsTotal || 0}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: COL.dim, marginTop: 8 }}>
              TIP_BIFURCATION_PROB: {run.constants?.TIP_BIFURCATION_PROB ?? '?'}<br/>
              FRUIT_COST: {run.constants?.FRUIT_COST ?? '?'}<br/>
              EXTEND_COST: {run.constants?.EXTEND_COST ?? '?'}
            </div>
          </div>
        )}
      </div>
    </DarkPanel>
  );
}

// ── App ───────────────────────────────────────────────────────────────────
function LabApp() {
  const [scenarios, setScenarios] = useState([]);
  const [picked,    setPicked]    = useState(null);
  const [runs,      setRuns]      = useState([]);
  const [viewing,   setViewing]   = useState(null);     // full run object
  const [running,   setRunning]   = useState(false);
  const [progress,  setProgress]  = useState(null);     // { currentTick, totalTicks, ... }
  const [slotA,     setSlotA]     = useState(null);
  const [slotB,     setSlotB]     = useState(null);
  const [error,     setError]     = useState(null);
  const [copyState, setCopyState] = useState(null);     // 'copied' | 'error' | null
  const pollRef     = useRef(null);
  const idsBeforeRef = useRef(new Set());                // run ids snapshotted at run start

  // Fetch scenarios + history on mount. Also check for an in-flight run —
  // if the user reloaded mid-run, we want the progress bar to pick up where
  // it left off and the viewer to populate once the run finishes.
  useEffect(() => {
    fetch('/api/lab/scenarios').then(r => r.json()).then(list => {
      setScenarios(list);
      if (list.length && !picked) setPicked(list[1]?.id || list[0].id);   // default to week-on-log
    }).catch(e => setError(e.message));
    refreshRuns();
    fetch('/api/lab/current').then(r => r.json()).then(job => {
      if (!job) return;
      // A run is already in flight on the server. Snapshot the current run
      // ids so the poller can identify which sim-N appeared when it lands.
      fetch('/api/lab/runs').then(r => r.json()).then(list => {
        idsBeforeRef.current = new Set(list.map(r => r.id));
        setRuns(list);
        setProgress(job);
        setRunning(true);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  function refreshRuns() {
    fetch('/api/lab/runs').then(r => r.json()).then(setRuns).catch(() => {});
  }

  // Progress polling. We rely on /api/lab/current as the source of truth for
  // both "what's the progress" and "is the run done." The POST /api/lab/run
  // response is unreliable for long runs: a reverse proxy in front of the
  // container may close the connection at its idle timeout (a 7-day run is
  // ~12 min, well past most defaults). The run still completes server-side —
  // we just need a different signal that doesn't require holding a connection
  // open. The transition from non-null → null tells us a run just finished.
  useEffect(() => {
    if (!running) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    let prevJob = null;
    pollRef.current = setInterval(() => {
      fetch('/api/lab/current').then(r => r.json()).then(job => {
        const justFinished = prevJob && job === null;
        prevJob = job;
        if (justFinished) {
          // Run completed server-side. Refresh history and open whichever
          // sim-N appeared since we started.
          fetch('/api/lab/runs').then(r => r.json()).then(list => {
            setRuns(list);
            const fresh = list.find(r => !idsBeforeRef.current.has(r.id));
            if (fresh) openRun(fresh.id);
          }).catch(() => {});
          setRunning(false);
          setProgress(null);
          return;
        }
        if (job) setProgress(job);
      }).catch(() => { /* network blip; keep polling */ });
    }, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [running]);

  function runScenario() {
    if (!picked || running) return;
    setError(null);
    idsBeforeRef.current = new Set(runs.map(r => r.id));
    setRunning(true);
    setProgress({ currentTick: 0, totalTicks: 1, scenarioName: scenarios.find(s => s.id === picked)?.name });
    // Fire and forget. The proxy may kill the response for long runs; the
    // poller above watches /api/lab/current and picks up the result when
    // the server-side run finishes. Errors here are only meaningful if the
    // request fails *quickly* (before the run starts).
    fetch('/api/lab/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioId: picked }),
    }).catch(() => { /* swallow — let the poller resolve completion */ });
  }

  function openRun(id) {
    fetch(`/api/lab/runs/${id}`).then(r => r.json()).then(setViewing).catch(e => setError(e.message));
  }

  function deleteRun(id) {
    if (!confirm(`delete ${id}?`)) return;
    fetch(`/api/lab/runs/${id}`, { method: 'DELETE' }).then(() => {
      if (viewing && viewing.id === id) setViewing(null);
      if (slotA   && slotA.id === id)   setSlotA(null);
      if (slotB   && slotB.id === id)   setSlotB(null);
      refreshRuns();
    });
  }

  function pinTo(slot, run) {
    if (slot === 'A') setSlotA(run);
    else              setSlotB(run);
  }

  const copyMarkdown = useCallback((id) => {
    fetch(`/api/lab/runs/${id}/markdown`)
      .then(r => r.text())
      .then(text => navigator.clipboard.writeText(text))
      .then(() => {
        setCopyState('copied');
        setTimeout(() => setCopyState(null), 1500);
      })
      .catch(() => {
        setCopyState('error');
        setTimeout(() => setCopyState(null), 2000);
      });
  }, []);

  // Estimate time remaining based on currentTick / totalTicks. Real wall time
  // per tick varies (~2-4ms locally, slower in Docker), so this is rough.
  const progressLabel = progress
    ? `${Math.min(100, Math.round((progress.currentTick / Math.max(1, progress.totalTicks)) * 100))}%  ·  tick ${progress.currentTick}/${progress.totalTicks}`
    : 'starting…';

  return (
    <div style={{ minHeight: '100dvh', padding: '32px 16px 80px' }}>
      <PageWallpaper />
      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>

        {/* Page header */}
        <div style={{ padding: '0 6px 14px', marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, color: COL.ember, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>
            shroom · lab
          </div>
          <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
            how shrooms behave when you ask them to
          </div>
          <div style={{ fontFamily: SERIF_RUN, color: COL.text2, fontSize: 16, lineHeight: 1.45, fontStyle: 'italic', maxWidth: 740 }}>
            A scenario sandbox for the simulation at <a href="/" style={{ color: COL.emberHi, textDecoration: 'none', borderBottom: `1px dotted ${COL.emberHi}` }}>/</a>.
            Pick a setup, run it. Each run is numbered, persisted, and dressed
            in a markdown report you can paste back into chat. Keeps the 20
            most recent. Tune sim constants between runs; the constants
            snapshot at the top of each run shows what you were testing.
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', marginBottom: 12, border: `1px solid ${COL.danger}`, color: COL.danger, fontFamily: MONO, fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* 01 — scenario picker */}
        <DarkPanel seed={5} style={{ marginBottom: 14 }}>
          <div style={{ position: 'relative', zIndex: 1, padding: '18px 22px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                <span style={{ color: COL.ember, marginRight: 8 }}>01</span>pick a scenario
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
              {scenarios.map(s => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  selected={picked === s.id}
                  onPick={() => !running && setPicked(s.id)}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <LabButton onClick={runScenario} disabled={!picked || running}>
                {running ? 'running…' : 'run'}
              </LabButton>
              <span style={{ fontFamily: MONO, color: COL.text2, fontSize: 11 }}>
                {picked ? <>selected: <span style={{ color: COL.emberHi }}>{scenarios.find(s => s.id === picked)?.name}</span></> : 'no scenario picked'}
              </span>
            </div>
            {running && (
              <div style={{ marginTop: 14 }}>
                <ProgressBar current={progress?.currentTick || 0} total={progress?.totalTicks || 1} label={progressLabel} />
                <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 10, marginTop: 6 }}>
                  the live world keeps ticking. you can leave this tab open.
                </div>
              </div>
            )}
          </div>
        </DarkPanel>

        {/* 02 — history + result */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, marginBottom: 14 }}>
          <DarkPanel seed={11}>
            <div style={{ position: 'relative', zIndex: 1, padding: '14px 12px 14px' }}>
              <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>
                <span style={{ color: COL.ember, marginRight: 8 }}>02</span>history
              </div>
              {runs.length === 0 ? (
                <div style={{ fontFamily: SERIF_RUN, color: COL.dim, fontSize: 12, fontStyle: 'italic' }}>
                  no runs yet — run a scenario above.
                </div>
              ) : (
                <div>
                  {runs.map(r => (
                    <RunListItem
                      key={r.id}
                      run={r}
                      selected={viewing?.id === r.id}
                      onPick={() => openRun(r.id)}
                      onDelete={deleteRun}
                    />
                  ))}
                </div>
              )}
              <div style={{ fontFamily: MONO, color: COL.faint, fontSize: 9, marginTop: 10, lineHeight: 1.5 }}>
                kept: 20 newest · older auto-pruned
              </div>
            </div>
          </DarkPanel>

          <div>
            <RunViewer
              run={viewing}
              onPin={pinTo}
              onCopyMarkdown={copyMarkdown}
              copyState={copyState}
            />
          </div>
        </div>

        {/* 03 — compare */}
        {(slotA || slotB) && (
          <DarkPanel seed={31} style={{ marginBottom: 14 }}>
            <div style={{ position: 'relative', zIndex: 1, padding: '18px 22px 22px' }}>
              <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 12 }}>
                <span style={{ color: COL.ember, marginRight: 8 }}>03</span>compare
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <CompareSlot label="A" run={slotA} onClear={() => setSlotA(null)} />
                <CompareSlot label="B" run={slotB} onClear={() => setSlotB(null)} />
              </div>
            </div>
          </DarkPanel>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontFamily: MONO, fontSize: 10, color: COL.dim }}>
          runs persist at <span style={{ color: COL.text2 }}>data/lab/runs/sim-N.json</span>.
          this page is a thin viewer on top of <span style={{ color: COL.text2 }}>/api/lab/*</span>.
        </div>

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('lab-root')).render(<LabApp />);
