const { useEffect, useState } = React;

const MONO  = '"IBM Plex Mono", monospace';
const SERIF = '"IM Fell DW Pica SC", serif';
const SERIF_RUN = '"IM Fell DW Pica", serif';

const COL = {
  text:    '#d4cdb8',
  textHi:  '#e8dfc8',
  text2:   '#a89a78',
  dim:     '#7a7060',
  faint:   '#52483c',
  ink:     '#1a1612',
  ember:   '#c89058',
  emberHi: '#e8b878',
  emberLo: '#90603a',
  hypha:   '#e0b878',
  hyphaHi: '#f8dca8',
  hyphaTip:'#ffecc4',
  cool:    '#78a8c8',
  glow:    '#e8c884',
  danger:  '#c87058',
  log:     '#6e4c1c',
  soil:    '#3a2a18',
  grass:   '#4c6230',
  air:     '#2a2620',
  flood:   '#6a9ec4',
  fire:    '#d87a48',
  frost:   '#bcd4e0',
  wind:    '#9c9684',
};

// ── Layout primitives ─────────────────────────────────────────────
function PageWallpaper() {
  const wrapRef = React.useRef(null);
  const [dim, setDim] = useState({ w: 200, h: 150 });
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

// Small pixel-art glyph rendered as inline SVG. Used as the kicker badge.
function SectionGlyph({ kind, color }) {
  const c = color || COL.ember;
  const dim = COL.faint;
  switch (kind) {
    case 'hero':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          {/* tiny mushroom */}
          <rect x="2" y="1" width="7" height="1" fill={c} />
          <rect x="1" y="2" width="9" height="2" fill={c} />
          <rect x="2" y="4" width="7" height="1" fill={COL.emberLo} />
          <rect x="4" y="5" width="3" height="4" fill={COL.text} />
          <rect x="3" y="9" width="5" height="1" fill={COL.text2} />
        </svg>
      );
    case 'tick':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          <rect x="5" y="1" width="1" height="4" fill={c} />
          <rect x="5" y="5" width="3" height="1" fill={c} />
          <circle cx="5.5" cy="5.5" r="4" fill="none" stroke={dim} />
        </svg>
      );
    case 'substrate':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          <rect x="0" y="0" width="11" height="4" fill={COL.air} />
          <rect x="0" y="4" width="11" height="1" fill={COL.grass} />
          <rect x="0" y="5" width="11" height="6" fill={COL.soil} />
          <rect x="2" y="2" width="7" height="2" fill={COL.log} />
        </svg>
      );
    case 'hyphae':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          <rect x="5" y="2" width="1" height="7" fill={c} />
          <rect x="3" y="4" width="2" height="1" fill={c} />
          <rect x="2" y="5" width="1" height="1" fill={c} />
          <rect x="6" y="5" width="2" height="1" fill={c} />
          <rect x="8" y="6" width="1" height="1" fill={c} />
          <rect x="4" y="9" width="3" height="1" fill={COL.hyphaHi} />
        </svg>
      );
    case 'genome':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          {[0,1,2,3,4].map(i => (
            <rect key={i} x="2" y={1 + i * 2} width="7" height="1" fill={i % 2 === 0 ? c : COL.text2} />
          ))}
        </svg>
      );
    case 'toofan':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          {/* lightning bolt */}
          <polygon points="6,1 3,6 5,6 4,10 8,5 6,5 7,1" fill={c} />
        </svg>
      );
    case 'nigehban':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          {/* quill / scroll */}
          <rect x="2" y="2" width="7" height="6" fill={COL.faint} />
          <rect x="3" y="3" width="5" height="1" fill={c} />
          <rect x="3" y="5" width="4" height="1" fill={c} />
          <rect x="3" y="7" width="5" height="1" fill={c} />
        </svg>
      );
    default: return null;
  }
}

function Section({ seed, num, kicker, title, sub, accent, glyph, children }) {
  const { DarkPanel } = window;
  return (
    <DarkPanel seed={seed} style={{ color: COL.text, marginBottom: 14 }}>
      <div style={{ position: 'relative', zIndex: 1, padding: '20px 24px 24px' }}>
        {/* left accent stripe */}
        <div style={{
          position: 'absolute', left: 0, top: 14, bottom: 14, width: 2,
          background: accent, opacity: 0.85,
        }} />
        {/* header */}
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

// Pull-quote / aside block. Used for "why" notes.
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

// Key/value rows with a stronger accented value column.
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

// ── Tick pipeline diagram ─────────────────────────────────────────
const TICK_STAGES = [
  { k: 'clock',       d: 'advance tick, roll season, drift weather',                color: 'textHi' },
  { k: 'grow',        d: 'absorb · extend (costs reserves) · thicken',              color: 'hypha' },
  { k: 'fruit',       d: 'mature stalks · roll new fruit (cost declines per fruit)',color: 'ember' },
  { k: 'spores',      d: 'drift caps · age out · release at maturity',              color: 'hyphaTip' },
  { k: 'germinate',   d: 'low-probability sow on viable substrate',                 color: 'hyphaHi' },
  { k: 'decay',       d: 'starved/aged cells die · deposit nutrients back',         color: 'dim' },
  { k: 'toofan-roll', d: 'Poisson 1/sim-year · flavor · phenotype-weighted survival', color: 'danger' },
];

function StageGlyph({ k, color }) {
  switch (k) {
    case 'clock':
      return (
        <svg width="12" height="12" viewBox="0 0 7 7" shapeRendering="crispEdges">
          <circle cx="3.5" cy="3.5" r="3" fill="none" stroke={color} />
          <rect x="3" y="1" width="1" height="3" fill={color} />
          <rect x="3" y="3" width="2" height="1" fill={color} />
        </svg>
      );
    case 'grow':
      return (
        <svg width="12" height="12" viewBox="0 0 7 7" shapeRendering="crispEdges">
          <rect x="3" y="1" width="1" height="5" fill={color} />
          <rect x="1" y="3" width="2" height="1" fill={color} />
          <rect x="4" y="4" width="2" height="1" fill={color} />
        </svg>
      );
    case 'fruit':
      return (
        <svg width="12" height="12" viewBox="0 0 7 7" shapeRendering="crispEdges">
          <rect x="1" y="1" width="5" height="2" fill={color} />
          <rect x="0" y="2" width="7" height="1" fill={color} />
          <rect x="3" y="3" width="1" height="3" fill={COL.text} />
        </svg>
      );
    case 'spores':
      return (
        <svg width="12" height="12" viewBox="0 0 7 7" shapeRendering="crispEdges">
          {[[1,1],[4,2],[2,4],[5,5],[0,3]].map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="1" height="1" fill={color} />
          ))}
        </svg>
      );
    case 'germinate':
      return (
        <svg width="12" height="12" viewBox="0 0 7 7" shapeRendering="crispEdges">
          <rect x="3" y="4" width="1" height="2" fill={color} />
          <rect x="2" y="3" width="3" height="1" fill={color} />
          <rect x="3" y="5" width="1" height="1" fill={color} />
        </svg>
      );
    case 'decay':
      return (
        <svg width="12" height="12" viewBox="0 0 7 7" shapeRendering="crispEdges">
          <rect x="0" y="5" width="7" height="1" fill={color} />
          {[[1,3],[3,4],[5,3]].map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="1" height="1" fill={color} opacity="0.6" />
          ))}
        </svg>
      );
    case 'toofan-roll':
      return (
        <svg width="12" height="12" viewBox="0 0 7 7" shapeRendering="crispEdges">
          <polygon points="4,0 2,3 3,3 2,6 5,3 4,3 5,0" fill={color} />
        </svg>
      );
    default: return null;
  }
}

function TickPipeline() {
  const cols = 4;
  const cellW = 188, cellH = 78;
  const gapX = 26, gapY = 78;
  const padX = 8, padY = 10;
  const rows = Math.ceil(TICK_STAGES.length / cols);
  const W = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const H = padY * 2 + rows * cellH + (rows - 1) * gapY;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: 880 }} shapeRendering="crispEdges">
      {TICK_STAGES.map((s, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const isRev = r % 2 === 1;
        const col = isRev ? (cols - 1 - c) : c;
        const x = padX + col * (cellW + gapX);
        const y = padY + r * (cellH + gapY);
        const acc = COL[s.color];
        return (
          <g key={s.k}>
            {/* outer panel */}
            <rect x={x} y={y} width={cellW} height={cellH} fill="#15110d" stroke={COL.faint} />
            {/* accent top stripe */}
            <rect x={x} y={y} width={cellW} height={3} fill={acc} />
            {/* glyph */}
            <g transform={`translate(${x + 12}, ${y + 14})`}>
              <StageGlyph k={s.k} color={acc} />
            </g>
            {/* step number */}
            <text x={x + 32} y={y + 24} fill={COL.dim} fontFamily={MONO} fontSize="10" letterSpacing="0.1em">
              {String(i + 1).padStart(2, '0')}
            </text>
            {/* name */}
            <text x={x + 32} y={y + 40} fill={COL.textHi} fontFamily={SERIF} fontSize="18">
              {s.k}
            </text>
            {/* description */}
            <foreignObject x={x + 12} y={y + 48} width={cellW - 24} height={cellH - 50}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                fontFamily: MONO, fontSize: 10, color: COL.text2, lineHeight: 1.4,
              }}>{s.d}</div>
            </foreignObject>
          </g>
        );
      })}
      {/* arrows */}
      {TICK_STAGES.slice(0, -1).map((_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const isRev = r % 2 === 1;
        const col = isRev ? (cols - 1 - c) : c;
        const x = padX + col * (cellW + gapX);
        const y = padY + r * (cellH + gapY);
        const nr = Math.floor((i + 1) / cols), nc = (i + 1) % cols;
        const nIsRev = nr % 2 === 1;
        const nCol = nIsRev ? (cols - 1 - nc) : nc;
        const nx = padX + nCol * (cellW + gapX);
        const ny = padY + nr * (cellH + gapY);
        const stroke = COL.faint;
        const yMid = y + cellH / 2;
        if (nr === r) {
          const x1 = isRev ? x : x + cellW;
          const x2 = isRev ? nx + cellW : nx;
          const ah = isRev ? 5 : -5;
          return (
            <g key={`a${i}`}>
              <line x1={x1} y1={yMid} x2={x2} y2={yMid} stroke={stroke} strokeWidth="1" />
              <polygon points={`${x2},${yMid - 4} ${x2 + ah},${yMid} ${x2},${yMid + 4}`} fill={stroke} />
            </g>
          );
        }
        // wrap to next row
        const exit = isRev ? x : x + cellW;
        const mid  = isRev ? exit - 14 : exit + 14;
        const ah2 = isRev ? 5 : -5;
        return (
          <g key={`a${i}`}>
            <line x1={exit} y1={yMid} x2={mid} y2={yMid} stroke={stroke} />
            <line x1={mid} y1={yMid} x2={mid} y2={ny + cellH / 2} stroke={stroke} />
            <line x1={mid} y1={ny + cellH / 2} x2={isRev ? nx : nx + cellW} y2={ny + cellH / 2} stroke={stroke} />
            <polygon points={`${(isRev ? nx : nx + cellW)},${ny + cellH / 2 - 4} ${(isRev ? nx + ah2 : nx + cellW + ah2)},${ny + cellH / 2} ${(isRev ? nx : nx + cellW)},${ny + cellH / 2 + 4}`} fill={stroke} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Terrain diagram ───────────────────────────────────────────────
function TerrainDiagram({ world }) {
  const W = 380, H = 220;
  const grassY = (world.GRASS_Y / world.H) * H;
  const logW = 150, logH = 30;
  const logX = (W - logW) / 2;
  const logY = grassY - logH;
  const r = logH / 2;
  const pockets = [
    { cx: 60,  cy: grassY + (H - grassY) * 0.72, r: 22, op: 0.6 },
    { cx: 170, cy: grassY + (H - grassY) * 0.55, r: 28, op: 0.7 },
    { cx: 270, cy: grassY + (H - grassY) * 0.85, r: 18, op: 0.55 },
    { cx: 330, cy: grassY + (H - grassY) * 0.62, r: 16, op: 0.5 },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: 480 }} shapeRendering="crispEdges">
      <rect x="0" y="0" width={W} height={grassY} fill={COL.air} />
      <rect x="0" y={grassY} width={W} height={H - grassY} fill={COL.soil} />
      {/* deeper-band tint */}
      <rect x="0" y={grassY + (H - grassY) * 0.55} width={W} height={(H - grassY) * 0.45} fill="#221710" />
      {pockets.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={p.r} fill="#7a5226" opacity={p.op} />
          <circle cx={p.cx} cy={p.cy} r={p.r * 0.55} fill="#a06c2c" opacity={p.op * 0.9} />
        </g>
      ))}
      <rect x="0" y={grassY - 1} width={W} height="2" fill={COL.grass} />
      <rect x={logX + r} y={logY} width={logW - logH} height={logH} fill={COL.log} />
      <circle cx={logX + r} cy={logY + r} r={r} fill={COL.log} />
      <circle cx={logX + logW - r} cy={logY + r} r={r} fill={COL.log} />
      {/* knot ring */}
      <circle cx={logX + logW * 0.62} cy={logY + r} r="4" fill="#3a2410" />
      {/* labels */}
      <text x="6" y="14" fontFamily={MONO} fontSize="10" fill={COL.dim}>AIR</text>
      <text x="6" y={grassY - 4} fontFamily={MONO} fontSize="10" fill={COL.grass}>GRASS · row {world.GRASS_Y}</text>
      <text x="6" y={grassY + 14} fontFamily={MONO} fontSize="10" fill={COL.dim}>SOIL · {world.W}×{world.H}</text>
      <text x={logX + 10} y={logY + 19} fontFamily={SERIF} fontSize="13" fill={COL.textHi}>LOG</text>
      <text x={pockets[1].cx + 28} y={pockets[1].cy + 4} fontFamily={MONO} fontSize="10" fill={COL.hyphaHi}>← nutrient pockets</text>
    </svg>
  );
}

// ── Fruit cost ladder ─────────────────────────────────────────────
function FruitLadder({ c }) {
  const rungs = [];
  for (let n = 0; n < 10; n++) {
    const cost = Math.max(c.FRUIT_COST_FLOOR, Math.floor(c.FRUIT_COST * Math.pow(c.FRUIT_DISCOUNT_PER_FRUIT, n)));
    rungs.push({ n, cost });
  }
  const max = c.FRUIT_COST;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: COL.dim, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        cost per fruit · n = past fruits already produced
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '32px 50px 1fr', rowGap: 4, alignItems: 'center', fontFamily: MONO, fontSize: 11 }}>
        {rungs.map(({ n, cost }) => {
          const floored = cost === c.FRUIT_COST_FLOOR;
          return (
            <React.Fragment key={n}>
              <div style={{ color: COL.dim }}>n={n}</div>
              <div style={{ color: floored ? COL.hyphaTip : COL.emberHi, fontWeight: 500 }}>{cost}</div>
              <div style={{ background: COL.ink, height: 10, position: 'relative', border: `1px solid ${COL.faint}` }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${(cost / max) * 100}%`,
                  background: `linear-gradient(90deg, ${COL.emberLo}, ${COL.ember})`,
                }} />
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: COL.dim, marginTop: 8 }}>
        floor at {c.FRUIT_COST_FLOOR} (cap) · ratio {c.FRUIT_DISCOUNT_PER_FRUIT} per past fruit
      </div>
    </div>
  );
}

// ── Reserves flow diagram (small, decorative) ─────────────────────
function ReservesFlow({ c }) {
  return (
    <svg viewBox="0 0 320 70" width="100%" style={{ display: 'block', maxWidth: 400, marginBottom: 12 }} shapeRendering="crispEdges">
      {/* substrate */}
      <rect x="0" y="42" width="80" height="20" fill={COL.soil} stroke={COL.faint} />
      <text x="40" y="35" fontFamily={MONO} fontSize="9" fill={COL.dim} textAnchor="middle">SUBSTRATE</text>
      <text x="40" y="56" fontFamily={MONO} fontSize="10" fill={COL.text} textAnchor="middle">nutrient</text>
      {/* arrow → reserves */}
      <line x1="80" y1="52" x2="118" y2="52" stroke={COL.hyphaHi} />
      <polygon points="118,48 124,52 118,56" fill={COL.hyphaHi} />
      <text x="100" y="45" fontFamily={MONO} fontSize="9" fill={COL.hyphaHi} textAnchor="middle">+{c.NUTRIENT_CONSUMPTION + c.SIDE_ABSORPTION}</text>
      {/* reserves pool */}
      <rect x="124" y="42" width="80" height="20" fill={COL.ink} stroke={COL.emberHi} />
      <text x="164" y="35" fontFamily={MONO} fontSize="9" fill={COL.emberHi} textAnchor="middle">RESERVES</text>
      <text x="164" y="56" fontFamily={MONO} fontSize="10" fill={COL.emberHi} textAnchor="middle">pool</text>
      {/* arrow → spend (extend) */}
      <line x1="204" y1="46" x2="240" y2="20" stroke={COL.emberLo} />
      <polygon points="240,16 246,20 238,24" fill={COL.emberLo} />
      <text x="252" y="20" fontFamily={MONO} fontSize="9" fill={COL.emberLo}>extend −{c.EXTEND_COST}</text>
      {/* arrow → spend (fruit) */}
      <line x1="204" y1="58" x2="240" y2="58" stroke={COL.ember} />
      <polygon points="240,54 246,58 240,62" fill={COL.ember} />
      <text x="252" y="61" fontFamily={MONO} fontSize="9" fill={COL.ember}>fruit −{c.FRUIT_COST}</text>
    </svg>
  );
}

// ── Genome table ──────────────────────────────────────────────────
const GENE_NOTES = {
  growth_rate:          'extension probability multiplier per tick',
  spread_bias_nutrient: 'how strongly tips pull toward higher-nutrient neighbors',
  vertical_bias:        'how strongly tips prefer ↑ over ↓ when spreading',
  fruit_threshold:      'genome-side gate on FRUIT_BASE_RATE roll',
  decay_resistance:     'reduces starvation / turnover risk',
  spore_count:          'spores released per mature fruit',
  cap_hue:              'fruit cap color (0..360°)',
  cap_shape:            '0 round · 1 conical · 2 flat · 3 frilly',
  cap_size:             'fruit cap diameter multiplier',
  stem_length:          'fruit stem height multiplier',
};

const GENE_BUCKET = {
  growth_rate: 'growth', spread_bias_nutrient: 'growth', vertical_bias: 'growth',
  fruit_threshold: 'fruit', decay_resistance: 'survive', spore_count: 'fruit',
  cap_hue: 'looks', cap_shape: 'looks', cap_size: 'looks', stem_length: 'looks',
};

const BUCKET_COLOR = {
  growth:  COL.hypha,
  fruit:   COL.ember,
  survive: COL.cool,
  looks:   COL.emberHi,
};

function GenomeTable({ genes }) {
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '14px 24px 1.5fr 0.9fr 2fr',
        columnGap: 12, rowGap: 6,
        fontFamily: MONO, fontSize: 11,
      }}>
        <div />
        <div style={{ color: COL.dim, letterSpacing: '0.08em' }}>#</div>
        <div style={{ color: COL.dim, letterSpacing: '0.08em' }}>gene</div>
        <div style={{ color: COL.dim, letterSpacing: '0.08em' }}>range</div>
        <div style={{ color: COL.dim, letterSpacing: '0.08em' }}>role</div>
        {genes.map((g, i) => {
          const bucket = GENE_BUCKET[g.name];
          const ac = BUCKET_COLOR[bucket] || COL.text;
          return (
            <React.Fragment key={g.name}>
              <div style={{ background: ac, width: 6, height: 6, marginTop: 5, borderRadius: 0 }} />
              <div style={{ color: COL.dim }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ color: COL.textHi }}>{g.name}</div>
              <div style={{ color: ac }}>{g.min}–{g.max}{g.continuous ? '' : ' (int)'}</div>
              <div style={{ color: COL.text2 }}>{GENE_NOTES[g.name] || ''}</div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 14, fontFamily: MONO, fontSize: 10, color: COL.dim }}>
        {Object.entries(BUCKET_COLOR).map(([name, c]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, background: c }} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── In-practice: a first day, fruit decisions, a toofan roll ──────
function FirstDayLedger({ c }) {
  // Illustrative trajectory: one tip on log substrate.
  // self draw = NUTRIENT_CONSUMPTION (1). Side draw assumes 4 substrate neighbors,
  // each contributing SIDE_ABSORPTION (1) above the floor. So +5/tick per cell.
  const perCell = c.NUTRIENT_CONSUMPTION + 4 * c.SIDE_ABSORPTION;
  const rows = [
    { t: 0,  cells: 1, res: 0,                 ev: 'sown — single tip on log' },
    { t: 1,  cells: 1, res: perCell,           ev: `+${perCell} absorb (self + 4 side)` },
    { t: 2,  cells: 1, res: perCell * 2,       ev: `+${perCell} absorb` },
    { t: 3,  cells: 2, res: perCell * 2 - c.EXTEND_COST + perCell * 2,
                                                ev: `extend −${c.EXTEND_COST} · then +${perCell * 2}` },
    { t: 4,  cells: 3, res: 'rising',          ev: 'second extend · absorbs grow with cells' },
    { t: 50, cells: 18, res: 'plateau',        ev: 'extension keeps pace with absorption' },
    { t: 120, cells: 24, res: c.FRUIT_COST,    ev: `first fruit eligible — cost ${c.FRUIT_COST}` },
  ];
  return (
    <div style={{ fontFamily: MONO, fontSize: 11 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 50px 80px 1fr',
        columnGap: 14, rowGap: 4,
        color: COL.dim, marginBottom: 6, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        <div>tick</div><div>cells</div><div>reserves</div><div>event</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '40px 50px 80px 1fr',
          columnGap: 14, rowGap: 0, padding: '3px 0',
          borderBottom: i < rows.length - 1 ? `1px dashed ${COL.faint}` : 'none',
        }}>
          <div style={{ color: COL.dim }}>t={r.t}</div>
          <div style={{ color: COL.hyphaHi }}>{r.cells}</div>
          <div style={{ color: COL.emberHi }}>{r.res}</div>
          <div style={{ color: COL.text2 }}>{r.ev}</div>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 10, color: COL.dim, fontStyle: 'italic' }}>
        illustrative · single tip on uniform log substrate, 4 substrate neighbors
      </div>
    </div>
  );
}

function FruitDecisions({ c }) {
  const cost = n => Math.max(c.FRUIT_COST_FLOOR, Math.floor(c.FRUIT_COST * Math.pow(c.FRUIT_DISCOUNT_PER_FRUIT, n)));
  const colonies = [
    { name: 'Wigglecap',   cells: 5,  fruits: 0, res: 487, glyph: '◯' },
    { name: 'Bramblewort', cells: 40, fruits: 4, res: 280, glyph: '◉' },
    { name: 'Plumpsigh',   cells: 82, fruits: 7, res: 612, glyph: '◍' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {colonies.map(col => {
        const need = cost(col.fruits);
        const can  = col.res >= need;
        const after = can ? col.res - need : col.res;
        const ac = can ? COL.hyphaHi : COL.danger;
        return (
          <div key={col.name} style={{
            background: COL.ink, border: `1px solid ${COL.faint}`,
            borderTop: `2px solid ${ac}`,
            padding: '10px 12px',
            fontFamily: MONO, fontSize: 11,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ color: ac, fontSize: 14 }}>{col.glyph}</span>
              <span style={{ fontFamily: SERIF, fontSize: 15, color: COL.textHi }}>{col.name}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 10, rowGap: 3, color: COL.text }}>
              <span style={{ color: COL.dim }}>cells</span><span>{col.cells}</span>
              <span style={{ color: COL.dim }}>fruits</span><span>{col.fruits}</span>
              <span style={{ color: COL.dim }}>reserves</span><span style={{ color: COL.hyphaHi }}>{col.res}</span>
              <span style={{ color: COL.dim }}>cost (n={col.fruits})</span><span style={{ color: COL.emberHi }}>{need}</span>
            </div>
            <div style={{
              marginTop: 10, padding: '5px 8px',
              background: can ? '#1c2418' : '#241612',
              border: `1px solid ${ac}`,
              color: ac,
              fontFamily: MONO, fontSize: 11,
            }}>
              {can ? `✓ fruits → reserves ${after}` : `× short by ${need - col.res}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ToofanRoll({ c }) {
  // Sample phenotype — values chosen to make the example tangible, not to mirror
  // any specific fit-function in sim.js. Caveat noted below the chart.
  const phen = { color: 'yellow-brown', shape: 'round', size: 'small' };
  const rolls = [
    { flavor: 'flood', fit: 0.20, note: 'warm/dry phenotype — poor in wet'    },
    { flavor: 'fire',  fit: 0.75, note: 'small cap weathers heat well'        },
    { flavor: 'frost', fit: 0.85, note: 'small round caps tolerate cold'      },
    { flavor: 'wind',  fit: 0.85, note: 'low stem, small cap — wind-resistant'},
  ];
  return (
    <div>
      <div style={{
        fontFamily: MONO, fontSize: 11, color: COL.text,
        background: COL.ink, border: `1px solid ${COL.faint}`,
        padding: '8px 12px', marginBottom: 12,
        display: 'flex', gap: 18,
      }}>
        <span style={{ color: COL.dim }}>phenotype</span>
        <span style={{ color: COL.text2 }}>{phen.color}</span>
        <span style={{ color: COL.text2 }}>· {phen.shape}</span>
        <span style={{ color: COL.text2 }}>· {phen.size}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '70px 90px 1fr 1fr', columnGap: 12, rowGap: 6, alignItems: 'center', fontFamily: MONO, fontSize: 11 }}>
        <div style={{ color: COL.dim, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>flavor</div>
        <div style={{ color: COL.dim, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>survival</div>
        <div style={{ color: COL.dim, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>bar</div>
        <div style={{ color: COL.dim, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>fit basis</div>
        {rolls.map(r => {
          const surv = c.TOOFAN_BASE_SURVIVAL + c.TOOFAN_PHENOTYPE_WEIGHT * r.fit;
          const ac = COL[r.flavor];
          return (
            <React.Fragment key={r.flavor}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, background: ac }} />
                <span style={{ color: COL.textHi }}>{r.flavor}</span>
              </div>
              <div style={{ color: ac }}>{surv.toFixed(2)}</div>
              <div style={{ background: COL.ink, height: 10, position: 'relative', border: `1px solid ${COL.faint}` }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${surv * 100}%`, background: ac }} />
              </div>
              <div style={{ color: COL.text2, fontSize: 10 }}>{r.note}</div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 10, color: COL.dim }}>
        formula: <span style={{ color: COL.text2 }}>survival = TOOFAN_BASE_SURVIVAL + TOOFAN_PHENOTYPE_WEIGHT · fit</span>
        <span style={{ marginLeft: 10 }}>= {c.TOOFAN_BASE_SURVIVAL} + {c.TOOFAN_PHENOTYPE_WEIGHT}·fit</span>
      </div>
      <div style={{ marginTop: 6, fontStyle: 'italic', fontFamily: MONO, fontSize: 10, color: COL.dim }}>
        fit values illustrative — the actual mapping lives in sim.js
      </div>
    </div>
  );
}

// ── Toofan flavor chips ───────────────────────────────────────────
const FLAVOR_DETAIL = {
  flood: { color: 'flood', note: 'wet substrate; high-moisture phenotypes favored'   },
  fire:  { color: 'fire',  note: 'dry sweep; decay_resistance + cap_shape help'      },
  frost: { color: 'frost', note: 'cold snap; small/round caps weather best'          },
  wind:  { color: 'wind',  note: 'gust; long stems and large caps are blown away'    },
};

function FlavorChips({ flavors }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
      {(flavors || []).map(f => {
        const d = FLAVOR_DETAIL[f] || { color: 'ember', note: '' };
        const ac = COL[d.color] || COL.ember;
        return (
          <div key={f} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: COL.ink, border: `1px solid ${COL.faint}`,
            borderLeft: `3px solid ${ac}`,
            padding: '8px 12px',
          }}>
            <div style={{ width: 10, height: 10, background: ac, marginTop: 4 }} />
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: COL.textHi, lineHeight: 1 }}>{f}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: COL.text2, marginTop: 3, lineHeight: 1.4 }}>{d.note}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────
function EngineApp() {
  const [spec, setSpec] = useState(null);
  const [err,  setErr]  = useState(null);
  useEffect(() => {
    fetch('/api/engine-spec')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setSpec)
      .catch(e => setErr(e.message));
  }, []);

  if (err) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageWallpaper />
        <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 12 }}>error: {err}</span>
      </div>
    );
  }
  if (!spec) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageWallpaper />
        <span style={{ fontFamily: MONO, color: COL.dim, fontSize: 12 }}>awakening…</span>
      </div>
    );
  }

  const c = spec.constants;
  const w = spec.world;

  return (
    <div style={{ minHeight: '100dvh', padding: '32px 16px 80px' }}>
      <PageWallpaper />
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Page header (no panel — sits on wallpaper) */}
        <div style={{ padding: '0 6px 14px', marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, color: COL.ember, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>
            home-server · shroom · engine
          </div>
          <div style={{ fontFamily: SERIF, color: COL.textHi, fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
            how this shroom works
          </div>
          <div style={{ fontFamily: SERIF_RUN, color: COL.text2, fontSize: 16, lineHeight: 1.45, fontStyle: 'italic', maxWidth: 740 }}>
            A field guide to the simulation that powers <a href="/" style={{ color: COL.emberHi, textDecoration: 'none', borderBottom: `1px dotted ${COL.emberHi}` }}>the live page at /</a>.
            Mycelium grows on a {w.W}×{w.H} grid, absorbs nutrients into a reserves pool, spends them to extend and to fruit, drifts spores, decays, and once a sim-year weathers a toofan. Numbers come straight from sim.js.
          </div>
        </div>

        {/* 01 — Tick pipeline */}
        <Section seed={7} num="01" kicker="every tick" glyph="tick" accent={COL.hypha}
          title="the tick pipeline"
          sub="Every tick runs the same seven stages, in this order. Clock advances first so everyone sees the new season and weather; toofan-roll is last so a destroyed colony still got its turn to grow and fruit beforehand.">
          <TickPipeline />
        </Section>

        {/* 02 — Substrate */}
        <Section seed={11} num="02" kicker="terrain" glyph="substrate" accent={COL.ember}
          title="substrate & terrain"
          sub="A flat 320×180 grid. Air on top, a one-row grass line, soil below. The initial log capsule rests on the grass. Deep nutrient pockets are scattered into the lower half of the soil band so mycelium has a reason to tunnel down.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 24, alignItems: 'start' }}>
            <TerrainDiagram world={w} />
            <KV accent={COL.emberHi} rows={[
              ['grid',         `${w.W} × ${w.H}`,                'cells, indexed y · W + x'],
              ['grass row',    w.GRASS_Y,                         'one-cell bridge between log & soil'],
              ['log',          'oak, 72–96 × 16–22',             'capsule: rect core + rounded caps'],
              ['pockets',      '5–7 of radius 8–13',              'placed 55–95% down the soil band'],
              ['base soil',    'nutrient 22–29',                  'lean, flat — variation lives in pockets'],
              ['log nutrient', '70–95',                            'lowered by knot/dry zones, lifted by wet'],
              ['NUTRIENT_MAX', c.NUTRIENT_MAX,                    'soft cap for all generators'],
            ]} />
          </div>
        </Section>

        {/* 03 — Hyphae economy */}
        <Section seed={15} num="03" kicker="reserves" glyph="hyphae" accent={COL.emberHi}
          title="the hyphae economy"
          sub="Colonies keep a reserves pool. Everything — extending a new cell, pushing a new fruit — is paid from reserves. Reserves only fill from absorption. This bottleneck is what prevents the old 'eat a few cells, fruit forever' degenerate strategy.">

          <ReservesFlow c={c} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 8 }}>
            <div>
              <Subhead accent={COL.hyphaHi}>absorb · into reserves</Subhead>
              <KV accent={COL.hyphaHi} rows={[
                ['NUTRIENT_CONSUMPTION',   c.NUTRIENT_CONSUMPTION,   'per hypha cell per tick'],
                ['SIDE_ABSORPTION',        c.SIDE_ABSORPTION,        'extra draw per adjacent substrate cell'],
                ['SIDE_ABSORPTION_FLOOR',  c.SIDE_ABSORPTION_FLOOR,  'won’t drain neighbors below this'],
                ['DECAY_DEPOSIT',          c.DECAY_DEPOSIT,          'returned to substrate on death'],
                ['DECAY_NEIGHBOR_DEPOSIT', c.DECAY_NEIGHBOR_DEPOSIT, 'spread to the 4 neighbors on death'],
              ]} />

              <Subhead accent={COL.hypha}>extend · out of reserves</Subhead>
              <KV accent={COL.hyphaHi} rows={[
                ['EXTEND_COST',     c.EXTEND_COST,     'reserves drained per new cell'],
                ['THICKNESS_MAX',   c.THICKNESS_MAX,   'box-radius cells can fatten to'],
                ['HYPHA_AGE_LIMIT', c.HYPHA_AGE_LIMIT, 'ticks before turnover-eligible'],
              ]} />

              <Subhead accent={COL.cool}>die · per-tick risks</Subhead>
              <KV accent={COL.cool} rows={[
                ['HYPHA_DEATH_THRESHOLD', c.HYPHA_DEATH_THRESHOLD, 'starve below this nutrient sum'],
                ['STARVATION_DIE_RISK',   c.STARVATION_DIE_RISK,   'while under threshold'],
                ['TURNOVER_DIE_RISK',     c.TURNOVER_DIE_RISK,     'past HYPHA_AGE_LIMIT'],
                ['OLD_AGE_DIE_RISK_MAX',  c.OLD_AGE_DIE_RISK_MAX,  `peak at age ${c.COLONY_OLD_AGE_DAYS}d`],
                ['BLIGHT_DIE_RISK',       c.BLIGHT_DIE_RISK,       'when Nigehban blights'],
              ]} />
            </div>
            <div>
              <Subhead accent={COL.ember}>fruit · out of reserves</Subhead>
              <KV accent={COL.emberHi} rows={[
                ['FRUIT_BASE_RATE',          c.FRUIT_BASE_RATE,           'per-tip roll, before gates'],
                ['FRUIT_COST',               c.FRUIT_COST,                'drained for the first fruit'],
                ['FRUIT_COST_FLOOR',         c.FRUIT_COST_FLOOR,          'cheapest a mature colony gets'],
                ['FRUIT_DISCOUNT_PER_FRUIT', c.FRUIT_DISCOUNT_PER_FRUIT,  'multiplicative per past fruit'],
                ['FRUIT_MATURE_TICKS',       c.FRUIT_MATURE_TICKS,        'emergence → spore release'],
                ['log mult',                 c.FRUIT_SUBSTRATE_MULT_LOG,  'rate factor on log'],
                ['grass mult',               c.FRUIT_SUBSTRATE_MULT_GRASS,'rate factor on grass'],
                ['soil mult',                c.FRUIT_SUBSTRATE_MULT_SOIL, 'rate factor on soil'],
              ]} />
              <FruitLadder c={c} />
            </div>
          </div>
        </Section>

        {/* 04 — In practice */}
        <Section seed={17} num="04" kicker="worked examples" glyph="hyphae" accent={COL.hyphaTip}
          title="in practice"
          sub="The same economy seen as scenarios — what the numbers feel like from inside a colony.">

          <Subhead accent={COL.hyphaHi}>a first sim-day · single tip on log</Subhead>
          <FirstDayLedger c={c} />

          <div style={{ marginTop: 24 }}>
            <Subhead accent={COL.ember}>fruit decisions · three colonies, same tick</Subhead>
            <FruitDecisions c={c} />
          </div>

          <div style={{ marginTop: 24 }}>
            <Subhead accent={COL.danger}>a toofan roll · one phenotype, all four flavors</Subhead>
            <ToofanRoll c={c} />
          </div>
        </Section>

        {/* 05 — Genome */}
        <Section seed={19} num="05" kicker="ten floats" glyph="genome" accent={COL.cool}
          title="the genome"
          sub="Ten floats per colony. Spores carry a mutated copy of the parent's genome. Mutation is substitution-only with scale-proportional perturbation — no swapping, no crossover.">
          <GenomeTable genes={spec.genome} />
        </Section>

        {/* 05 — Toofan */}
        <Section seed={23} num="06" kicker="annual event" glyph="toofan" accent={COL.danger}
          title="the toofan"
          sub="Once per simulated year, on a Poisson roll, the world picks a flavor and every colony rolls survival — weighted by how well its phenotype matches the flavor. No warning. No buildup. No pressure meter.">
          <KV accent={COL.danger} rows={[
            ['TOOFAN_DAILY_PROB',       c.TOOFAN_DAILY_PROB.toFixed(5),    `mean one event per ${Math.round(1 / c.TOOFAN_DAILY_PROB)} sim-days`],
            ['TOOFAN_BASE_SURVIVAL',    c.TOOFAN_BASE_SURVIVAL,            'floor for an unsuited phenotype'],
            ['TOOFAN_PHENOTYPE_WEIGHT', c.TOOFAN_PHENOTYPE_WEIGHT,         'how much fit lifts above the floor'],
          ]} />
          <div style={{ marginTop: 14 }}>
            <Subhead accent={COL.danger}>flavors · one per event, sampled uniformly</Subhead>
            <FlavorChips flavors={c.TOOFAN_FLAVORS} />
          </div>
          <Aside accent={COL.danger}>
            Why one a year? Earlier builds tied toofan to consumption pressure — the colony ate the log so fast the pressure meter pinned at 88% within a sim-day. The Poisson rewrite decouples it from substrate state entirely. Time is the only clock.
          </Aside>
        </Section>

        {/* 06 — Nigehban */}
        <Section seed={27} num="07" kicker="the narrator" glyph="nigehban" accent={COL.glow}
          title="nigehban"
          sub="A Claude-backed pass that wakes once a sim-day, reads the recent events, and writes a journal entry for the Chronicle. Bestows real names on standout colonies; otherwise they keep their placeholder name (Wigglecap, Bramblewort, etc.) until they earn one — or die.">
          <KV accent={COL.glow} rows={[
            ['wake cadence', 'once per sim-day',           'capped by NIGEHBAN_DAILY_CAP env'],
            ['inputs',       'last events + colony stats', 'see lib/nigehban.js'],
            ['can bestow',   'name · blight · sparing',    'persisted on the colony record'],
            ['hall',         'durable colony obits',       'written on death, kept forever'],
          ]} />
        </Section>

        <div style={{ textAlign: 'center', marginTop: 24, fontFamily: MONO, fontSize: 10, color: COL.dim }}>
          all numbers above are read live from <span style={{ color: COL.text2 }}>/api/engine-spec</span>.
        </div>

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('engine-root')).render(<EngineApp />);
