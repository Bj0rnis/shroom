# Shroom design kit

Seven layered files. Each layer depends only on those above it.

```
tokens.jsx      palette · fonts · RNG · no React
motifs.jsx      pixel SVG glyphs (SectionGlyph, StageGlyph)
atmosphere.jsx  canvas buffer (PB) · surface painters · PixelStage · PageWallpaper
primitives.jsx  DarkPanel · Section · KV · Subhead · Aside · Stat
overlays.jsx    Hall of Fame · DevDashboard
shell.jsx       StatusLeft · StatusRight
charts.jsx      TickPipeline · TerrainDiagram · FruitLadder · ReservesFlow ·
                GenomeTable · FirstDayLedger · FruitDecisions · ToofanRoll · FlavorChips
```

Load them in that order in any HTML that needs them. Consumer pages (`/`, `/engine`) are
compositions of kit exports — they should not re-define surfaces or layout primitives.

---

## Rules

**Compose, don't recreate.** If a component already exists in the kit, use it.
Never inline a `<div style="background: #0a0908 …">` where `DarkPanel` or `paintDark` fits.

**Read tokens, never hardcode.** All colors come from `window.SHROOM_TOKENS.COL` (hex CSS)
or `window.PIX.C` (RGB canvas arrays). No magic hex strings in new code.

**One density tier (`calm`).** Components accept a `density` prop placeholder but only
`calm` is implemented. Don't wire density switches until a TweaksPanel exists.

**No emojis.** Decoration comes from `SectionGlyph` / `StageGlyph` (motifs.jsx) or hand-
drawn pixel stages on canvas. Never emoji in UI chrome.

**Pixel rendering.** Anything sub-12 px in canvas space: `shapeRendering="crispEdges"`,
integer coordinates, no anti-aliasing. Use `PixelStage` / `PixelStageAnim` for all canvas
output — never manage a `<canvas>` ref directly in a consumer component.

**New components live in kit first.** Build it in `kit/`, demo it on `/preview` once that
exists, then consume it from pages. This prevents one-off inline components from
accumulating again.

---

## Window exports

| Global | Module | Notes |
|---|---|---|
| `window.SHROOM_TOKENS` | tokens | `{ C, F57, F35, rgba, mulberry, MONO, SERIF, SERIF_RUN, SERIF_BODY, SANS, COL }` |
| `window.SectionGlyph` | motifs | 7 kinds: hero · tick · substrate · hyphae · genome · toofan · nigehban |
| `window.StageGlyph` | motifs | 7 kinds: clock · grow · fruit · spores · germinate · decay · toofan-roll |
| `window.PIX` | atmosphere | `{ C, F57, F35, PB, PixelStage, PixelStageAnim, paintDark, paintParchment, paintWood, panel, mulberry, rgba }` |
| `window.PageWallpaper` | atmosphere | full-screen dark pixel noise, fixed behind page |
| `window.DarkPanel` | primitives | dark surface + 1px border + corner notch, fills container |
| `window.Section` | primitives | engine-page section: DarkPanel + accent stripe + glyph + title |
| `window.KV` | primitives | key/value grid, 3-col layout |
| `window.Subhead` | primitives | square bullet + serif label |
| `window.Aside` | primitives | italic pull-quote with left border |
| `window.Stat` | primitives | inline `label value` chip |
| `window.HallTrigger` | overlays | slim button opening HallModal |
| `window.HallModal` | overlays | grid of inscribed colonies |
| `window.HallDetail` | overlays | single colony detail overlay |
| `window.DevDashboard` | overlays | dev tools panel (speed · toofan · sow · reset) |
| `window.DevDashboardTrigger` | overlays | labeled chip — gear + "dev" + ⌘. hotkey |
| `window.NavLinkTrigger` | overlays | labeled chip wrapper: 9×9 glyph + mono label, hover-ember, `<a href>` |
| `window.EnginePageTrigger` | overlays | labeled chip → `/engine` |
| `window.LabPageTrigger` | overlays | labeled chip → `/lab` |
| `window.ResearchPageTrigger` | overlays | labeled chip → `/research` |
| `window.StatusLeft` | shell | vol / era / day strip; optional `nav` prop renders a second row of nav chips |
| `window.StatusRight` | shell | season / vitals / pressure bar |
| `window.TickPipeline` | charts | 7-stage flowchart |
| `window.TerrainDiagram` | charts | SVG terrain cross-section |
| `window.FruitLadder` | charts | cost-per-fruit bar chart |
| `window.ReservesFlow` | charts | reserves in/out flow SVG |
| `window.GenomeTable` | charts | 10-gene table with bucket colors |
| `window.FirstDayLedger` | charts | illustrative tick-by-tick ledger |
| `window.FruitDecisions` | charts | three-colony decision example |
| `window.ToofanRoll` | charts | survival-by-phenotype bar grid |
| `window.FlavorChips` | charts | toofan flavor card grid |
