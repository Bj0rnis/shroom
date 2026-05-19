// Shroom — research dashboard.
// A view over RESEARCH.md (the paper), NOTES.md (the journal), PROCESS.md
// (the contract), and recent lab runs. Source markdown stays authoritative;
// this page is composition + parsed structure.

const { MONO, SERIF, SERIF_RUN, COL } = window.SHROOM_TOKENS;
const { useEffect, useState } = React;
const { PageWallpaper, DarkPanel, Section, KV, Subhead, Aside } = window;

// ── Helpers ──────────────────────────────────────────────────────────────

function tagColor(tag) {
  switch (tag) {
    case 'mechanic': return COL.glow || '#e8c98a';
    case 'tweak':    return COL.hyphaHi || '#9dc488';
    case 'rewrite':  return COL.ember || '#C84B3D';
    case 'stuck':    return '#c89058';
    case 'observe':  return COL.dim;
    default:         return COL.dim;
  }
}

function passColor(pass, of) {
  if (!of) return COL.dim;
  const r = pass / of;
  if (r >= 0.8) return COL.hyphaHi || '#9dc488';
  if (r >= 0.4) return COL.glow || '#e8c98a';
  return '#c89058';
}

function hypoStatusColor(status) {
  if (status === 'current') return COL.hyphaHi || '#9dc488';
  if (status === 'tried')   return COL.glow || '#e8c98a';
  return COL.dim;
}

// ── Iteration timeline card ──────────────────────────────────────────────

function IterCard({ entry }) {
  const headerLeft = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: MONO, color: COL.emberHi, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        {entry.iter || '—'}
      </span>
      <span style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 16 }}>{entry.branch}</span>
      <span style={{
        fontFamily: MONO, fontSize: 10, color: tagColor(entry.tag),
        border: `1px solid ${tagColor(entry.tag)}`, padding: '1px 6px', borderRadius: 2,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>{entry.tag}</span>
      <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 11 }}>{entry.date}</span>
      {entry.agent && (
        <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 10 }}>
          · {entry.agent}
        </span>
      )}
    </div>
  );

  return (
    <DarkPanel seed={(entry.date + (entry.iter || '')).length * 7} style={{ marginBottom: 12 }}>
      <div style={{ position: 'relative', zIndex: 1, padding: '14px 18px 16px' }}>
        {headerLeft}
        {entry.plain && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'rgba(232,200,132,0.06)',
            borderLeft: `2px solid ${COL.glow || '#e8c884'}`,
            fontFamily: SERIF, fontSize: 14, color: COL.textHi, lineHeight: 1.45,
          }}>
            {entry.plain}
          </div>
        )}
        {entry.scores && entry.scores.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {entry.scores.map(s => (
              <span key={s.name} style={{
                fontFamily: MONO, fontSize: 10, color: passColor(s.pass, s.of),
                border: `1px solid ${passColor(s.pass, s.of)}`, padding: '1px 6px', borderRadius: 2,
              }}>
                {s.name} <strong>{s.pass}/{s.of}</strong>
              </span>
            ))}
          </div>
        )}
        {/* Technical detail below the plain line — for the next iterating agent */}
        <details style={{ marginTop: 12 }}>
          <summary style={{
            fontFamily: MONO, color: COL.dim, fontSize: 10,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            agent notes
          </summary>
          {entry.hypothesis && <Field label="hypothesis" body={entry.hypothesis} />}
          {entry.result     && <Field label="result"     body={entry.result} />}
          {entry.reading    && <Field label="reading"    body={entry.reading} />}
          {entry.next       && <Field label="next"       body={entry.next} accent />}
        </details>
      </div>
    </DarkPanel>
  );
}

function Field({ label, body, accent }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        fontFamily: MONO, color: COL.dim, fontSize: 9,
        letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontFamily: SERIF_RUN, fontSize: 13, color: accent ? COL.emberHi : COL.text,
        lineHeight: 1.5, fontStyle: accent ? 'italic' : 'normal',
      }}>{body}</div>
    </div>
  );
}

// ── Status matrix ────────────────────────────────────────────────────────

function StatusMatrix({ entries }) {
  // Only iter-tagged entries with scores.
  const iters = entries.filter(e => e.iter && e.scores && e.scores.length > 0).reverse(); // oldest-first
  if (!iters.length) return null;

  // Collect scorer names in the order they first appear.
  const scorerSet = new Set();
  iters.forEach(e => e.scores.forEach(s => scorerSet.add(s.name)));
  const scorers = [...scorerSet];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontFamily: MONO, fontSize: 11, color: COL.text,
      }}>
        <thead>
          <tr>
            <th style={cellHead}>iter</th>
            {scorers.map(s => <th key={s} style={cellHead}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {iters.map(e => (
            <tr key={e.date + e.iter}>
              <td style={{ ...cell, color: COL.emberHi }}>{e.iter}</td>
              {scorers.map(s => {
                const sc = e.scores.find(x => x.name === s);
                if (!sc) return <td key={s} style={{ ...cell, color: COL.dim }}>—</td>;
                return (
                  <td key={s} style={{ ...cell, color: passColor(sc.pass, sc.of) }}>
                    {sc.pass}/{sc.of}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellHead = {
  textAlign: 'left', padding: '6px 10px',
  borderBottom: `1px solid ${COL.faint}`,
  color: COL.hyphaHi, fontWeight: 'normal',
};
const cell = {
  padding: '6px 10px', borderBottom: `1px solid ${COL.faint}`,
  fontVariantNumeric: 'tabular-nums',
};

// ── Hypothesis buffet ────────────────────────────────────────────────────

function HypothesisBuffet({ hypotheses }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
      {hypotheses.map(h => (
        <div key={h.name} style={{
          border: `1px solid ${hypoStatusColor(h.status)}`,
          borderRadius: 3, padding: '10px 12px',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 14 }}>{h.name}</span>
            <span style={{
              fontFamily: MONO, fontSize: 9, color: hypoStatusColor(h.status),
              letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>· {h.status}</span>
          </div>
          <div style={{ fontFamily: SERIF_RUN, fontSize: 12, color: COL.text2, lineHeight: 1.45 }}>
            {h.oneLiner}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Recent lab runs ──────────────────────────────────────────────────────

function RecentRuns({ runs }) {
  if (!runs.length) {
    return (
      <div style={{ fontFamily: SERIF_RUN, fontSize: 13, color: COL.dim, fontStyle: 'italic' }}>
        No lab runs yet. Run one at <a href="/lab" style={{ color: COL.emberHi }}>/lab</a>.
      </div>
    );
  }
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8,
    }}>
      {runs.map(r => (
        <a key={r.id} href={`/lab#${r.id}`} style={{
          textDecoration: 'none', color: 'inherit',
          border: `1px solid ${COL.faint}`, borderRadius: 3, padding: '8px 12px',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontFamily: MONO, color: COL.emberHi, fontSize: 11, letterSpacing: '0.15em' }}>
            {r.id}
          </div>
          <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 13, marginTop: 2 }}>
            {r.scenarioName || r.scenarioId}
          </div>
          <div style={{ fontFamily: MONO, color: COL.dim, fontSize: 10, marginTop: 4 }}>
            seed {r.seed} · {r.durationDays}d sim
          </div>
        </a>
      ))}
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────

function ResearchApp() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch('/api/research')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setData)
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <StatusFrame text={`error: ${err}`} />;
  if (!data) return <StatusFrame text="awakening…" />;

  const iterCount = data.notes.filter(n => n.iter).length;
  const tried = data.hypotheses.filter(h => h.status === 'tried').length;
  const current = data.hypotheses.find(h => h.status === 'current');

  return (
    <div style={{ minHeight: '100dvh', padding: '32px 16px 80px' }}>
      <PageWallpaper />
      <div style={{ maxWidth: 1040, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: '0 6px 14px', marginBottom: 10 }}>
          <div style={{
            fontFamily: MONO, color: COL.ember, fontSize: 10, letterSpacing: '0.3em',
            textTransform: 'uppercase', marginBottom: 6,
          }}>
            shroom · research
          </div>
          <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
            what we're trying
          </div>
          <div style={{
            fontFamily: SERIF_RUN, color: COL.text2, fontSize: 15, lineHeight: 1.5,
            fontStyle: 'italic', maxWidth: 740,
          }}>
            Each row below is one thing we tried, what came out, and what to try
            next. The painting we're aiming for lives on{' '}
            <a href="/engine" style={{ color: COL.emberHi }}>engine</a>; the
            full notes and rules live at{' '}
            <a href="/research/paper" style={{ color: COL.emberHi }}>paper</a>,{' '}
            <a href="/notes"          style={{ color: COL.emberHi }}>notes</a>,{' '}
            <a href="/process"        style={{ color: COL.emberHi }}>process</a>.
          </div>
        </div>

        {/* Header stats strip */}
        <DarkPanel seed={5} style={{ marginBottom: 14 }}>
          <div style={{
            position: 'relative', zIndex: 1, padding: '14px 22px',
            display: 'flex', gap: 28, flexWrap: 'wrap',
          }}>
            <Stat label="things tried" v={iterCount} />
            <Stat label="ideas explored" v={`${tried + 1}/${data.hypotheses.length}`} />
            <Stat label="trying now" v={current ? current.name.toLowerCase() : '—'} />
            <Stat label="last move" v={data.notes[0]?.date || '—'} />
          </div>
        </DarkPanel>

        {/* Hypothesis buffet */}
        <Section seed={11} num="01" kicker="ideas" glyph="cycle" accent={COL.hypha}
          title="ideas on the table"
          sub="The painting is what we want. How we get there is open. One of these is the current bet; the others are on the buffet for when the current one stops paying off.">
          <HypothesisBuffet hypotheses={data.hypotheses} />
        </Section>

        {/* Status matrix */}
        <Section seed={17} num="02" kicker="how it's going" glyph="tick" accent={COL.glow}
          title="what's passing"
          sub="One row per thing we tried. One column per check. Green means most seeds pass; amber means some; red means almost none.">
          <StatusMatrix entries={data.notes} />
        </Section>

        {/* Iteration timeline */}
        <Section seed={23} num="03" kicker="story so far" glyph="substrate" accent={COL.ember}
          title="what we tried, and what came out"
          sub="Newest at the top. Each card is one move — a short summary, the per-check pass-rates, and (if you want the detail) the agent's own notes underneath.">
          {data.notes.map((e, idx) => <IterCard key={idx} entry={e} />)}
        </Section>

        {/* Recent runs */}
        <Section seed={29} num="04" kicker="last runs" glyph="cycle" accent={COL.hypha}
          title="recent test runs"
          sub="The lab plays out a single day at a time, with a chosen seed, so the same setup always lands on the same world. Each tile below is one of those plays.">
          <RecentRuns runs={data.runs} />
        </Section>

      </div>
    </div>
  );
}

function Stat({ label, v }) {
  return (
    <div>
      <div style={{
        fontFamily: MONO, color: COL.dim, fontSize: 9,
        letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 18 }}>{v}</div>
    </div>
  );
}

function StatusFrame({ text }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <PageWallpaper />
      <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 12, position: 'relative', zIndex: 1 }}>
        {text}
      </span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('research-root')).render(<ResearchApp />);
