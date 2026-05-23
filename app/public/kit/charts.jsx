// Shroom — kit · charts
// Data-visualisation components: TickPipeline, TerrainDiagram, FruitLadder,
// ReservesFlow, GenomeTable, FirstDayLedger, FruitDecisions, ToofanRoll,
// FlavorChips.
// Depends on: tokens, motifs (window.SHROOM_TOKENS, window.StageGlyph).

(function () {

const { MONO, SERIF, SERIF_RUN, COL } = window.SHROOM_TOKENS;
// StageGlyph is set by motifs.jsx which loads before charts.jsx.
const StageGlyph = window.StageGlyph;

// ── Tick pipeline ─────────────────────────────────────────────────────────
const TICK_STAGES = [
  { k: 'clock',       d: 'advance tick, roll season, drift weather',                color: 'textHi' },
  { k: 'trees',       d: 'saplings rise · grow · mature · fall into logs',          color: 'grass' },
  { k: 'substrate',   d: 'log nutrient regen · empty log cells crumble to soil',    color: 'soil' },
  { k: 'grow',        d: 'absorb · extend (costs reserves) · thicken',              color: 'hypha' },
  { k: 'fruit',       d: 'mature stalks · roll new fruit (cost declines per fruit)',color: 'ember' },
  { k: 'spores',      d: 'drift caps · age out · release at maturity',              color: 'hyphaTip' },
  { k: 'germinate',   d: 'low-probability sow on viable substrate',                 color: 'hyphaHi' },
  { k: 'decay',       d: 'starved/aged cells die · deposit nutrients back',         color: 'dim' },
  { k: 'toofan-roll', d: 'Poisson 1/sim-year · flavor · phenotype-weighted survival', color: 'danger' },
];

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
            <rect x={x} y={y} width={cellW} height={cellH} fill="#15110d" stroke={COL.faint} />
            <rect x={x} y={y} width={cellW} height={3} fill={acc} />
            <g transform={`translate(${x + 12}, ${y + 14})`}>
              <StageGlyph k={s.k} color={acc} />
            </g>
            <text x={x + 32} y={y + 24} fill={COL.dim} fontFamily={MONO} fontSize="10" letterSpacing="0.1em">
              {String(i + 1).padStart(2, '0')}
            </text>
            <text x={x + 32} y={y + 40} fill={COL.textHi} fontFamily={SERIF} fontSize="18">
              {s.k}
            </text>
            <foreignObject x={x + 12} y={y + 48} width={cellW - 24} height={cellH - 50}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                fontFamily: MONO, fontSize: 10, color: COL.text2, lineHeight: 1.4,
              }}>{s.d}</div>
            </foreignObject>
          </g>
        );
      })}
      {/* arrows between stages */}
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

// ── Terrain diagram ───────────────────────────────────────────────────────
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
      <circle cx={logX + logW * 0.62} cy={logY + r} r="4" fill="#3a2410" />
      <text x="6" y="14" fontFamily={MONO} fontSize="10" fill={COL.dim}>AIR</text>
      <text x="6" y={grassY - 4} fontFamily={MONO} fontSize="10" fill={COL.grass}>GRASS · row {world.GRASS_Y}</text>
      <text x="6" y={grassY + 14} fontFamily={MONO} fontSize="10" fill={COL.dim}>SOIL · {world.W}×{world.H}</text>
      <text x={logX + 10} y={logY + 19} fontFamily={SERIF} fontSize="13" fill={COL.textHi}>LOG</text>
      <text x={pockets[1].cx + 28} y={pockets[1].cy + 4} fontFamily={MONO} fontSize="10" fill={COL.hyphaHi}>← nutrient pockets</text>
    </svg>
  );
}

// ── Fruit cost ladder ─────────────────────────────────────────────────────
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

// ── Reserves flow diagram ─────────────────────────────────────────────────
function ReservesFlow({ c }) {
  return (
    <svg viewBox="0 0 320 70" width="100%" style={{ display: 'block', maxWidth: 400, marginBottom: 12 }} shapeRendering="crispEdges">
      <rect x="0" y="42" width="80" height="20" fill={COL.soil} stroke={COL.faint} />
      <text x="40" y="35" fontFamily={MONO} fontSize="9" fill={COL.dim} textAnchor="middle">SUBSTRATE</text>
      <text x="40" y="56" fontFamily={MONO} fontSize="10" fill={COL.text} textAnchor="middle">nutrient</text>
      <line x1="80" y1="52" x2="118" y2="52" stroke={COL.hyphaHi} />
      <polygon points="118,48 124,52 118,56" fill={COL.hyphaHi} />
      <text x="100" y="45" fontFamily={MONO} fontSize="9" fill={COL.hyphaHi} textAnchor="middle">+{c.NUTRIENT_CONSUMPTION + c.SIDE_ABSORPTION}</text>
      <rect x="124" y="42" width="80" height="20" fill={COL.ink} stroke={COL.emberHi} />
      <text x="164" y="35" fontFamily={MONO} fontSize="9" fill={COL.emberHi} textAnchor="middle">RESERVES</text>
      <text x="164" y="56" fontFamily={MONO} fontSize="10" fill={COL.emberHi} textAnchor="middle">pool</text>
      <line x1="204" y1="46" x2="240" y2="20" stroke={COL.emberLo} />
      <polygon points="240,16 246,20 238,24" fill={COL.emberLo} />
      <text x="252" y="20" fontFamily={MONO} fontSize="9" fill={COL.emberLo}>extend -{c.EXTEND_COST}</text>
      <line x1="204" y1="58" x2="240" y2="58" stroke={COL.ember} />
      <polygon points="240,54 246,58 240,62" fill={COL.ember} />
      <text x="252" y="61" fontFamily={MONO} fontSize="9" fill={COL.ember}>fruit -{c.FRUIT_COST}</text>
    </svg>
  );
}

// ── Genome table ──────────────────────────────────────────────────────────
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

// ── First day ledger ──────────────────────────────────────────────────────
function FirstDayLedger({ c }) {
  const perCell = c.NUTRIENT_CONSUMPTION + 4 * c.SIDE_ABSORPTION;
  const rows = [
    { t: 0,   cells: 1,  res: 0,                 ev: 'sown — single tip on log' },
    { t: 1,   cells: 1,  res: perCell,            ev: `+${perCell} absorb (self + 4 side)` },
    { t: 2,   cells: 1,  res: perCell * 2,        ev: `+${perCell} absorb` },
    { t: 3,   cells: 2,  res: perCell * 2 - c.EXTEND_COST + perCell * 2,
                                                   ev: `extend -${c.EXTEND_COST} · then +${perCell * 2}` },
    { t: 4,   cells: 3,  res: 'rising',           ev: 'second extend · absorbs grow with cells' },
    { t: 50,  cells: 18, res: 'plateau',          ev: 'extension keeps pace with absorption' },
    { t: 120, cells: 24, res: c.FRUIT_COST,       ev: `first fruit eligible — cost ${c.FRUIT_COST}` },
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

// ── Fruit decisions ───────────────────────────────────────────────────────
function FruitDecisions({ c }) {
  const cost = n => Math.max(c.FRUIT_COST_FLOOR, Math.floor(c.FRUIT_COST * Math.pow(c.FRUIT_DISCOUNT_PER_FRUIT, n)));
  const colonies = [
    { name: 'Pale Bell',       cells: 5,  fruits: 0, res: 487, glyph: '◯' },
    { name: 'Wormwood Throne', cells: 40, fruits: 4, res: 280, glyph: '◉' },
    { name: 'Bone Saint',      cells: 82, fruits: 7, res: 612, glyph: '◍' },
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
              background: COL.ink,
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

// ── Toofan roll ───────────────────────────────────────────────────────────
function ToofanRoll({ c }) {
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

// ── Flavor chips ──────────────────────────────────────────────────────────
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

// ── Cycle diagram ─────────────────────────────────────────────────────────
// Two loops that keep the world running. Each ring renders six labelled
// nodes around a circle with arrowed arcs between them. Visual register
// matches TickPipeline (mono labels, pixel-aligned, accent stripe).
function CycleDiagram() {
  const loops = [
    {
      title: 'spore cycle',
      caption: 'a colony, carried forward',
      accent: 'hyphaTip',
      nodes: ['spore', 'germinate', 'colony', 'fruit', 'release', 'drift'],
    },
    {
      title: 'substrate cycle',
      caption: 'a stage, replaced',
      accent: 'ember',
      nodes: ['sapling', 'tree', 'fall', 'log', 'consumed', 'soil'],
    },
  ];
  const W = 880, ringW = 380, ringH = 300;
  const cx = ringW / 2, cy = ringH / 2 - 4, r = 92;

  function ring({ title, caption, accent, nodes }, dx) {
    const acc = COL[accent];
    return (
      <g transform={`translate(${dx}, 0)`} key={title}>
        <text x={cx} y="16" textAnchor="middle"
          fontFamily={MONO} fontSize="10" fill={COL.dim}
          letterSpacing="0.2em">{title.toUpperCase()}</text>
        <text x={cx} y={ringH - 6} textAnchor="middle"
          fontFamily={SERIF} fontSize="13" fill={COL.text2} fontStyle="italic">
          {caption}
        </text>
        {/* Faint guide ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={COL.faint} strokeDasharray="2 3" />
        {nodes.map((n, i) => {
          const t  = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const tN = ((i + 1) / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const x  = cx + r * Math.cos(t),  y  = cy + r * Math.sin(t);
          const xN = cx + r * Math.cos(tN), yN = cy + r * Math.sin(tN);
          // Pull-back endpoints so arcs don't overlap node dots.
          const pull = 12;
          const ax = (x + xN) / 2,  ay = (y + yN) / 2;
          const vx = xN - x, vy = yN - y, vL = Math.hypot(vx, vy) || 1;
          const x1 = x  + (vx / vL) * pull;
          const y1 = y  + (vy / vL) * pull;
          const x2 = xN - (vx / vL) * pull;
          const y2 = yN - (vy / vL) * pull;
          // Arrowhead at the tail (x2,y2), pointed along (vx,vy).
          const ang = Math.atan2(vy, vx);
          const ah = 5;
          const ahx = x2, ahy = y2;
          const ah1x = ahx - ah * Math.cos(ang - 0.5);
          const ah1y = ahy - ah * Math.sin(ang - 0.5);
          const ah2x = ahx - ah * Math.cos(ang + 0.5);
          const ah2y = ahy - ah * Math.sin(ang + 0.5);
          // Label placement — push outside the ring radially.
          const lx = cx + (r + 22) * Math.cos(t);
          const ly = cy + (r + 22) * Math.sin(t);
          const anchor = Math.cos(t) > 0.3 ? 'start' : Math.cos(t) < -0.3 ? 'end' : 'middle';
          return (
            <g key={n}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={acc} strokeWidth="1" />
              <polygon points={`${ahx},${ahy} ${ah1x},${ah1y} ${ah2x},${ah2y}`} fill={acc} />
              <rect x={x - 3} y={y - 3} width="6" height="6" fill={acc} />
              <text x={lx} y={ly + 3} textAnchor={anchor}
                fontFamily={MONO} fontSize="10" fill={COL.textHi}>{n}</text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${ringH}`} width="100%" style={{ display: 'block', maxWidth: 880, marginBottom: 6 }}>
      {ring(loops[0], 60)}
      {ring(loops[1], 60 + ringW + 20)}
    </svg>
  );
}

window.TickPipeline    = TickPipeline;
window.TerrainDiagram  = TerrainDiagram;
window.FruitLadder     = FruitLadder;
window.ReservesFlow    = ReservesFlow;
window.GenomeTable     = GenomeTable;
window.FirstDayLedger  = FirstDayLedger;
window.FruitDecisions  = FruitDecisions;
window.ToofanRoll      = ToofanRoll;
window.FlavorChips     = FlavorChips;
window.CycleDiagram    = CycleDiagram;

})();
