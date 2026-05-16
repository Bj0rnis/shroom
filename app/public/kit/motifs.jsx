// Shroom — kit · motifs
// Pixel-art inline SVG glyphs: SectionGlyph (7 kinds), StageGlyph (7 kinds).
// Depends on: tokens (window.SHROOM_TOKENS).

(function () {

const { COL } = window.SHROOM_TOKENS;

// ── Section badge glyphs (22×22 display, 11×11 source) ───────────────────
function SectionGlyph({ kind, color }) {
  const c = color || COL.ember;
  switch (kind) {
    case 'hero':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
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
          <circle cx="5.5" cy="5.5" r="4" fill="none" stroke={COL.faint} />
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
          <polygon points="6,1 3,6 5,6 4,10 8,5 6,5 7,1" fill={c} />
        </svg>
      );
    case 'nigehban':
      return (
        <svg width="22" height="22" viewBox="0 0 11 11" shapeRendering="crispEdges">
          <rect x="2" y="2" width="7" height="6" fill={COL.faint} />
          <rect x="3" y="3" width="5" height="1" fill={c} />
          <rect x="3" y="5" width="4" height="1" fill={c} />
          <rect x="3" y="7" width="5" height="1" fill={c} />
        </svg>
      );
    default: return null;
  }
}

// ── Tick-pipeline stage glyphs (12×12 display, 7×7 source) ───────────────
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

window.SectionGlyph = SectionGlyph;
window.StageGlyph   = StageGlyph;

})();
